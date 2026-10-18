/**
 * Damage and accuracy.
 *
 * Damage (design doc §5.1):
 *   (((2*L/5 + 2) * Power * A / D) / 50) + 2
 *   then x STAB x type-effectiveness x crit x random(0.85-1.0)
 *   x weather x burn x ability modifiers
 *
 * Everything here is a pure function of the two creatures, the move and the
 * field context, which is what makes the balance simulator and the unit tests
 * meaningful.
 */

import { hasHook } from '../data/abilities';
import type { WeatherKind } from '../data/battleTypes';
import { getMove, type MoveData, type MoveTag } from '../data/moves';
import {
  ELEMENTS,
  stabMultiplier,
  typeEffectiveness,
  type Element,
  type MoveType,
} from '../data/types';
import type { RNG } from '../core/SeededRNG';
import {
  abilityOf,
  effectiveStat,
  elementsOf,
  hpFraction,
  isFainted,
  speciesOf,
  type CreatureInstance,
} from './Creature';
import { maxHp } from './Creature';

export interface FieldContext {
  weather: WeatherKind;
  timeOfDay: 'day' | 'night';
  isCave: boolean;
}

export interface DamageResult {
  /** Final HP lost (>= 0). */
  damage: number;
  /** Multiplier from type matchups (0.5, 1 or 2). */
  effectiveness: number;
  crit: boolean;
  stab: number;
  /** True when the move did nothing because of type immunity (not used yet). */
  immune: boolean;
}

/** Crit chance for a given crit stage (0 = normal). */
export function critChance(stage: number): number {
  switch (Math.max(0, Math.min(4, stage))) {
    case 0:
      return 1 / 16;
    case 1:
      return 1 / 8;
    case 2:
      return 1 / 2;
    default:
      return 1 / 2;
  }
}

/** Resolve the element a move actually uses, honouring Spectrum Burst. */
export function resolvedMoveType(move: MoveData, defender: CreatureInstance): MoveType {
  if (move.tags?.includes('best-type')) {
    const defElement = speciesOf(defender).element;
    let best: { type: Element; mult: number } | null = null;
    for (const type of ELEMENTS) {
      const mult = typeEffectiveness(type, defElement);
      if (!best || mult > best.mult) best = { type, mult };
    }
    return best?.type ?? move.type;
  }
  return move.type;
}

/** Damage multiplier from the weather for a given move type. */
export function weatherDamageMultiplier(weather: WeatherKind, type: MoveType): number {
  if (weather === 'sunny') {
    if (type === 'fire') return 1.5;
    if (type === 'water') return 0.5;
  }
  if (weather === 'rain') {
    if (type === 'water') return 1.5;
    if (type === 'fire') return 0.5;
  }
  return 1;
}

/**
 * Power after tag-driven adjustments (Soaked targets, statused targets, pinch
 * boosts). Returned separately so the UI can show "it hit harder!".
 */
export function effectivePower(
  move: MoveData,
  attacker: CreatureInstance,
  defender: CreatureInstance,
): { power: number; boosted: boolean } {
  let power = move.power;
  let boosted = false;
  const tags = move.tags ?? [];
  const has = (tag: MoveTag) => tags.includes(tag);

  if (has('bonus-vs-soaked') && defender.volatiles.soaked) {
    power *= 1.5;
    boosted = true;
  }
  if (has('double-vs-status') && defender.status) {
    power *= 2;
    boosted = true;
  }
  if (has('pinch-power') && hpFraction(attacker) <= 1 / 3) {
    power *= 1.5;
    boosted = true;
  }
  const ability = abilityOf(attacker);
  if (ability.hooks.includes('pinch-boost') && hpFraction(attacker) <= 1 / 3) {
    if (ability.element === move.type) {
      power *= 1.5;
      boosted = true;
    }
  }
  if (ability.hooks.includes('weather-boost') && ability.element === move.type) {
    power *= 1.5;
    boosted = true;
  }
  return { power: Math.round(power), boosted };
}

/** STAB for this move, honouring Six Elements and Neutral moves. */
export function stabFor(
  move: MoveData,
  attacker: CreatureInstance,
  resolvedType: MoveType,
): number {
  if (hasHook(attacker.ability, 'omni-stab') && move.category !== 'status') return 1.5;
  return stabMultiplier(resolvedType, elementsOf(attacker));
}

/**
 * Chance (0..1) that the move connects. `bypass` accuracy always hits, as do
 * certain conditions such as Rain + Electric or the Locked On volatile.
 */
export function hitChance(
  move: MoveData,
  attacker: CreatureInstance,
  defender: CreatureInstance,
  context: FieldContext,
): number {
  if (move.accuracy === 'bypass') return 1;
  if (attacker.volatiles.sureHit) return 1;
  if (context.weather === 'rain' && move.type === 'electric') return 1;

  let chance = move.accuracy / 100;

  // Accuracy stage (Dazzled folds in via effectiveStat).
  const accStage = attacker.stages.accuracy - (attacker.volatiles.dazzled ? 2 : 0);
  chance *= accStage >= 0 ? (3 + accStage) / 3 : 3 / (3 - accStage);

  // Evasion stage of the target.
  let evaStage = defender.stages.evasion;
  const defAbility = abilityOf(defender);
  if (defAbility.hooks.includes('weather-evasion') && defAbility.weather === context.weather) {
    evaStage += 1;
  }
  chance /= evaStage >= 0 ? (3 + evaStage) / 3 : 3 / (3 - evaStage);

  return Math.max(0.05, Math.min(1, chance));
}

export interface CalculateOptions {
  context: FieldContext;
  rng: RNG;
  /** Force a critical hit (used by tests). */
  forceCrit?: boolean;
}

export function calculateDamage(
  attacker: CreatureInstance,
  defender: CreatureInstance,
  move: MoveData,
  options: CalculateOptions,
): DamageResult {
  const { context, rng } = options;
  const none: DamageResult = {
    damage: 0,
    effectiveness: 1,
    crit: false,
    stab: 1,
    immune: false,
  };
  if (move.category === 'status' || move.power <= 0) return none;
  if (isFainted(attacker) || isFainted(defender)) return none;

  const resolvedType = resolvedMoveType(move, defender);
  const defElement = speciesOf(defender).element;
  const effectiveness = typeEffectiveness(resolvedType, defElement);

  const attackStat = move.category === 'physical' ? 'attack' : 'spPower';
  const defenseStat = move.category === 'physical' ? 'defense' : 'spGuard';

  const atk = effectiveStat(attacker, attackStat, context);
  const def = effectiveStat(defender, defenseStat, context);

  const { power } = effectivePower(move, attacker, defender);
  const level = attacker.level;

  let dmg = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * power * atk) / def) / 50) + 2;

  const stab = stabFor(move, attacker, resolvedType);

  // Critical hit.
  let crit = false;
  if (!hasHook(defender.ability, 'crit-immune')) {
    let stage = move.critStage ?? 0;
    if (attacker.volatiles.focusEnergy) stage += 1;
    crit = options.forceCrit ?? rng.chance(critChance(stage));
  }
  const critMult = crit ? 1.5 : 1;

  // Weather, then random spread.
  const weatherMult = weatherDamageMultiplier(context.weather, resolvedType);
  const roll = rng.float(0.85, 1);

  dmg = Math.floor(dmg * stab * effectiveness * critMult * weatherMult * roll);

  // Defender abilities that soften incoming damage.
  const defAbility = abilityOf(defender);
  if (
    defAbility.hooks.includes('full-hp-resist') &&
    effectiveness >= 2 &&
    defender.currentHp >= maxHp(defender)
  ) {
    dmg = Math.floor(dmg * 0.5);
  }
  if (defAbility.hooks.includes('special-resist') && move.category === 'special') {
    dmg = Math.floor(dmg * (defAbility.fraction ?? 0.8));
  }
  if (defender.volatiles.reflectTurns > 0 && move.category === 'special') {
    dmg = Math.floor(dmg * (1 - defender.volatiles.reflectFraction));
  }

  // Always leave at least 1 damage from a connecting damaging move.
  dmg = Math.max(1, dmg);

  return { damage: dmg, effectiveness, crit, stab, immune: false };
}

/** Recoil damage the user takes from a move like Struggle. */
export function recoilDamage(dealt: number, move: MoveData): number {
  const effect = move.effects?.find((e) => e.kind === 'recoil');
  if (!effect || effect.kind !== 'recoil') return 0;
  return Math.max(1, Math.floor(dealt * effect.fraction));
}

/** Convenience for the AI: rough expected damage without randomness. */
export function expectedDamage(
  attacker: CreatureInstance,
  defender: CreatureInstance,
  move: MoveData,
  context: FieldContext,
): DamageResult {
  const resolvedType = resolvedMoveType(move, defender);
  const effectiveness = typeEffectiveness(resolvedType, speciesOf(defender).element);
  const attackStat = move.category === 'physical' ? 'attack' : 'spPower';
  const defenseStat = move.category === 'physical' ? 'defense' : 'spGuard';
  const atk = effectiveStat(attacker, attackStat, context);
  const def = effectiveStat(defender, defenseStat, context);
  const { power } = effectivePower(move, attacker, defender);
  const base =
    Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * atk) / def) / 50) + 2;
  const stab = stabFor(move, attacker, resolvedType);
  const weatherMult = weatherDamageMultiplier(context.weather, resolvedType);
  const raw = Math.floor(base * stab * effectiveness * weatherMult * 0.925);
  return {
    damage: Math.max(1, raw),
    effectiveness,
    crit: false,
    stab,
    immune: false,
  };
}

export { getMove };
