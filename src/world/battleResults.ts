/**
 * Pure, scene-free results logic for a finished battle.
 *
 * The Battle scene owns animation and event flow; this module owns the
 * bookkeeping it must never get wrong: recording a trainer defeat exactly once,
 * handing out a Trial Sigil exactly once, and charging the bag for a battle
 * item exactly once. Nothing here imports Phaser and nothing here throws on
 * malformed save data.
 */

import { displayName, isFainted, maxHp, type CreatureInstance } from '../battle/Creature';
import { ITEMS, type Item, type ItemEffect, type ItemId } from '../data/items';
import type { BattleAction } from '../battle/TurnResolver';
import type { GameState } from '../core/GameState';
import type { TrainerDef } from './trainers';

export interface TrainerVictoryResult {
  /** True only the first time a trainer is recorded as defeated. */
  firstVictory: boolean;
  /** The Trial Sigil item id granted by this victory, or null. */
  trophyId: string | null;
}

export interface ItemConsumeResult {
  ok: boolean;
  reason?: string;
}

/** Every item id that marks a Trial Sigil, resolved at runtime. */
const SIGIL_ITEM_IDS: Record<string, ItemId> = {};
for (const id of Object.keys(ITEMS) as ItemId[]) {
  if (id.startsWith('sigil-')) SIGIL_ITEM_IDS[id] = id;
}

/** Resolve a trainer's `sigil` string to a real Sigil item id, or null. */
function knownSigilId(id: string | undefined): ItemId | null {
  if (!id) return null;
  return SIGIL_ITEM_IDS[id] ?? null;
}

function defeatedFlagFor(trainer: TrainerDef): string {
  return `defeated-${trainer.id}`;
}

/**
 * Record a trainer defeat. Idempotent: the first call performs the bookkeeping,
 * every later call is a no-op.
 *
 * Old saves could have set the trainer's story flag without the explicit
 * defeated marker. When that happens the trainer counts as already beaten
 * (`firstVictory: false`) so no reward is paid twice, but the marker is still
 * backfilled and a missing Sigil is repaired exactly once.
 */
export function applyTrainerVictory(
  state: GameState,
  trainer: TrainerDef,
): TrainerVictoryResult {
  const defeatedFlag = defeatedFlagFor(trainer);
  if (state.getFlag(defeatedFlag)) return { firstVictory: false, trophyId: null };

  const flagAlreadySet = trainer.setsFlag ? state.getFlag(trainer.setsFlag) : false;
  const firstVictory = !flagAlreadySet;

  state.setFlag(defeatedFlag, true);
  if (trainer.setsFlag) state.setFlag(trainer.setsFlag, true);

  let trophyId: string | null = null;
  const sigilId = knownSigilId(trainer.sigil);
  if (sigilId && !state.hasSigil(sigilId)) {
    state.sigils.push(sigilId);
    if (state.itemCount(sigilId) === 0) state.addItem(sigilId, 1);
    trophyId = sigilId;
  }

  if (trainer.isChampion) state.hallOfFame = true;

  return { firstVictory, trophyId };
}

function fail(reason: string): ItemConsumeResult {
  return { ok: false, reason };
}

/** True when the bag holds a finite, positive, whole quantity of an item. */
function hasStock(state: GameState, itemId: ItemId): boolean {
  const count = state.itemCount(itemId);
  return Number.isInteger(count) && count > 0;
}

/** Why this item cannot be used on this creature, or null when it can. */
function targetReason(effect: ItemEffect, target: CreatureInstance): string | null {
  const name = displayName(target);
  const fainted = isFainted(target);
  const fullHp = target.currentHp >= maxHp(target);

  switch (effect.kind) {
    case 'heal-hp':
    case 'heal-fraction':
      if (fainted) return `${name} has fainted.`;
      if (fullHp) return `${name}'s HP is already full.`;
      return null;
    case 'revive':
      if (!fainted) return `${name} has not fainted.`;
      return null;
    case 'cure-status': {
      if (!target.status) return `${name} has no status condition.`;
      const statuses = effect.statuses;
      if (statuses !== 'all' && !statuses.includes(target.status)) {
        return `That will not help ${name}.`;
      }
      return null;
    }
    case 'restore-pp':
      if (!target.moves.some((move) => move.pp < move.maxPp)) {
        return `${name}'s PP is already full.`;
      }
      return null;
    case 'battle-stat':
      if (fainted) return `${name} has fainted.`;
      return null;
    default:
      return 'That item cannot be used here.';
  }
}

/**
 * Charge the bag for the player's chosen battle action.
 *
 * Runs before the turn resolver so a legal action is paid for exactly once.
 * It applies no effects — the resolver reads the same item from the data table.
 * Invalid actions return `{ ok: false, reason }` and never mutate the bag.
 */
export function consumeBattleItem(
  state: GameState,
  action: BattleAction,
  isWild: boolean,
): ItemConsumeResult {
  if (action.kind === 'orb') return consumeOrb(state, action.itemId, isWild);
  if (action.kind === 'item') return consumeItem(state, action.itemId, action.targetIndex);
  return { ok: true };
}

function consumeOrb(state: GameState, itemId: ItemId, isWild: boolean): ItemConsumeResult {
  const item = ITEMS[itemId] as Item | undefined;
  if (!item) return fail('There is no such item.');
  if (item.throwable !== true || item.effect.kind !== 'orb') {
    return fail('That item cannot be thrown.');
  }
  if (!isWild) return fail("You can't catch another trainer's creature!");
  if (!state.partyHasSpace && state.firstFreeBoxSlot() === null) {
    return fail('Your party and storage are full.');
  }
  if (!hasStock(state, itemId)) return fail(`You have no ${item.name} left.`);
  if (!state.removeItem(itemId, 1)) return fail(`You have no ${item.name} left.`);
  return { ok: true };
}

function consumeItem(
  state: GameState,
  itemId: ItemId,
  targetIndex: number,
): ItemConsumeResult {
  const item = ITEMS[itemId] as Item | undefined;
  if (!item) return fail('There is no such item.');
  if (item.usableInBattle !== true) return fail(`You can't use the ${item.name} in battle.`);
  if (item.effect.kind === 'orb') return fail('Use a capture orb from the ball pocket.');
  if (!hasStock(state, itemId)) return fail(`You have no ${item.name} left.`);

  const target = Number.isInteger(targetIndex) ? state.party[targetIndex] : undefined;
  if (!target) return fail('Choose a creature to use that on.');

  const reason = targetReason(item.effect, target);
  if (reason) return fail(reason);

  if (!state.removeItem(itemId, 1)) return fail(`You have no ${item.name} left.`);
  return { ok: true };
}
