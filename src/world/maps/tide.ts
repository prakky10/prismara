/** Route 3 and Tidehaven, home of the Tide Trial. */

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
  scatter,
  toRows,
  vLine,
} from './grid';
import type { MapDef } from './types';

export function routeThree(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, 's'), '#');
  hLine(g, 27, 1, ROUTE_WIDTH - 2, 's');
  vLine(g, 17, 2, 27, '=');
  hLine(g, 16, 8, 17, '=');
  hLine(g, 8, 17, 26, '=');
  vLine(g, 26, 8, 20, '=');
  lake(g, 27, 25, 6, 3);
  lake(g, 6, 6, 4, 3);
  grassPatch(g, 10, 22, 4, 3);
  grassPatch(g, 22, 12, 4, 3);
  grassPatch(g, 11, 8, 4, 3);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '=');
  return {
    id: 'route-3',
    name: 'Route 3',
    biome: 'beach',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Coral Coast — the sea is always just over there.',
    encounterZone: 'route-3',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'voltspire-city', x: 17, y: 1, facing: 'down' },
      },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'tidehaven', x: 17, y: 24, facing: 'up' } },
      {
        x: 27,
        y: 28,
        width: 2,
        height: 1,
        to: { mapId: 'route-4', x: 17, y: 28, facing: 'up' },
        requires: 'surf',
        lockedMessage: 'The sea is too deep to swim. Surf would help.',
      },
    ],
    npcs: [
      {
        id: 'route3-npc',
        name: 'Shell Collector',
        x: 12,
        y: 18,
        facing: 'up',
        kind: 'npc',
        sprite: STYLE.kid(0xffd0e0),
        chatter: ['Krabrine shells used to be lighthouses.', 'Now they are just very heavy.'],
      },
    ],
  };
}

export function tidehaven(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, 's'), '#');
  hLine(g, 13, 1, TOWN_WIDTH - 2, '=');
  vLine(g, 17, 4, 23, '=');
  scatter(g, ['b', 'o'], 0.04, 307);
  building(g, { x: 12, y: 2, width: 11, height: 6, roof: 'V', doorX: 17 });
  building(g, { x: 3, y: 8, width: 7, height: 5, roof: 'H', doorX: 6 });
  building(g, { x: 24, y: 8, width: 7, height: 5, roof: 'S', doorX: 27 });
  building(g, { x: 8, y: 17, width: 7, height: 6, roof: 'R', doorX: 11 });
  building(g, { x: 21, y: 17, width: 7, height: 6, roof: 'R', doorX: 24 });
  lake(g, 30, 21, 2, 3);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 11, 1, 13, '=');
  hLine(g, 1, 11, 18, '=');
  vLine(g, 17, 8, 24, '=');
  return {
    id: 'tidehaven',
    name: 'Tidehaven',
    biome: 'beach',
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'A harbour town that smells of salt and adventure.',
    music: 'town',
    warps: [
      { x: 17, y: 25, width: 2, height: 1, to: { mapId: 'route-3', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-4', x: 17, y: 28, facing: 'up' } },
      {
        x: 17,
        y: 7,
        width: 1,
        height: 1,
        to: { mapId: 'tidehaven-trial', x: 9, y: 11, facing: 'up' },
      },
      {
        x: 6,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'tidehaven-heal', x: 7, y: 8, facing: 'up' },
      },
      {
        x: 27,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'tidehaven-shop', x: 7, y: 8, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'sailor-mako',
        name: 'Mako',
        x: 25,
        y: 15,
        facing: 'left',
        kind: 'trainer',
        trainerId: 'sailor-mako',
        sight: 4,
        sprite: STYLE.adult(0x3f7fbf),
      },
      {
        id: 'tide-npc',
        name: 'Fishmonger',
        x: 10,
        y: 14,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.adult(0x2ea8ff),
        chatter: ['Captain Marin once wrestled a Maelstrotter.', 'She won. Obviously.'],
      },
      {
        id: 'tidehaven-sign',
        name: 'Sign',
        x: 20,
        y: 13,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['TIDEHAVEN', 'Water Trophy: the Trial of Marin.'],
      },
    ],
  };
}
