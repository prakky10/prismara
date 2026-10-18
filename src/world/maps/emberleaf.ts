/** Emberleaf Town, its interiors and Route 1: where the adventure starts. */

import {
  ROUTE_HEIGHT,
  ROUTE_WIDTH,
  STYLE,
  TOWN_HEIGHT,
  TOWN_WIDTH,
  blank,
  border,
  building,
  gate,
  grassPatch,
  hLine,
  lake,
  rect,
  scatter,
  toRows,
  vLine,
} from './grid';
import type { MapDef } from './types';

export function emberleafTown(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, '.'), '#');
  // Main street.
  hLine(g, 13, 1, TOWN_WIDTH - 2, '=');
  vLine(g, 17, 6, 13, '=');
  vLine(g, 17, 13, 20, '=');
  scatter(g, ['+', 'b', 'o'], 0.05, 7);

  // Professor Lumen's lab (north), a house (west), the shop (east).
  building(g, { x: 13, y: 3, width: 9, height: 6, roof: 'R', doorX: 17 });
  building(g, { x: 4, y: 8, width: 7, height: 5, roof: 'H', doorX: 7 });
  building(g, { x: 23, y: 8, width: 7, height: 5, roof: 'S', doorX: 26 });

  // Two houses south of the street.
  building(g, { x: 6, y: 17, width: 6, height: 5, roof: 'R', doorX: 9 });
  building(g, { x: 22, y: 17, width: 6, height: 5, roof: 'R', doorX: 25 });

  // The town's little pond and fence line.
  lake(g, 8, 24, 3, 2);
  hLine(g, 21, 12, 15, 'f');

  // Exit north to Route 1.
  hLine(g, 1, 17, 18, '=');

  // Keep every gate and building exit reachable, routing around the lab.
  gate(g, 17, 'n');
  vLine(g, 12, 2, 13, '=');
  hLine(g, 2, 12, 18, '=');
  hLine(g, 9, 17, 17, '=');
  vLine(g, 13, 14, 22, '=');
  hLine(g, 22, 9, 13, '=');
  hLine(g, 14, 10, 10, '.');

  return {
    id: 'emberleaf-town',
    name: 'Emberleaf Town',
    biome: 'meadow',
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'Where every Prismara journey begins.',
    music: 'town',
    warps: [
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-1', x: 17, y: 28, facing: 'up' } },
      { x: 17, y: 8, width: 1, height: 1, to: { mapId: 'lumen-lab', x: 8, y: 11, facing: 'up' } },
      {
        x: 9,
        y: 21,
        width: 1,
        height: 1,
        to: { mapId: 'emberleaf-house', x: 7, y: 8, facing: 'up' },
      },
      {
        x: 26,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'emberleaf-shop', x: 6, y: 8, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'mom',
        name: 'Aunt Mira',
        x: 17,
        y: 15,
        facing: 'down',
        kind: 'npc',
        sprite: STYLE.adult(0xff8fc4),
        dialogue: [
          'Kai is looking for his brother. Team Eclipse took him away from us.',
          'The lighthouse keeper vanished the night the sky-crystal cracked.',
          'Find your mother, keeper. Keep Potions for the road, and change your socks!',
        ],
      },
      {
        id: 'town-boy',
        name: 'Boy',
        x: 12,
        y: 14,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.kid(0x2ea8ff),
        chatter: [
          'Tall grass hides creatures. Walk through it to find some!',
          'Press C to open the pause menu.',
          'My sister says a shiny is one in two hundred and fifty-six.',
        ],
      },
      {
        id: 'emberleaf-sign',
        name: 'Sign',
        x: 19,
        y: 2,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: [
          'EMBELEAF TOWN',
          'North: Route 1 and Thistlebrook. Six Trophies open the Summit.',
        ],
      },
      {
        id: 'emberleaf-sign-2',
        name: 'Sign',
        x: 20,
        y: 19,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['Professor Lumen\u2019s Lab is north of the street.'],
      },
    ],
  };
}

export function lumenLab(): MapDef {
  const g = border(blank(16, 14, 'c'), 'W');
  hLine(g, 11, 1, 14, 'c');
  rect(g, 2, 2, 3, 2, 'c');
  rect(g, 11, 2, 3, 2, 'c');
  // Desk row.
  hLine(g, 3, 5, 10, 'W');
  return {
    id: 'lumen-lab',
    name: "Professor Lumen's Lab",
    biome: 'city',
    indoor: true,
    width: 16,
    height: 14,
    tiles: toRows(g),
    music: 'town',
    warps: [
      {
        x: 8,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'emberleaf-town', x: 17, y: 9, facing: 'down' },
      },
    ],
    npcs: [
      {
        id: 'professor-lumen',
        name: 'Prof. Lumen',
        x: 8,
        y: 3,
        facing: 'down',
        kind: 'npc',
        sprite: STYLE.elder(0xf5f0ff),
        dialogue: [
          'Ah, there you are! Welcome to Prismara.',
          'The sky-crystal shattered long ago and split the light into six elements.',
          'Take a creature with you. Three are waiting on the table — choose wisely.',
        ],
      },
      {
        id: 'lab-aide',
        name: 'Aide',
        x: 3,
        y: 8,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.adult(0x7fffe5),
        chatter: [
          'The Prismadex records every creature you meet.',
          'Legendaries only appear at certain times of day!',
        ],
      },
    ],
  };
}

export function emberleafHouse(): MapDef {
  const g = border(blank(14, 11, 'c'), 'W');
  rect(g, 2, 2, 3, 2, 'c');
  rect(g, 9, 2, 3, 2, 'c');
  return {
    id: 'emberleaf-house',
    name: 'Emberleaf House',
    biome: 'city',
    indoor: true,
    width: 14,
    height: 11,
    tiles: toRows(g),
    music: 'town',
    warps: [
      {
        x: 7,
        y: 9,
        width: 1,
        height: 1,
        to: { mapId: 'emberleaf-town', x: 9, y: 22, facing: 'down' },
      },
    ],
    npcs: [
      {
        id: 'house-gran',
        name: 'Gran',
        x: 6,
        y: 3,
        facing: 'down',
        kind: 'npc',
        sprite: STYLE.elder(0x4cd964),
        dialogue: [
          'When I was young we had no Prismadex. We drew them in a book!',
          'Sleep well, and heal at a Healing Center for free.',
        ],
      },
    ],
  };
}

export function emberleafShop(): MapDef {
  const g = border(blank(14, 11, 'c'), 'W');
  hLine(g, 2, 1, 12, 'c');
  hLine(g, 3, 2, 5, 'W');
  return {
    id: 'emberleaf-shop',
    name: 'Emberleaf Mart',
    biome: 'city',
    indoor: true,
    width: 14,
    height: 11,
    tiles: toRows(g),
    music: 'city',
    warps: [
      {
        x: 6,
        y: 9,
        width: 1,
        height: 1,
        to: { mapId: 'emberleaf-town', x: 26, y: 13, facing: 'down' },
      },
    ],
    npcs: [
      {
        id: 'emberleaf-clerk',
        name: 'Shopkeeper',
        x: 6,
        y: 4,
        facing: 'down',
        kind: 'shop',
        sprite: STYLE.adult(0x3f7fbf),
        dialogue: ['Welcome to the Mart! What can I get you?'],
      },
      {
        id: 'emberleaf-shop-npc',
        name: 'Customer',
        x: 10,
        y: 6,
        facing: 'left',
        kind: 'npc',
        sprite: STYLE.adult(0xffd60a),
        chatter: ['Great Prisms catch things more easily.', 'Try a Dusk Orb at night!'],
      },
    ],
  };
}

export function routeOne(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), '#');
  scatter(g, ['+', 'b'], 0.06, 21);
  // The path snakes north.
  vLine(g, 17, 2, 12, '=');
  hLine(g, 12, 8, 17, '=');
  vLine(g, 8, 12, 20, '=');
  hLine(g, 20, 8, 24, '=');
  vLine(g, 24, 16, 20, '=');
  // Encounter grass.
  grassPatch(g, 26, 26, 5, 3);
  grassPatch(g, 13, 22, 4, 3);
  grassPatch(g, 13, 7, 4, 3);
  // A ledge shortcut back to town.
  hLine(g, 24, 15, 20, '^');
  // A little pond.
  lake(g, 4, 6, 2, 2);
  // Cut tree blocking a shortcut.
  g[18][28] = 'k';
  g[17][28] = 'b';
  g[19][28] = 'b';

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '=');
  return {
    id: 'route-1',
    name: 'Route 1',
    biome: 'meadow',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Meadow Path — soft grass, softer creatures.',
    encounterZone: 'route-1',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'emberleaf-town', x: 17, y: 1, facing: 'down' },
      },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'whisperwood-forest', x: 17, y: 28, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'route1-sign',
        name: 'Sign',
        x: 18,
        y: 27,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['ROUTE 1', 'North: Whisperwood Forest.'],
      },
      {
        id: 'youngster-ben',
        name: 'Ben',
        x: 12,
        y: 19,
        facing: 'right',
        kind: 'trainer',
        trainerId: 'youngster-ben',
        sight: 4,
        sprite: STYLE.kid(0x4cd964),
      },
      {
        id: 'route1-hiker',
        name: 'Traveller',
        x: 26,
        y: 8,
        facing: 'down',
        kind: 'npc',
        sprite: STYLE.adult(0xff6b35),
        chatter: [
          'Ledgeds are one-way — you can hop down but not up.',
          'My creature got burned once and never Forgave me.',
        ],
      },
    ],
  };
}
