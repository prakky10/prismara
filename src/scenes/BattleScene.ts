/**
 * The battle scene.
 *
 * It owns no rules: it builds a `BattleState`, asks the player what to do, and
 * plays the resulting event stream as animation. That split is what lets the
 * engine be unit-tested while the fight still looks cinematic — camera punch-ins,
 * hit-stop, screen shake, elemental particle storms and a dissolve on faint.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { buildBattle, maximizeMovesForLevel, partyForTrainer } from '../world/battleSetup';
import {
  BattleState,
  displayName,
  expProgress,
  getMove,
  hpFraction,
  isFainted,
  maxHp,
  speciesOf,
  type BattleAction,
  type BattleEvent,
  type CreatureInstance,
} from '../battle';
import { resolveLearnMove } from '../battle/TurnResolver';
import { applyTrainerVictory, consumeBattleItem } from '../world/battleResults';
import { HPBar } from '../ui/HPBar';
import { Panel } from '../ui/Panel';
import { MenuList, type MenuItem } from '../ui/MenuList';
import { TextBox } from '../ui/TextBox';
import { banner, damageNumber, toast, xpPopup } from '../ui/Popups';
import { ELEMENT_INFO, effectivenessLabel } from '../data/types';
import { CreatureRig } from '../render/CreatureRig';
import { Battle3D } from '../render/three/Battle3D';
import { playMoveVfx, typeWipe } from '../render/vfx/MoveVfx';
import { statusColor } from '../ui/Theme';
import { ITEMS, type ItemId } from '../data/items';
import { STATUS_INFO, WEATHERS, type Side } from '../data/battleTypes';
import type { AITier } from '../battle/BattleState';

type MenuMode = 'none' | 'action' | 'moves' | 'party' | 'bag' | 'learn';

/** Where each side's creature stands. The platforms are drawn at these points. */
const PLAYER_STAGE = { x: 200, y: 400 };
const ENEMY_STAGE = { x: 720, y: 250 };

interface UiPanel {
  panel: Panel;
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  hp: HPBar;
  status: Phaser.GameObjects.Text;
  statusIcon: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private controls!: InputManager;
  private battle!: BattleState;
  private stage3d?: Battle3D;
  private biome = 'meadow';

  private playerRig!: CreatureRig;
  private enemyRig!: CreatureRig;
  private playerUi!: UiPanel;
  private enemyUi!: UiPanel;
  private weatherText!: Phaser.GameObjects.Text;
  private textbox!: TextBox;
  private menu!: MenuList;
  private menuBox!: Panel;
  private menuMode: MenuMode = 'none';
  private resolver: ((value: BattleAction) => void) | null = null;
  private learnResolver: ((index: number) => void) | null = null;
  private messageResolver: (() => void) | null = null;
  private messageTimer?: Phaser.Time.TimerEvent;
  private lastOrbId: ItemId | null = null;

  constructor() {
    super(SCENES.battle);
  }

  create(): void {
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // Reset every field a previous battle may have left behind so a second
    // battle never inherits a stale resolver, menu, message or background.
    this.menuMode = 'none';
    this.resolver = null;
    this.learnResolver = null;
    this.messageResolver = null;
    this.messageTimer = undefined;
    this.pendingSwitchOnly = false;
    this.pendingLearn = null;
    this.lastOrbId = null;
    this.stage3d = undefined;
    this.forcedSwitchResolver = null;
    this.displayedUid = { player: null, enemy: null };

    const request = Game.pendingBattle;
    if (!request) {
      // Nothing to fight: bail back to wherever we came from.
      this.finishToOverworld();
      return;
    }

    // Hide the paused overworld (its Phaser HUD and World3D) so only the battle
    // arena shows; the battle's own Phaser UI still draws on the canvas. The
    // one-shot listener restores it the moment this scene shuts down, so the
    // normal resume path is untouched. Skipped entirely on the early bail above.
    const overworld = this.scene.get(SCENES.overworld);
    if (overworld) {
      overworld.sys.setVisible(false);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        overworld.sys.setVisible(true);
      });
    }

    this.biome = this.biomeForRequest(request);
    this.buildArena();
    this.buildBattle(request);
    this.buildUi();

    Audio.playMusic(
      request.kind === 'trainer'
        ? request.trainer.isChampion
          ? 'battle-legendary'
          : 'battle-trainer'
        : 'battle-wild',
    );

    void this.runBattle();
  }

  private biomeForRequest(request: NonNullable<typeof Game.pendingBattle>): string {
    const mapId = Game.state.position.mapId;
    const zones: Record<string, string> = {
      'emberleaf-town': 'meadow',
      'route-1': 'meadow',
      'whisperwood-forest': 'forest',
      thistlebrook: 'forest',
      'route-2': 'city',
      'voltspire-city': 'city',
      'route-3': 'beach',
      tidehaven: 'beach',
      'route-4': 'beach',
      'ashfall-town': 'volcano',
      'cinder-peak': 'volcano',
      'route-5': 'volcano',
      'route-6': 'ruins',
      'geode-hollow': 'cave',
      'glimmer-caverns': 'cave',
      'route-7': 'forest',
      'duskmoor-ruins': 'ruins',
      'prism-summit': 'summit',
    };
    void request;
    return zones[mapId] ?? 'meadow';
  }

  /* ------------------------------------------------------------ setup -- */

  private buildArena(): void {
    this.stage3d = new Battle3D(this, this.biome);
  }

  private buildBattle(request: NonNullable<typeof Game.pendingBattle>): void {
    const state = Game.state;
    const playerParty = state.party.filter((c) => !isFainted(c));
    const usable = playerParty.length > 0 ? playerParty : state.party;

    let enemyParty: CreatureInstance[];
    const isWild = request.kind === 'wild';
    let aiTier: AITier = 'youngster';
    let moneyReward = 0;
    let enemyTrainerName: string | undefined;

    if (request.kind === 'wild') {
      enemyParty = [
        Game.pendingWildCreature ?? Game.createWild(request.speciesId, request.level, request.shiny),
      ];
      aiTier = 'youngster';
      // Mark it seen in the Dex.
      state.markSeen(request.speciesId, request.shiny, state.position.mapId);
    } else {
      enemyParty = partyForTrainer(request.trainer, state.playerName, request.party);
      aiTier = request.trainer.tier;
      moneyReward = request.trainer.purse;
      enemyTrainerName = request.trainerName;
    }

    // Music for a legendary wild encounter.
    if (request.kind === 'wild') {
      const species = speciesOf(enemyParty[0]);
      if (species.tier === 'legendary' || species.tier === 'mythical') {
        Audio.playMusic('battle-legendary');
      }
    }

    this.battle = buildBattle({
      state,
      clock: state.clock,
      playerParty: usable,
      enemyParty,
      isWild,
      aiTier,
      moneyReward,
      mapIsCave: this.biome === 'cave',
      enemyTrainerName,
    });
  }

  private buildUi(): void {
    const state = this.battle;

    // Enemy panel top-left, player panel on the right above the text box:
    // the classic four-corner layout, arranged so nothing overlaps.
    this.enemyUi = this.makePanel(60, 40, 330, 74, 'enemy');
    this.playerUi = this.makePanel(VIEW_WIDTH - 400, 300, 340, 84, 'player');

    this.weatherText = this.add
      .text(VIEW_WIDTH - 16, 14, '', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#dce6f7',
        backgroundColor: 'rgba(5,7,15,0.5)',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(DEPTHS.ui);

    // The text box sits bottom-left and the action menu bottom-right, so both
    // can be on screen at once without covering each other.
    this.textbox = new TextBox(this, { width: VIEW_WIDTH - 440 });
    this.textbox.setX(24 + (VIEW_WIDTH - 440) / 2);
    this.textbox.setDepth(DEPTHS.textbox);

    this.menuBox = new Panel(this, VIEW_WIDTH - 190, 421, {
      width: 330,
      height: 210,
      glow: COLORS.panelGlow,
    });
    this.menuBox.setDepth(DEPTHS.menu);
    this.menuBox.setVisible(false);

    this.menu = new MenuList(this, VIEW_WIDTH - 320, 404, {
      items: [],
      width: 300,
      rowHeight: 28,
      fontSize: 15,
      columns: 2,
      onSelect: (value) => this.onMenuSelect(value),
      onHighlight: () => Audio.playSfx('cursor'),
    });
    this.menu.setDepth(DEPTHS.menu + 1);
    this.menu.setVisible(false);

    void state;
  }

  private makePanel(x: number, y: number, width: number, height: number, side: Side): UiPanel {
    const panel = new Panel(this, x + width / 2, y + height / 2, {
      width,
      height,
      glow: side === 'player' ? COLORS.panelGlow : COLORS.panelEdge,
    });
    panel.setDepth(DEPTHS.ui);

    const name = this.add
      .text(x + 16, y + 18, '', {
        fontFamily: FONTS.body,
        fontSize: '16px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 1);

    const level = this.add
      .text(x + width - 14, y + 18, '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#ffd60a',
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.ui + 1);

    const hp = new HPBar(this, x + width / 2 - 6, y + 46, {
      width: width - 40,
      height: 9,
      showXp: side === 'player',
    });
    hp.setDepth(DEPTHS.ui + 1);

    const statusIcon = this.add
      .text(x + 14, y + 46, '', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: '#ffd60a',
        backgroundColor: 'rgba(5,7,15,0.7)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 2);

    const status = this.add
      .text(x + 14, y + height - 10, '', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: '#9fb0cc',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 1);

    return { panel, name, level, hp, status, statusIcon };
  }

  private async buildRigs(side?: Side, uid?: string): Promise<void> {
    const player = side === 'player' && uid
      ? this.battle.player.party.find((c) => c.uid === uid) ?? this.battle.active('player')
      : this.battle.active('player');
    const enemy = side === 'enemy' && uid
      ? this.battle.enemy.party.find((c) => c.uid === uid) ?? this.battle.active('enemy')
      : this.battle.active('enemy');

    // Only rebuild the side whose displayed creature actually changed, so a
    // replacement is never fainted in place of the creature that just fainted.
    const needPlayer = side !== 'enemy' && this.displayedUid.player !== player.uid;
    const needEnemy = side !== 'player' && this.displayedUid.enemy !== enemy.uid;
    if (!needPlayer && !needEnemy) return;

    await CreatureRig.preloadMany(this, [
      ...(needPlayer ? [{ speciesId: player.speciesId, shiny: player.shiny }] : []),
      ...(needEnemy ? [{ speciesId: enemy.speciesId, shiny: enemy.shiny }] : []),
    ]);

    if (needPlayer) {
      this.playerRig?.destroy();
      this.playerRig = new CreatureRig(this, player.speciesId, {
        shiny: player.shiny,
        scale: 1.5,
        facing: -1,
        floating: speciesOf(player).body === 'floater',
      });
      this.playerRig.setPosition(PLAYER_STAGE.x, PLAYER_STAGE.y);
      this.playerRig.setDepth(DEPTHS.actors + 1);
      this.hideRigArt(this.playerRig);
      this.displayedUid.player = player.uid;
    }

    if (needEnemy) {
      this.enemyRig?.destroy();
      this.enemyRig = new CreatureRig(this, enemy.speciesId, {
        shiny: enemy.shiny,
        scale: 1.3,
        facing: 1,
        floating: speciesOf(enemy).body === 'floater',
      });
      this.enemyRig.setPosition(ENEMY_STAGE.x, ENEMY_STAGE.y);
      this.enemyRig.setDepth(DEPTHS.actors);
      this.hideRigArt(this.enemyRig);
      this.displayedUid.enemy = enemy.uid;
      if (enemy.shiny) {
        Audio.playSfx('shiny');
        toast(this, 'A shiny creature!', COLORS.gold, 2000);
      }
    }
  }

  private hideRigArt(rig: CreatureRig): void {
    rig.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Image) child.setVisible(false);
    });
  }

  private refreshPanels(): void {
    const player = this.battle.active('player');
    const enemy = this.battle.active('enemy');

    this.updatePanel(this.playerUi, player);
    this.updatePanel(this.enemyUi, enemy);

    const weather = WEATHERS[this.battle.weather.kind];
    this.weatherText.setText(
      this.battle.weather.kind === 'clear' ? '' : `${weather.name} (${this.battle.weather.turnsLeft || '\u221e'})`,
    );
    this.weatherText.setColor(`#${weather.color.toString(16).padStart(6, '0')}`);
  }

  private updatePanel(ui: UiPanel, creature: CreatureInstance): void {
    ui.name.setText(displayName(creature));
    ui.level.setText(`Lv ${creature.level}`);
    ui.hp.set(creature.currentHp, maxHp(creature), false);
    ui.hp.setXpVisible(true);
    ui.hp.setXp(expProgress(creature));

    const status = creature.status;
    ui.status.setText(
      status
        ? `${STATUS_INFO[status].name}${creature.status === 'sleep' ? ` (${creature.statusTurns})` : ''}`
        : '',
    );
    ui.status.setColor(status ? `#${statusColor(status).toString(16).padStart(6, '0')}` : '#9fb0cc');
    ui.statusIcon.setText(status ? STATUS_INFO[status].name.toUpperCase().slice(0, 4) : '');
    ui.statusIcon.setVisible(Boolean(status));
  }

  /* ------------------------------------------------------- the main loop -- */

  private async runBattle(): Promise<void> {
    this.refreshPanels();
    this.battle.start();
    await this.buildRigs();
    this.refreshPanels();

    await this.playEvents(this.battle.drainEvents());

    while (!this.battle.isOver) {
      if (this.battle.phase === 'awaiting-switch') {
        // A forced switch is not a turn: drain its events and loop again.
        await this.promptForcedSwitch();
        await this.playEvents(this.battle.drainEvents());
        this.refreshPanels();
        continue;
      }

      const action = await this.promptAction();
      if (!action) break;

      // Charge the bag before the turn resolves. An invalid action shows why
      // and re-prompts without advancing the turn.
      const consume = consumeBattleItem(Game.state, this.gameActionFor(action), this.battle.isWild);
      if (!consume.ok) {
        await this.showMessage(consume.reason ?? "That won't work.");
        continue;
      }

      const events = this.battle.takeTurn(action);
      await this.playEvents(events);
      this.refreshPanels();
    }

    await this.finish();
  }

  /** Remap an item action's battle-party index to the save's party index. */
  private gameActionFor(action: BattleAction): BattleAction {
    if (action.kind !== 'item') return action;
    const creature = this.battle.player.party[action.targetIndex];
    const targetIndex = creature
      ? Game.state.party.findIndex((c) => c.uid === creature.uid)
      : -1;
    return { ...action, targetIndex };
  }

  /* ---------------------------------------------------------- event play -- */

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      await this.playEvent(event);
    }
  }

  private async playEvent(event: BattleEvent): Promise<void> {
    switch (event.type) {
      case 'battle-start':
        await this.showMessage(
          event.isWild
            ? `A wild ${event.enemyName} appeared!`
            : `${event.enemyName} wants to battle!`,
        );
        break;

      case 'switch-in':
        // Rebuild only the side that changed as the replacement arrives.
        await this.buildRigs(event.side, event.uid);
        await this.showMessage(
          event.side === 'player' ? `Go, ${event.name}!` : `Foe ${event.name} was sent out!`,
        );
        if (event.side === 'player') this.playerRig?.playCelebrate();
        break;

      case 'switch-out':
        await this.showMessage(`${event.name}, come back!`);
        break;

      case 'move-used': {
        const rig = event.side === 'player' ? this.playerRig : this.enemyRig;
        const move = getMove(event.moveId);
        await this.showMessage(
          `${event.side === 'player' ? '' : 'Foe '}${displayName(
            this.battle.active(event.side),
          )} used ${event.moveName}!`,
          520,
          false,
        );
        rig?.playAttack();

        // The elemental VFX fires as the creature lunges, and the damage event
        // that follows lands right on the effect's impact frame.
        if (move && Game.settings.battleAnimations) {
          const other = this.battle.other(event.side);
          const handle = playMoveVfx(
            {
              scene: this,
              from: { x: this.rigX(event.side), y: this.rigY(event.side) - 40 },
              to: { x: this.rigX(other), y: this.rigY(other) - 30 },
              depth: DEPTHS.actors + 5,
              reduced: Game.settings.reducedEffects,
            },
            move.type,
          );
          await this.wait(Math.max(120, handle.impactAtMs));
        } else {
          await this.wait(160);
        }
        break;
      }

      case 'move-missed':
        await this.showMessage('But it missed!');
        damageNumber(
          this,
          this.rigX(this.battle.other(event.side)),
          this.rigY(this.battle.other(event.side)),
          0,
          { kind: 'miss' },
        );
        break;

      case 'move-protected':
        await this.showMessage('It protected itself!');
        break;

      case 'move-failed':
        await this.showMessage('But it failed!');
        break;

      case 'damage':
        await this.playDamage(event);
        break;

      case 'status-damage':
        await this.playIndirectDamage(event);
        break;

      case 'heal': {
        const ui = event.side === 'player' ? this.playerUi : this.enemyUi;
        ui.hp.set(event.hpRemaining, event.maxHp, true);
        damageNumber(this, this.rigX(event.side), this.rigY(event.side) - 40, event.amount, {
          kind: 'heal',
          reduced: Game.settings.reducedEffects,
        });
        Audio.playSfx('heal');
        await this.wait(260);
        break;
      }

      case 'recoil':
        await this.showMessage('It was hurt by recoil!', 700, false);
        break;

      case 'status-applied':
        await this.showMessage(
          `${event.side === 'player' ? '' : 'Foe '}${displayName(
            this.battle.active(event.side),
          )} was afflicted with ${STATUS_INFO[event.status].name}!`,
        );
        Audio.playSfx('status');
        toast(this, STATUS_INFO[event.status].name.toUpperCase(), STATUS_INFO[event.status].color);
        this.refreshPanels();
        break;

      case 'status-cured':
        await this.showMessage('It recovered!', 800, false);
        this.refreshPanels();
        break;

      case 'status-immune':
        await this.showMessage('It had no effect...', 800, false);
        break;

      case 'stat-change': {
        const amount = Math.abs(event.delta) >= 2 ? 'sharply ' : '';
        const verb = event.delta > 0 ? 'rose' : 'fell';
        await this.showMessage(
          `${event.side === 'player' ? '' : 'Foe '}${statLabel(event.stat)} ${amount}${verb}!`,
          800,
          false,
        );
        Audio.playSfx(event.delta > 0 ? 'statUp' : 'statDown');
        break;
      }

      case 'stat-change-failed':
        await this.showMessage('Nothing happened!', 700, false);
        break;

      case 'volatile-applied':
        if (event.volatile === 'soaked') await this.showMessage('It was soaked!', 800, false);
        break;

      case 'weather-set':
        await this.showMessage(WEATHERS[event.weather].description);
        this.refreshPanels();
        break;

      case 'weather-ended':
        await this.showMessage('The weather returned to normal.', 900, false);
        this.refreshPanels();
        break;

      case 'ability-triggered':
        await this.showMessage(`${event.abilityName} activated!`, 800, false);
        break;

      case 'faint': {
        const rig = event.side === 'player' ? this.playerRig : this.enemyRig;
        const fallen =
          this.battle.party(event.side).find((c) => c.uid === event.uid) ??
          this.battle.active(event.side);
        const element = speciesOf(fallen).element;
        rig?.playFaint(element);
        Audio.playSfx('faint');
        await this.showMessage(`${event.side === 'player' ? '' : 'Foe '}${event.name} fainted!`);
        break;
      }

      case 'revive':
        await this.showMessage(`${event.name} was reborn!`);
        Audio.playSfx('shiny');
        break;

      case 'exp-gained': {
        const ui = this.playerUi;
        xpPopup(this, this.rigX('player'), this.rigY('player') - 60, event.amount);
        const creature = this.battle.active('player');
        ui.hp.setXp(expProgress(creature));
        await this.wait(420);
        break;
      }

      case 'level-up': {
        Audio.playSfx('levelUp');
        banner(this, `LEVEL ${event.level}`, COLORS.gold, 900);
        this.refreshPanels();
        await this.wait(700);
        break;
      }

      case 'move-learned':
        await this.showMessage(
          `${displayName(this.battle.active('player'))} learned ${prettyMove(event.moveId)}!`,
        );
        break;

      case 'move-learn-prompt':
        await this.promptLearnMove(event.uid, event.moveId);
        break;

      case 'catch-shake':
        Audio.playSfx('orbShake');
        await this.wait(420);
        break;

      case 'catch-success': {
        Audio.playSfx('orbClick');
        banner(this, 'GOTCHA!', COLORS.gold, 1600);
        await this.showMessage(
          `${event.shakes} shakes... and it was caught!`,
        );
        this.captureCreature();
        break;
      }

      case 'catch-failed':
        Audio.playSfx('orbBreak');
        await this.showMessage('Argh! It broke free!');
        break;

      case 'flee-attempt':
        await this.showMessage(event.success ? 'Got away safely!' : "Couldn't get away!");
        break;

      case 'item-used':
        Audio.playSfx('heal');
        await this.showMessage(`You used ${ITEMS[event.itemId]?.name ?? 'an item'}.`, 800, false);
        break;

      case 'money-earned':
        Audio.playSfx('money');
        Game.state.addMoney(event.amount);
        await this.showMessage(`You got \u00a3${event.amount} for winning!`);
        break;

      case 'request-switch':
        // Handled by the loop, nothing to animate here.
        break;

      case 'battle-end':
        await this.playBattleEnd(event);
        break;

      case 'turn-start':
      case 'message':
        if (event.type === 'message') await this.showMessage(event.text);
        break;

      case 'drain':
        break;

      default:
        break;
    }
  }

  private async playDamage(event: Extract<BattleEvent, { type: 'damage' }>): Promise<void> {
    const ui = event.side === 'player' ? this.playerUi : this.enemyUi;
    const rig = event.side === 'player' ? this.playerRig : this.enemyRig;

    ui.hp.set(event.hpRemaining, event.maxHp, true);
    ui.hp.flashDamage();

    if (Game.settings.damageNumbers) {
      damageNumber(this, this.rigX(event.side), this.rigY(event.side) - 30, event.amount, {
        crit: event.crit,
        effectiveness: event.effectiveness,
        reduced: Game.settings.reducedEffects,
      });
    }

    if (event.indirect) {
      Audio.playSfx('hitWeak');
      await this.wait(220);
      return;
    }

    const dir = event.side === 'player' ? 1 : -1;
    rig?.playHurt(dir);

    const reduced = Game.settings.reducedEffects;

    if (event.crit) {
      Audio.playSfx('crit');
      if (!reduced) {
        this.cameras.main.shake(180, 0.012);
        // Hit-stop: a brief freeze sells the impact. The delay runs on real
        // time so it stays 70ms even while the scene clock is slowed down.
        this.time.timeScale = 0.05;
        try {
          await realDelay(70);
        } finally {
          this.time.timeScale = 1;
        }
      }
    } else if (event.effectiveness >= 2) {
      Audio.playSfx('hitSuper');
      if (!reduced) this.cameras.main.shake(140, 0.008);
    } else if (event.effectiveness <= 0.5) {
      Audio.playSfx('hitWeak');
    } else {
      Audio.playSfx('hit');
      if (!reduced) this.cameras.main.shake(90, 0.004);
    }

    const label = effectivenessLabel(event.effectiveness);
    await this.wait(event.crit ? 420 : event.effectiveness >= 2 ? 380 : 300);
    if (label) await this.showMessage(label, 800, false);
  }

  private async playIndirectDamage(
    event: Extract<BattleEvent, { type: 'status-damage' }>,
  ): Promise<void> {
    const ui = event.side === 'player' ? this.playerUi : this.enemyUi;
    ui.hp.set(event.hpRemaining, maxHp(this.battle.active(event.side)), true);
    if (Game.settings.damageNumbers) {
      damageNumber(this, this.rigX(event.side), this.rigY(event.side) - 30, event.amount, {
        reduced: Game.settings.reducedEffects,
      });
    }
    Audio.playSfx('hitWeak');
    await this.showMessage(
      `${event.side === 'player' ? '' : 'Foe '}${displayName(
        this.battle.active(event.side),
      )} is hurt by ${STATUS_INFO[event.status].name.toLowerCase()}!`,
      800,
      false,
    );
  }

  private async playBattleEnd(event: Extract<BattleEvent, { type: 'battle-end' }>): Promise<void> {
    Game.lastOutcome = {
      winner: event.winner === 'draw' ? 'draw' : event.winner,
      reason: event.reason,
      caught: this.battle.caughtCreature,
      moneyEarned: this.battle.moneyReward,
      fled: this.battle.fled,
    };

    if (event.winner === 'player' && event.reason === 'faint') {
      Audio.playMusic('victory');
      banner(this, 'VICTORY!', COLORS.gold, 1400);
      await this.wait(900);
    } else if (event.reason !== 'catch' && event.reason !== 'flee') {
      await this.showMessage(event.winner === 'enemy' ? 'You have no creatures left...' : 'The battle ended.');
    }
  }

  /* ------------------------------------------------------------ capture -- */

  private captureCreature(): void {
    const caught = this.battle.caughtCreature;
    if (!caught) return;

    const species = speciesOf(caught);

    // The orb that caught it can warm the new friend to you.
    const orb = this.lastOrbId ? ITEMS[this.lastOrbId] : undefined;
    if (orb && orb.effect.kind === 'orb' && orb.effect.friendship) {
      caught.friendship = Math.min(255, (caught.friendship ?? 0) + orb.effect.friendship);
    }

    // Name prompt for the new friend (skipped for wild duplicates being boxed).
    caught.originalTrainer = Game.state.playerName;
    const where = Game.state.addCreature(caught);
    if (where === 'box') {
      toast(this, `${species.name} was sent to the Storage PC.`, COLORS.panelGlow, 2400);
    } else {
      toast(this, `${species.name} joined your party!`, COLORS.gold, 2400);
    }
  }

  /* -------------------------------------------------------------- menus -- */

  private openMenu(items: MenuItem[], mode: MenuMode, columns: 1 | 2 = 2, visibleRows = 4): void {
    this.menuMode = mode;

    // Fit the panel to the layout: 6 rows x 28 + padding spans 316..526.
    const height = visibleRows * 28 + 42;
    const top = 526 - height;
    const width = 330;
    const centerX = VIEW_WIDTH - 190;
    this.menuBox.setSize(width, height);
    this.menuBox.setPosition(centerX, top + height / 2);
    this.menu.setPosition(centerX - width / 2 + 24, top + 21);

    this.menuBox.setVisible(true);
    this.menu.setVisible(true);
    this.menu.setItems(items);
    this.menu.setLayout(columns, visibleRows);
    this.menu.setCursor(0);
  }

  private closeMenu(): void {
    this.menuMode = 'none';
    this.menuBox.setVisible(false);
    this.menu.setVisible(false);
  }

  private promptAction(): Promise<BattleAction | null> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.openMenu(
        [
          { value: 'fight', label: 'Fight' },
          { value: 'bag', label: 'Bag' },
          { value: 'party', label: 'Creature' },
          {
            value: 'run',
            label: this.battle.canFlee ? 'Run' : '\u2014',
            disabled: !this.battle.canFlee,
          },
        ],
        'action',
        2,
        2,
      );
    });
  }

  private promptForcedSwitch(): Promise<void> {
    return new Promise((resolve) => {
      const party = this.battle.player.party;
      const items: MenuItem[] = party.map((creature, index) => ({
        value: String(index),
        label: displayName(creature),
        sublabel: `${creature.currentHp}/${maxHp(creature)}`,
        disabled: isFainted(creature) || index === this.battle.player.activeIndex,
      }));
      this.forcedSwitchResolver = resolve;
      this.openMenu(items, 'party', 1, 6);
      this.pendingSwitchOnly = true;
    });
  }

  private pendingSwitchOnly = false;
  private forcedSwitchResolver: (() => void) | null = null;
  private displayedUid: { player: string | null; enemy: string | null } = { player: null, enemy: null };

  private promptLearnMove(uid: string, moveId: string): Promise<void> {
    return new Promise((resolve) => {
      const creature = this.battle.player.party.find((c) => c.uid === uid);
      if (!creature) {
        resolve();
        return;
      }
      const items: MenuItem[] = [
        ...creature.moves.map((slot, index) => ({
          value: String(index),
          label: prettyMove(slot.id),
          sublabel: `${slot.pp}/${slot.maxPp}`,
        })),
        { value: 'skip', label: "Don't learn it" },
      ];
      this.learnResolver = (index) => {
        resolveLearnMove(this.battle, uid, moveId, index);
        this.pendingLearn = null;
        resolve();
      };
      this.pendingLearn = { moveId, items };
    });
  }

  private pendingLearn: { moveId: string; items: MenuItem[] } | null = null;

  private onMenuSelect(value: string): void {
    if (this.pendingLearn) {
      const index = value === 'skip' ? -1 : Number(value);
      Audio.playSfx('select');
      this.closeMenu();
      const resolve = this.learnResolver;
      this.learnResolver = null;
      resolve?.(index);
      return;
    }

    if (this.menuMode === 'action') {
      if (value === 'fight') {
        Audio.playSfx('select');
        this.openMoveMenu();
        return;
      }
      if (value === 'bag') {
        Audio.playSfx('select');
        this.openBagMenu();
        return;
      }
      if (value === 'party') {
        Audio.playSfx('select');
        this.openPartyMenu(false);
        return;
      }
      if (value === 'run') {
        Audio.playSfx('select');
        this.closeMenu();
        this.emitAction({ kind: 'flee' });
        return;
      }
    }

    if (this.menuMode === 'moves') {
      const index = Number(value);
      Audio.playSfx('select');
      this.closeMenu();
      this.emitAction({ kind: 'move', moveIndex: index });
      return;
    }

    if (this.menuMode === 'party') {
      const index = Number(value);
      Audio.playSfx('select');
      this.closeMenu();
      if (this.pendingSwitchOnly) {
        this.pendingSwitchOnly = false;
        this.battle.forceSwitch('player', index);
        const resolve = this.forcedSwitchResolver;
        this.forcedSwitchResolver = null;
        resolve?.();
        return;
      }
      this.emitAction({ kind: 'switch', index });
      return;
    }

    if (this.menuMode === 'bag') {
      if (value === 'back') {
        Audio.playSfx('back');
        this.openActionMenuAgain();
        return;
      }
      const itemId = value.replace('item-', '') as ItemId;
      const item = ITEMS[itemId];
      Audio.playSfx('select');
      this.closeMenu();
      if (item?.effect.kind === 'orb') {
        this.lastOrbId = itemId;
        this.emitAction({ kind: 'orb', itemId });
      } else {
        // Healing items target the active creature.
        this.emitAction({
          kind: 'item',
          itemId,
          targetIndex: this.battle.player.activeIndex,
        });
      }
      return;
    }
  }

  private openActionMenuAgain(): void {
    this.openMenu(
      [
        { value: 'fight', label: 'Fight' },
        { value: 'bag', label: 'Bag' },
        { value: 'party', label: 'Creature' },
        { value: 'run', label: 'Run', disabled: !this.battle.canFlee },
      ],
      'action',
      2,
      2,
    );
  }

  private openMoveMenu(): void {
    const player = this.battle.active('player');
    const items: MenuItem[] = player.moves.map((slot, index) => {
      const move = getMove(slot.id);
      return {
        value: String(index),
        label: move?.name ?? slot.id,
        sublabel: `${slot.pp}/${slot.maxPp}`,
        disabled: slot.pp <= 0,
        trailing: move ? move.type.toUpperCase() : '',
        color: move ? ELEMENT_INFO[move.type].color : undefined,
      };
    });
    // Struggle is the fallback when every move is out of PP (engine reads -1).
    const anyPp = player.moves.some((slot) => slot.pp > 0);
    if (items.length === 0 || !anyPp) items.push({ value: '-1', label: 'Struggle' });
    this.openMenu(items, 'moves', 1, 4);
  }

  private openPartyMenu(forced: boolean): void {
    const party = this.battle.player.party;
    const items: MenuItem[] = party.map((creature, index) => ({
      value: String(index),
      label: displayName(creature),
      sublabel: `${creature.currentHp}/${maxHp(creature)}`,
      disabled:
        isFainted(creature) ||
        (index === this.battle.player.activeIndex && !forced) ||
        (!forced && creature.status === 'entangled'),
    }));
    this.openMenu(items, 'party', forced ? 1 : 2, 6);
  }

  private openBagMenu(): void {
    const wild = this.battle.isWild;
    // Only real, non-empty entries — never a duplicate or a zero-count orb row.
    const entries = Game.state
      .bagEntries()
      .filter((entry) => entry.count > 0)
      .filter((entry) => ITEMS[entry.id].usableInBattle || ITEMS[entry.id].throwable);
    const items: MenuItem[] = entries.map((entry) => {
      const item = ITEMS[entry.id];
      const isOrb = item.throwable === true;
      return {
        value: `item-${entry.id}`,
        label: item.name,
        trailing: `x${entry.count}`,
        disabled: isOrb && !wild,
      };
    });
    items.push({ value: 'back', label: 'Back' });
    this.openMenu(items, 'bag', 1, 6);
  }

  private emitAction(action: BattleAction): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.closeMenu();
    resolve?.(action);
  }

  /* ---------------------------------------------------------- messaging -- */

  /**
   * Show a line of dialogue. Resolves when the player presses confirm *or*
   * after `autoMs`, so a long battle does not require constant input.
   */
  private showMessage(text: string, autoMs = 0, waitForInput = true): Promise<void> {
    if (!text) return Promise.resolve();
    return new Promise((resolve) => {
      this.messageResolver = resolve;
      // A caller-supplied duration is honoured exactly so battles keep pace;
      // otherwise a message waits for a button press.
      const timeout = autoMs > 0 ? autoMs : waitForInput ? 0 : 900;
      this.textbox.show(text);
      this.messageTimer?.remove();
      if (timeout > 0) {
        this.messageTimer = this.time.delayedCall(timeout, () => this.dismissMessage());
      }
    });
  }

  private dismissMessage(): void {
    const resolve = this.messageResolver;
    this.messageResolver = null;
    this.messageTimer?.remove();
    this.messageTimer = undefined;
    this.textbox.hide();
    resolve?.();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  /* -------------------------------------------------------------- rig pos -- */

  private rigX(side: Side): number {
    return side === 'player' ? PLAYER_STAGE.x : ENEMY_STAGE.x;
  }

  private rigY(side: Side): number {
    return side === 'player' ? PLAYER_STAGE.y : ENEMY_STAGE.y;
  }

  private syncStage(): void {
    if (!this.stage3d) return;
    if (this.playerRig) {
      this.stage3d.sync('player', this.playerRig.speciesId, this.playerRig.shiny, this.rigPose(this.playerRig));
    }
    if (this.enemyRig) {
      this.stage3d.sync('enemy', this.enemyRig.speciesId, this.enemyRig.shiny, this.rigPose(this.enemyRig));
    }
  }

  private rigPose(rig: CreatureRig): {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    alpha: number;
    visible: boolean;
    angle: number;
  } {
    return {
      x: rig.x,
      y: rig.y,
      scaleX: rig.scaleX,
      scaleY: rig.scaleY,
      alpha: rig.alpha,
      visible: rig.visible,
      angle: rig.angle,
    };
  }

  /* --------------------------------------------------------------- finish -- */

  private async finish(): Promise<void> {
    await this.wait(400);
    this.textbox.hide();

    // Queue any evolutions the battle produced.
    for (const creature of this.battle.player.party) {
      if (creature.pendingEvolution) {
        Game.pendingEvolutions.push(creature.uid);
      }
    }

    // Record the trainer victory (and grant the Trial Sigil) exactly once,
    // before the world regains control and before the request is cleared.
    const request = Game.pendingBattle;
    if (request?.kind === 'trainer' && this.battle.winner === 'player') {
      applyTrainerVictory(Game.state, request.trainer);
    }

    // The world resumes from `lastOutcome` and the state's sigil list, so the
    // pending request can safely be cleared now.
    Game.pendingBattle = null;
    Game.pendingWildCreature = null;

    // Remove creatures that fainted from the roster's "active" set is handled by
    // the engine; the party keeps its members either way.

    this.cameras.main.fadeOut(360, 5, 7, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.finishToOverworld();
    });
  }

  private finishToOverworld(): void {
    const overworld = this.scene.get(SCENES.overworld);
    this.scene.stop(SCENES.battle);

    if (overworld && this.scene.isPaused(SCENES.overworld)) {
      this.scene.resume(SCENES.overworld);
      overworld.events.emit('battle-finished');
      return;
    }

    if (overworld && this.scene.isActive(SCENES.overworld)) {
      overworld.events.emit('battle-finished');
      return;
    }

    // Came from the title screen's debug battle.
    this.scene.start(SCENES.overworld);
  }

  /* -------------------------------------------------------------- update -- */

  override update(time: number): void {
    this.controls.update();

    this.syncStage();

    if (this.messageResolver) {
      if (this.controls.justPressed('confirm') || this.controls.justPressed('cancel')) {
        this.dismissMessage();
      }
      return;
    }

    if (this.pendingLearn && this.menuMode === 'none') {
      this.openMenu(this.pendingLearn.items, 'learn', 1, 5);
      return;
    }

    if (this.menuMode === 'none') return;

    const vertical = this.controls.verticalNav(time);
    if (vertical !== 0) this.menu.moveCursor(vertical);

    const horizontal = this.controls.horizontalNav(time);
    if (horizontal !== 0 && this.menuMode !== 'party') this.menu.moveHorizontal(horizontal);

    if (this.controls.justPressed('confirm')) this.menu.confirm();
    if (this.controls.justPressed('cancel') && this.menuMode === 'moves') {
      Audio.playSfx('back');
      this.openActionMenuAgain();
    } else if (this.controls.justPressed('cancel') && this.menuMode === 'bag') {
      Audio.playSfx('back');
      this.openActionMenuAgain();
    }
  }
}

function statLabel(stat: string): string {
  const labels: Record<string, string> = {
    attack: 'Attack',
    defense: 'Defense',
    spPower: 'Sp. Power',
    spGuard: 'Sp. Guard',
    speed: 'Speed',
    accuracy: 'accuracy',
    evasion: 'evasiveness',
  };
  return labels[stat] ?? stat;
}

function prettyMove(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** A real-time delay, unaffected by the scene clock's time scale. */
function realDelay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export { maximizeMovesForLevel, typeWipe, hpFraction };
