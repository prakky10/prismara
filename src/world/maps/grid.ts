/** Grid-composition helpers shared by every map: blank fields, lines, buildings, ponds and rooms. */

import type { MapDef, SpriteStyle, TileChar } from './types';

export const TOWN_WIDTH = 34;
export const TOWN_HEIGHT = 26;
export const ROUTE_WIDTH = 34;
export const ROUTE_HEIGHT = 30;

export type Grid = string[][];

export function blank(width: number, height: number, fill: TileChar): Grid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

export function rect(g: Grid, x: number, y: number, w: number, h: number, fill: TileChar): Grid {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (g[yy] && g[yy][xx] !== undefined) g[yy][xx] = fill;
    }
  }
  return g;
}

export function hLine(
  g: Grid,
  y: number,
  x1: number,
  x2: number,
  fill: TileChar,
  thickness = 1,
): Grid {
  for (let t = 0; t < thickness; t++) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      if (g[y + t] && g[y + t][x] !== undefined) g[y + t][x] = fill;
    }
  }
  return g;
}

export function vLine(
  g: Grid,
  x: number,
  y1: number,
  y2: number,
  fill: TileChar,
  thickness = 1,
): Grid {
  for (let t = 0; t < thickness; t++) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      if (g[y] && g[y][x + t] !== undefined) g[y][x + t] = fill;
    }
  }
  return g;
}

/** Pill-shaped tall-grass patch, the classic route encounter spot. */
export function grassPatch(g: Grid, cx: number, cy: number, rx: number, ry: number): Grid {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && g[y] && g[y][x] !== undefined && g[y][x] === '.') {
        g[y][x] = ':';
      }
    }
  }
  return g;
}

/** A lake with a soft shoreline. */
export function lake(g: Grid, cx: number, cy: number, rx: number, ry: number): Grid {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && g[y] && g[y][x] !== undefined) g[y][x] = '~';
    }
  }
  return g;
}

export interface BuildingSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  roof: 'R' | 'H' | 'S' | 'V';
  doorX?: number;
}

/** A two-tone building: a roof block over a wall block with a door and windows. */
export function building(g: Grid, spec: BuildingSpec): Grid {
  const { x, y, width, height, roof } = spec;
  const roofHeight = Math.max(1, Math.floor(height / 2));
  rect(g, x, y, width, roofHeight, roof);
  rect(g, x, y + roofHeight, width, height - roofHeight, 'W');
  const doorX = spec.doorX ?? x + Math.floor(width / 2);
  rect(g, doorX, y + height - 1, 1, 1, 'D');
  // Windows on the wall row.
  for (let wx = x + 1; wx < x + width - 1; wx += 2) {
    if (wx === doorX || Math.abs(wx - doorX) <= 1) continue;
    g[y + roofHeight + 1] && (g[y + roofHeight + 1][wx] = 'w');
  }
  return g;
}

/** Solid tree/rock border around the whole map. */
export function border(g: Grid, fill: TileChar): Grid {
  const h = g.length;
  const w = g[0].length;
  hLine(g, 0, 0, w - 1, fill);
  hLine(g, h - 1, 0, w - 1, fill);
  vLine(g, 0, 0, h - 1, fill);
  vLine(g, w - 1, 0, h - 1, fill);
  return g;
}

/** Sprinkle deterministic decoration (flowers, rocks) so fields are not flat. */
export function scatter(
  g: Grid,
  chars: TileChar[],
  density: number,
  seed: number,
  on: TileChar = '.',
): Grid {
  let counter = seed;
  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < g[0].length - 1; x++) {
      if (g[y][x] !== on) continue;
      counter = (counter * 1103515245 + 12345) & 0x7fffffff;
      if ((counter % 1000) / 1000 < density) {
        g[y][x] = chars[counter % chars.length];
      }
    }
  }
  return g;
}

export function toRows(g: Grid): string[] {
  return g.map((row) => row.join(''));
}

/**
 * Punch a 2-wide walkable gate through the top or bottom border and pave the
 * tile just inside it, so a route's edge warp is always reachable. This is an
 * intentional opening for a road, never a path carved through a building.
 */
export function gate(g: Grid, x: number, edge: 'n' | 's'): Grid {
  const h = g.length;
  const edgeY = edge === 'n' ? 0 : h - 1;
  const innerY = edge === 'n' ? 1 : h - 2;
  g[edgeY][x] = '=';
  g[edgeY][x + 1] = '=';
  g[innerY][x] = '=';
  g[innerY][x + 1] = '=';
  return g;
}

/* ------------------------------------------------------------ NPC styles -- */

export const STYLE = {
  kid: (shirt: number): SpriteStyle => ({ shirt, hair: 0x3a2a1a, skin: 0xf0c8a0 }),
  adult: (shirt: number, hair = 0x2a1a1a): SpriteStyle => ({ shirt, hair, skin: 0xe8bf98 }),
  elder: (shirt: number): SpriteStyle => ({ shirt, hair: 0xd8d8d8, skin: 0xe8c8a8 }),
};

/** Indoor rooms are generated from a tiny spec so they stay consistent. */
export function indoorRoom(
  id: string,
  name: string,
  width: number,
  height: number,
  exit: { toMap: string; x: number; y: number },
  music: string,
): MapDef {
  const g = border(blank(width, height, 'c'), 'W');
  hLine(g, height - 3, 1, width - 2, 'c');
  return {
    id,
    name,
    biome: 'city',
    indoor: true,
    width,
    height,
    tiles: toRows(g),
    music,
    warps: [
      {
        x: Math.floor(width / 2),
        y: height - 2,
        width: 1,
        height: 1,
        to: { mapId: exit.toMap, x: exit.x, y: exit.y, facing: 'down' },
      },
    ],
    npcs: [],
  };
}
