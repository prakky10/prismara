/**
 * Stat maths: raw values from base stats + IVs + level, then stage multipliers.
 *
 * Formula (design doc §5.1):
 *   HP    = floor((2*base + iv) * level / 100) + level + 10
 *   other = floor((2*base + iv) * level / 100) + 5
 *
 * Stage multipliers for the five combat stats:
 *   (2 + s) / 2  for s >= 0     2 / (2 - s)  for s < 0
 * Accuracy and evasion use thirds instead:
 *   (3 + s) / 3  for s >= 0     3 / (3 - s)  for s < 0
 */

import type { StageId, StatId } from '../data/battleTypes';

export type { StageId, StatId };

export const STAGE_MIN = -6;
export const STAGE_MAX = 6;

/** Raw (un-staged) HP for the given base stat, IV and level. */
export function calcHp(baseHp: number, iv: number, level: number): number {
  return Math.floor(((2 * baseHp + iv) * level) / 100) + level + 10;
}

/** Raw (un-staged) value for a non-HP stat. */
export function calcStat(base: number, iv: number, level: number): number {
  return Math.floor(((2 * base + iv) * level) / 100) + 5;
}

/** Multiplier from a stage value, for the five combat stats. */
export function stageMultiplier(stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/** Multiplier from a stage value, for accuracy and evasion. */
export function accuracyMultiplier(stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

export function clampStage(stage: number): number {
  return Math.max(STAGE_MIN, Math.min(STAGE_MAX, Math.trunc(stage)));
}

export function isAccuracyStat(stat: StageId): boolean {
  return stat === 'accuracy' || stat === 'evasion';
}

/** Multiplier for any stage id. */
export function multiplierFor(stat: StageId, stage: number): number {
  return isAccuracyStat(stat) ? accuracyMultiplier(stage) : stageMultiplier(stage);
}

/**
 * The medium-fast experience curve: total XP needed to *reach* a level.
 *   xp(level) = level^3
 */
export function expForLevel(level: number): number {
  return Math.floor(level ** 3);
}

/** XP required to advance from `level` to `level + 1`. */
export function expToNextLevel(level: number): number {
  return expForLevel(level + 1) - expForLevel(level);
}

export const MAX_LEVEL = 60;

/** Levels gained by adding `gained` XP; returns the new level and leftovers. */
export function applyExp(level: number, expIntoLevel: number, gained: number): {
  level: number;
  expIntoLevel: number;
} {
  let lvl = level;
  let xp = expIntoLevel + gained;
  while (lvl < MAX_LEVEL && xp >= expToNextLevel(lvl)) {
    xp -= expToNextLevel(lvl);
    lvl++;
  }
  if (lvl >= MAX_LEVEL) xp = 0;
  return { level: lvl, expIntoLevel: xp };
}

/**
 * XP awarded for defeating a creature.
 *   xp = floor(baseExp * enemyLevel / 7)  (then split across participants)
 */
export function expAward(baseExp: number, enemyLevel: number, participants = 1): number {
  const total = Math.floor((baseExp * enemyLevel) / 7);
  return Math.max(1, Math.floor(total / Math.max(1, participants)));
}

/** Stat label helpers for the UI. */
export const STAT_LABELS: Record<StatId | 'hp', string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  spPower: 'Sp. Power',
  spGuard: 'Sp. Guard',
  speed: 'Speed',
};

export const STAT_SHORT: Record<StatId | 'hp', string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  spPower: 'SpA',
  spGuard: 'SpD',
  speed: 'Spe',
};
