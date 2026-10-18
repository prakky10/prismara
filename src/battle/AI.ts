/**
 * Trainer AI, in three tiers (design doc §5.1):
 *
 *  - `youngster` — picks a random move. Kids are unpredictable.
 *  - `trainer`   — picks the highest expected damage, with 10% randomness.
 *  - `master`    — scores moves on damage, KO chance, status value, setup
 *                  potential and healing, and switches out of terrible matchups.
 *
 * All of it is a pure read of `BattleState`, so it can be driven headless by the
 * balance simulator.
 */

import type { Side } from '../data/battleTypes';
import { getMove, type MoveData } from '../data/moves';
import { getSpecies } from '../data/creatures';
import { typeEffectiveness } from '../data/types';
import { effectiveStat, hpFraction, isFainted, type CreatureInstance } from './Creature';
import type { BattleState } from './BattleState';
import { expectedDamage } from './DamageCalc';
import type { BattleAction } from './TurnResolver';

export function chooseAIAction(state: BattleState, side: Side): BattleAction {
  const me = state.active(side);
  const foe = state.active(state.other(side));
  const usable = usableMoveIndices(me);

  if (usable.length === 0) return { kind: 'move', moveIndex: 0 };

  switch (state.aiTier) {
    case 'youngster':
      return { kind: 'move', moveIndex: pick(usable, state) };
    case 'master':
      return masterChoice(state, side, me, foe, usable);
    case 'trainer':
    default: {
      if (state.rng.chance(0.1)) return { kind: 'move', moveIndex: pick(usable, state) };
      return { kind: 'move', moveIndex: bestDamageIndex(state, me, foe, usable) };
    }
  }
}

function pick<T>(items: T[], state: BattleState): T {
  return items[state.rng.int(0, items.length - 1)];
}

/** Indices of moves that still have PP. */
export function usableMoveIndices(creature: CreatureInstance): number[] {
  const out: number[] = [];
  creature.moves.forEach((slot, index) => {
    if (slot.pp > 0) out.push(index);
  });
  return out;
}

function bestDamageIndex(
  state: BattleState,
  me: CreatureInstance,
  foe: CreatureInstance,
  usable: number[],
): number {
  let bestIndex = usable[0];
  let bestScore = -1;
  for (const index of usable) {
    const move = getMove(me.moves[index].id);
    if (!move) continue;
    const score = scoreMove(state, me, foe, move);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/** Raw expected damage, ignoring all the strategic bonuses. */
function damageScore(state: BattleState, me: CreatureInstance, foe: CreatureInstance, move: MoveData): number {
  if (move.category === 'status' || move.power <= 0) return 0;
  const result = expectedDamage(me, foe, move, state.context);
  return result.damage * (move.accuracy === 'bypass' ? 1 : move.accuracy / 100);
}

/**
 * A strategic score for a single move, from the AI's point of view. Higher is
 * better. Damage dominates; everything else is a nudge.
 */
export function scoreMove(
  state: BattleState,
  me: CreatureInstance,
  foe: CreatureInstance,
  move: MoveData,
): number {
  let score = damageScore(state, me, foe, move);

  // A guaranteed KO is worth far more than raw damage.
  if (move.category !== 'status' && move.power > 0) {
    if (score >= foe.currentHp) score += 200;
  }

  const effects = move.effects ?? [];
  for (const effect of effects) {
    const chance = 'chance' in effect ? (effect.chance ?? 1) : 1;
    switch (effect.kind) {
      case 'status': {
        // Only worth it if the foe can actually receive it.
        if (!foe.status) score += 26 * chance;
        break;
      }
      case 'volatile': {
        if (effect.volatile === 'soaked' && !foe.volatiles.soaked) score += 10 * chance;
        if (effect.volatile === 'dazzled' && !foe.volatiles.dazzled) score += 12 * chance;
        break;
      }
      case 'heal': {
        const missing = 1 - hpFraction(me);
        score += missing * 140 * (effect.fraction ?? 0.5);
        break;
      }
      case 'drain':
        score += score * (effect.fraction ?? 0) * 0.4;
        break;
      case 'recoil':
        score -= Math.min(score, Math.max(1, Math.floor(score * effect.fraction))) * 0.7;
        break;
      case 'weather':
        score += 14;
        break;
      case 'protect':
        score += 6;
        break;
      case 'stat': {
        // Setup is better early and when healthy; debuffs are better early too.
        const healthy = hpFraction(me);
        const turnFactor = Math.max(0.2, 1 - state.turn * 0.04);
        const magnitude = Object.values(effect.changes).reduce(
          (sum, v) => sum + Math.abs(v ?? 0),
          0,
        );
        score += 8 * magnitude * healthy * turnFactor * chance;
        break;
      }
      case 'reflect':
      case 'crit-stage':
      case 'sure-hit':
        score += 7;
        break;
      default:
        break;
    }
  }

  // Penalise moves that cannot affect the foe at all.
  const eff = typeEffectiveness(move.type, getSpecies(foe.speciesId).element);
  if (move.category !== 'status' && eff < 1) score *= eff;

  return score;
}

/**
 * The `master` tier: consider switching, then score every move.
 */
function masterChoice(
  state: BattleState,
  side: Side,
  me: CreatureInstance,
  foe: CreatureInstance,
  usable: number[],
): BattleAction {
  // Look for a clearly better creature if we are in danger.
  const incoming = worstIncoming(state, me, foe);
  const danger = incoming >= me.currentHp * 0.9;
  if (danger && hpFraction(me) < 0.45) {
    const better = findBetterSwitch(state, side, me, foe);
    if (better >= 0) return { kind: 'switch', index: better };
  }

  let bestIndex = usable[0];
  let bestScore = -Infinity;
  for (const index of usable) {
    const move = getMove(me.moves[index].id);
    if (!move) continue;
    // Small jitter keeps battles from looking robotic.
    const score = scoreMove(state, me, foe, move) * state.rng.float(0.97, 1.03);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return { kind: 'move', moveIndex: bestIndex };
}

/** The hardest hit the foe could land on us with its current moves. */
function worstIncoming(state: BattleState, me: CreatureInstance, foe: CreatureInstance): number {
  let worst = 0;
  for (const slot of foe.moves) {
    const move = getMove(slot.id);
    if (!move || move.power <= 0) continue;
    const result = expectedDamage(foe, me, move, state.context);
    worst = Math.max(worst, result.damage);
  }
  return worst;
}

/** Index of the party member that best counters the foe, or -1. */
function findBetterSwitch(
  state: BattleState,
  side: Side,
  current: CreatureInstance,
  foe: CreatureInstance,
): number {
  const party = state.party(side);
  const currentScore = matchupScore(current, foe);
  let best = -1;
  let bestScore = currentScore;
  party.forEach((creature, index) => {
    if (creature === current || isFainted(creature)) return;
    const score = matchupScore(creature, foe);
    if (score > bestScore + 20) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/** Positive when the creature has a good offensive/defensive matchup. */
function matchupScore(creature: CreatureInstance, foe: CreatureInstance): number {
  const myType = getSpecies(creature.speciesId).element;
  const foeType = getSpecies(foe.speciesId).element;
  const offense = typeEffectiveness(myType, foeType);
  const defense = typeEffectiveness(foeType, myType);
  const speedEdge = effectiveStat(creature, 'speed') - effectiveStat(foe, 'speed');
  return offense * 30 - defense * 30 + speedEdge * 0.2 + hpFraction(creature) * 20;
}

/** The tier label shown before a trainer battle. */
export function aiTierLabel(tier: BattleState['aiTier']): string {
  switch (tier) {
    case 'youngster':
      return 'A cheerful youngster';
    case 'master':
      return 'An elite trainer';
    default:
      return 'A trainer';
  }
}
