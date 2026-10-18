/**
 * The region of Prismara.
 *
 * Maps are authored as character grids that a legend turns into tiles. Rather
 * than hand-drawing eighteen 34x26 grids (which is error-prone and unreadable),
 * each area is *composed* from small helpers — `field`, `hLine`, `building`,
 * `grassPatch` — so the intent of the layout is visible in the code and every
 * map is guaranteed rectangular and bordered.
 */

import type { CreatureId } from '../../data/creatures';
import { ashfallTown, cinderPeak, routeFour } from './ember';
import { emberleafHouse, emberleafShop, emberleafTown, lumenLab, routeOne } from './emberleaf';
import { geodeHollow, glimmerCaverns, routeFive, routeSix } from './facet';
import { STYLE, indoorRoom } from './grid';
import { routeTwo, voltspireCity } from './storm';
import { routeThree, tidehaven } from './tide';
import { duskmoorRuins, prismSummit, routeSeven } from './twilight';
import type { MapDef } from './types';
import { thistlebrook, whisperwood } from './verdant';

export * from './types';

/* -------------------------------------------------------------- assembling -- */

const TRIAL_ROOMS: Array<[string, string, string, string]> = [
  ['thistlebrook-trial', 'Thistlebrook Trial Hall', 'thistlebrook', 'trial-ivy'],
  ['voltspire-trial', 'Voltspire Trial Hall', 'voltspire-city', 'trial-volta'],
  ['tidehaven-trial', 'Tidehaven Trial Hall', 'tidehaven', 'trial-marin'],
  ['ashfall-trial', 'Ashfall Trial Hall', 'ashfall-town', 'trial-blaze'],
  ['geode-trial', 'Geode Trial Hall', 'geode-hollow', 'trial-opal'],
];

const HEAL_ROOMS: Array<[string, string, string]> = [
  ['thistlebrook-heal', 'Thistlebrook Healing Center', 'thistlebrook'],
  ['voltspire-heal', 'Voltspire Healing Center', 'voltspire-city'],
  ['tidehaven-heal', 'Tidehaven Healing Center', 'tidehaven'],
  ['ashfall-heal', 'Ashfall Healing Center', 'ashfall-town'],
  ['geode-heal', 'Geode Healing Center', 'geode-hollow'],
  ['duskmoor-heal', 'Duskmoor Camp', 'duskmoor-ruins'],
];

const SHOP_ROOMS: Array<[string, string, string]> = [
  ['thistlebrook-shop', 'Thistlebrook Mart', 'thistlebrook'],
  ['voltspire-shop', 'Voltspire Department Store', 'voltspire-city'],
  ['tidehaven-shop', 'Tidehaven Mart', 'tidehaven'],
  ['ashfall-shop', 'Ashfall Forge Shop', 'ashfall-town'],
  ['geode-shop', 'Geode Gem Shop', 'geode-hollow'],
];

function buildAllMaps(): Record<string, MapDef> {
  const maps: Record<string, MapDef> = {};

  const add = (map: MapDef) => {
    maps[map.id] = map;
  };

  add(emberleafTown());
  add(lumenLab());
  add(emberleafHouse());
  add(emberleafShop());
  add(routeOne());
  add(whisperwood());
  add(thistlebrook());
  add(routeTwo());
  add(voltspireCity());
  add(routeThree());
  add(tidehaven());
  add(routeFour());
  add(ashfallTown());
  add(cinderPeak());
  add(routeFive());
  add(routeSix());
  add(geodeHollow());
  add(glimmerCaverns());
  add(routeSeven());
  add(duskmoorRuins());
  add(prismSummit());

  // Trial halls.
  for (const [id, name, , trainerId] of TRIAL_ROOMS) {
    const town = trialExitFor(id);
    const room = indoorRoom(
      id,
      name,
      18,
      14,
      { toMap: town, x: 17, y: town === 'thistlebrook' ? 9 : 8 },
      'battle-trial',
    );
    room.npcs.push({
      id: `${id}-master`,
      name: trainerDisplayName(trainerId),
      x: 9,
      y: 4,
      facing: 'down',
      kind: 'trial',
      trainerId,
      sight: 6,
      sprite: STYLE.adult(0xffd60a),
    });
    add(room);
  }

  // Healing centers.
  for (const [id, name, town] of HEAL_ROOMS) {
    const room = indoorRoom(
      id,
      name,
      14,
      11,
      { toMap: town, x: 6, y: town === 'thistlebrook' ? 14 : 13 },
      'town',
    );
    room.npcs.push({
      id: `${id}-nurse`,
      name: 'Nurse',
      x: 5,
      y: 3,
      facing: 'down',
      kind: 'heal',
      sprite: STYLE.adult(0xff8fc4, 0xffd0e0),
      dialogue: [
        'Welcome to the Healing Center.',
        'Shall I restore your creatures to full health?',
      ],
    });
    add(room);
  }

  // Shops.
  for (const [id, name, town] of SHOP_ROOMS) {
    const room = indoorRoom(
      id,
      name,
      14,
      11,
      { toMap: town, x: 27, y: town === 'thistlebrook' ? 14 : 13 },
      'city',
    );
    room.npcs.push({
      id: `${id}-clerk`,
      name: 'Clerk',
      x: 6,
      y: 4,
      facing: 'down',
      kind: 'shop',
      sprite: STYLE.adult(0x3f7fbf),
      dialogue: ['Welcome! Take a look at our stock.'],
    });
    add(room);
  }

  return maps;
}

function trialExitFor(trialId: string): string {
  const map: Record<string, string> = {
    'thistlebrook-trial': 'thistlebrook',
    'voltspire-trial': 'voltspire-city',
    'tidehaven-trial': 'tidehaven',
    'ashfall-trial': 'ashfall-town',
    'geode-trial': 'geode-hollow',
  };
  return map[trialId] ?? 'emberleaf-town';
}

function trainerDisplayName(trainerId: string): string {
  const names: Record<string, string> = {
    'trial-ivy': 'Ivy',
    'trial-volta': 'Volta',
    'trial-marin': 'Marin',
    'trial-blaze': 'Blaze',
    'trial-opal': 'Opal',
    'trial-raven': 'Raven',
  };
  return names[trainerId] ?? 'Trial Master';
}

export const MAPS: Record<string, MapDef> = buildAllMaps();

export const STARTING_MAP = 'emberleaf-town';

export function getMap(id: string): MapDef | undefined {
  return MAPS[id];
}

export function requireMap(id: string): MapDef {
  const map = MAPS[id];
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}

/** Where the player should stand to trigger an evolution-style scene. */
export function mapByIdFloor(id: string): { width: number; height: number } {
  const map = requireMap(id);
  return { width: map.width, height: map.height };
}

/** Species the professor offers, in the order they appear on the table. */
export const STARTER_ORDER: CreatureId[] = ['emberkit', 'drizzlet', 'sproutle'];
