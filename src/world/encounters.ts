/**
 * Wild encounter tables, per area and per time of day.
 *
 * Night tables lean toward Shadow and Electric creatures; day tables toward
 * Fire, Grass and Water. Rustling grass has a higher shiny chance (the
 * Overworld rolls that, not this data).
 */

import type { CreatureId } from '../data/creatures';

export interface EncounterEntry {
  speciesId: CreatureId;
  minLevel: number;
  maxLevel: number;
  weight: number;
  /** Which times of day this entry appears at. */
  when?: 'day' | 'night' | 'any';
}

export interface EncounterZone {
  id: string;
  name: string;
  /** Overall chance per step (0..1) checked when the player steps on grass. */
  rate: number;
  entries: EncounterEntry[];
  /** Water-only zones need Surf. */
  requires?: 'surf' | 'fishing';
}

const e = (
  speciesId: CreatureId,
  minLevel: number,
  maxLevel: number,
  weight: number,
  when: EncounterEntry['when'] = 'any',
): EncounterEntry => ({ speciesId, minLevel, maxLevel, weight, when });

export const ENCOUNTER_ZONES: Record<string, EncounterZone> = {
  'route-1': {
    id: 'route-1',
    name: 'Meadow Path',
    rate: 0.14,
    entries: [
      e('sparkit', 3, 5, 22),
      e('sproutle', 3, 5, 14, 'day'),
      e('emberkit', 3, 5, 12, 'day'),
      e('drizzlet', 3, 5, 12, 'day'),
      e('mossprite', 3, 5, 18),
      e('gloomlet', 4, 6, 16, 'night'),
      e('nightfang', 5, 6, 8, 'night'),
      e('shroomble', 4, 6, 6),
    ],
  },
  'whisperwood-forest': {
    id: 'whisperwood-forest',
    name: 'Whisperwood Forest',
    rate: 0.17,
    entries: [
      e('mossprite', 5, 8, 20),
      e('shroomble', 5, 8, 16),
      e('vinesnap', 6, 9, 12),
      e('sparkit', 5, 8, 12),
      e('coilbug', 6, 9, 12),
      e('gloomlet', 6, 9, 14, 'night'),
      e('nightfang', 7, 10, 10, 'night'),
      e('shardling', 6, 9, 8),
      e('bubbloon', 5, 8, 8),
    ],
  },
  'route-2': {
    id: 'route-2',
    name: 'Wind Farms',
    rate: 0.15,
    entries: [
      e('sparkit', 9, 12, 18),
      e('coilbug', 9, 12, 16),
      e('ampuff', 10, 13, 14),
      e('fulminx', 12, 14, 6),
      e('teslapede', 12, 15, 5),
      e('thundrake', 14, 16, 2, 'night'),
      e('mossprite', 9, 12, 10),
      e('vinesnap', 10, 13, 8),
      e('shardling', 10, 13, 7),
    ],
  },
  'route-3': {
    id: 'route-3',
    name: 'Coral Coast',
    rate: 0.14,
    entries: [
      e('drizzlet', 12, 15, 14),
      e('bubbloon', 12, 15, 18),
      e('coralisk', 14, 17, 6),
      e('krabrine', 14, 17, 5),
      e('shardling', 12, 15, 12),
      e('glimmoth', 14, 17, 5, 'night'),
      e('nightfang', 14, 17, 8, 'night'),
      e('emberkit', 12, 15, 8, 'day'),
      e('sparkit', 13, 16, 8),
    ],
  },
  'route-4': {
    id: 'route-4',
    name: 'Sea Cliffs',
    rate: 0.16,
    entries: [
      e('krabrine', 18, 22, 14),
      e('coralisk', 18, 22, 12),
      e('puffathom', 20, 23, 6),
      e('nightfang', 19, 23, 14, 'night'),
      e('duskmaw', 20, 24, 8, 'night'),
      e('ashwing', 20, 24, 8),
      e('teslapede', 19, 23, 10),
      e('glimmoth', 20, 24, 6, 'night'),
      e('shardling', 18, 22, 10),
    ],
  },
  'route-5': {
    id: 'route-5',
    name: 'Lava Fields',
    rate: 0.17,
    entries: [
      e('cindermole', 24, 28, 16),
      e('magmolith', 28, 31, 5),
      e('emberkit', 24, 28, 8),
      e('pyrolynx', 26, 30, 7),
      e('ashwing', 26, 30, 8),
      e('duskmaw', 26, 30, 10, 'night'),
      e('nightfang', 26, 30, 8, 'night'),
      e('shardling', 24, 28, 10),
    ],
  },
  'route-6': {
    id: 'route-6',
    name: 'Misty Marsh',
    rate: 0.18,
    entries: [
      e('shroomble', 30, 34, 14),
      e('bloomwisp', 30, 34, 10),
      e('gloomlet', 30, 34, 10),
      e('shadeling', 32, 36, 7),
      e('facetoad', 31, 35, 8),
      e('glimmoth', 31, 35, 7, 'night'),
      e('umbrawraith', 36, 38, 3, 'night'),
      e('vinesnap', 30, 34, 9),
      e('lumicorn', 34, 38, 2, 'night'),
    ],
  },
  'route-7': {
    id: 'route-7',
    name: 'Night Forest',
    rate: 0.19,
    entries: [
      e('shadeling', 36, 40, 12),
      e('umbrawraith', 40, 44, 5, 'night'),
      e('nightfang', 36, 40, 12),
      e('duskmaw', 36, 40, 12),
      e('gloomlet', 36, 40, 10),
      e('lumicorn', 38, 42, 3, 'night'),
      e('prismantis', 38, 42, 6),
      e('glimmoth', 38, 42, 8),
      e('vinesnap', 38, 42, 8),
    ],
  },
  'glimmer-caverns': {
    id: 'glimmer-caverns',
    name: 'Glimmer Caverns',
    rate: 0.17,
    entries: [
      e('shardling', 30, 34, 18),
      e('prismantis', 33, 37, 7),
      e('glimmoth', 32, 36, 10),
      e('facetoad', 32, 36, 10),
      e('lumicorn', 36, 40, 3),
      e('coilbug', 30, 34, 10),
      e('teslapede', 33, 37, 7),
      e('gloomlet', 30, 34, 10, 'night'),
    ],
  },
  'cinder-peak': {
    id: 'cinder-peak',
    name: 'Cinder Peak Caldera',
    rate: 0.2,
    entries: [
      e('magmolith', 40, 44, 12),
      e('infernyx', 44, 48, 4),
      e('ashwing', 40, 44, 12),
      e('pyrolynx', 40, 44, 12),
      e('duskmaw', 40, 44, 10, 'night'),
      e('shardling', 40, 44, 8),
      e('thundrake', 44, 48, 3, 'night'),
    ],
  },
  'duskmoor-ruins': {
    id: 'duskmoor-ruins',
    name: 'Duskmoor Ruins',
    rate: 0.2,
    entries: [
      e('shadeling', 42, 46, 14),
      e('umbrawraith', 46, 50, 6),
      e('nightfang', 42, 46, 12),
      e('duskmaw', 42, 46, 12),
      e('gloomlet', 42, 46, 10),
      e('lumicorn', 46, 50, 3, 'night'),
      e('prismantis', 44, 48, 6),
    ],
  },
  'geode-hollow': {
    id: 'geode-hollow',
    name: 'Geode Hollow',
    rate: 0.18,
    entries: [
      e('shardling', 38, 42, 16),
      e('prismantis', 40, 44, 10),
      e('facetoad', 40, 44, 10),
      e('glimmoth', 40, 44, 10),
      e('lumicorn', 44, 48, 4),
      e('teslapede', 40, 44, 8),
      e('thundrake', 44, 48, 3),
    ],
  },
  'prism-summit': {
    id: 'prism-summit',
    name: 'Prism Summit',
    rate: 0.2,
    entries: [
      e('lumicorn', 50, 54, 12),
      e('prismantis', 50, 54, 12),
      e('umbrawraith', 50, 54, 10, 'night'),
      e('infernyx', 50, 54, 8),
      e('thundrake', 52, 56, 5),
      e('grovetitan', 50, 54, 6),
    ],
  },
  /* Water routes, reachable once the Water Sigil unlocks Surf. */
  'coral-coast-water': {
    id: 'coral-coast-water',
    name: 'Coral Coast (surf)',
    rate: 0.18,
    requires: 'surf',
    entries: [
      e('bubbloon', 14, 18, 20),
      e('coralisk', 16, 20, 12),
      e('puffathom', 20, 24, 6),
      e('krabrine', 18, 22, 8),
    ],
  },
};

export function getEncounterZone(id: string): EncounterZone | undefined {
  return ENCOUNTER_ZONES[id];
}

/** Weighted pick honouring the time of day. */
export function rollEncounter(
  zone: EncounterZone,
  timeOfDay: 'day' | 'night',
  rng: { next(): number; int(min: number, max: number): number },
): { speciesId: CreatureId; level: number } | null {
  const pool = zone.entries.filter(
    (entry) => (entry.when ?? 'any') === 'any' || entry.when === timeOfDay,
  );
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) {
      return {
        speciesId: entry.speciesId,
        level: rng.int(entry.minLevel, entry.maxLevel),
      };
    }
  }
  const last = pool[pool.length - 1];
  return { speciesId: last.speciesId, level: rng.int(last.minLevel, last.maxLevel) };
}

/** Every species that can be found in the wild, for the Prismadex habitat map. */
export function wildHabitats(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const zone of Object.values(ENCOUNTER_ZONES)) {
    for (const entry of zone.entries) {
      if (!out[entry.speciesId]) out[entry.speciesId] = [];
      if (!out[entry.speciesId].includes(zone.name)) out[entry.speciesId].push(zone.name);
    }
  }
  return out;
}
