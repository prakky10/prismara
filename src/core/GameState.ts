/**
 * The complete mutable state of a save file.
 *
 * Everything a player can change lives here and nowhere else, which is what
 * makes saving a single JSON round-trip. The GameState is deliberately free of
 * Phaser types so it can be serialised, diffed and unit-tested.
 */

import { createCreature, fullHealCreature, restorePp, type CreatureInstance } from '../battle/Creature';
import { ITEMS, type ItemId } from '../data/items';
import { getSpecies, type CreatureId } from '../data/creatures';
import { newClock, type ClockState } from './Time';
import { random } from './SeededRNG';
import { migrateLegacyStoryFlags } from '../world/story/journal';

export const SAVE_VERSION = 1;

export const BOX_COUNT = 8;
export const BOX_SIZE = 30;
export const MAX_PARTY = 6;

export interface PlayerPosition {
  mapId: string;
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
}

export interface DexEntry {
  seen: boolean;
  caught: boolean;
  /** Number of times this species has been caught (for the completion stats). */
  caughtCount: number;
  /** Form seen as shiny at least once. */
  shinySeen: boolean;
  /** Where the player first met it. */
  firstMet: string | null;
}

export interface GameStateData {
  version: number;
  playerName: string;
  rivalName: string;
  money: number;
  playtimeMinutes: number;
  clock: ClockState;
  position: PlayerPosition;
  party: CreatureInstance[];
  boxes: Array<Array<CreatureInstance | null>>;
  bag: Record<string, number>;
  dex: Record<string, DexEntry>;
  flags: Record<string, boolean>;
  /** Number of steps walked, used for friendship and egg-style events. */
  steps: number;
  starterChosen: CreatureId | null;
  /** Sigils earned, in order. */
  sigils: string[];
  hallOfFame: boolean;
  createdAt: number;
  updatedAt: number;
}

export class GameState {
  playerName = 'Ash';
  rivalName = 'Kai';
  money = 3000;
  playtimeMinutes = 0;
  clock: ClockState = newClock(8);
  position: PlayerPosition = { mapId: 'emberleaf-town', x: 10, y: 14, facing: 'down' };
  party: CreatureInstance[] = [];
  boxes: Array<Array<CreatureInstance | null>> = [];
  bag: Record<string, number> = {};
  dex: Record<string, DexEntry> = {};
  flags: Record<string, boolean> = {};
  steps = 0;
  starterChosen: CreatureId | null = null;
  sigils: string[] = [];
  hallOfFame = false;
  createdAt = Date.now();
  updatedAt = Date.now();

  constructor() {
    this.reset();
  }

  /** A brand-new game: empty boxes, a starter kit of items. */
  reset(): void {
    this.playerName = 'Ash';
    this.rivalName = 'Kai';
    this.money = 3000;
    this.playtimeMinutes = 0;
    this.clock = newClock(8);
    this.position = { mapId: 'emberleaf-town', x: 10, y: 14, facing: 'down' };
    this.party = [];
    this.boxes = Array.from({ length: BOX_COUNT }, () =>
      Array.from({ length: BOX_SIZE }, () => null),
    );
    this.bag = {};
    this.dex = {};
    this.flags = {};
    this.steps = 0;
    this.starterChosen = null;
    this.sigils = [];
    this.hallOfFame = false;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.addItem('prism-orb', 5);
    this.addItem('potion', 3);
    this.addItem('prismadex', 1);
  }

  /* --------------------------------------------------------------- flags -- */

  getFlag(name: string): boolean {
    return this.flags[name] === true;
  }

  setFlag(name: string, value = true): void {
    this.flags[name] = value;
    this.updatedAt = Date.now();
  }

  getSigilCount(): number {
    return this.sigils.length;
  }

  hasSigil(id: string): boolean {
    return this.sigils.includes(id);
  }

  /* ----------------------------------------------------------------- bag -- */

  addItem(id: ItemId, count = 1): void {
    this.bag[id] = (this.bag[id] ?? 0) + count;
    this.updatedAt = Date.now();
  }

  removeItem(id: ItemId, count = 1): boolean {
    const have = this.bag[id] ?? 0;
    if (have < count) return false;
    if (have === count) delete this.bag[id];
    else this.bag[id] = have - count;
    this.updatedAt = Date.now();
    return true;
  }

  itemCount(id: ItemId): number {
    return this.bag[id] ?? 0;
  }

  /** Every bag entry as `{ id, count }`, sorted by pocket then name. */
  bagEntries(): Array<{ id: ItemId; count: number }> {
    return (Object.keys(this.bag) as ItemId[])
      .filter((id) => this.bag[id] > 0 && ITEMS[id])
      .map((id) => ({ id, count: this.bag[id] }))
      .sort((a, b) => {
        const pa = ITEMS[a.id].pocket;
        const pb = ITEMS[b.id].pocket;
        if (pa !== pb) return pa.localeCompare(pb);
        return ITEMS[a.id].name.localeCompare(ITEMS[b.id].name);
      });
  }

  /* --------------------------------------------------------------- money -- */

  addMoney(amount: number): void {
    this.money = Math.max(0, this.money + amount);
    this.updatedAt = Date.now();
  }

  spendMoney(amount: number): boolean {
    if (this.money < amount) return false;
    this.money -= amount;
    this.updatedAt = Date.now();
    return true;
  }

  /* --------------------------------------------------------------- party -- */

  get partyFull(): boolean {
    return this.party.length >= MAX_PARTY;
  }

  get partyHasSpace(): boolean {
    return this.party.length < MAX_PARTY;
  }

  /** Add to the party if there is room, otherwise to the first free box slot. */
  addCreature(creature: CreatureInstance): 'party' | 'box' {
    if (this.partyHasSpace) {
      this.party.push(creature);
      this.markCaught(creature.speciesId, creature.shiny, creature.metLocation);
      return 'party';
    }
    const slot = this.firstFreeBoxSlot();
    if (slot) {
      this.boxes[slot.box][slot.index] = creature;
    }
    this.markCaught(creature.speciesId, creature.shiny, creature.metLocation);
    return 'box';
  }

  firstFreeBoxSlot(): { box: number; index: number } | null {
    for (let box = 0; box < this.boxes.length; box++) {
      const index = this.boxes[box].findIndex((c) => c === null);
      if (index >= 0) return { box, index };
    }
    return null;
  }

  get hasUsableCreature(): boolean {
    return this.party.some((c) => c.currentHp > 0);
  }

  healParty(): void {
    for (const creature of this.party) {
      fullHealCreature(creature);
      restorePp(creature);
    }
  }

  /** Swap two party members (drag-reorder in the Party scene). */
  swapParty(a: number, b: number): void {
    if (a < 0 || b < 0 || a >= this.party.length || b >= this.party.length) return;
    [this.party[a], this.party[b]] = [this.party[b], this.party[a]];
  }

  /* ----------------------------------------------------------------- dex -- */

  markSeen(id: CreatureId, shiny = false, location?: string): void {
    const species = getSpecies(id);
    const entry = this.dex[id] ?? {
      seen: false,
      caught: false,
      caughtCount: 0,
      shinySeen: false,
      firstMet: null,
    };
    entry.seen = true;
    if (shiny) entry.shinySeen = true;
    if (location && !entry.firstMet) entry.firstMet = location;
    this.dex[id] = entry;
    void species;
  }

  markCaught(id: CreatureId, shiny = false, location?: string): void {
    this.markSeen(id, shiny, location);
    const entry = this.dex[id];
    entry.caught = true;
    entry.caughtCount += 1;
    this.updatedAt = Date.now();
  }

  isCaught(id: CreatureId): boolean {
    return this.dex[id]?.caught === true;
  }

  isSeen(id: CreatureId): boolean {
    return this.dex[id]?.seen === true;
  }

  caughtCount(): number {
    return Object.values(this.dex).filter((e) => e.caught).length;
  }

  seenCount(): number {
    return Object.values(this.dex).filter((e) => e.seen).length;
  }

  dexCompletion(): number {
    const total = Object.keys(getAllSpeciesIds()).length;
    return total === 0 ? 0 : this.caughtCount() / total;
  }

  /* --------------------------------------------------------------- misc -- */

  registerStep(count = 1): void {
    this.steps += count;
    // Every 128 steps, the active creature warms to you a little.
    if (this.steps % 128 === 0 && this.party[0]) {
      this.party[0].friendship = Math.min(255, this.party[0].friendship + 1);
    }
  }

  /** Start a brand new adventure with the chosen starter. */
  beginAdventure(playerName: string, rivalName: string, starter: CreatureId): void {
    this.reset();
    this.playerName = playerName;
    this.rivalName = rivalName;
    this.starterChosen = starter;
    const creature = createCreature(starter, 5, {
      rng: random,
      originalTrainer: playerName,
      metLocation: 'Emberleaf Town',
      metLevel: 5,
    });
    this.party.push(creature);
    this.markCaught(starter, creature.shiny, 'Emberleaf Town');
  }

  /* ------------------------------------------------------------ (de)serial -- */

  toJSON(): GameStateData {
    return {
      version: SAVE_VERSION,
      playerName: this.playerName,
      rivalName: this.rivalName,
      money: this.money,
      playtimeMinutes: this.playtimeMinutes,
      clock: { ...this.clock },
      position: { ...this.position },
      party: this.party.map(serialiseCreature),
      boxes: this.boxes.map((box) => box.map((c) => (c ? serialiseCreature(c) : null))),
      bag: { ...this.bag },
      dex: { ...this.dex },
      flags: { ...this.flags },
      steps: this.steps,
      starterChosen: this.starterChosen,
      sigils: [...this.sigils],
      hallOfFame: this.hallOfFame,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: GameStateData): GameState {
    const state = new GameState();
    state.playerName = data.playerName ?? 'Ash';
    state.rivalName = data.rivalName ?? 'Kai';
    state.money = data.money ?? 0;
    state.playtimeMinutes = data.playtimeMinutes ?? 0;
    state.clock = data.clock ? { ...data.clock } : newClock(8);
    state.position = data.position ?? { mapId: 'emberleaf-town', x: 10, y: 14, facing: 'down' };
    state.party = (data.party ?? []).map(deserialiseCreature);
    state.boxes = Array.from({ length: BOX_COUNT }, (_, box) =>
      Array.from({ length: BOX_SIZE }, (_, index) => {
        const raw = data.boxes?.[box]?.[index];
        return raw ? deserialiseCreature(raw) : null;
      }),
    );
    state.bag = { ...(data.bag ?? {}) };
    state.dex = { ...(data.dex ?? {}) };
    state.flags = { ...(data.flags ?? {}) };
    state.steps = data.steps ?? 0;
    state.starterChosen = data.starterChosen ?? null;
    state.sigils = [...(data.sigils ?? [])];
    state.hallOfFame = data.hallOfFame ?? false;
    state.createdAt = data.createdAt ?? Date.now();
    state.updatedAt = data.updatedAt ?? Date.now();
    migrateLegacyStoryFlags(state);
    return state;
  }
}

/** Strip derived fields before writing to disk. */
function serialiseCreature(creature: CreatureInstance): CreatureInstance {
  return { ...creature, stages: { ...creature.stages }, volatiles: { ...creature.volatiles } };
}

function deserialiseCreature(raw: CreatureInstance): CreatureInstance {
  const fresh = createCreature(raw.speciesId, raw.level, {
    uid: raw.uid,
    nickname: raw.nickname,
    level: raw.level,
    expIntoLevel: raw.expIntoLevel,
    exp: raw.exp,
    ivs: raw.ivs,
    currentHp: raw.currentHp,
    status: raw.status,
    statusTurns: raw.statusTurns,
    volatiles: raw.volatiles,
    stages: raw.stages,
    moves: raw.moves,
    ability: raw.ability,
    shiny: raw.shiny,
    gender: raw.gender,
    friendship: raw.friendship,
    originalTrainer: raw.originalTrainer,
    metLocation: raw.metLocation,
    metLevel: raw.metLevel,
  });
  fresh.pendingEvolution = raw.pendingEvolution ?? null;
  return fresh;
}

/** Ids of every species, used for completion percentages. */
function getAllSpeciesIds(): Record<string, true> {
  return Object.fromEntries(Object.keys(SPECIES_INDEX).map((id) => [id, true as const]));
}

// Populated lazily to avoid importing the whole bestiary at module load.
const SPECIES_INDEX: Record<string, true> = {};
export function registerSpeciesIndex(ids: CreatureId[]): void {
  for (const id of ids) SPECIES_INDEX[id] = true;
}
