/** Routes 5 and 6, Geode Hollow and Glimmer Caverns, home of the Facet Trial. */

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

export function routeFive(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), '#');
  scatter(g, ['o', 'L'], 0.12, 701);
  hLine(g, 26, 1, ROUTE_WIDTH - 2, '=');
  vLine(g, 17, 2, 26, '=');
  hLine(g, 14, 17, 28, '=');
  vLine(g, 28, 8, 14, '=');
  hLine(g, 8, 6, 28, '=');
  vLine(g, 6, 8, 26, '=');
  grassPatch(g, 11, 20, 4, 3);
  grassPatch(g, 24, 20, 4, 3);
  grassPatch(g, 11, 11, 3, 2);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '=');
  return {
    id: 'route-5',
    name: 'Route 5',
    biome: 'volcano',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Lava Fields — the rocks are warm to the touch.',
    encounterZone: 'route-5',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'cinder-peak', x: 17, y: 2, facing: 'down' },
      },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-6', x: 17, y: 28, facing: 'up' } },
    ],
    npcs: [],
  };
}

export function routeSix(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, '.'), '#');
  scatter(g, ['b', 'o', 'P'], 0.1, 811);
  hLine(g, 26, 1, ROUTE_WIDTH - 2, '=');
  vLine(g, 17, 4, 26, '=');
  hLine(g, 18, 6, 17, '=');
  hLine(g, 10, 17, 28, '=');
  vLine(g, 6, 18, 26, '=');
  vLine(g, 28, 4, 10, '=');
  // Marsh water.
  lake(g, 11, 8, 5, 3);
  lake(g, 24, 20, 5, 3);
  grassPatch(g, 11, 21, 3, 2);
  grassPatch(g, 24, 8, 3, 2);
  grassPatch(g, 24, 14, 3, 2);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 2, 28, '=');
  return {
    id: 'route-6',
    name: 'Route 6',
    biome: 'ruins',
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'Misty Marsh — something is always moving in the reeds.',
    encounterZone: 'route-6',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'ashfall-town', x: 17, y: 1, facing: 'down' },
      },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'geode-hollow', x: 17, y: 24, facing: 'up' },
      },
    ],
    npcs: [],
  };
}

export function geodeHollow(): MapDef {
  const g = border(blank(TOWN_WIDTH, TOWN_HEIGHT, 'g'), 'G');
  scatter(g, ['G'], 0.1, 907);
  hLine(g, 13, 1, TOWN_WIDTH - 2, 'g');
  vLine(g, 17, 4, 20, 'g');
  building(g, { x: 12, y: 2, width: 11, height: 6, roof: 'V', doorX: 17 });
  building(g, { x: 3, y: 8, width: 7, height: 5, roof: 'H', doorX: 6 });
  building(g, { x: 24, y: 8, width: 7, height: 5, roof: 'S', doorX: 27 });
  // Smashable crystal walls blocking side passages.
  rect(g, 8, 16, 1, 1, 'X');
  rect(g, 26, 16, 1, 1, 'G');

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 11, 1, 13, 'g');
  hLine(g, 1, 11, 18, 'g');
  vLine(g, 17, 8, 24, 'g');
  vLine(g, 9, 13, 17, 'g');
  hLine(g, 17, 8, 9, 'g');
  vLine(g, 19, 13, 17, 'g');
  hLine(g, 17, 18, 20, 'g');
  return {
    id: 'geode-hollow',
    name: 'Geode Hollow',
    biome: 'cave',
    isCave: true,
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles: toRows(g),
    blurb: 'A cavern lined with more gemstones than rock.',
    music: 'cave',
    encounterZone: 'geode-hollow',
    warps: [
      { x: 17, y: 25, width: 2, height: 1, to: { mapId: 'route-6', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-7', x: 17, y: 28, facing: 'up' } },
      { x: 17, y: 7, width: 1, height: 1, to: { mapId: 'geode-trial', x: 9, y: 11, facing: 'up' } },
      { x: 6, y: 12, width: 1, height: 1, to: { mapId: 'geode-heal', x: 7, y: 8, facing: 'up' } },
      { x: 27, y: 12, width: 1, height: 1, to: { mapId: 'geode-shop', x: 7, y: 8, facing: 'up' } },
      {
        x: 8,
        y: 16,
        width: 1,
        height: 1,
        to: { mapId: 'glimmer-caverns', x: 17, y: 27, facing: 'up' },
        requires: 'smash',
        lockedMessage: 'This crystal wall is too hard to break by hand.',
      },
    ],
    npcs: [
      {
        id: 'geode-sign',
        name: 'Sign',
        x: 20,
        y: 13,
        facing: 'down',
        kind: 'sign',
        sprite: STYLE.adult(0x9aa4b0),
        dialogue: ['GEODE HOLLOW', 'Crystal Trophy: the Trial of Opal.'],
      },
    ],
  };
}

export function glimmerCaverns(): MapDef {
  const g = border(blank(ROUTE_WIDTH, ROUTE_HEIGHT, 'g'), 'G');
  scatter(g, ['G'], 0.14, 1009);
  // Carve winding tunnels.
  let x = 17;
  for (let y = 2; y < ROUTE_HEIGHT - 3; y++) {
    x += (y % 3 === 0 ? 1 : -1) * (y % 2 === 0 ? 1 : 0);
    x = Math.max(4, Math.min(ROUTE_WIDTH - 5, x));
    g[y][x] = 'g';
    g[y][x + 1] = 'g';
  }
  hLine(g, 26, 1, ROUTE_WIDTH - 2, 'g');
  grassPatch(g, 10, 20, 4, 3);
  grassPatch(g, 24, 20, 4, 3);
  grassPatch(g, 17, 8, 4, 3);

  gate(g, 17, 'n');
  gate(g, 17, 's');
  vLine(g, 17, 1, 28, 'g');
  return {
    id: 'glimmer-caverns',
    name: 'Glimmer Caverns',
    biome: 'cave',
    isCave: true,
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    tiles: toRows(g),
    blurb: 'The walls sparkle, but the tunnels are very dark.',
    music: 'cave',
    encounterZone: 'glimmer-caverns',
    requires: 'light',
    warps: [
      {
        x: 17,
        y: 29,
        width: 2,
        height: 1,
        to: { mapId: 'geode-hollow', x: 8, y: 17, facing: 'down' },
      },
      {
        x: 17,
        y: 0,
        width: 2,
        height: 1,
        to: { mapId: 'geode-hollow', x: 19, y: 17, facing: 'down' },
      },
    ],
    npcs: [
      {
        id: 'hiker-rolf',
        name: 'Rolf',
        x: 10,
        y: 22,
        facing: 'right',
        kind: 'trainer',
        trainerId: 'hiker-rolf',
        sight: 4,
        sprite: STYLE.adult(0x8a4a2f),
      },
    ],
  };
}
