/** Whisperwood Forest and Thistlebrook, home of the Verdant Trial. */

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

export function whisperwood(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), '#');
  // Dense woods.
  scatter(g, ['#', 'P', 'b'], 0.26, 33);
  // Carve the walking route through the trees.
  vLine(g, 17, 2, 27, '.');
  vLine(g, 16, 2, 27, '.');
  hLine(g, 14, 6, 16, '.');
  vLine(g, 6, 14, 22, '.');
  hLine(g, 22, 6, 27, '.');
  vLine(g, 27, 22, 27, '.');
  vLine(g, 27, 2, 10, '.');
  hLine(g, 10, 17, 27, '.');
  grassPatch(g, 11, 22, 4, 3);
  grassPatch(g, 22, 8, 4, 3);
  grassPatch(g, 11, 8, 4, 3);
  scatter(g, ['+'], 0.05, 51);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '.');
  rect(g, 25, 11, 3, 3, '.');
  return {
    id: 'whisperwood-forest',
    name: 'Whisperwood Forest',
    biome: 'forest',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Old trees, older secrets.',
    encounterZone: 'whisperwood-forest',
    warps: [
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'route-1', x: 17, y: 1, facing: 'down' } },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'thistlebrook', x: 17, y: 24, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'forest-sign',
        name: 'Sign',
        x: 18,
        y: 27,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['WHISPERWOOD FOREST', 'The trees whisper. Mostly about you.'],
      },
      {
        id: 'lass-mira',
        name: 'Mira',
        x: 11,
        y: 22,
        facing: 'right',
        kind: 'trainer',
        trainerId: 'lass-mira',
        sight: 4,
        sprite: STYLE.kid(0xff8fc4),
      },
      {
        id: 'eclipse-grunt-1',
        name: 'Eclipse Grunt',
        x: 27,
        y: 12,
        facing: 'left',
        kind: 'trainer',
        trainerId: 'eclipse-grunt-1',
        sight: 4,
        sprite: STYLE.adult(0x4d2aa8),
      },
      {
        id: 'soren-forest',
        name: 'Soren',
        x: 16,
        y: 4,
        facing: 'down',
        kind: 'npc',
        sprite: STYLE.kid(0x4d2aa8),
        showWhenFlag: 'eclipse-forest-cleared',
        hideWhenFlag: 'soren-sighted',
        dialogue: ['Soren: You should not be here.'],
      },
      {
        id: 'forest-npc',
        name: 'Naturalist',
        x: 6,
        y: 18,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.adult(0x4cd964),
        chatter: [
          'Grass beats Water. Water beats Fire. Fire beats Grass.',
          'Simple, until you add Electric, Shadow and Crystal!',
        ],
      },
    ],
  };
}

export function thistlebrook(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, '.'), '#');
  hLine(g, 14, 1, TOWN_WIDTH - 2, '=');
  vLine(g, 17, 6, 14, '=');
  vLine(g, 17, 14, 24, '=');
  scatter(g, ['+', 'b', 'o'], 0.06, 91);
  // The Trial Hall (blue roof) sits at the north end.
  building(g, { x: 12, y: 3, width: 11, height: 6, roof: 'V', doorX: 17 });
  // Healing Center west, shop east.
  building(g, { x: 3, y: 9, width: 7, height: 5, roof: 'H', doorX: 6 });
  building(g, { x: 24, y: 9, width: 7, height: 5, roof: 'S', doorX: 27 });
  building(g, { x: 8, y: 18, width: 6, height: 5, roof: 'R', doorX: 11 });
  building(g, { x: 21, y: 18, width: 6, height: 5, roof: 'R', doorX: 24 });
  lake(g, 29, 23, 3, 2);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 11, 2, 14, '=');
  hLine(g, 2, 11, 18, '=');
  vLine(g, 17, 14, 24, '=');
  return {
    id: 'thistlebrook',
    name: 'Thistlebrook',
    biome: 'forest',
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'A garden town wrapped around a great thorn tree.',
    music: 'town',
    warps: [
      {
        x: 17,
        y: 25,
        width: 2,
        height: 1,
        to: { mapId: 'whisperwood-forest', x: 17, y: 1, facing: 'down' },
      },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-2', x: 17, y: 28, facing: 'up' } },
      {
        x: 17,
        y: 8,
        width: 1,
        height: 1,
        to: { mapId: 'thistlebrook-trial', x: 9, y: 11, facing: 'up' },
      },
      {
        x: 6,
        y: 13,
        width: 1,
        height: 1,
        to: { mapId: 'thistlebrook-heal', x: 7, y: 8, facing: 'up' },
      },
      {
        x: 27,
        y: 13,
        width: 1,
        height: 1,
        to: { mapId: 'thistlebrook-shop', x: 7, y: 8, facing: 'up' },
      },
    ],
    npcs: [
      {
        id: 'thistle-sign',
        name: 'Sign',
        x: 19,
        y: 22,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['THISTLEBROOK', 'Grass Trophy: the Trial of Ivy, in the hall north.'],
      },
      {
        id: 'thistle-npc-1',
        name: 'Gardener',
        x: 8,
        y: 13,
        facing: 'right',
        kind: 'npc',
        sprite: STYLE.adult(0x4cd964),
        chatter: [
          'Ivy grows the biggest pumpkins in Prismara.',
          'She never lets anyone leave without a battle.',
        ],
      },
      {
        id: 'thistle-npc-2',
        name: 'Child',
        x: 22,
        y: 13,
        facing: 'left',
        kind: 'npc',
        sprite: STYLE.kid(0xffd60a),
        chatter: ['Six Trophies! One for each element!', 'I only have zero.'],
      },
    ],
  };
}
