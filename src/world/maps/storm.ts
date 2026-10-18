/** Route 2 and Voltspire City, home of the Storm Trial. */

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

export function routeTwo(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), '#');
  scatter(g, ['o', 'b', 'P'], 0.08, 137);
  hLine(g, 26, 1, ROUTE_WIDTH - 2, '=');
  vLine(g, 17, 2, 26, '=');
  hLine(g, 14, 6, 17, '=');
  vLine(g, 6, 14, 26, '=');
  grassPatch(g, 10, 9, 5, 3);
  grassPatch(g, 25, 20, 5, 3);
  grassPatch(g, 25, 8, 4, 3);
  // Wind turbines (small rocks as placeholders for pylons).
  rect(g, 21, 4, 2, 2, 'o');
  rect(g, 12, 20, 2, 2, 'o');

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '=');
  return {
    id: 'route-2',
    name: 'Route 2',
    biome: 'city',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Wind Farms — the turbines hum all night.',
    encounterZone: 'route-2',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'thistlebrook', x: 17, y: 1, facing: 'down' },
      },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'voltspire-city', x: 17, y: 24, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'bug-catcher-orel',
        name: 'Orel',
        x: 10,
        y: 12,
        facing: 'down',
        kind: 'trainer',
        trainerId: 'bug-catcher-orel',
        sight: 4,
        sprite: STYLE.kid(0xd98a3a),
      },
      {
        id: 'route2-npc',
        name: 'Engineer',
        x: 26,
        y: 14,
        facing: 'left',
        kind: 'npc',
        sprite: STYLE.adult(0xffd60a),
        chatter: [
          'Volta built every turbine on this route.',
          'Her Stormfleece charges them just by standing still.',
        ],
      },
    ],
  };
}

export function voltspireCity(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, '.'), '#');
  hLine(g, 13, 1, TOWN_WIDTH - 2, '=');
  vLine(g, 17, 4, 24, '=');
  scatter(g, ['o', 'b'], 0.05, 211);
  building(g, { x: 12, y: 2, width: 11, height: 6, roof: 'V', doorX: 17 });
  building(g, { x: 3, y: 8, width: 7, height: 5, roof: 'H', doorX: 6 });
  building(g, { x: 24, y: 8, width: 7, height: 5, roof: 'S', doorX: 27 });
  building(g, { x: 5, y: 17, width: 8, height: 6, roof: 'R', doorX: 9 });
  building(g, { x: 21, y: 17, width: 8, height: 6, roof: 'R', doorX: 25 });
  // Magnet plates forming a shortcut across the pond.
  lake(g, 17, 21, 4, 2);
  rect(g, 15, 20, 1, 1, 'm');
  rect(g, 19, 20, 1, 1, 'm');

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 11, 1, 13, '=');
  hLine(g, 1, 11, 18, '=');
  vLine(g, 17, 19, 24, 'B');
  vLine(g, 18, 19, 24, 'B');
  return {
    id: 'voltspire-city',
    name: 'Voltspire City',
    biome: 'city',
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'A city that never stops humming.',
    music: 'city',
    warps: [
      { x: 17, y: 25, width: 2, height: 1, to: { mapId: 'route-2', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-3', x: 17, y: 28, facing: 'up' } },
      {
        x: 17,
        y: 7,
        width: 1,
        height: 1,
        to: { mapId: 'voltspire-trial', x: 9, y: 11, facing: 'up' },
      },
      {
        x: 6,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'voltspire-heal', x: 7, y: 8, facing: 'up' },
      },
      {
        x: 27,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'voltspire-shop', x: 7, y: 8, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'eclipse-grunt-2',
        name: 'Eclipse Grunt',
        x: 26,
        y: 14,
        facing: 'left',
        kind: 'trainer',
        trainerId: 'eclipse-grunt-2',
        sight: 5,
        sprite: STYLE.adult(0x4d2aa8),
      },
      {
        id: 'volt-npc-1',
        name: 'Voltspire Tech',
        x: 10,
        y: 15,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.adult(0x7fffe5),
        chatter: ['Magnet plates lift you over gaps.', 'They need the Storm Trophy to work.'],
      },
      {
        id: 'voltspire-sign',
        name: 'Sign',
        x: 20,
        y: 13,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['VOLTSPIRE CITY', 'Electric Trophy: the Trial of Volta.'],
      },
    ],
  };
}
