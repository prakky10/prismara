/** Map, warp and NPC definitions, plus the legend that turns grid characters into tiles. */

import type { Biome, TileName } from '../../render/tiles/TilePainter';

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
