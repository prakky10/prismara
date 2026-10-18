/** Route 4, Ashfall Town and Cinder Peak, home of the Ember Trial. */

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

export function routeFour(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), '#');
  scatter(g, ['o', 'b', 'P'], 0.12, 401);
  // A cliff path with ledges.
  vLine(g, 17, 2, 12, '=');
  hLine(g, 12, 10, 17, '=');
  vLine(g, 10, 12, 22, '=');
  hLine(g, 22, 10, 24, '=');
  vLine(g, 24, 12, 22, '=');
  hLine(g, 12, 17, 24, '=');
  hLine(g, 18, 15, 19, '^');
  grassPatch(g, 8, 18, 4, 3);
  grassPatch(g, 27, 18, 4, 3);
  grassPatch(g, 27, 6, 4, 3);
  lake(g, 5, 28, 5, 2);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '=');
  return {
    id: 'route-4',
    name: 'Route 4',
    biome: 'beach',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Sea Cliffs — one wrong step and it is a long way down.',
    encounterZone: 'route-4',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'tidehaven', x: 17, y: 1, facing: 'down' },
      },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'ashfall-town', x: 17, y: 24, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'route4-npc',
        name: 'Climber',
        x: 24,
        y: 20,
        facing: 'up',
        kind: 'npc',
        sprite: STYLE.adult(0xff6b35),
        chatter: ['Ashfall Town is just past the ridge.', 'Mind the ash — it gets everywhere.'],
      },
    ],
  };
}

export function ashfallTown(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, '.'), '#');
  hLine(g, 13, 1, TOWN_WIDTH - 2, '=');
  vLine(g, 17, 4, 22, '=');
  scatter(g, ['o', 'b'], 0.07, 509);
  building(g, { x: 12, y: 2, width: 11, height: 6, roof: 'V', doorX: 17 });
  building(g, { x: 3, y: 8, width: 7, height: 5, roof: 'H', doorX: 6 });
  building(g, { x: 24, y: 8, width: 7, height: 5, roof: 'S', doorX: 27 });
  building(g, { x: 8, y: 17, width: 7, height: 6, roof: 'R', doorX: 11 });
  building(g, { x: 21, y: 17, width: 7, height: 6, roof: 'R', doorX: 24 });
  lake(g, 5, 23, 3, 1);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 11, 1, 13, '=');
  hLine(g, 1, 11, 18, '=');
  vLine(g, 17, 8, 24, '=');
  vLine(g, 28, 13, 23, '=');
  vLine(g, 29, 13, 23, '=');
  hLine(g, 23, 28, 29, '=');
  return {
    id: 'ashfall-town',
    name: 'Ashfall Town',
    biome: 'volcano',
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'Blacksmiths, warm springs, and ash like grey snow.',
    music: 'town',
    warps: [
      { x: 17, y: 25, width: 2, height: 1, to: { mapId: 'route-4', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-6', x: 17, y: 28, facing: 'up' } },
      {
        x: 17,
        y: 7,
        width: 1,
        height: 1,
        to: { mapId: 'ashfall-trial', x: 9, y: 11, facing: 'up' },
      },
      { x: 6, y: 12, width: 1, height: 1, to: { mapId: 'ashfall-heal', x: 7, y: 8, facing: 'up' } },
      {
        x: 27,
        y: 12,
        width: 1,
        height: 1,
        to: { mapId: 'ashfall-shop', x: 7, y: 8, facing: 'up' },
      },
      {
        x: 28,
        y: 22,
        width: 2,
        height: 1,
        to: { mapId: 'cinder-peak', x: 17, y: 27, facing: 'up' },
        requires: 'light',
        lockedMessage: 'The caldera is pitch black without a lit cave.',
      },
    ],
    npcs: [
      {
        id: 'ash-npc',
        name: 'Blacksmith',
        x: 11,
        y: 14,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.adult(0xff6b35),
        chatter: [
          'Blaze forged my best hammer.',
          'She says a good battle is just good metal, moving fast.',
        ],
      },
      {
        id: 'ashfall-sign',
        name: 'Sign',
        x: 20,
        y: 13,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['ASHFALL TOWN', 'Fire Trophy: the Trial of Blaze.'],
      },
    ],
  };
}

export function cinderPeak(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), '#');
  scatter(g, ['o', 'L'], 0.08, 601);
  rect(g, 13, 4, 8, 5, 'L');
  hLine(g, 26, 1, ROUTE_WIDTH - 2, '=');
  vLine(g, 17, 9, 26, '=');
  grassPatch(g, 10, 18, 4, 3);
  grassPatch(g, 24, 18, 4, 3);
  grassPatch(g, 24, 9, 4, 3);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 10, 1, 26, '=');
  hLine(g, 1, 10, 18, '=');
  vLine(g, 17, 9, 28, '=');
  return {
    id: 'cinder-peak',
    name: 'Cinder Peak',
    biome: 'volcano',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'The caldera where the sun itself comes to sleep.',
    encounterZone: 'cinder-peak',
    warps: [
      {
        x: 17,
        y: 28,
        width: 2,
        height: 1,
        to: { mapId: 'ashfall-town', x: 28, y: 21, facing: 'down' },
      },
      { x: 17, y: 1, width: 2, height: 1, to: { mapId: 'route-5', x: 17, y: 28, facing: 'up' } },
    ],
    npcs: [
      {
        id: 'cinder-sign',
        name: 'Ancient Stone',
        x: 15,
        y: 12,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: [
          'Carved here: "When the sun is highest, the golden one wakes."',
          'Solarion can only be challenged at noon.',
        ],
      },
      {
        id: 'pilgrim-cinder',
        name: 'Pilgrim',
        x: 14,
        y: 12,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.elder(0xe8e0f0),
        showWhenFlag: 'trial-3-cleared',
        hideWhenFlag: 'aurelia-confessed',
        dialogue: ['Pilgrim: Go on. The beacons need you more than I do.'],
      },
    ],
  };
}
