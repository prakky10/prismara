/**
 * The mutable state of a single battle.
 *
 * A `BattleState` owns both parties, the field (weather + time of day), the
 * turn counter, the RNG and the outgoing event queue. It exposes small query
 * helpers and the `takeTurn` entry point; the actual turn logic lives in
 * `TurnResolver.ts` so this file stays about *state*.
 *
 * The class is deliberately Phaser-free — a battle can be run headless in a
 * unit test or a few thousand times in the balance simulator.
 */

import { abilityOf, isFainted, resetBattleState, displayName, type CreatureInstance } from './Creature';
import type { BattleEvent } from './events';
import type { FieldContext } from './DamageCalc';
import { clearWeather, setWeather, tickWeather, weatherEndOfTurnHeal, type WeatherState } from './Weather';
import { createRNG, randomSeed, type RNG } from '../core/SeededRNG';
import type { Side } from '../data/battleTypes';
import { resolveTurn, resolveSwitch, type BattleAction } from './TurnResolver';

export type AITier = 'youngster' | 'trainer' | 'master';
export type BattlePhase = 'choose' | 'awaiting-switch' | 'ended';

export interface SideState {
  side: Side;
  party: CreatureInstance[];
  activeIndex: number;
  /** Trainer name for the UI, "Wild" for a wild creature. */
  name: string;
}

export interface BattleConfig {
  playerParty: CreatureInstance[];
  enemyParty: CreatureInstance[];
  playerName: string;
  isWild: boolean;
  /** Trainer's display name, e.g. "Ivy" or "Team Eclipse Grunt". */
  enemyTrainerName?: string;
  aiTier?: AITier;
  context: FieldContext;
  seed?: number;
  moneyReward?: number;
  /** Wild battles allow fleeing; trainer battles do not. */
  canFlee?: boolean;
}

export class BattleState {
  readonly player: SideState;
  readonly enemy: SideState;
  readonly context: FieldContext;
  readonly isWild: boolean;
  readonly aiTier: AITier;
  readonly moneyReward: number;
  readonly canFlee: boolean;
  readonly playerName: string;

  weather: WeatherState = clearWeather();
  turn = 0;
  phase: BattlePhase = 'choose';
  rng: RNG;
  events: BattleEvent[] = [];

  winner: Side | 'draw' | null = null;
  /** Set when the battle ends because a creature was caught. */
  caughtCreature: CreatureInstance | null = null;
  /** Set when the battle ends by fleeing. */
  fled = false;
  /** Number of creatures the player has had faint (for a white-out). */
  playerFaints = 0;

  constructor(config: BattleConfig) {
    this.player = {
      side: 'player',
      party: config.playerParty,
      activeIndex: firstAliveIndex(config.playerParty),
      name: config.playerName,
    };
    this.enemy = {
      side: 'enemy',
      party: config.enemyParty,
      activeIndex: firstAliveIndex(config.enemyParty),
      name: config.enemyTrainerName ?? (config.isWild ? 'Wild' : 'Trainer'),
    };
    this.context = { ...config.context };
    this.isWild = config.isWild;
    this.aiTier = config.aiTier ?? (config.isWild ? 'youngster' : 'trainer');
    this.moneyReward = config.moneyReward ?? 0;
    this.canFlee = config.canFlee ?? config.isWild;
    this.playerName = config.playerName;
    this.rng = createRNG(config.seed ?? randomSeed());
  }

  /* ------------------------------------------------------------- queries -- */

  active(side: Side): CreatureInstance {
    const s = side === 'player' ? this.player : this.enemy;
    return s.party[s.activeIndex];
  }

  party(side: Side): CreatureInstance[] {
    return side === 'player' ? this.player.party : this.enemy.party;
  }

  sideState(side: Side): SideState {
    return side === 'player' ? this.player : this.enemy;
  }

  other(side: Side): Side {
    return side === 'player' ? 'enemy' : 'player';
  }

  hasAlive(side: Side): boolean {
    return this.party(side).some((c) => !isFainted(c));
  }

  aliveCount(side: Side): number {
    return this.party(side).filter((c) => !isFainted(c)).length;
  }

  /** True once the battle cannot continue. */
  get isOver(): boolean {
    return this.phase === 'ended';
  }

  get weatherKind() {
    return this.weather.kind;
  }

  /* ------------------------------------------------------------- events -- */

  emit(event: BattleEvent): void {
    this.events.push(event);
  }

  log(text: string): void {
    this.events.push({ type: 'message', text });
  }

  /** Take (and clear) everything queued since the last call. */
  drainEvents(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /* -------------------------------------------------------------- flow -- */

  /** Emit the opening events. Called once by the scene when the battle loads. */
  start(): void {
    for (const c of this.player.party) resetBattleState(c);
    for (const c of this.enemy.party) resetBattleState(c);

    this.emit({
      type: 'battle-start',
      playerName: this.playerName,
      enemyName: this.isWild ? displayName(this.active('enemy')) : this.enemy.name,
      isWild: this.isWild,
    });
    this.sendOut('enemy', this.enemy.activeIndex, { announce: false });
    this.sendOut('player', this.player.activeIndex, { announce: true });
    this.turn = 0;
    this.phase = 'choose';
  }

  /**
   * Put a creature on the field. Resets its battle-only state, applies
   * entry abilities (Storm Caller) and emits the switch-in event.
   */
  sendOut(side: Side, index: number, opts: { announce?: boolean } = {}): void {
    const state = this.sideState(side);
    state.activeIndex = index;
    const creature = state.party[index];
    resetBattleState(creature);

    if (opts.announce !== false) {
      this.emit({
        type: 'switch-in',
        side,
        uid: creature.uid,
        name: displayName(creature),
        level: creature.level,
      });
    }

    // Entry abilities.
    const ability = abilityOf(creature);
    if (ability.hooks.includes('weather-on-entry') && ability.weather) {
      this.weather = setWeather(ability.weather);
      this.emit({ type: 'ability-triggered', side, ability: ability.id, abilityName: ability.name });
      this.emit({ type: 'weather-set', weather: this.weather.kind });
    }
  }

  /** Resolve one full turn. Only valid in the `choose` phase. */
  takeTurn(action: BattleAction): BattleEvent[] {
    if (this.phase === 'ended') return this.drainEvents();
    if (this.phase === 'awaiting-switch') {
      // A switch is the only legal action here.
      if (action.kind === 'switch') {
        this.forceSwitch('player', action.index);
        return this.drainEvents();
      }
      return this.drainEvents();
    }
    resolveTurn(this, action);
    return this.drainEvents();
  }

  /** A voluntary mid-battle switch (uses the turn). */
  switchPlayer(index: number): BattleEvent[] {
    return this.takeTurn({ kind: 'switch', index });
  }

  /** Switch in a replacement without spending a turn (after a faint). */
  forceSwitch(side: Side, index: number): void {
    resolveSwitch(this, side, index, true);
    if (side === 'player') this.phase = 'choose';
  }

  /* ----------------------------------------------------------- end game -- */

  endBattle(winner: Side | 'draw', reason: 'faint' | 'catch' | 'flee' | 'forfeit'): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.winner = winner;
    this.emit({ type: 'battle-end', winner, reason });
  }

  /** Called by the resolver at the end of a turn. */
  finishTurn(): void {
    this.turn += 1;

    // Weather countdown.
    if (tickWeather(this.weather)) {
      this.emit({ type: 'weather-ended', weather: 'clear' });
    }

    // End-of-turn healing from weather and abilities.
    for (const side of ['player', 'enemy'] as Side[]) {
      const creature = this.active(side);
      if (isFainted(creature)) continue;
      const { healed, source } = weatherEndOfTurnHeal(creature, this.weather.kind);
      if (healed > 0) {
        this.emit({
          type: 'heal',
          side,
          amount: healed,
          hpRemaining: creature.currentHp,
          maxHp: creature.currentHp + healed,
        });
        if (source === 'ability') {
          const ability = abilityOf(creature);
          this.emit({
            type: 'ability-triggered',
            side,
            ability: ability.id,
            abilityName: ability.name,
          });
        }
      }
    }

    this.checkEnd();
  }

  /** Decide whether the battle is finished and what happens next. */
  checkEnd(): void {
    if (this.phase === 'ended') return;
    const playerAlive = this.hasAlive('player');
    const enemyAlive = this.hasAlive('enemy');

    if (!enemyAlive) {
      if (!this.isWild && this.moneyReward > 0) {
        this.emit({ type: 'money-earned', amount: this.moneyReward });
      }
      this.endBattle('player', 'faint');
      return;
    }
    if (!playerAlive) {
      this.endBattle('enemy', 'faint');
      return;
    }

    // If the player's active creature fainted, ask for a replacement.
    if (isFainted(this.active('player'))) {
      this.phase = 'awaiting-switch';
      this.emit({ type: 'request-switch', side: 'player' });
      return;
    }

    // The enemy always replaces a fainted creature immediately.
    if (isFainted(this.active('enemy'))) {
      const next = firstAliveIndex(this.enemy.party);
      if (next >= 0) this.sendOut('enemy', next);
    }

    this.phase = 'choose';
  }

  /** Snapshot the RNG so a battle can be replayed exactly. */
  snapshot(): number {
    return this.rng.state();
  }
}

export function firstAliveIndex(party: CreatureInstance[]): number {
  const idx = party.findIndex((c) => !isFainted(c));
  return idx >= 0 ? idx : 0;
}

/** Build the field context for a map location. */
export function fieldContext(
  timeOfDay: 'day' | 'night',
  isCave = false,
  weather: WeatherState = clearWeather(),
): FieldContext {
  return { weather: weather.kind, timeOfDay, isCave };
}

export { resolveSwitch };
