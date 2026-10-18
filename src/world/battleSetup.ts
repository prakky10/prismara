/**
 * Helpers that bridge the overworld to the battle engine: turning data into
 * creatures, choosing their moves, and assembling a `BattleState`.
 */

import {
  addMove,
  createCreature,
  forgetMove,
  hasRoomForMove,
  MAX_MOVES,
  type CreatureInstance,
} from '../battle/Creature';
import { BattleState, fieldContext, type AITier } from '../battle/BattleState';
import { getMove, movesOfType, isDamaging } from '../data/moves';
import { getSpecies, type CreatureId } from '../data/creatures';
import { ELEMENTS, typeEffectiveness } from '../data/types';
import { random } from '../core/SeededRNG';
import type { GameState } from '../core/GameState';
import type { ClockState } from '../core/Time';
import { timeOfDay } from '../core/Time';
import type { TrainerDef } from './trainers';

/**
 * Give a creature the best four moves it could know at its level. Trainers use
 * this so their creatures always have a sensible, threatening moveset.
 */
export function maximizeMovesForLevel(creature: CreatureInstance, forced?: string[]): void {
  if (forced && forced.length > 0) {
    while (creature.moves.length > 0) forgetMove(creature, 0);
    for (const id of forced.slice(0, MAX_MOVES)) {
      if (getMove(id)) addMove(creature, id);
    }
    return;
  }

  const species = getSpecies(creature.speciesId);
  const available = species.learnset
    .filter((entry) => entry.level <= creature.level)
    .map((entry) => entry.move);

  if (available.length <= MAX_MOVES) {
    while (creature.moves.length > 0) forgetMove(creature, 0);
    for (const id of available) addMove(creature, id);
    return;
  }

  // Prefer the strongest moves, but always keep at least one that can hit
  // every element for at least neutral damage.
  const scored = [...new Set(available)]
    .map((id) => getMove(id))
    .filter((move): move is NonNullable<typeof move> => move !== undefined)
    .map((move) => ({ move, score: moveScore(move) }))
    .sort((a, b) => b.score - a.score);

  const chosen: string[] = [];
  const coverage = new Set<string>();

  // A coverage move against each of the creature's weaknesses.
  const weaknesses = ELEMENTS.filter(
    (element) => typeEffectiveness(getSpecies(creature.speciesId).element, element) === 0.5,
  );

  for (const element of weaknesses) {
    const counter = scored.find((entry) => entry.move.type === element && isDamaging(entry.move));
    if (counter && !chosen.includes(counter.move.id) && chosen.length < MAX_MOVES - 1) {
      chosen.push(counter.move.id);
      coverage.add(element);
    }
  }

  for (const entry of scored) {
    if (chosen.length >= MAX_MOVES) break;
    if (chosen.includes(entry.move.id)) continue;
    chosen.push(entry.move.id);
  }

  // If nothing damaging was chosen, force a basic attack in.
  if (!chosen.some((id) => isDamaging(getMove(id)!))) {
    const fallback = movesOfType('neutral').find((move) => isDamaging(move));
    if (fallback) chosen[chosen.length - 1] = fallback.id;
  }

  while (creature.moves.length > 0) forgetMove(creature, 0);
  for (const id of chosen.slice(0, MAX_MOVES)) addMove(creature, id);
  void coverage;
}

function moveScore(move: ReturnType<typeof getMove>): number {
  if (!move) return 0;
  let score = move.power;
  if (move.category !== 'status') score += 20;
  if (move.priority > 0) score += 15;
  for (const effect of move.effects ?? []) {
    if (effect.kind === 'status') score += 18;
    if (effect.kind === 'heal') score += 12;
    if (effect.kind === 'drain') score += 10;
  }
  const accuracy = move.accuracy === 'bypass' ? 100 : move.accuracy;
  return score * (accuracy / 100);
}

export interface BuildBattleOptions {
  state: GameState;
  clock: ClockState;
  playerParty: CreatureInstance[];
  enemyParty: CreatureInstance[];
  isWild: boolean;
  enemyTrainerName?: string;
  aiTier?: AITier;
  moneyReward?: number;
  mapIsCave?: boolean;
  seed?: number;
}

/** Construct a `BattleState` from a save and two parties. */
export function buildBattle(options: BuildBattleOptions): BattleState {
  const {
    state,
    clock,
    playerParty,
    enemyParty,
    isWild,
    enemyTrainerName,
    aiTier,
    moneyReward = 0,
    mapIsCave = false,
    seed,
  } = options;

  return new BattleState({
    playerParty,
    enemyParty,
    playerName: state.playerName,
    isWild,
    enemyTrainerName,
    aiTier,
    context: fieldContext(timeOfDay(clock), mapIsCave, undefined),
    seed: seed ?? (Math.random() * 0xffffffff) >>> 0,
    moneyReward,
    canFlee: isWild,
  });
}

/** A quick random opponent for the title screen's debug battle. */
export function buildQuickBattleParties(playerLevel = 25): {
  player: CreatureInstance[];
  enemy: CreatureInstance[];
} {
  const playerTeam: CreatureId[] = ['infernyx', 'maelstrotter', 'grovetitan'];
  const enemyTeam: CreatureId[] = ['fulminx', 'umbrawraith', 'prismantis'];

  const make = (id: CreatureId, level: number) => {
    const creature = createCreature(id, level, {
      rng: random,
      originalTrainer: 'Trainer',
      metLocation: 'Prismara',
      metLevel: level,
    });
    maximizeMovesForLevel(creature);
    return creature;
  };

  return {
    player: playerTeam.map((id) => make(id, playerLevel)),
    enemy: enemyTeam.map((id) => make(id, playerLevel)),
  };
}

/** Turn a trainer definition into the battle's enemy party. */
export function partyForTrainer(
  trainer: TrainerDef,
  playerName: string,
  partyOverride?: Array<{ speciesId: CreatureId; level: number; moves?: string[] }>,
): CreatureInstance[] {
  const list = partyOverride ?? trainer.party;
  return list.map((mon) => {
    const creature = createCreature(mon.speciesId, mon.level, {
      rng: random,
      originalTrainer: trainer.name,
      metLocation: 'Prismara',
      metLevel: mon.level,
    });
    maximizeMovesForLevel(creature, mon.moves);
    void playerName;
    return creature;
  });
}

export { hasRoomForMove };
