/**
 * A concrete creature in a save file or a battle: the *instance* of a species.
 *
 * Holds everything that changes over time — level, XP, HP, status, stat stages,
 * volatile conditions, PP — while the static facts (base stats, learnset,
 * evolution) live on the species record in `data/creatures.ts`.
 */

import { getAbility, type AbilityId, hasHook } from '../data/abilities';
import {
  getSpecies,
  type BaseStats,
  type CreatureId,
  type CreatureSpecies,
  type StatKey,
} from '../data/creatures';
import type { Element } from '../data/types';
import type { StageId, StatusId } from '../data/battleTypes';
import { getMove } from '../data/moves';
import { random, type RNG } from '../core/SeededRNG';
import {
  applyExp,
  calcHp,
  calcStat,
  clampStage,
  expForLevel,
  expToNextLevel,
  MAX_LEVEL,
  multiplierFor,
  STAT_LABELS,
} from './stats';

export const MAX_MOVES = 4;

export interface MoveSlot {
  id: string;
  pp: number;
  maxPp: number;
}

export interface VolatileState {
  soaked: boolean;
  dazzled: boolean;
  /** Turns of trapping remaining; 0 = not trapped. */
  trapped: number;
  protected: boolean;
  /** Turns of Reflect remaining. */
  reflectTurns: number;
  reflectFraction: number;
  flinch: boolean;
  /** Turns of Daze remaining. */
  daze: number;
  sureHit: boolean;
  focusEnergy: boolean;
  magnetPull: boolean;
  leechSeed: boolean;
  /** Move id being charged, or null. */
  charging: string | null;
}

export type Gender = 'male' | 'female' | 'none';

export interface CreatureInstance {
  /** Unique id within a save; used by the scene to track sprites. */
  uid: string;
  speciesId: CreatureId;
  nickname: string | null;
  level: number;
  /** XP accumulated *within* the current level. */
  expIntoLevel: number;
  /** Total XP, kept for display/sorting. Derived but cached. */
  exp: number;
  ivs: BaseStats;
  /** Current HP, persisted between battles. */
  currentHp: number;
  /** Major status or null. */
  status: StatusId | null;
  /** Remaining turns for sleep/fear. 0 when not applicable. */
  statusTurns: number;
  volatiles: VolatileState;
  /** Stat stages, reset at the start of every battle. */
  stages: Record<StageId, number>;
  moves: MoveSlot[];
  ability: AbilityId;
  shiny: boolean;
  gender: Gender;
  friendship: number;
  originalTrainer: string;
  metLocation: string;
  metLevel: number;
  /** True once this battle's Rebirth ability has been consumed. */
  revivedThisBattle: boolean;
  /** Set when the creature should evolve after the current battle. */
  pendingEvolution: string | null;
}

let uidCounter = 0;
export function newUid(): string {
  uidCounter += 1;
  return `c${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

export function emptyVolatiles(): VolatileState {
  return {
    soaked: false,
    dazzled: false,
    trapped: 0,
    protected: false,
    reflectTurns: 0,
    reflectFraction: 0.5,
    flinch: false,
    daze: 0,
    sureHit: false,
    focusEnergy: false,
    magnetPull: false,
    leechSeed: false,
    charging: null,
  };
}

export function emptyStages(): Record<StageId, number> {
  return {
    attack: 0,
    defense: 0,
    spPower: 0,
    spGuard: 0,
    speed: 0,
    accuracy: 0,
    evasion: 0,
  };
}

/** Roll an IV spread in 0..15, the range used by this game. */
export function rollIvs(rng: RNG = random): BaseStats {
  return {
    hp: rng.int(0, 15),
    attack: rng.int(0, 15),
    defense: rng.int(0, 15),
    spPower: rng.int(0, 15),
    spGuard: rng.int(0, 15),
    speed: rng.int(0, 15),
  };
}

/**
 * The four most recent moves a creature would know at `level`, newest last.
 * Falls back to the first learnset entry when the level is very low.
 */
export function movesForLevel(species: CreatureSpecies, level: number): string[] {
  const known = species.learnset
    .filter((entry) => entry.level <= level)
    .sort((a, b) => a.level - b.level)
    .map((entry) => entry.move);
  if (known.length === 0) {
    return species.learnset.slice(0, 1).map((entry) => entry.move);
  }
  // Keep the last four, but avoid duplicates.
  const unique: string[] = [];
  for (const id of known) if (!unique.includes(id)) unique.push(id);
  return unique.slice(-MAX_MOVES);
}

/** Build a fresh creature at a given level. */
export function createCreature(
  speciesId: CreatureId,
  level: number,
  options: Partial<CreatureInstance> & { rng?: RNG } = {},
): CreatureInstance {
  const species = getSpecies(speciesId);
  const rng = options.rng ?? random;
  const ivs = options.ivs ?? rollIvs(rng);
  const shiny = options.shiny ?? rng.chance(1 / 256);
  const learnset = movesForLevel(species, level);
  const moves: MoveSlot[] = learnset.map((id) => {
    const pp = getMove(id)?.pp ?? 10;
    return { id, pp, maxPp: pp };
  });

  const instance: CreatureInstance = {
    uid: options.uid ?? newUid(),
    speciesId,
    nickname: options.nickname ?? null,
    level,
    expIntoLevel: options.expIntoLevel ?? 0,
    exp: options.exp ?? expForLevel(level),
    ivs,
    currentHp: options.currentHp ?? 0,
    status: options.status ?? null,
    statusTurns: options.statusTurns ?? 0,
    volatiles: options.volatiles ?? emptyVolatiles(),
    stages: options.stages ?? emptyStages(),
    moves: options.moves ?? moves,
    ability: options.ability ?? species.ability,
    shiny,
    gender: options.gender ?? rollGender(species, rng),
    friendship: options.friendship ?? 70,
    originalTrainer: options.originalTrainer ?? 'Trainer',
    metLocation: options.metLocation ?? 'Prismara',
    metLevel: options.metLevel ?? level,
    revivedThisBattle: false,
    pendingEvolution: null,
  };
  if (options.currentHp === undefined) instance.currentHp = maxHp(instance);
  return instance;
}

function movePp(id: string): number {
  return getMove(id)?.pp ?? 10;
}

const GENDERLESS: CreatureId[] = ['shardling', 'prismantis', 'glimmoth', 'aetherion'];

function rollGender(species: CreatureSpecies, rng: RNG): Gender {
  if (GENDERLESS.includes(species.id)) return 'none';
  return rng.chance(0.5) ? 'male' : 'female';
}

/* ------------------------------------------------------------------ stats -- */

export function speciesOf(creature: CreatureInstance): CreatureSpecies {
  return getSpecies(creature.speciesId);
}

export function elementsOf(creature: CreatureInstance): Element[] {
  return [speciesOf(creature).element];
}

export function displayName(creature: CreatureInstance): string {
  return creature.nickname ?? speciesOf(creature).name;
}

export function maxHp(creature: CreatureInstance): number {
  return calcHp(speciesOf(creature).baseStats.hp, creature.ivs.hp, creature.level);
}

/** Raw stat with no stages applied. */
export function rawStat(creature: CreatureInstance, stat: StatKey): number {
  const base = speciesOf(creature).baseStats[stat];
  return calcStat(base, creature.ivs[stat], creature.level);
}

/** Convenience: every raw stat plus the computed max HP. */
export function statBlock(creature: CreatureInstance): BaseStats & { hp: number } {
  return {
    hp: maxHp(creature),
    attack: rawStat(creature, 'attack'),
    defense: rawStat(creature, 'defense'),
    spPower: rawStat(creature, 'spPower'),
    spGuard: rawStat(creature, 'spGuard'),
    speed: rawStat(creature, 'speed'),
  };
}

/**
 * A stat after stage multipliers and status modifiers.
 *
 *  - Burn halves Attack.
 *  - Paralyze halves Speed.
 *  - Soaked is treated as one stage of Speed down (x2/3).
 *  - Dazzled is treated as two stages of Accuracy down.
 *  - Night Hunter / Aurora Mane can scale Speed by time of day.
 */
export function effectiveStat(
  creature: CreatureInstance,
  stat: StageId,
  context: { timeOfDay?: 'day' | 'night'; weather?: string } = {},
): number {
  if (stat === 'accuracy' || stat === 'evasion') {
    let stage = creature.stages[stat];
    if (stat === 'accuracy' && creature.volatiles.dazzled) stage -= 2;
    if (stat === 'accuracy' && hasHook(creature.ability, 'accuracy-lock') && stage < 0) stage = 0;
    return Math.max(1, Math.round(multiplierFor(stat, stage) * 100));
  }

  const base = rawStat(creature, stat);
  let mult = multiplierFor(stat, creature.stages[stat]);

  if (stat === 'attack' && creature.status === 'burn') mult *= 0.5;
  if (stat === 'speed') {
    if (creature.status === 'paralyze') mult *= 0.5;
    if (creature.volatiles.soaked) mult *= 2 / 3;
    const ability = getAbility(creature.ability);
    if (hasHook(creature.ability, 'time-speed') && context.timeOfDay === ability.timeOfDay) {
      mult *= 1.5;
    }
  }
  return Math.max(1, Math.floor(base * mult));
}

/* ------------------------------------------------------------------ status -- */

export function isFainted(creature: CreatureInstance): boolean {
  return creature.currentHp <= 0;
}

export function hpFraction(creature: CreatureInstance): number {
  return creature.currentHp / maxHp(creature);
}

export function heal(creature: CreatureInstance, amount: number): number {
  const before = creature.currentHp;
  creature.currentHp = Math.min(maxHp(creature), creature.currentHp + Math.max(0, amount));
  return creature.currentHp - before;
}

export function damage(creature: CreatureInstance, amount: number): number {
  const before = creature.currentHp;
  creature.currentHp = Math.max(0, creature.currentHp - Math.max(0, amount));
  return before - creature.currentHp;
}

export function fullHealCreature(creature: CreatureInstance): void {
  creature.currentHp = maxHp(creature);
  creature.status = null;
  creature.statusTurns = 0;
  creature.volatiles = emptyVolatiles();
}

/** Reset per-battle state (stages, volatiles) without touching HP/PP. */
export function resetBattleState(creature: CreatureInstance): void {
  creature.stages = emptyStages();
  creature.volatiles = emptyVolatiles();
  creature.revivedThisBattle = false;
}

export function clearVolatiles(creature: CreatureInstance): void {
  creature.volatiles = emptyVolatiles();
}

/* ---------------------------------------------------------------- levelling -- */

export interface LevelUpResult {
  levelsGained: number;
  newLevel: number;
  /** Move ids newly available at the new level(s). */
  newMoves: string[];
  evolutionPending: string | null;
}

/** Award XP and report what changed. */
export function gainExp(creature: CreatureInstance, amount: number): LevelUpResult {
  const before = creature.level;
  creature.exp += amount;
  const result = applyExp(creature.level, creature.expIntoLevel, amount);
  creature.level = result.level;
  creature.expIntoLevel = result.expIntoLevel;

  const newMoves: string[] = [];
  if (creature.level > before) {
    const species = speciesOf(creature);
    for (let lvl = before + 1; lvl <= creature.level; lvl++) {
      for (const entry of species.learnset) {
        if (entry.level === lvl && !creature.moves.some((m) => m.id === entry.move)) {
          if (!newMoves.includes(entry.move)) newMoves.push(entry.move);
        }
      }
    }
    // HP grows with level: award the difference so it does not lose HP.
    creature.currentHp += maxHp(creature) - calcHp(
      speciesOf(creature).baseStats.hp,
      creature.ivs.hp,
      before,
    );
    creature.currentHp = Math.min(creature.currentHp, maxHp(creature));
    const evolution = speciesOf(creature).evolution;
    if (evolution && creature.level >= evolution.level) {
      creature.pendingEvolution = evolution.into;
    }
  }
  return {
    levelsGained: creature.level - before,
    newLevel: creature.level,
    newMoves,
    evolutionPending: creature.pendingEvolution,
  };
}

/** Progress toward the next level, 0..1. */
export function expProgress(creature: CreatureInstance): number {
  if (creature.level >= MAX_LEVEL) return 1;
  const need = expToNextLevel(creature.level);
  return need <= 0 ? 1 : Math.min(1, creature.expIntoLevel / need);
}

export function xpToNext(creature: CreatureInstance): number {
  return creature.level >= MAX_LEVEL ? 0 : expToNextLevel(creature.level);
}

/* --------------------------------------------------------------- learnset -- */

export function knowsMove(creature: CreatureInstance, moveId: string): boolean {
  return creature.moves.some((m) => m.id === moveId);
}

export function hasRoomForMove(creature: CreatureInstance): boolean {
  return creature.moves.length < MAX_MOVES;
}

export function addMove(creature: CreatureInstance, moveId: string): void {
  const pp = movePp(moveId);
  creature.moves.push({ id: moveId, pp, maxPp: pp });
}

/** Replace the move at `index` (returns the id that was forgotten). */
export function replaceMove(creature: CreatureInstance, index: number, moveId: string): string {
  const old = creature.moves[index]?.id ?? '';
  const pp = movePp(moveId);
  creature.moves[index] = { id: moveId, pp, maxPp: pp };
  return old;
}

export function forgetMove(creature: CreatureInstance, index: number): string {
  const old = creature.moves[index]?.id ?? '';
  creature.moves.splice(index, 1);
  return old;
}

/** Restore all PP (used by Healing Centers). */
export function restorePp(creature: CreatureInstance): void {
  for (const slot of creature.moves) slot.pp = slot.maxPp;
}

export function ppFraction(creature: CreatureInstance): number {
  let cur = 0;
  let max = 0;
  for (const slot of creature.moves) {
    cur += slot.pp;
    max += slot.maxPp;
  }
  return max === 0 ? 0 : cur / max;
}

/* ------------------------------------------------------------------ stages -- */

export function applyStage(
  creature: CreatureInstance,
  stat: StageId,
  delta: number,
  maxStage = 6,
): number {
  const capped = stat === 'accuracy' || stat === 'evasion' ? 6 : maxStage;
  const before = creature.stages[stat];
  const after = clampStage(Math.max(-capped, Math.min(capped, before + delta)));
  creature.stages[stat] = after;
  return after - before;
}

export function resetStages(creature: CreatureInstance): void {
  creature.stages = emptyStages();
}

/* -------------------------------------------------------------- abilities -- */

export function hasAbility(creature: CreatureInstance, hook: Parameters<typeof hasHook>[1]): boolean {
  return hasHook(creature.ability, hook);
}

export function abilityOf(creature: CreatureInstance) {
  return getAbility(creature.ability);
}

/** Friendship gained from walking/levelling, capped. */
export function addFriendship(creature: CreatureInstance, amount: number): void {
  creature.friendship = Math.max(0, Math.min(255, creature.friendship + amount));
}

/** A short "HP bar colour" hint for the UI. */
export function hpColor(creature: CreatureInstance): number {
  const f = hpFraction(creature);
  if (f > 0.5) return 0x4cd964;
  if (f > 0.2) return 0xffd60a;
  return 0xff4d4d;
}

export { STAT_LABELS };
