/**
 * Capture.
 *
 *   a = catchRate * (3*maxHP - 2*HP) / (3*maxHP) * orbBonus * statusBonus * CATCH_EASE
 *
 * A Master Prism always succeeds. Otherwise the game performs three shake
 * checks; the number that pass is the number of times the orb wobbles before
 * the creature either breaks free or is caught.
 */

import { ITEMS, type ItemEffect, type ItemId } from '../data/items';
import type { StatusId } from '../data/battleTypes';
import type { RNG } from '../core/SeededRNG';
import { speciesOf, type CreatureInstance } from './Creature';
import { maxHp } from './Creature';

/** Extra information a situational orb needs. */
export interface CaptureContext {
  /** Zero-based battle turn. Turn zero is the battle's first turn. */
  turn?: number;
  /** The target creature's element, e.g. 'water'. */
  targetElement?: string;
  /** The target creature's level. */
  targetLevel?: number;
}

export interface CaptureOptions {
  /** True at night (for the Dusk Orb). */
  isNight: boolean;
  /** True when the battle takes place in a cave (for the Dusk Orb). */
  isCave: boolean;
  /** Current HP fraction thresholds already applied. */
  rng: RNG;
  /** Zero-based battle turn. Defaults to 0. */
  turn?: number;
}

export interface CaptureResult {
  caught: boolean;
  /** 0-3 successful wobbles. */
  shakes: number;
  /** The raw `a` value, useful for the balance simulator and tests. */
  catchValue: number;
  bonus: number;
  statusBonus: number;
}

type OrbEffect = Extract<ItemEffect, { kind: 'orb' }>;

/** The target's element, taken from the species' public `element` field. */
function targetElementOf(target: CreatureInstance): string | undefined {
  return speciesOf(target).element;
}

/** Validate that an item is a throwable orb, and return its effect. */
function orbEffectOf(itemId: ItemId): OrbEffect {
  const item = ITEMS[itemId];
  if (!item) throw new Error(`Unknown item: ${itemId}`);
  if (item.effect.kind !== 'orb') throw new Error(`Item ${itemId} is not a capture orb`);
  return item.effect;
}

/** Multiplier applied for a status condition. */
export function statusCatchBonus(status: StatusId | null): number {
  switch (status) {
    case 'sleep':
      return 2.5;
    case 'entangled':
      return 2;
    case 'burn':
    case 'paralyze':
    case 'fear':
      return 1.5;
    default:
      return 1;
  }
}

/** Effective orb multiplier in the current context. */
export function orbBonus(
  itemId: ItemId,
  isNight: boolean,
  isCave: boolean,
  context?: CaptureContext,
): number {
  const item = ITEMS[itemId];
  if (!item || item.effect.kind !== 'orb') return 1;
  const effect = item.effect as OrbEffect;
  const turn = context?.turn ?? 0;
  let bonus = effect.bonus;

  if (effect.duskBonus && (isNight || isCave)) bonus = Math.max(bonus, effect.duskBonus);
  if (effect.elementBonus && context?.targetElement === effect.elementBonus.element) {
    bonus = Math.max(bonus, effect.elementBonus.bonus);
  }
  if (effect.firstTurnBonus && turn === 0) bonus = Math.max(bonus, effect.firstTurnBonus);
  if (effect.timerBonus) {
    bonus = Math.max(bonus, Math.min(effect.timerBonus.cap, 1 + turn * effect.timerBonus.perTurn));
  }
  if (
    effect.levelBonus &&
    context?.targetLevel !== undefined &&
    context.targetLevel <= effect.levelBonus.maxLevel
  ) {
    bonus = Math.max(bonus, effect.levelBonus.bonus);
  }
  return bonus;
}

/** Global easing on every catch so captures feel fair without trivialising legendaries. */
export const CATCH_EASE = 1.5;

/** The catch value `a` before the shake checks. */
export function catchValue(
  target: CreatureInstance,
  itemId: ItemId,
  isNight: boolean,
  isCave: boolean,
  context?: CaptureContext,
): { value: number; bonus: number; statusBonus: number } {
  const species = speciesOf(target);
  const max = maxHp(target);
  const hp = Math.max(1, target.currentHp);
  const bonus = orbBonus(itemId, isNight, isCave, {
    turn: context?.turn,
    targetElement: context?.targetElement ?? targetElementOf(target),
    targetLevel: context?.targetLevel ?? target.level,
  });
  const status = statusCatchBonus(target.status);

  const value = species.catchRate * ((3 * max - 2 * hp) / (3 * max)) * bonus * status * CATCH_EASE;
  return { value, bonus, statusBonus: status };
}

/** Probability each individual shake check succeeds. */
export function shakeProbability(catchValueA: number): number {
  if (catchValueA <= 0) return 0;
  if (catchValueA >= 255) return 1;
  // b = 65536 / (255 / a)^(1/4)
  const b = 65536 / Math.pow(255 / catchValueA, 0.25);
  return Math.min(1, b / 65536);
}

export function attemptCapture(
  target: CreatureInstance,
  itemId: ItemId,
  options: CaptureOptions,
): CaptureResult {
  const effect = orbEffectOf(itemId);
  const turn = options.turn ?? 0;
  const context: CaptureContext = {
    turn,
    targetElement: targetElementOf(target),
    targetLevel: target.level,
  };

  const { value, bonus, statusBonus } = catchValue(
    target,
    itemId,
    options.isNight,
    options.isCave,
    context,
  );

  if (target.currentHp <= 0) {
    return { caught: false, shakes: 0, catchValue: 0, bonus, statusBonus };
  }

  if (effect.master === true) {
    return { caught: true, shakes: 3, catchValue: 255, bonus, statusBonus };
  }

  const chance = shakeProbability(value);
  let shakes = 0;
  for (let i = 0; i < 3; i++) {
    if (options.rng.next() < chance) shakes++;
    else break;
  }
  const caught = shakes >= 3;
  return { caught, shakes, catchValue: value, bonus, statusBonus };
}

/** Human-readable odds, shown in the Prismadex and by the balance simulator. */
export function catchOddsPercent(
  target: CreatureInstance,
  itemId: ItemId,
  isNight: boolean,
  isCave: boolean,
  context?: CaptureContext,
): number {
  const effect = orbEffectOf(itemId);
  if (target.currentHp <= 0) return 0;
  if (effect.master === true) return 100;
  const { value } = catchValue(target, itemId, isNight, isCave, context);
  const p = shakeProbability(value);
  return Math.round(p ** 3 * 1000) / 10;
}
