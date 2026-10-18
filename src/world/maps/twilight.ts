/** Route 7, the Duskmoor Ruins and Prism Summit: the endgame. */

import {
  type Grid,
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
  rect,
  scatter,
  toRows,
  vLine,
} from './grid';
import type { MapDef } from './types';

export function routeSeven(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), 'P');
  scatter(g, ['P', '#', 'b'], 0.22, 1103);
  vLine(g, 17, 2, 27, '.');
  vLine(g, 16, 2, 27, '.');
  hLine(g, 14, 6, 16, '.');
  vLine(g, 6, 14, 24, '.');
  hLine(g, 24, 6, 16, '.');
  hLine(g, 8, 17, 28, '.');
  vLine(g, 28, 8, 14, '.');
  grassPatch(g, 11, 20, 4, 3);
  grassPatch(g, 24, 4, 4, 3);
  grassPatch(g, 24, 18, 4, 3);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '.');
  return {
    id: 'route-7',
    name: 'Route 7',
    biome: 'forest',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Night Forest — the trees here have never seen daylight.',
    encounterZone: 'route-7',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'geode-hollow', x: 17, y: 1, facing: 'down' },
      },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'duskmoor-ruins', x: 17, y: 24, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'ace-nerys',
        name: 'Nerys',
        x: 24,
        y: 20,
        facing: 'left',
        kind: 'trainer',
        trainerId: 'ace-nerys',
        sight: 5,
        sprite: STYLE.adult(0x8e5cff),
      },
    ],
  };
}

export function duskmoorRuins(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, 'r'), 'u');
  scatter(g, ['u'], 0.12, 1201);
  hLine(g, 13, 1, TOWN_WIDTH - 2, 'r');
  vLine(g, 17, 4, 20, 'r');
  // The altar chamber at the north end.
  rect(g, 13, 3, 9, 6, 'r');
  hLine(g, 3, 13, 21, 'u');
  hLine(g, 8, 13, 21, 'u');
  vLine(g, 12, 3, 8, 'u');
  vLine(g, 22, 3, 8, 'u');
  building(g, { x: 3, y: 8, width: 7, height: 5, roof: 'H', doorX: 6 });
  rubberBand(g);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 1, 24, 'r');
  return {
    id: 'duskmoor-ruins',
    name: 'Duskmoor Ruins',
    biome: 'ruins',
    isCave: true,
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'An altar older than the six elements.',
    music: 'ruins',
    encounterZone: 'duskmoor-ruins',
    warps: [
      { x: 17, y: 25, width: 2, height: 1, to: { mapId: 'route-7', x: 17, y: 1, facing: 'down' } },
      {
        x: 6,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'duskmoor-heal', x: 7, y: 8, facing: 'up' },
      },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'prism-summit', x: 17, y: 24, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'eclipse-admin-voss',
        name: 'Voss',
        x: 16,
        y: 12,
        facing: 'down',
        kind: 'trainer',
        trainerId: 'eclipse-admin-voss',
        sight: 5,
        sprite: STYLE.adult(0x2e2050),
      },
      {
        id: 'trial-raven',
        name: 'Raven',
        x: 15,
        y: 7,
        facing: 'right',
        kind: 'trial',
        trainerId: 'trial-raven',
        sight: 6,
        sprite: STYLE.adult(0x8e5cff),
      },
      {
        id: 'duskmoor-sign',
        name: 'Sign',
        x: 19,
        y: 12,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['DUSKMOOR RUINS', 'Shadow Trophy: the Trial of Raven, held at the altar.'],
      },
      {
        id: 'duskmoor-altar',
        name: 'Altar',
        x: 15,
        y: 5,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x8e5cff),
        dialogue: [
          'A black altar hums under your feet.',
          'Voss believes the light is a wound, and only the dark can close it.',
          'He means to stop the dawn forever. At midnight, something answers him.',
        ],
      },
    ],
  };
}

export function prismSummit(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, 'n'), 'u');
  scatter(g, ['u', 'o'], 0.08, 1301);
  hLine(g, 20, 1, TOWN_WIDTH - 2, 'n');
  vLine(g, 17, 6, 20, 'n');
  // The summit plateau with the Champion's ring.
  rect(g, 12, 4, 11, 8, 'n');
  hLine(g, 4, 13, 21, 'u');
  hLine(g, 11, 13, 21, 'u');
  vLine(g, 12, 4, 11, 'u');
  vLine(g, 22, 4, 11, 'u');
  // A pad for the Aetherion event.
  rect(g, 16, 7, 3, 2, 'r');

  gate(g, 17, 's');
  vLine(g, 17, 5, 24, 'n');
  return {
    id: 'prism-summit',
    name: 'Prism Summit',
    biome: 'summit',
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'The roof of Prismara. The sky feels close enough to touch.',
    music: 'summit',
    encounterZone: 'prism-summit',
    warps: [
      {
        x: 17,
        y: 25,
        width: 2,
        height: 1,
        to: { mapId: 'duskmoor-ruins', x: 17, y: 1, facing: 'down' },
      },
    ],
    npcs: [
      {
        id: 'champion-aurelia',
        name: 'Aurelia',
        x: 17,
        y: 6,
        facing: 'down',
        kind: 'trial',
        trainerId: 'champion-aurelia',
        sight: 5,
        sprite: STYLE.adult(0xffd60a, 0xf0e0a0),
      },
      {
        id: 'aetherion-altar',
        name: 'Prism Altar',
        x: 15,
        y: 12,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x7fffe5),
        dialogue: [
          'Six empty Trophy sockets ring the altar, one for every element.',
          'Something vast circles above the clouds.',
        ],
      },
    ],
  };
}

/** Small helper to keep the Duskmoor layout readable. */
function rubberBand(g: Grid): Grid {
  g[16][17] = 'r';
  g[16][18] = 'r';
  return g;
}
