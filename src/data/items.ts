/**
 * Items: healing, status cures, capture orbs, battle items and key items.
 *
 * All of them are data. The battle engine reads `effect` to apply an item, and
 * the Bag scene reads `pocket`/`description` to render it.
 */

import type { StatusId, StatId } from './battleTypes';

export type ItemPocket = 'healing' | 'orbs' | 'battle' | 'key';

export type ItemId =
  // Healing
  | 'potion'
  | 'super-potion'
  | 'hyper-potion'
  | 'max-potion'
  | 'revive'
  | 'full-heal'
  | 'antidote'
  | 'awakening'
  | 'burn-salve'
  | 'paralyze-cure'
  | 'root-salve'
  | 'calm-mist'
  | 'elixir'
  // Orbs
  | 'prism-orb'
  | 'great-prism'
  | 'ultra-prism'
  | 'dusk-orb'
  | 'luxe-orb'
  | 'tide-orb'
  | 'bloom-orb'
  | 'quick-orb'
  | 'timer-orb'
  | 'nest-orb'
  | 'master-prism'
  // Battle items
  | 'x-attack'
  | 'x-defense'
  | 'x-speed'
  | 'x-sp-power'
  | 'guard-spec'
  // Key items
  | 'prismadex'
  | 'sigil-grass'
  | 'sigil-electric'
  | 'sigil-water'
  | 'sigil-fire'
  | 'sigil-crystal'
  | 'sigil-shadow'
  | 'bike'
  | 'fishing-rod'
  | 'escape-rope';

export type ItemEffect =
  | { kind: 'heal-hp'; amount: number | 'full' }
  | { kind: 'heal-fraction'; fraction: number }
  | { kind: 'revive'; fraction: number }
  | { kind: 'cure-status'; statuses: StatusId[] | 'all' }
  | { kind: 'restore-pp'; amount: number | 'full' }
  | {
      kind: 'orb';
      bonus: number;
      duskBonus?: number;
      friendship?: number;
      master?: boolean;
      /** Bonus when the target matches this element, e.g. Water for the Tide Orb. */
      elementBonus?: { element: string; bonus: number };
      /** Bonus applied only on the battle's first turn (turn 0). */
      firstTurnBonus?: number;
      /** Grows by `perTurn` each turn, clamped to `cap`. */
      timerBonus?: { perTurn: number; cap: number };
      /** Bonus against targets at or below `maxLevel`. */
      levelBonus?: { maxLevel: number; bonus: number };
    }
  | { kind: 'battle-stat'; stat: StatId; stages: number }
  | { kind: 'field'; ability: 'cut' | 'surf' | 'light' | 'smash' | 'night-sight' | 'magnet' }
  | { kind: 'quality-of-life'; note: string };

export interface Item {
  id: ItemId;
  name: string;
  pocket: ItemPocket;
  description: string;
  price: number;
  /** Can it be used on a creature outside battle? */
  usableInField?: boolean;
  /** Can it be used during battle? Only when it is the player's turn. */
  usableInBattle?: boolean;
  /** Can it be thrown at a wild creature? */
  throwable?: boolean;
  effect: ItemEffect;
}

export const ITEMS: Record<ItemId, Item> = {
  potion: {
    id: 'potion',
    name: 'Potion',
    pocket: 'healing',
    description: 'Restores 20 HP to one creature.',
    price: 200,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'heal-hp', amount: 20 },
  },
  'super-potion': {
    id: 'super-potion',
    name: 'Super Potion',
    pocket: 'healing',
    description: 'Restores 60 HP to one creature.',
    price: 700,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'heal-hp', amount: 60 },
  },
  'hyper-potion': {
    id: 'hyper-potion',
    name: 'Hyper Potion',
    pocket: 'healing',
    description: 'Restores 120 HP to one creature.',
    price: 1200,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'heal-hp', amount: 120 },
  },
  'max-potion': {
    id: 'max-potion',
    name: 'Max Potion',
    pocket: 'healing',
    description: 'Fully restores one creature’s HP.',
    price: 2500,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'heal-hp', amount: 'full' },
  },
  revive: {
    id: 'revive',
    name: 'Revive',
    pocket: 'healing',
    description: 'Brings a fainted creature back with half its HP.',
    price: 1800,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'revive', fraction: 0.5 },
  },
  'full-heal': {
    id: 'full-heal',
    name: 'Full Heal',
    pocket: 'healing',
    description: 'Cures any status condition.',
    price: 600,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'cure-status', statuses: 'all' },
  },
  antidote: {
    id: 'antidote',
    name: 'Antidote',
    pocket: 'healing',
    description: 'Cures Burn or Entangled.',
    price: 400,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'cure-status', statuses: ['burn', 'entangled'] },
  },
  awakening: {
    id: 'awakening',
    name: 'Awakening',
    pocket: 'healing',
    description: 'Wakes a sleeping creature.',
    price: 250,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'cure-status', statuses: ['sleep'] },
  },
  'burn-salve': {
    id: 'burn-salve',
    name: 'Burn Salve',
    pocket: 'healing',
    description: 'Cures a Burn.',
    price: 250,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'cure-status', statuses: ['burn'] },
  },
  'paralyze-cure': {
    id: 'paralyze-cure',
    name: 'Paralyze Cure',
    pocket: 'healing',
    description: 'Cures Paralysis.',
    price: 250,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'cure-status', statuses: ['paralyze'] },
  },
  'root-salve': {
    id: 'root-salve',
    name: 'Root Salve',
    pocket: 'healing',
    description: 'Untangles an Entangled creature.',
    price: 300,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'cure-status', statuses: ['entangled'] },
  },
  'calm-mist': {
    id: 'calm-mist',
    name: 'Calm Mist',
    pocket: 'healing',
    description: 'Soothes a frightened creature.',
    price: 300,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'cure-status', statuses: ['fear'] },
  },
  elixir: {
    id: 'elixir',
    name: 'Elixir',
    pocket: 'healing',
    description: 'Restores 10 PP to every move.',
    price: 1500,
    usableInField: true,
    usableInBattle: true,
    effect: { kind: 'restore-pp', amount: 10 },
  },
  'prism-orb': {
    id: 'prism-orb',
    name: 'Prism Orb',
    pocket: 'orbs',
    description: 'A standard orb for catching wild creatures.',
    price: 200,
    throwable: true,
    effect: { kind: 'orb', bonus: 1 },
  },
  'great-prism': {
    id: 'great-prism',
    name: 'Great Prism',
    pocket: 'orbs',
    description: 'A better orb with a 1.5x catch bonus.',
    price: 600,
    throwable: true,
    effect: { kind: 'orb', bonus: 1.5 },
  },
  'ultra-prism': {
    id: 'ultra-prism',
    name: 'Ultra Prism',
    pocket: 'orbs',
    description: 'A high-grade orb with a 2x catch bonus.',
    price: 1200,
    throwable: true,
    effect: { kind: 'orb', bonus: 2 },
  },
  'dusk-orb': {
    id: 'dusk-orb',
    name: 'Dusk Orb',
    pocket: 'orbs',
    description: 'A 3x catch bonus at night or deep in caves.',
    price: 1000,
    throwable: true,
    effect: { kind: 'orb', bonus: 1, duskBonus: 3 },
  },
  'luxe-orb': {
    id: 'luxe-orb',
    name: 'Luxe Orb',
    pocket: 'orbs',
    description: 'A 2x catch bonus that also raises friendship.',
    price: 1200,
    throwable: true,
    effect: { kind: 'orb', bonus: 2, friendship: 20 },
  },
  'tide-orb': {
    id: 'tide-orb',
    name: 'Tide Orb',
    pocket: 'orbs',
    description: 'A 3x catch bonus against Water creatures; 1x against everything else.',
    price: 700,
    throwable: true,
    effect: { kind: 'orb', bonus: 1, elementBonus: { element: 'water', bonus: 3 } },
  },
  'bloom-orb': {
    id: 'bloom-orb',
    name: 'Bloom Orb',
    pocket: 'orbs',
    description: 'A 3x catch bonus against Grass creatures; 1x against everything else.',
    price: 700,
    throwable: true,
    effect: { kind: 'orb', bonus: 1, elementBonus: { element: 'grass', bonus: 3 } },
  },
  'quick-orb': {
    id: 'quick-orb',
    name: 'Quick Orb',
    pocket: 'orbs',
    description: 'A 4x catch bonus on the first battle turn; 1x afterwards.',
    price: 900,
    throwable: true,
    effect: { kind: 'orb', bonus: 1, firstTurnBonus: 4 },
  },
  'timer-orb': {
    id: 'timer-orb',
    name: 'Timer Orb',
    pocket: 'orbs',
    description: 'Grows stronger each battle turn, from 1x up to 4x after ten turns.',
    price: 850,
    throwable: true,
    effect: { kind: 'orb', bonus: 1, timerBonus: { perTurn: 0.3, cap: 4 } },
  },
  'nest-orb': {
    id: 'nest-orb',
    name: 'Nest Orb',
    pocket: 'orbs',
    description: 'A 3x catch bonus against creatures at level 15 or below; 1x otherwise.',
    price: 700,
    throwable: true,
    effect: { kind: 'orb', bonus: 1, levelBonus: { maxLevel: 15, bonus: 3 } },
  },
  'master-prism': {
    id: 'master-prism',
    name: 'Master Prism',
    pocket: 'orbs',
    description: 'Catches any wild creature without fail. Only one exists.',
    price: 0,
    throwable: true,
    effect: { kind: 'orb', bonus: 255, master: true },
  },
  'x-attack': {
    id: 'x-attack',
    name: 'X Attack',
    pocket: 'battle',
    description: 'Raises Attack by one stage in battle.',
    price: 500,
    usableInBattle: true,
    effect: { kind: 'battle-stat', stat: 'attack', stages: 1 },
  },
  'x-defense': {
    id: 'x-defense',
    name: 'X Defense',
    pocket: 'battle',
    description: 'Raises Defense by one stage in battle.',
    price: 500,
    usableInBattle: true,
    effect: { kind: 'battle-stat', stat: 'defense', stages: 1 },
  },
  'x-speed': {
    id: 'x-speed',
    name: 'X Speed',
    pocket: 'battle',
    description: 'Raises Speed by one stage in battle.',
    price: 500,
    usableInBattle: true,
    effect: { kind: 'battle-stat', stat: 'speed', stages: 1 },
  },
  'x-sp-power': {
    id: 'x-sp-power',
    name: 'X Sp. Power',
    pocket: 'battle',
    description: 'Raises Sp. Power by one stage in battle.',
    price: 500,
    usableInBattle: true,
    effect: { kind: 'battle-stat', stat: 'spPower', stages: 1 },
  },
  'guard-spec': {
    id: 'guard-spec',
    name: 'Guard Spec.',
    pocket: 'battle',
    description: 'Raises Sp. Guard by one stage in battle.',
    price: 600,
    usableInBattle: true,
    effect: { kind: 'battle-stat', stat: 'spGuard', stages: 1 },
  },
  prismadex: {
    id: 'prismadex',
    name: 'Prismadex',
    pocket: 'key',
    description: 'Professor Lumen’s encyclopaedia of Prismara’s creatures.',
    price: 0,
    effect: { kind: 'quality-of-life', note: 'Opens the Prismadex from the pause menu.' },
  },
  'sigil-grass': {
    id: 'sigil-grass',
    name: 'Verdant Trophy',
    pocket: 'key',
    description: 'Proof of Ivy’s trial. Unlocks Cut in the field.',
    price: 0,
    effect: { kind: 'field', ability: 'cut' },
  },
  'sigil-electric': {
    id: 'sigil-electric',
    name: 'Storm Trophy',
    pocket: 'key',
    description: 'Proof of Volta’s trial. Unlocks Magnet Lifts.',
    price: 0,
    effect: { kind: 'field', ability: 'magnet' },
  },
  'sigil-water': {
    id: 'sigil-water',
    name: 'Tide Trophy',
    pocket: 'key',
    description: 'Proof of Captain Marin’s trial. Unlocks Surf.',
    price: 0,
    effect: { kind: 'field', ability: 'surf' },
  },
  'sigil-fire': {
    id: 'sigil-fire',
    name: 'Ember Trophy',
    pocket: 'key',
    description: 'Proof of Blaze’s trial. Unlocks Light Caves.',
    price: 0,
    effect: { kind: 'field', ability: 'light' },
  },
  'sigil-crystal': {
    id: 'sigil-crystal',
    name: 'Facet Trophy',
    pocket: 'key',
    description: 'Proof of Opal’s trial. Unlocks Smash on crystal walls.',
    price: 0,
    effect: { kind: 'field', ability: 'smash' },
  },
  'sigil-shadow': {
    id: 'sigil-shadow',
    name: 'Twilight Trophy',
    pocket: 'key',
    description: 'Proof of Raven’s trial. Unlocks Night Sight.',
    price: 0,
    effect: { kind: 'field', ability: 'night-sight' },
  },
  bike: {
    id: 'bike',
    name: 'Prism Bike',
    pocket: 'key',
    description: 'Hold B to ride it and cover ground twice as fast.',
    price: 0,
    effect: { kind: 'quality-of-life', note: 'Hold B to sprint anywhere.' },
  },
  'fishing-rod': {
    id: 'fishing-rod',
    name: 'Fishing Rod',
    pocket: 'key',
    description: 'Fish for Water creatures at any shoreline.',
    price: 0,
    effect: { kind: 'quality-of-life', note: 'Fish at any water edge.' },
  },
  'escape-rope': {
    id: 'escape-rope',
    name: 'Escape Rope',
    pocket: 'key',
    description: 'Warps you back to the entrance of a cave.',
    price: 550,
    usableInField: true,
    effect: { kind: 'quality-of-life', note: 'Return to the cave entrance.' },
  },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function getItem(id: ItemId): Item {
  return ITEMS[id];
}

/** Everything that can be bought in a standard shop, in display order. */
export const SHOP_STOCK: ItemId[] = [
  'prism-orb',
  'great-prism',
  'ultra-prism',
  'dusk-orb',
  'luxe-orb',
  'tide-orb',
  'bloom-orb',
  'quick-orb',
  'timer-orb',
  'nest-orb',
  'potion',
  'super-potion',
  'hyper-potion',
  'revive',
  'antidote',
  'awakening',
  'burn-salve',
  'paralyze-cure',
  'root-salve',
  'calm-mist',
  'escape-rope',
];

export function itemsInPocket(pocket: ItemPocket): Item[] {
  return ITEM_IDS.map((id) => ITEMS[id]).filter((item) => item.pocket === pocket);
}
