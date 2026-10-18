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
  hpFraction,
  isFainted,
  speciesOf,
  type BattleAction,
  type BattleEvent,
  type CreatureInstance,
} from '../battle';
import { resolveLearnMove } from '../battle/TurnResolver';
import { applyTrainerVictory, consumeBattleItem } from '../world/battleResults';
import { Panel } from '../ui/Panel';
import { MenuList, type MenuItem } from '../ui/MenuList';
import { TextBox } from '../ui/TextBox';
import { toast } from '../ui/Popups';
import { CreatureRig } from '../render/CreatureRig';
import { Battle3D } from '../render/three/Battle3D';
import { typeWipe } from '../render/vfx/MoveVfx';
import { ITEMS, type ItemId } from '../data/items';
import { WEATHERS, type Side } from '../data/battleTypes';
import type { AITier } from '../battle/BattleState';
import { BattlePanel } from './battle/BattlePanel';
import { BattleEventPlayer } from './battle/BattleEventPlayer';
import {
  actionMenuItems,
  arenaBiomeFor,
  bagMenuItems,
  learnMenuItems,
  moveMenuItems,
  partyMenuItems,
} from './battle/battleMenus';

type MenuMode = 'none' | 'action' | 'moves' | 'party' | 'bag' | 'learn';

/** Where each side's creature stands. The platforms are drawn at these points. */
const PLAYER_STAGE = { x: 200, y: 400 };
const ENEMY_STAGE = { x: 720, y: 250 };

export class BattleScene extends Phaser.Scene {
  private controls!: InputManager;
  private battle!: BattleState;
  private stage3d?: Battle3D;
  private biome = 'meadow';

  private playerRig!: CreatureRig;
  private enemyRig!: CreatureRig;
  private playerUi!: BattlePanel;
  private enemyUi!: BattlePanel;
  private player!: BattleEventPlayer;
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
    this.player = new BattleEventPlayer({
      scene: this,
      battle: () => this.battle,
      rig: (side) => (side === 'player' ? this.playerRig : this.enemyRig),
      hud: (side) => (side === 'player' ? this.playerUi : this.enemyUi),
      stagePoint: (side) => ({ x: this.rigX(side), y: this.rigY(side) }),
      showMessage: (text, autoMs, waitForInput) => this.showMessage(text, autoMs, waitForInput),
      wait: (ms) => this.wait(ms),
      refreshPanels: () => this.refreshPanels(),
      buildRigs: (side, uid) => this.buildRigs(side, uid),
      promptLearnMove: (uid, moveId) => this.promptLearnMove(uid, moveId),
      captureCreature: () => this.captureCreature(),
    });

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
    void request;
    return arenaBiomeFor(Game.state.position.mapId);
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
    this.enemyUi = new BattlePanel(this, 60, 40, 330, 74, 'enemy');
    this.playerUi = new BattlePanel(this, VIEW_WIDTH - 400, 280, 340, 84, 'player');

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

    this.playerUi.update(player);
    this.enemyUi.update(enemy);

    const weather = WEATHERS[this.battle.weather.kind];
    this.weatherText.setText(
      this.battle.weather.kind === 'clear' ? '' : `${weather.name} (${this.battle.weather.turnsLeft || '\u221e'})`,
    );
    this.weatherText.setColor(`#${weather.color.toString(16).padStart(6, '0')}`);
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
    await this.player.playAll(events);
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
      this.openMenu(actionMenuItems(this.battle), 'action', 2, 2);
    });
  }

  private promptForcedSwitch(): Promise<void> {
    return new Promise((resolve) => {
      this.forcedSwitchResolver = resolve;
      this.openMenu(partyMenuItems(this.battle, true), 'party', 1, 6);
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
      const items = learnMenuItems(creature.moves);
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
    this.openMenu(actionMenuItems(this.battle), 'action', 2, 2);
  }

  private openMoveMenu(): void {
    this.openMenu(moveMenuItems(this.battle), 'moves', 1, 4);
  }

  private openPartyMenu(forced: boolean): void {
    this.openMenu(partyMenuItems(this.battle, forced), 'party', forced ? 1 : 2, 6);
  }

  private openBagMenu(): void {
    this.openMenu(bagMenuItems(Game.state.bagEntries(), this.battle.isWild), 'bag', 1, 6);
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

export { maximizeMovesForLevel, typeWipe, hpFraction };
