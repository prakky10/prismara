/**
 * Plays the battle engine's event stream as animation, sound and text.
 *
 * The scene hands over a small view of itself so this stays free of menu and
 * lifecycle concerns: it only turns one `BattleEvent` into what the player sees.
 */

import type Phaser from 'phaser';
import { COLORS, DEPTHS } from '../../ui/Theme';
import { Audio } from '../../audio/AudioManager';
import { Game } from '../../world/GameContext';
import {
  displayName,
  expProgress,
  getMove,
  maxHp,
  speciesOf,
  type BattleEvent,
  type BattleState,
} from '../../battle';
import { banner, damageNumber, toast, xpPopup } from '../../ui/Popups';
import { effectivenessLabel } from '../../data/types';
import type { CreatureRig } from '../../render/CreatureRig';
import { playMoveVfx } from '../../render/vfx/MoveVfx';
import { ITEMS } from '../../data/items';
import { STATUS_INFO, WEATHERS, type Side } from '../../data/battleTypes';
import type { BattlePanel } from './BattlePanel';
import { prettyMove, statLabel } from './battleMenus';

export interface BattleView {
  readonly scene: Phaser.Scene;
  battle(): BattleState;
  rig(side: Side): CreatureRig | undefined;
  hud(side: Side): BattlePanel;
  stagePoint(side: Side): { x: number; y: number };
  showMessage(text: string, autoMs?: number, waitForInput?: boolean): Promise<void>;
  wait(ms: number): Promise<void>;
  refreshPanels(): void;
  /** Build the creature model for a side that just switched in. */
  buildRigs(side: Side, uid: string): Promise<void>;
  promptLearnMove(uid: string, moveId: string): Promise<void>;
  captureCreature(): void;
}

export class BattleEventPlayer {
  constructor(private readonly view: BattleView) {}

  async playAll(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      await this.play(event);
    }
  }

  private get scene(): Phaser.Scene {
    return this.view.scene;
  }

  private get battle(): BattleState {
    return this.view.battle();
  }

  private rigX(side: Side): number {
    return this.view.stagePoint(side).x;
  }

  private rigY(side: Side): number {
    return this.view.stagePoint(side).y;
  }

  async play(event: BattleEvent): Promise<void> {
    const view = this.view;
    switch (event.type) {
      case 'battle-start':
        await view.showMessage(
          event.isWild
            ? `A wild ${event.enemyName} appeared!`
            : `${event.enemyName} wants to battle!`,
        );
        break;

      case 'switch-in':
        // Rebuild only the side that changed as the replacement arrives.
        await view.buildRigs(event.side, event.uid);
        await view.showMessage(
          event.side === 'player' ? `Go, ${event.name}!` : `Foe ${event.name} was sent out!`,
        );
        if (event.side === 'player') view.rig('player')?.playCelebrate();
        break;

      case 'switch-out':
        await view.showMessage(`${event.name}, come back!`);
        break;

      case 'move-used': {
        const rig = view.rig(event.side);
        const move = getMove(event.moveId);
        await view.showMessage(
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
              scene: this.scene,
              from: { x: this.rigX(event.side), y: this.rigY(event.side) - 40 },
              to: { x: this.rigX(other), y: this.rigY(other) - 30 },
              depth: DEPTHS.actors + 5,
              reduced: Game.settings.reducedEffects,
            },
            move.type,
          );
          await view.wait(Math.max(120, handle.impactAtMs));
        } else {
          await view.wait(160);
        }
        break;
      }

      case 'move-missed':
        await view.showMessage('But it missed!');
        damageNumber(
          this.scene,
          this.rigX(this.battle.other(event.side)),
          this.rigY(this.battle.other(event.side)),
          0,
          { kind: 'miss' },
        );
        break;

      case 'move-protected':
        await view.showMessage('It protected itself!');
        break;

      case 'move-failed':
        await view.showMessage('But it failed!');
        break;

      case 'damage':
        await this.playDamage(event);
        break;

      case 'status-damage':
        await this.playIndirectDamage(event);
        break;

      case 'heal': {
        view.hud(event.side).hp.set(event.hpRemaining, event.maxHp, true);
        damageNumber(this.scene, this.rigX(event.side), this.rigY(event.side) - 40, event.amount, {
          kind: 'heal',
          reduced: Game.settings.reducedEffects,
        });
        Audio.playSfx('heal');
        await view.wait(260);
        break;
      }

      case 'recoil':
        await view.showMessage('It was hurt by recoil!', 700, false);
        break;

      case 'status-applied':
        await view.showMessage(
          `${event.side === 'player' ? '' : 'Foe '}${displayName(
            this.battle.active(event.side),
          )} was afflicted with ${STATUS_INFO[event.status].name}!`,
        );
        Audio.playSfx('status');
        toast(
          this.scene,
          STATUS_INFO[event.status].name.toUpperCase(),
          STATUS_INFO[event.status].color,
        );
        view.refreshPanels();
        break;

      case 'status-cured':
        await view.showMessage('It recovered!', 800, false);
        view.refreshPanels();
        break;

      case 'status-immune':
        await view.showMessage('It had no effect...', 800, false);
        break;

      case 'stat-change': {
        const amount = Math.abs(event.delta) >= 2 ? 'sharply ' : '';
        const verb = event.delta > 0 ? 'rose' : 'fell';
        await view.showMessage(
          `${event.side === 'player' ? '' : 'Foe '}${statLabel(event.stat)} ${amount}${verb}!`,
          800,
          false,
        );
        Audio.playSfx(event.delta > 0 ? 'statUp' : 'statDown');
        break;
      }

      case 'stat-change-failed':
        await view.showMessage('Nothing happened!', 700, false);
        break;

      case 'volatile-applied':
        if (event.volatile === 'soaked') await view.showMessage('It was soaked!', 800, false);
        break;

      case 'weather-set':
        await view.showMessage(WEATHERS[event.weather].description);
        view.refreshPanels();
        break;

      case 'weather-ended':
        await view.showMessage('The weather returned to normal.', 900, false);
        view.refreshPanels();
        break;

      case 'ability-triggered':
        await view.showMessage(`${event.abilityName} activated!`, 800, false);
        break;

      case 'faint': {
        const rig = view.rig(event.side);
        const fallen =
          this.battle.party(event.side).find((c) => c.uid === event.uid) ??
          this.battle.active(event.side);
        const element = speciesOf(fallen).element;
        rig?.playFaint(element);
        Audio.playSfx('faint');
        await view.showMessage(`${event.side === 'player' ? '' : 'Foe '}${event.name} fainted!`);
        break;
      }

      case 'revive':
        await view.showMessage(`${event.name} was reborn!`);
        Audio.playSfx('shiny');
        break;

      case 'exp-gained': {
        xpPopup(this.scene, this.rigX('player'), this.rigY('player') - 60, event.amount);
        const creature = this.battle.active('player');
        view.hud('player').hp.setXp(expProgress(creature));
        await view.wait(420);
        break;
      }

      case 'level-up': {
        Audio.playSfx('levelUp');
        banner(this.scene, `LEVEL ${event.level}`, COLORS.gold, 900);
        view.refreshPanels();
        await view.wait(700);
        break;
      }

      case 'move-learned':
        await view.showMessage(
          `${displayName(this.battle.active('player'))} learned ${prettyMove(event.moveId)}!`,
        );
        break;

      case 'move-learn-prompt':
        await view.promptLearnMove(event.uid, event.moveId);
        break;

      case 'catch-shake':
        Audio.playSfx('orbShake');
        await view.wait(420);
        break;

      case 'catch-success': {
        Audio.playSfx('orbClick');
        banner(this.scene, 'GOTCHA!', COLORS.gold, 1600);
        await view.showMessage(`${event.shakes} shakes... and it was caught!`);
        view.captureCreature();
        break;
      }

      case 'catch-failed':
        Audio.playSfx('orbBreak');
        await view.showMessage('Argh! It broke free!');
        break;

      case 'flee-attempt':
        await view.showMessage(event.success ? 'Got away safely!' : "Couldn't get away!");
        break;

      case 'item-used':
        Audio.playSfx('heal');
        await view.showMessage(`You used ${ITEMS[event.itemId]?.name ?? 'an item'}.`, 800, false);
        break;

      case 'money-earned':
        Audio.playSfx('money');
        Game.state.addMoney(event.amount);
        await view.showMessage(`You got £${event.amount} for winning!`);
        break;

      case 'request-switch':
        // Handled by the loop, nothing to animate here.
        break;

      case 'battle-end':
        await this.playBattleEnd(event);
        break;

      case 'turn-start':
      case 'message':
        if (event.type === 'message') await view.showMessage(event.text);
        break;

      case 'drain':
        break;

      default:
        break;
    }
  }

  private async playDamage(event: Extract<BattleEvent, { type: 'damage' }>): Promise<void> {
    const ui = this.view.hud(event.side);
    const rig = this.view.rig(event.side);

    ui.hp.set(event.hpRemaining, event.maxHp, true);
    ui.hp.flashDamage();

    if (Game.settings.damageNumbers) {
      damageNumber(this.scene, this.rigX(event.side), this.rigY(event.side) - 30, event.amount, {
        crit: event.crit,
        effectiveness: event.effectiveness,
        reduced: Game.settings.reducedEffects,
      });
    }

    if (event.indirect) {
      Audio.playSfx('hitWeak');
      await this.view.wait(220);
      return;
    }

    const dir = event.side === 'player' ? 1 : -1;
    rig?.playHurt(dir);

    const reduced = Game.settings.reducedEffects;
    const camera = this.scene.cameras.main;

    if (event.crit) {
      Audio.playSfx('crit');
      if (!reduced) {
        camera.shake(180, 0.012);
        // Hit-stop: a brief freeze sells the impact. The delay runs on real
        // time so it stays 70ms even while the scene clock is slowed down.
        this.scene.time.timeScale = 0.05;
        try {
          await realDelay(70);
        } finally {
          this.scene.time.timeScale = 1;
        }
      }
    } else if (event.effectiveness >= 2) {
      Audio.playSfx('hitSuper');
      if (!reduced) camera.shake(140, 0.008);
    } else if (event.effectiveness <= 0.5) {
      Audio.playSfx('hitWeak');
    } else {
      Audio.playSfx('hit');
      if (!reduced) camera.shake(90, 0.004);
    }

    const label = effectivenessLabel(event.effectiveness);
    await this.view.wait(event.crit ? 420 : event.effectiveness >= 2 ? 380 : 300);
    if (label) await this.view.showMessage(label, 800, false);
  }

  private async playIndirectDamage(
    event: Extract<BattleEvent, { type: 'status-damage' }>,
  ): Promise<void> {
    this.view
      .hud(event.side)
      .hp.set(event.hpRemaining, maxHp(this.battle.active(event.side)), true);
    if (Game.settings.damageNumbers) {
      damageNumber(this.scene, this.rigX(event.side), this.rigY(event.side) - 30, event.amount, {
        reduced: Game.settings.reducedEffects,
      });
    }
    Audio.playSfx('hitWeak');
    await this.view.showMessage(
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
      banner(this.scene, 'VICTORY!', COLORS.gold, 1400);
      await this.view.wait(900);
    } else if (event.reason !== 'catch' && event.reason !== 'flee') {
      await this.view.showMessage(
        event.winner === 'enemy' ? 'You have no creatures left...' : 'The battle ended.',
      );
    }
  }
}

/** A real-time delay, unaffected by the scene clock's time scale. */
function realDelay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
