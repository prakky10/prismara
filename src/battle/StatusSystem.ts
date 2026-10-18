/**
 * Major status conditions.
 *
 * Prismara allows exactly one major status per creature (Burn, Paralyze, Sleep,
 * Entangled or Fear) alongside any number of volatile conditions. Each status
 * has an element that shrugs it off entirely (Fire cannot burn, Electric cannot
 * paralyze, Grass cannot be entangled) plus an ability-based immunity.
 */

import { hasHook, ABILITIES } from '../data/abilities';
import { STATUS_INFO, type Side, type StatusId } from '../data/battleTypes';
import { speciesOf, type CreatureInstance } from './Creature';
import type { BattleState } from './BattleState';

/** Turns a sleep lasts when freshly applied. */
export const SLEEP_MIN_TURNS = 1;
export const SLEEP_MAX_TURNS = 3;
/** Turns Fear lasts. */
export const FEAR_TURNS = 3;

/** Elements that are naturally immune to a given status. */
const ELEMENT_IMMUNITY: Partial<Record<StatusId, string>> = {
  burn: 'fire',
  paralyze: 'electric',
  entangled: 'grass',
};

export function elementImmune(creature: CreatureInstance, status: StatusId): boolean {
  const immuneTo = ELEMENT_IMMUNITY[status];
  return immuneTo !== undefined && speciesOf(creature).element === immuneTo;
}

export function abilityImmune(creature: CreatureInstance, status: StatusId): boolean {
  if (!hasHook(creature.ability, 'status-immune')) return false;
  return ABILITIES[creature.ability].status === status;
}

export function canReceiveStatus(creature: CreatureInstance, status: StatusId): boolean {
  if (creature.currentHp <= 0) return false;
  if (creature.status) return false;
  if (elementImmune(creature, status)) return false;
  if (abilityImmune(creature, status)) return false;
  return true;
}

/**
 * Try to inflict a status. Emits the right event either way, so the player
 * always sees "X is immune!" rather than silence.
 */
export function applyStatus(
  state: BattleState,
  side: Side,
  status: StatusId,
  rng = state.rng,
): boolean {
  const creature = state.active(side);

  if (creature.status === status) return false;

  if (elementImmune(creature, status) || abilityImmune(creature, status)) {
    state.emit({ type: 'status-immune', side, status });
    return false;
  }
  if (creature.status) {
    // Already afflicted by something else: silently fail, as in the games.
    return false;
  }

  creature.status = status;
  switch (status) {
    case 'sleep':
      creature.statusTurns = rng.int(SLEEP_MIN_TURNS, SLEEP_MAX_TURNS);
      break;
    case 'fear':
      creature.statusTurns = FEAR_TURNS;
      break;
    default:
      creature.statusTurns = 0;
      break;
  }
  state.emit({ type: 'status-applied', side, status });
  return true;
}

/** Force a status on (used by Rest's self-sleep and by scripted battles). */
export function forceStatus(
  state: BattleState,
  side: Side,
  status: StatusId,
  turns = 0,
): void {
  const creature = state.active(side);
  creature.status = status;
  creature.statusTurns = turns;
  state.emit({ type: 'status-applied', side, status });
}

export function cureStatus(state: BattleState, side: Side, status: StatusId): void {
  const creature = state.active(side);
  if (creature.status !== status) return;
  creature.status = null;
  creature.statusTurns = 0;
  state.emit({ type: 'status-cured', side, status });
}

export function cureAllStatuses(state: BattleState, side: Side): void {
  const creature = state.active(side);
  const status = creature.status;
  if (!status) return;
  creature.status = null;
  creature.statusTurns = 0;
  state.emit({ type: 'status-cured', side, status });
}

/**
 * End-of-turn damage and bookkeeping. Returns true when the creature fainted.
 * Handles Burn chip damage, Entangled draining (to the opposing side) and the
 * Sleep/Fear countdowns.
 */
export function endOfTurnStatus(state: BattleState, side: Side): boolean {
  const creature = state.active(side);
  if (creature.currentHp <= 0) return false;

  const status = creature.status;
  if (!status) return false;

  switch (status) {
    case 'burn': {
      const dmg = Math.max(1, Math.floor(maxHpOf(creature) / 16));
      creature.currentHp = Math.max(0, creature.currentHp - dmg);
      state.emit({
        type: 'status-damage',
        side,
        status,
        amount: dmg,
        hpRemaining: creature.currentHp,
      });
      break;
    }
    case 'entangled': {
      const dmg = Math.max(1, Math.floor(maxHpOf(creature) / 16));
      creature.currentHp = Math.max(0, creature.currentHp - dmg);
      state.emit({
        type: 'status-damage',
        side,
        status,
        amount: dmg,
        hpRemaining: creature.currentHp,
      });
      // The roots feed whoever holds them.
      const other = state.active(state.other(side));
      if (other.currentHp > 0) {
        const before = other.currentHp;
        other.currentHp = Math.min(maxHpOf(other), other.currentHp + dmg);
        const healed = other.currentHp - before;
        if (healed > 0) {
          state.emit({
            type: 'heal',
            side: state.other(side),
            amount: healed,
            hpRemaining: other.currentHp,
            maxHp: maxHpOf(other),
          });
        }
      }
      break;
    }
    case 'fear':
      if (creature.statusTurns > 0) creature.statusTurns -= 1;
      if (creature.statusTurns <= 0) cureStatus(state, side, 'fear');
      break;
    case 'sleep':
      // Sleep is decremented at the start of the creature's move instead, so
      // that a wake-up happens before it acts.
      break;
    default:
      break;
  }

  return creature.currentHp <= 0;
}

/** Decrement sleep at the point the creature tries to act. Returns true if awake. */
export function tickSleep(state: BattleState, side: Side): boolean {
  const creature = state.active(side);
  if (creature.status !== 'sleep') return true;
  creature.statusTurns -= 1;
  if (creature.statusTurns <= 0) {
    cureStatus(state, side, 'sleep');
    return true;
  }
  return false;
}

/** The 25% paralysis "loses the turn" roll. */
export function paralysisSkipsTurn(creature: CreatureInstance, rng = Math.random): boolean {
  if (creature.status !== 'paralyze') return false;
  return rng() < 0.25;
}

/** The 30% Fear flinch roll. */
export function fearFlinches(creature: CreatureInstance, rng = Math.random): boolean {
  if (creature.status !== 'fear') return false;
  return rng() < 0.3;
}

export function statusName(status: StatusId): string {
  return STATUS_INFO[status].name;
}

// Local helper to avoid an import cycle with Creature.ts's maxHp re-export.
function maxHpOf(creature: CreatureInstance): number {
  const base = speciesOf(creature).baseStats.hp;
  return Math.floor(((2 * base + creature.ivs.hp) * creature.level) / 100) + creature.level + 10;
}
