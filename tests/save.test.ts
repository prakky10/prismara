import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../src/core/GameState';
import {
  autosave,
  exportSave,
  hasAutosave,
  importSave,
  listSlots,
  loadAutosave,
  loadFromSlot,
  loadSettings,
  saveToSlot,
} from '../src/core/SaveManager';
import * as creatures from '../src/data/creatures';

type CreatureId = creatures.CreatureId;

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

describe('real elapsed playtime', () => {
  it('loads a save after fractional minutes of gameplay', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    try {
      const state = new GameState();
      state.beginAdventure('Rowan', 'Kai', 'emberkit');
      state.playtimeMinutes = 0.125;
      expect(autosave(state)).toBe(true);
      expect(loadAutosave()?.playtimeMinutes).toBe(0.125);
      expect(hasAutosave()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function findSpeciesTable(): Record<string, unknown> | null {
  const module = creatures as unknown as Record<string, unknown>;
  for (const value of Object.values(module)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const table = value as Record<string, unknown>;
    const keys = Object.keys(table);
    if (keys.length === 0) continue;
    const looksLikeSpecies = keys.some((key) => {
      const sample = table[key];
      if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return false;
      const record = sample as Record<string, unknown>;
      return typeof record.dexNumber === 'number' && typeof record.element === 'string';
    });
    if (looksLikeSpecies) return table;
  }
  return null;
}

const FALLBACK_SPECIES: CreatureId[] = ['emberlet', 'sprigat', 'aquaflip'];

function firstValidSpeciesId(): CreatureId {
  const table = findSpeciesTable();
  const candidates = table ? (Object.keys(table) as CreatureId[]) : [];
  for (const id of [...candidates, ...FALLBACK_SPECIES]) {
    try {
      if (creatures.getSpecies(id)) return id;
    } catch {
      /* not a real species: try the next candidate */
    }
  }
  throw new Error('No species data available for the save tests');
}

const STARTER = firstValidSpeciesId();

function makeGame(): GameState {
  const state = new GameState();
  state.beginAdventure('Ash', 'Kai', STARTER);
  return state;
}

function asPayload(state: GameState): Record<string, unknown> {
  return JSON.parse(exportSave(state)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SaveManager', () => {
  it('round-trips a fresh adventure through a manual slot', () => {
    const state = makeGame();
    expect(saveToSlot(1, state)).toBe(true);
    const loaded = loadFromSlot(1);
    expect(loaded).not.toBeNull();
    expect(loaded?.playerName).toBe('Ash');
    expect(loaded?.party).toHaveLength(1);
    expect(loaded?.party[0].speciesId).toBe(STARTER);
  });

  it('enforces the manual slot bounds 1..3', () => {
    expect(saveToSlot(0, makeGame())).toBe(false);
    expect(saveToSlot(4, makeGame())).toBe(false);
    expect(loadFromSlot(0)).toBeNull();
    expect(loadFromSlot(4)).toBeNull();
    for (let slot = 1; slot <= 3; slot += 1) {
      expect(saveToSlot(slot, makeGame())).toBe(true);
      expect(loadFromSlot(slot)).not.toBeNull();
    }
  });

  it('rejects malformed imported saves', () => {
    expect(importSave('')).toBeNull();
    expect(importSave('not json')).toBeNull();
    expect(importSave('null')).toBeNull();
    expect(importSave('42')).toBeNull();
    expect(importSave('[]')).toBeNull();
    expect(importSave('{}')).toBeNull();
  });

  it('accepts a valid exported save', () => {
    const loaded = importSave(exportSave(makeGame()));
    expect(loaded).not.toBeNull();
    expect(loaded?.party).toHaveLength(1);
  });

  it('refuses a save from a future version', () => {
    const payload = asPayload(makeGame());
    payload.version = 999;
    expect(importSave(JSON.stringify(payload))).toBeNull();
    localStorage.setItem('prismara.save.slot2', JSON.stringify(payload));
    expect(loadFromSlot(2)).toBeNull();
    expect(listSlots().find((meta) => meta.slot === 2)?.exists).toBe(false);
  });

  it('refuses a party with an unknown species', () => {
    const payload = asPayload(makeGame());
    (payload.party as Array<Record<string, unknown>>)[0].speciesId = '__not_a_species__';
    expect(importSave(JSON.stringify(payload))).toBeNull();
  });

  it('refuses a save with an empty party', () => {
    const payload = asPayload(makeGame());
    payload.party = [];
    expect(importSave(JSON.stringify(payload))).toBeNull();
  });

  it('accepts a valid legacy version 0 save', () => {
    const payload = asPayload(makeGame());
    delete payload.version;
    const loaded = importSave(JSON.stringify(payload));
    expect(loaded).not.toBeNull();
    expect(loaded?.party).toHaveLength(1);
  });

  it('treats corrupt slot data as empty', () => {
    localStorage.setItem('prismara.save.slot1', '{ this is not json');
    expect(loadFromSlot(1)).toBeNull();
    expect(listSlots().find((meta) => meta.slot === 1)?.exists).toBe(false);
  });

  it('reports slot metadata through the shared loader', () => {
    expect(saveToSlot(2, makeGame())).toBe(true);
    const meta = listSlots().find((entry) => entry.slot === 2);
    expect(meta?.exists).toBe(true);
    expect(meta?.playerName).toBe('Ash');
    expect(meta?.starter).toBe(STARTER);
  });

  it('round-trips the autosave and reports availability', () => {
    expect(hasAutosave()).toBe(false);
    expect(autosave(makeGame())).toBe(true);
    expect(hasAutosave()).toBe(true);
    const loaded = loadAutosave();
    expect(loaded).not.toBeNull();
    expect(loaded?.party).toHaveLength(1);
  });

  it('does not report an unavailable autosave as present', () => {
    localStorage.setItem('prismara.save.auto', '{}');
    expect(hasAutosave()).toBe(false);
    expect(loadAutosave()).toBeNull();
  });

  it('handles storage read exceptions gracefully', () => {
    localStorage.getItem = () => {
      throw new Error('storage blocked');
    };
    expect(loadFromSlot(1)).toBeNull();
    expect(loadAutosave()).toBeNull();
    expect(hasAutosave()).toBe(false);
    expect(listSlots()).toHaveLength(3);
    expect(listSlots().every((meta) => !meta.exists)).toBe(true);
    expect(loadSettings().muted).toBe(false);
  });

  it('refuses a party member with a valid species but a malformed shape', () => {
    const missingMoves = asPayload(makeGame());
    delete (missingMoves.party as Array<Record<string, unknown>>)[0].moves;
    expect(importSave(JSON.stringify(missingMoves))).toBeNull();

    const missingIvs = asPayload(makeGame());
    delete (missingIvs.party as Array<Record<string, unknown>>)[0].ivs;
    expect(importSave(JSON.stringify(missingIvs))).toBeNull();

    const badMoves = asPayload(makeGame());
    const badMoveCreature = (badMoves.party as Array<Record<string, unknown>>)[0];
    (badMoveCreature.moves as Array<Record<string, unknown>>)[0].pp = Number.NaN;
    expect(importSave(JSON.stringify(badMoves))).toBeNull();

    const badIvs = asPayload(makeGame());
    (badIvs.party as Array<Record<string, unknown>>)[0].ivs = { hp: Number.POSITIVE_INFINITY };
    expect(importSave(JSON.stringify(badIvs))).toBeNull();
  });

  it('rejects malformed storage and bag data', () => {
    const badStorageShape = asPayload(makeGame());
    badStorageShape.boxes = { 0: [] };
    localStorage.setItem('prismara.save.slot1', JSON.stringify(badStorageShape));
    expect(loadFromSlot(1)).toBeNull();

    const badStoredCreature = asPayload(makeGame());
    badStoredCreature.boxes = [[{ speciesId: STARTER }]];
    localStorage.setItem('prismara.save.slot2', JSON.stringify(badStoredCreature));
    expect(loadFromSlot(2)).toBeNull();

    const badBag = asPayload(makeGame());
    badBag.bag = { potion: 'lots' };
    localStorage.setItem('prismara.save.slot3', JSON.stringify(badBag));
    expect(loadFromSlot(3)).toBeNull();

    const infiniteBag = asPayload(makeGame());
    infiniteBag.bag = { potion: Number.POSITIVE_INFINITY };
    localStorage.setItem('prismara.save.auto', JSON.stringify(infiniteBag));
    expect(loadAutosave()).toBeNull();
  });

  it('does not throw when a slot has malformed dex entries', () => {
    const payload = asPayload(makeGame());
    payload.dex = { emberlet: null, broken: 'nope' };
    localStorage.setItem('prismara.save.slot1', JSON.stringify(payload));
    expect(() => listSlots()).not.toThrow();
    expect(listSlots().find((entry) => entry.slot === 1)?.exists).toBe(false);
  });

  it('sanitises corrupt settings instead of merging them', () => {
    localStorage.setItem(
      'prismara.settings',
      JSON.stringify({ musicVolume: 5, sfxVolume: -3, textSpeed: 'hyperspeed', muted: 'yes', bogus: true }),
    );
    const settings = loadSettings();
    expect(settings.musicVolume).toBe(1);
    expect(settings.sfxVolume).toBe(0);
    expect(settings.textSpeed).toBe('normal');
    expect(settings.muted).toBe(false);
    expect('bogus' in settings).toBe(false);
  });

  it('falls back to defaults when settings data is not an object', () => {
    localStorage.setItem('prismara.settings', JSON.stringify([1, 2, 3]));
    expect(loadSettings().musicVolume).toBe(0.5);
  });
});
