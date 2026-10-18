/**
 * The region of Prismara.
 *
 * Maps are authored as character grids that a legend turns into tiles. Rather
 * than hand-drawing eighteen 34x26 grids (which is error-prone and unreadable),
 * each area is *composed* from small helpers — `field`, `hLine`, `building`,
 * `grassPatch` — so the intent of the layout is visible in the code and every
 * map is guaranteed rectangular and bordered.
 */

import type { Biome, TileName } from '../render/tiles/TilePainter';
import type { CreatureId } from '../data/creatures';

export type Facing = 'up' | 'down' | 'left' | 'right';

/** A character in a map grid. */
export type TileChar = string;

export interface MapDef {
  id: string;
  name: string;
  biome: Biome;
  /** Optional music override; otherwise chosen from the biome. */
  music?: string;
  isCave?: boolean;
  /** Indoor maps do not cycle the day/night lighting. */
  indoor?: boolean;
  width: number;
  height: number;
  /** Ground layer rows, one string per row. */
  tiles: string[];
  /** Optional overlay rows (signs, flowers drawn above the ground). */
  decor?: string[];
  warps: WarpDef[];
  npcs: NpcDef[];
  /** Encounter zone id, or undefined for safe areas. */
  encounterZone?: string;
  /** Field ability needed to enter at all (unused on the critical path). */
  requires?: 'surf' | 'cut' | 'light' | 'smash' | 'night-sight' | 'magnet';
  /** Shown on the area banner when the player enters. */
  blurb?: string;
}

export interface WarpDef {
  x: number;
  y: number;
  /** Optional multi-tile warp (doors and gates). */
  width?: number;
  height?: number;
  to: { mapId: string; x: number; y: number; facing?: Facing };
  /** Only usable when the player has this field ability. */
  requires?: 'surf' | 'cut' | 'light' | 'smash' | 'night-sight' | 'magnet';
  /** Show this line when the requirement is missing. */
  lockedMessage?: string;
}

export interface SpriteStyle {
  shirt: number;
  hair: number;
  skin: number;
}

export interface NpcDef {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  kind: 'npc' | 'trainer' | 'heal' | 'shop' | 'sign' | 'trial';
  sprite: SpriteStyle;
  dialogue?: string[];
  /** Trainer id, for kind === 'trainer' or 'trial'. */
  trainerId?: string;
  /** How far the trainer looks for the player, in tiles. */
  sight?: number;
  /** Hide the NPC entirely when this flag is set. */
  hideWhenFlag?: string;
  /** Only show when this flag is set. */
  showWhenFlag?: string;
  /** A random line from this list, for flavour NPCs. */
  chatter?: string[];
}

/* ------------------------------------------------------------- legends -- */

/** Default character -> tile mapping used by every map. */
export const DEFAULT_LEGEND: Record<TileChar, TileName> = {
  '.': 'grass',
  ':': 'tallgrass',
  '+': 'flowers',
  '=': 'path',
  s: 'sand',
  '~': 'water',
  '#': 'tree',
  P: 'pine',
  b: 'bush',
  o: 'rock-small',
  '^': 'ledge',
  T: 'sign',
  W: 'wall',
  R: 'roof',
  H: 'roof-heal',
  S: 'roof-shop',
  V: 'roof-trial',
  D: 'door',
  w: 'window',
  f: 'fence',
  B: 'bridge',
  c: 'cave-floor',
  C: 'cave-wall',
  g: 'crystal-floor',
  G: 'crystal-wall',
  r: 'ruin-floor',
  u: 'ruin-wall',
  L: 'lava',
  n: 'snow',
  m: 'magnet-plate',
  k: 'cut-tree',
  X: 'crystal-smashable',
  x: 'empty',
};

export function tileNameFor(char: TileChar, biome: Biome): TileName {
  const base = DEFAULT_LEGEND[char] ?? 'grass';
  // Cave biomes reuse the floor/wall tiles for plain ground.
  if (biome === 'cave' && base === 'grass') return 'cave-floor';
  if (biome === 'ruins' && base === 'grass') return 'ruin-floor';
  if (biome === 'summit' && base === 'grass') return 'snow';
  return base;
}

/* ----------------------------------------------------------- generators -- */

const TOWN_WIDTH = 34;
const TOWN_HEIGHT = 26;
const ROUTE_WIDTH = 34;
const ROUTE_HEIGHT = 30;

type Grid = string[][];

function blank(width: number, height: number, fill: TileChar): Grid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function rect(g: Grid, x: number, y: number, w: number, h: number, fill: TileChar): Grid {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (g[yy] && g[yy][xx] !== undefined) g[yy][xx] = fill;
    }
  }
  return g;
}

function hLine(g: Grid, y: number, x1: number, x2: number, fill: TileChar, thickness = 1): Grid {
  for (let t = 0; t < thickness; t++) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      if (g[y + t] && g[y + t][x] !== undefined) g[y + t][x] = fill;
    }
  }
  return g;
}

function vLine(g: Grid, x: number, y1: number, y2: number, fill: TileChar, thickness = 1): Grid {
  for (let t = 0; t < thickness; t++) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      if (g[y] && g[y][x + t] !== undefined) g[y][x + t] = fill;
    }
  }
  return g;
}

/** Pill-shaped tall-grass patch, the classic route encounter spot. */
function grassPatch(g: Grid, cx: number, cy: number, rx: number, ry: number): Grid {
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
function lake(g: Grid, cx: number, cy: number, rx: number, ry: number): Grid {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && g[y] && g[y][x] !== undefined) g[y][x] = '~';
    }
  }
  return g;
}

interface BuildingSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  roof: 'R' | 'H' | 'S' | 'V';
  doorX?: number;
}

/** A two-tone building: a roof block over a wall block with a door and windows. */
function building(g: Grid, spec: BuildingSpec): Grid {
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
function border(g: Grid, fill: TileChar): Grid {
  const h = g.length;
  const w = g[0].length;
  hLine(g, 0, 0, w - 1, fill);
  hLine(g, h - 1, 0, w - 1, fill);
  vLine(g, 0, 0, h - 1, fill);
  vLine(g, w - 1, 0, h - 1, fill);
  return g;
}

/** Sprinkle deterministic decoration (flowers, rocks) so fields are not flat. */
function scatter(g: Grid, chars: TileChar[], density: number, seed: number, on: TileChar = '.'): Grid {
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

function toRows(g: Grid): string[] {
  return g.map((row) => row.join(''));
}

/**
 * Punch a 2-wide walkable gate through the top or bottom border and pave the
 * tile just inside it, so a route's edge warp is always reachable. This is an
 * intentional opening for a road, never a path carved through a building.
 */
function gate(g: Grid, x: number, edge: 'n' | 's'): Grid {
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

const STYLE = {
  kid: (shirt: number): SpriteStyle => ({ shirt, hair: 0x3a2a1a, skin: 0xf0c8a0 }),
  adult: (shirt: number, hair = 0x2a1a1a): SpriteStyle => ({ shirt, hair, skin: 0xe8bf98 }),
  elder: (shirt: number): SpriteStyle => ({ shirt, hair: 0xd8d8d8, skin: 0xe8c8a8 }),
};

/* ----------------------------------------------------------- the region -- */

function emberleafTown(): MapDef {
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
      { x: 9, y: 21, width: 1, height: 1, to: { mapId: 'emberleaf-house', x: 7, y: 8, facing: 'up' } },
      { x: 26, y: 12, width: 1, height: 1, to: { mapId: 'emberleaf-shop', x: 6, y: 8, facing: 'up' } },
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
        dialogue: ['EMBELEAF TOWN', 'North: Route 1 and Thistlebrook. Six Trophies open the Summit.'],
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

function lumenLab(): MapDef {
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
    warps: [{ x: 8, y: 12, width: 1, height: 1, to: { mapId: 'emberleaf-town', x: 17, y: 9, facing: 'down' } }],
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

function emberleafHouse(): MapDef {
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
    warps: [{ x: 7, y: 9, width: 1, height: 1, to: { mapId: 'emberleaf-town', x: 9, y: 22, facing: 'down' } }],
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

function emberleafShop(): MapDef {
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
    warps: [{ x: 6, y: 9, width: 1, height: 1, to: { mapId: 'emberleaf-town', x: 26, y: 13, facing: 'down' } }],
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

function routeOne(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'emberleaf-town', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'whisperwood-forest', x: 17, y: 28, facing: 'up' } },
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

function whisperwood(): MapDef {
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
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'thistlebrook', x: 17, y: 24, facing: 'up' } },
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

function thistlebrook(): MapDef {
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
      { x: 17, y: 25, width: 2, height: 1, to: { mapId: 'whisperwood-forest', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-2', x: 17, y: 28, facing: 'up' } },
      { x: 17, y: 8, width: 1, height: 1, to: { mapId: 'thistlebrook-trial', x: 9, y: 11, facing: 'up' } },
      { x: 6, y: 13, width: 1, height: 1, to: { mapId: 'thistlebrook-heal', x: 7, y: 8, facing: 'up' } },
      { x: 27, y: 13, width: 1, height: 1, to: { mapId: 'thistlebrook-shop', x: 7, y: 8, facing: 'up' } },
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

/** Indoor rooms are generated from a tiny spec so they stay consistent. */
function indoorRoom(
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
    warps: [{ x: Math.floor(width / 2), y: height - 2, width: 1, height: 1, to: { mapId: exit.toMap, x: exit.x, y: exit.y, facing: 'down' } }],
    npcs: [],
  };
}

function routeTwo(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'thistlebrook', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'voltspire-city', x: 17, y: 24, facing: 'up' } },
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

function voltspireCity(): MapDef {
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
      { x: 17, y: 7, width: 1, height: 1, to: { mapId: 'voltspire-trial', x: 9, y: 11, facing: 'up' } },
      { x: 6, y: 12, width: 1, height: 1, to: { mapId: 'voltspire-heal', x: 7, y: 8, facing: 'up' } },
      { x: 27, y: 12, width: 1, height: 1, to: { mapId: 'voltspire-shop', x: 7, y: 8, facing: 'up' } },
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

function routeThree(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'voltspire-city', x: 17, y: 1, facing: 'down' } },
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

function tidehaven(): MapDef {
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
      { x: 17, y: 7, width: 1, height: 1, to: { mapId: 'tidehaven-trial', x: 9, y: 11, facing: 'up' } },
      { x: 6, y: 12, width: 1, height: 1, to: { mapId: 'tidehaven-heal', x: 7, y: 8, facing: 'up' } },
      { x: 27, y: 12, width: 1, height: 1, to: { mapId: 'tidehaven-shop', x: 7, y: 8, facing: 'up' } },
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

function routeFour(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'tidehaven', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'ashfall-town', x: 17, y: 24, facing: 'up' } },
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

function ashfallTown(): MapDef {
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
      { x: 17, y: 7, width: 1, height: 1, to: { mapId: 'ashfall-trial', x: 9, y: 11, facing: 'up' } },
      { x: 6, y: 12, width: 1, height: 1, to: { mapId: 'ashfall-heal', x: 7, y: 8, facing: 'up' } },
      { x: 27, y: 12, width: 1, height: 1, to: { mapId: 'ashfall-shop', x: 7, y: 8, facing: 'up' } },
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

function cinderPeak(): MapDef {
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
      { x: 17, y: 28, width: 2, height: 1, to: { mapId: 'ashfall-town', x: 28, y: 21, facing: 'down' } },
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
    ],
  };
}

function routeFive(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'cinder-peak', x: 17, y: 2, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'route-6', x: 17, y: 28, facing: 'up' } },
    ],
    npcs: [],
  };
}

function routeSix(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'ashfall-town', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'geode-hollow', x: 17, y: 24, facing: 'up' } },
    ],
    npcs: [],
  };
}

function geodeHollow(): MapDef {
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

function glimmerCaverns(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'geode-hollow', x: 8, y: 17, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'geode-hollow', x: 19, y: 17, facing: 'down' } },
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

function routeSeven(): MapDef {
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
      { x: 17, y: 29, width: 2, height: 1, to: { mapId: 'geode-hollow', x: 17, y: 1, facing: 'down' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'duskmoor-ruins', x: 17, y: 24, facing: 'up' } },
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

function duskmoorRuins(): MapDef {
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
      { x: 6, y: 12, width: 1, height: 1, to: { mapId: 'duskmoor-heal', x: 7, y: 8, facing: 'up' } },
      { x: 17, y: 0, width: 2, height: 1, to: { mapId: 'prism-summit', x: 17, y: 24, facing: 'up' } },
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
        dialogue: [
          'DUSKMOOR RUINS',
          'Shadow Trophy: the Trial of Raven, held at the altar.',
        ],
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

function prismSummit(): MapDef {
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
      { x: 17, y: 25, width: 2, height: 1, to: { mapId: 'duskmoor-ruins', x: 17, y: 1, facing: 'down' } },
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
    const room = indoorRoom(id, name, 18, 14, { toMap: town, x: 17, y: town === 'thistlebrook' ? 9 : 8 }, 'battle-trial');
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
    const room = indoorRoom(id, name, 14, 11, { toMap: town, x: 6, y: town === 'thistlebrook' ? 14 : 13 }, 'town');
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
    const room = indoorRoom(id, name, 14, 11, { toMap: town, x: 27, y: town === 'thistlebrook' ? 14 : 13 }, 'city');
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
