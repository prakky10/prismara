/**
 * TilePainter — the overworld tileset, drawn entirely in code.
 *
 * No external art: every tile is painted onto a canvas at boot from a biome
 * palette (grass with noise dithering, paths, water, sand, cliffs, cave rock,
 * crystal floors, ruins, buildings). The result is registered with Phaser as a
 * single tileset texture so maps can be built from simple index grids.
 *
 * Tiles are 16px and the overworld renders them at x3, giving a crisp
 * pixel-art look that still benefits from modern lighting and shaders.
 */

import Phaser from 'phaser';

export const TILE_SIZE = 16;
export const TILESET_COLUMNS = 8;

export type Biome =
  | 'meadow'
  | 'forest'
  | 'city'
  | 'beach'
  | 'volcano'
  | 'cave'
  | 'ruins'
  | 'summit';

export interface TileSpec {
  /** Blocks movement. */
  solid?: boolean;
  /** Tall grass: walking here can trigger an encounter. */
  encounter?: boolean;
  /** Requires a field ability (Cut, Surf, ...) to pass. */
  requires?: 'cut' | 'surf' | 'light' | 'smash' | 'night-sight' | 'magnet';
  /** Human-readable name, shown by the debug overlay. */
  name: string;
}

interface Palette {
  ground: number;
  groundAlt: number;
  groundDark: number;
  path: number;
  pathAlt: number;
  water: number;
  waterDeep: number;
  waterFoam: number;
  rock: number;
  rockDark: number;
  accent: number;
  accentAlt: number;
}

const BIOME_PALETTES: Record<Biome, Palette> = {
  meadow: {
    ground: 0x6fbf5a,
    groundAlt: 0x7fd069,
    groundDark: 0x4f9a3e,
    path: 0xd9c08a,
    pathAlt: 0xc7aa72,
    water: 0x3fa9e0,
    waterDeep: 0x2478b8,
    waterFoam: 0xd8f3ff,
    rock: 0x9aa4b0,
    rockDark: 0x6c7684,
    accent: 0xff8fc4,
    accentAlt: 0xffd60a,
  },
  forest: {
    ground: 0x4f9a48,
    groundAlt: 0x5fae54,
    groundDark: 0x356b32,
    path: 0xbfa06a,
    pathAlt: 0xa88a58,
    water: 0x2f8fd0,
    waterDeep: 0x1a5f96,
    waterFoam: 0xc8ecff,
    rock: 0x7d868f,
    rockDark: 0x565e66,
    accent: 0x8fe07a,
    accentAlt: 0xffe066,
  },
  city: {
    ground: 0xbfb5a4,
    groundAlt: 0xcfc6b6,
    groundDark: 0x9a9182,
    path: 0xa8a096,
    pathAlt: 0x8f877d,
    water: 0x4fb0e8,
    waterDeep: 0x2a7fb8,
    waterFoam: 0xe0f5ff,
    rock: 0x8b939c,
    rockDark: 0x5f676f,
    accent: 0x8e5cff,
    accentAlt: 0x7fffe5,
  },
  beach: {
    ground: 0xf0dfa8,
    groundAlt: 0xfaeac0,
    groundDark: 0xd0bb80,
    path: 0xe0c98a,
    pathAlt: 0xc9ae6d,
    water: 0x35b6e8,
    waterDeep: 0x1f83b8,
    waterFoam: 0xffffff,
    rock: 0xb9a98a,
    rockDark: 0x8d8064,
    accent: 0xffd0e0,
    accentAlt: 0x7fffe5,
  },
  volcano: {
    ground: 0x5c4038,
    groundAlt: 0x6e4d43,
    groundDark: 0x3d2a24,
    path: 0x8a5a44,
    pathAlt: 0x6f4636,
    water: 0xff6b35,
    waterDeep: 0xb23a12,
    waterFoam: 0xffd60a,
    rock: 0x6b5049,
    rockDark: 0x452f2a,
    accent: 0xff6b35,
    accentAlt: 0xffd60a,
  },
  cave: {
    ground: 0x4a4550,
    groundAlt: 0x585264,
    groundDark: 0x322e3a,
    path: 0x605a6e,
    pathAlt: 0x4a4553,
    water: 0x2f7fb8,
    waterDeep: 0x1a4f7a,
    waterFoam: 0x9fe8ff,
    rock: 0x5d5769,
    rockDark: 0x3a3542,
    accent: 0x7fffe5,
    accentAlt: 0x8e5cff,
  },
  ruins: {
    ground: 0x5a5470,
    groundAlt: 0x6a6482,
    groundDark: 0x3e394f,
    path: 0x726c8c,
    pathAlt: 0x5a5470,
    water: 0x3f6fd0,
    waterDeep: 0x24428c,
    waterFoam: 0xbfd8ff,
    rock: 0x6e6884,
    rockDark: 0x494360,
    accent: 0x8e5cff,
    accentAlt: 0xc0a0ff,
  },
  summit: {
    ground: 0xdfe8f5,
    groundAlt: 0xeff4fc,
    groundDark: 0xb8c6dc,
    path: 0xc9d6e8,
    pathAlt: 0xafbdd2,
    water: 0x7fd8ff,
    waterDeep: 0x4fa8d8,
    waterFoam: 0xffffff,
    rock: 0x9fb0c8,
    rockDark: 0x74849c,
    accent: 0x7fffe5,
    accentAlt: 0xffd0ff,
  },
};

/** Everything the overworld asks for by name. */
export const TILE_NAMES = [
  'empty',
  'grass',
  'grass-a',
  'grass-b',
  'grass-c',
  'tallgrass',
  'tallgrass-a',
  'flowers',
  'path',
  'path-a',
  'path-b',
  'sand',
  'water',
  'water-a',
  'water-b',
  'water-c',
  'water-edge-n',
  'water-edge-s',
  'water-edge-e',
  'water-edge-w',
  'rock',
  'rock-dark',
  'cave-floor',
  'cave-wall',
  'crystal-floor',
  'crystal-wall',
  'ruin-floor',
  'ruin-wall',
  'lava',
  'snow',
  'tree',
  'pine',
  'bush',
  'rock-small',
  'ledge',
  'sign',
  'wall',
  'roof',
  'roof-trial',
  'roof-heal',
  'roof-shop',
  'door',
  'window',
  'fence',
  'bridge',
  'magnet-plate',
  'crystal-smashable',
  'cut-tree',
] as const;

export type TileName = (typeof TILE_NAMES)[number];

export const TILE_INDEX: Record<TileName, number> = Object.fromEntries(
  TILE_NAMES.map((name, index) => [name, index]),
) as Record<TileName, number>;

/** Walkability / behaviour for every tile. */
export const TILE_SPECS: Record<TileName, TileSpec> = {
  empty: { name: 'Void', solid: true },
  grass: { name: 'Grass' },
  'grass-a': { name: 'Grass' },
  'grass-b': { name: 'Grass' },
  'grass-c': { name: 'Grass' },
  tallgrass: { name: 'Tall grass', encounter: true },
  'tallgrass-a': { name: 'Tall grass', encounter: true },
  flowers: { name: 'Flowers' },
  path: { name: 'Path' },
  'path-a': { name: 'Path' },
  'path-b': { name: 'Path' },
  sand: { name: 'Sand' },
  water: { name: 'Water', solid: true, requires: 'surf' },
  'water-a': { name: 'Water', solid: true, requires: 'surf' },
  'water-b': { name: 'Water', solid: true, requires: 'surf' },
  'water-c': { name: 'Water', solid: true, requires: 'surf' },
  'water-edge-n': { name: 'Shore', solid: true, requires: 'surf' },
  'water-edge-s': { name: 'Shore', solid: true, requires: 'surf' },
  'water-edge-e': { name: 'Shore', solid: true, requires: 'surf' },
  'water-edge-w': { name: 'Shore', solid: true, requires: 'surf' },
  rock: { name: 'Rock', solid: true },
  'rock-dark': { name: 'Rock', solid: true },
  'cave-floor': { name: 'Cave floor' },
  'cave-wall': { name: 'Cave wall', solid: true, requires: 'light' },
  'crystal-floor': { name: 'Crystal floor' },
  'crystal-wall': { name: 'Crystal wall', solid: true, requires: 'smash' },
  'ruin-floor': { name: 'Ruin floor' },
  'ruin-wall': { name: 'Ruin wall', solid: true },
  lava: { name: 'Lava', solid: true },
  snow: { name: 'Snow' },
  tree: { name: 'Tree', solid: true },
  pine: { name: 'Pine', solid: true },
  bush: { name: 'Bush', solid: true, requires: 'night-sight' },
  'rock-small': { name: 'Boulder', solid: true },
  ledge: { name: 'Ledge', solid: false },
  sign: { name: 'Sign', solid: true },
  wall: { name: 'Wall', solid: true },
  roof: { name: 'Roof', solid: true },
  'roof-trial': { name: 'Trial hall roof', solid: true },
  'roof-heal': { name: 'Healing Center roof', solid: true },
  'roof-shop': { name: 'Shop roof', solid: true },
  door: { name: 'Door' },
  window: { name: 'Window', solid: true },
  fence: { name: 'Fence', solid: true },
  bridge: { name: 'Bridge' },
  'magnet-plate': { name: 'Magnet plate', requires: 'magnet' },
  'crystal-smashable': { name: 'Crystal wall', solid: true, requires: 'smash' },
  'cut-tree': { name: 'Small tree', solid: true, requires: 'cut' },
};

export function isSolid(name: TileName): boolean {
  return TILE_SPECS[name]?.solid ?? true;
}

export function isEncounterTile(name: TileName): boolean {
  return TILE_SPECS[name]?.encounter ?? false;
}

export function textureKeyFor(biome: Biome): string {
  return `tileset:${biome}`;
}

/* ------------------------------------------------------------- painting -- */

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, step = 2): void {
  ctx.fillStyle = color;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if ((x * 7 + y * 13) % 5 === 0) ctx.fillRect(x, y, 1, 1);
    }
  }
}

type TilePainter = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: Palette,
  variant: number,
) => void;

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function fillTile(ctx: CanvasRenderingContext2D, x: number, y: number, color: number): void {
  ctx.fillStyle = hex(color);
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
}

const PAINTERS: Record<TileName, TilePainter> = {
  empty: () => {},
  grass: (ctx, x, y, p, v) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(v % 2 === 0 ? p.groundAlt : p.groundDark);
    for (let i = 0; i < 6; i++) {
      const px = x + ((i * 5 + v * 3) % 15);
      const py = y + ((i * 7 + v * 5) % 15);
      ctx.fillRect(px, py, 1, 2);
    }
  },
  'grass-a': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    noise(ctx, TILE_SIZE, TILE_SIZE, hex(p.groundDark), 3);
    ctx.fillRect(x + 3, y + 3, 1, 2);
    ctx.fillRect(x + 11, y + 8, 1, 2);
  },
  'grass-b': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.groundAlt);
    noise(ctx, TILE_SIZE, TILE_SIZE, hex(p.ground), 2);
  },
  'grass-c': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(p.groundAlt);
    ctx.fillRect(x + 2, y + 4, 3, 1);
    ctx.fillRect(x + 9, y + 10, 4, 1);
    ctx.fillStyle = hex(p.groundDark);
    ctx.fillRect(x + 5, y + 12, 2, 1);
  },
  tallgrass: (ctx, x, y, p, v) => {
    fillTile(ctx, x, y, p.groundDark);
    ctx.fillStyle = hex(p.ground);
    for (let i = 0; i < 5; i++) {
      const px = x + 1 + i * 3 + (v % 2);
      ctx.fillRect(px, y + 5, 2, 10);
    }
    ctx.fillStyle = hex(p.groundAlt);
    for (let i = 0; i < 5; i++) {
      const px = x + 1 + i * 3 + (v % 2);
      ctx.fillRect(px, y + 4, 2, 3);
    }
    ctx.fillStyle = hex(p.accentAlt);
    ctx.fillRect(x + 6, y + 3, 1, 3);
  },
  'tallgrass-a': (ctx, x, y, p) => PAINTERS.tallgrass(ctx, x, y, p, 1),
  flowers: (ctx, x, y, p, v) => {
    fillTile(ctx, x, y, p.ground);
    noise(ctx, TILE_SIZE, TILE_SIZE, hex(p.groundDark), 4);
    ctx.fillStyle = hex(p.accent);
    ctx.fillRect(x + 3, y + 4, 3, 3);
    ctx.fillRect(x + 10, y + 9, 3, 3);
    ctx.fillStyle = hex(v % 2 ? p.accentAlt : 0xffffff);
    ctx.fillRect(x + 4, y + 5, 1, 1);
    ctx.fillRect(x + 11, y + 10, 1, 1);
  },
  path: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.path);
    noise(ctx, TILE_SIZE, TILE_SIZE, hex(p.pathAlt), 3);
  },
  'path-a': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.pathAlt);
    noise(ctx, TILE_SIZE, TILE_SIZE, hex(p.path), 2);
  },
  'path-b': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.path);
    ctx.fillStyle = hex(p.pathAlt);
    ctx.fillRect(x, y, TILE_SIZE, 1);
    ctx.fillRect(x, y + 15, TILE_SIZE, 1);
  },
  sand: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.path);
    noise(ctx, TILE_SIZE, TILE_SIZE, hex(p.pathAlt), 3);
  },
  water: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.water);
    ctx.fillStyle = hex(p.waterDeep);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 1, y + 3 + i * 5, 14, 1);
  },
  'water-a': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.waterDeep);
    ctx.fillStyle = hex(p.water);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 2, y + 4 + i * 5, 12, 1);
  },
  'water-b': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.water);
    ctx.fillStyle = hex(p.waterFoam);
    ctx.fillRect(x + 4, y + 6, 4, 1);
  },
  'water-c': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.waterDeep);
    ctx.fillStyle = hex(p.water);
    ctx.fillRect(x + 1, y + 1, 14, 14);
  },
  'water-edge-n': (ctx, x, y, p) => {
    PAINTERS.water(ctx, x, y, p, 0);
    ctx.fillStyle = hex(p.waterFoam);
    ctx.fillRect(x, y, TILE_SIZE, 2);
    ctx.fillRect(x + 2, y + 2, 3, 1);
    ctx.fillRect(x + 9, y + 2, 4, 1);
  },
  'water-edge-s': (ctx, x, y, p) => {
    PAINTERS.water(ctx, x, y, p, 0);
    ctx.fillStyle = hex(p.waterFoam);
    ctx.fillRect(x, y + 14, TILE_SIZE, 2);
    ctx.fillRect(x + 3, y + 13, 4, 1);
    ctx.fillRect(x + 10, y + 13, 3, 1);
  },
  'water-edge-e': (ctx, x, y, p) => {
    PAINTERS.water(ctx, x, y, p, 0);
    ctx.fillStyle = hex(p.waterFoam);
    ctx.fillRect(x + 14, y, 2, TILE_SIZE);
  },
  'water-edge-w': (ctx, x, y, p) => {
    PAINTERS.water(ctx, x, y, p, 0);
    ctx.fillStyle = hex(p.waterFoam);
    ctx.fillRect(x, y, 2, TILE_SIZE);
  },
  rock: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.rock);
    ctx.fillStyle = hex(p.rockDark);
    ctx.fillRect(x + 2, y + 5, 5, 3);
    ctx.fillRect(x + 9, y + 9, 4, 3);
    ctx.fillStyle = hex(0xffffff);
    ctx.globalAlpha = 0.16;
    ctx.fillRect(x + 2, y + 2, 6, 1);
    ctx.globalAlpha = 1;
  },
  'rock-dark': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.rockDark);
    ctx.fillStyle = hex(p.rock);
    ctx.fillRect(x + 3, y + 4, 4, 2);
    ctx.fillRect(x + 8, y + 10, 5, 2);
  },
  'cave-floor': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    noise(ctx, TILE_SIZE, TILE_SIZE, hex(p.groundDark), 3);
    ctx.fillStyle = hex(p.groundAlt);
    ctx.fillRect(x + 5, y + 6, 2, 1);
    ctx.fillRect(x + 11, y + 12, 2, 1);
  },
  'cave-wall': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.rockDark);
    ctx.fillStyle = hex(p.rock);
    ctx.fillRect(x, y, TILE_SIZE, 3);
    ctx.fillRect(x + 1, y + 5, 6, 5);
    ctx.fillRect(x + 8, y + 6, 6, 5);
    ctx.fillRect(x + 3, y + 11, 4, 4);
    ctx.fillRect(x + 10, y + 12, 5, 3);
  },
  'crystal-floor': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.groundAlt);
    ctx.fillStyle = hex(p.accent);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + 2, y + 2, 5, 5);
    ctx.fillRect(x + 9, y + 8, 5, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(p.groundDark);
    ctx.fillRect(x, y + 15, TILE_SIZE, 1);
  },
  'crystal-wall': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.rockDark);
    ctx.fillStyle = hex(p.accent);
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 1 + i * 4, y + 2 + (i % 2) * 3, 3, 11 - (i % 2) * 3);
    }
    ctx.fillStyle = hex(0xffffff);
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 2, y + 3, 1, 8);
    ctx.fillRect(x + 10, y + 5, 1, 7);
    ctx.globalAlpha = 1;
  },
  'ruin-floor': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.strokeStyle = hex(p.groundDark);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    ctx.fillStyle = hex(p.groundAlt);
    ctx.fillRect(x + 4, y + 4, 8, 8);
    ctx.fillStyle = hex(p.groundDark);
    ctx.fillRect(x + 4, y + 4, 8, 1);
    ctx.fillRect(x + 4, y + 11, 8, 1);
  },
  'ruin-wall': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.rockDark);
    ctx.fillStyle = hex(p.rock);
    ctx.fillRect(x + 1, y + 1, 6, 6);
    ctx.fillRect(x + 9, y + 1, 6, 6);
    ctx.fillRect(x + 1, y + 9, 6, 6);
    ctx.fillRect(x + 9, y + 9, 6, 6);
    ctx.fillStyle = hex(p.accent);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x + 6, y + 6, 4, 4);
    ctx.globalAlpha = 1;
  },
  lava: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.waterDeep);
    ctx.fillStyle = hex(p.water);
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 1, y + 2 + i * 5, 14, 3);
    }
    ctx.fillStyle = hex(p.waterFoam);
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x + 4, y + 7, 5, 1);
    ctx.globalAlpha = 1;
  },
  snow: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(p.groundDark);
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 2, y + 6, 4, 1);
    ctx.fillRect(x + 9, y + 11, 5, 1);
    ctx.globalAlpha = 1;
  },
  tree: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(0x6b4a2a);
    ctx.fillRect(x + 6, y + 9, 4, 7);
    ctx.fillStyle = hex(p.groundDark);
    ctx.fillRect(x + 2, y + 1, 12, 9);
    ctx.fillStyle = hex(0x2f7a35);
    ctx.fillRect(x + 3, y + 2, 10, 7);
    ctx.fillStyle = hex(p.groundAlt);
    ctx.fillRect(x + 4, y + 3, 4, 3);
  },
  pine: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(0x6b4a2a);
    ctx.fillRect(x + 7, y + 11, 2, 5);
    ctx.fillStyle = hex(0x1f6b30);
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 15, y + 9);
    ctx.lineTo(x + 1, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(0x2f8f3c);
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 4);
    ctx.lineTo(x + 14, y + 12);
    ctx.lineTo(x + 2, y + 12);
    ctx.closePath();
    ctx.fill();
  },
  bush: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(0x2f7a35);
    ctx.fillRect(x + 2, y + 7, 12, 7);
    ctx.fillRect(x + 4, y + 4, 8, 4);
    ctx.fillStyle = hex(p.groundAlt);
    ctx.fillRect(x + 5, y + 6, 3, 2);
    ctx.fillStyle = hex(p.accent);
    ctx.fillRect(x + 10, y + 9, 2, 2);
  },
  'rock-small': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(p.rockDark);
    ctx.fillRect(x + 3, y + 6, 10, 8);
    ctx.fillStyle = hex(p.rock);
    ctx.fillRect(x + 4, y + 7, 8, 4);
    ctx.fillStyle = hex(0xffffff);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x + 5, y + 7, 5, 1);
    ctx.globalAlpha = 1;
  },
  ledge: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(p.groundDark);
    ctx.fillRect(x, y + 10, TILE_SIZE, 3);
    ctx.fillStyle = hex(p.rockDark);
    ctx.fillRect(x, y + 13, TILE_SIZE, 3);
    ctx.fillStyle = hex(p.rock);
    ctx.fillRect(x + 1, y + 14, 5, 1);
    ctx.fillRect(x + 9, y + 14, 5, 1);
  },
  sign: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(0x6b4a2a);
    ctx.fillRect(x + 7, y + 8, 2, 8);
    ctx.fillStyle = hex(0xb98b52);
    ctx.fillRect(x + 2, y + 2, 12, 8);
    ctx.fillStyle = hex(0x7a5a34);
    ctx.fillRect(x + 2, y + 9, 12, 1);
    ctx.fillStyle = hex(0xf5e6c8);
    ctx.fillRect(x + 4, y + 4, 8, 1);
    ctx.fillRect(x + 4, y + 6, 6, 1);
  },
  wall: (ctx, x, y, _p) => {
    fillTile(ctx, x, y, 0xc9b79a);
    ctx.fillStyle = '#b0a086';
    for (let r = 0; r < 4; r++) {
      const offset = r % 2 === 0 ? 0 : 4;
      for (let c = -1; c < 3; c++) {
        ctx.fillRect(x + offset + c * 8, y + r * 4, 7, 3);
      }
    }
  },
  roof: (ctx, x, y, _p) => {
    fillTile(ctx, x, y, 0xb5563f);
    ctx.fillStyle = '#8f3f2c';
    for (let r = 0; r < 4; r++) ctx.fillRect(x, y + r * 4 + 3, TILE_SIZE, 1);
    ctx.fillStyle = '#d2705a';
    ctx.fillRect(x, y, TILE_SIZE, 1);
  },
  'roof-trial': (ctx, x, y, p) => {
    fillTile(ctx, x, y, 0x4a5b8c);
    ctx.fillStyle = '#33406b';
    for (let r = 0; r < 4; r++) ctx.fillRect(x, y + r * 4 + 3, TILE_SIZE, 1);
    ctx.fillStyle = hex(p.accentAlt);
    ctx.fillRect(x + 6, y + 6, 4, 4);
  },
  'roof-heal': (ctx, x, y, _p) => {
    fillTile(ctx, x, y, 0xd8504a);
    ctx.fillStyle = '#a83a36';
    for (let r = 0; r < 4; r++) ctx.fillRect(x, y + r * 4 + 3, TILE_SIZE, 1);
    ctx.fillStyle = '#fff5f5';
    ctx.fillRect(x + 6, y + 5, 4, 5);
    ctx.fillRect(x + 5, y + 6, 6, 3);
  },
  'roof-shop': (ctx, x, y, _p) => {
    fillTile(ctx, x, y, 0x3f7fbf);
    ctx.fillStyle = '#2f5f95';
    for (let r = 0; r < 4; r++) ctx.fillRect(x, y + r * 4 + 3, TILE_SIZE, 1);
    ctx.fillStyle = '#dff0ff';
    ctx.fillRect(x + 4, y + 5, 8, 2);
  },
  door: (ctx, x, y, p) => {
    fillTile(ctx, x, y, 0xb0a086);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x + 2, y + 1, 12, 15);
    ctx.fillStyle = '#8f6a3f';
    ctx.fillRect(x + 3, y + 2, 10, 13);
    ctx.fillStyle = hex(p.accentAlt);
    ctx.fillRect(x + 10, y + 8, 2, 2);
    ctx.fillStyle = '#54381f';
    ctx.fillRect(x + 7, y + 2, 1, 13);
  },
  window: (ctx, x, y, p) => {
    PAINTERS.wall(ctx, x, y, p, 0);
    ctx.fillStyle = '#3f6f9f';
    ctx.fillRect(x + 2, y + 3, 12, 10);
    ctx.fillStyle = hex(p.accentAlt);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + 3, y + 4, 4, 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x + 7, y + 3, 1, 10);
    ctx.fillRect(x + 2, y + 7, 12, 1);
  },
  fence: (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = '#8f6a3f';
    ctx.fillRect(x + 2, y + 4, 2, 12);
    ctx.fillRect(x + 12, y + 4, 2, 12);
    ctx.fillRect(x, y + 6, TILE_SIZE, 2);
    ctx.fillRect(x, y + 11, TILE_SIZE, 2);
  },
  bridge: (ctx, x, y, _p) => {
    fillTile(ctx, x, y, 0x9a7448);
    ctx.fillStyle = '#7a5a34';
    for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 4, TILE_SIZE, 1);
  },
  'magnet-plate': (ctx, x, y, _p) => {
    fillTile(ctx, x, y, 0x6b6f8a);
    ctx.fillStyle = hex(0xffd60a);
    ctx.fillRect(x + 1, y + 1, 5, 5);
    ctx.fillRect(x + 10, y + 1, 5, 5);
    ctx.fillRect(x + 1, y + 10, 5, 5);
    ctx.fillRect(x + 10, y + 10, 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x + 2, y + 2, 3, 1);
    ctx.globalAlpha = 1;
  },
  'crystal-smashable': (ctx, x, y, p) => {
    PAINTERS['crystal-wall'](ctx, x, y, p, 0);
  },
  'cut-tree': (ctx, x, y, p) => {
    fillTile(ctx, x, y, p.ground);
    ctx.fillStyle = hex(0x6b4a2a);
    ctx.fillRect(x + 6, y + 8, 4, 8);
    ctx.fillStyle = hex(0x3f9a4a);
    ctx.fillRect(x + 3, y + 2, 10, 8);
    ctx.fillStyle = hex(0x5fbf5a);
    ctx.fillRect(x + 4, y + 3, 5, 3);
  },
};

/** Variants for tiles that have several looks. */
const VARIANTS: Partial<Record<TileName, number>> = {
  grass: 4,
  path: 3,
};

/**
 * Paint the tileset for a biome onto a canvas and register it with Phaser.
 * Returns the texture key. Safe to call repeatedly for the same biome.
 */
export function paintTileset(scene: Phaser.Scene, biome: Biome): string {
  const key = textureKeyFor(biome);
  if (scene.textures.exists(key)) return key;

  const palette = BIOME_PALETTES[biome];
  const columns = TILESET_COLUMNS;
  const rows = Math.ceil(TILE_NAMES.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = columns * TILE_SIZE;
  canvas.height = rows * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return key;

  TILE_NAMES.forEach((name, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    const painter = PAINTERS[name];
    if (!painter) return;
    const variant = (VARIANTS[name] ?? 1) > 1 ? index % 4 : 0;
    ctx.save();
    painter(ctx, x, y, palette, variant);
    ctx.restore();
  });

  scene.textures.addCanvas(key, canvas);
  return key;
}

/** RGB tint for the ambient light of a biome, used by the colour grade. */
export function biomeAmbient(biome: Biome): number {
  switch (biome) {
    case 'cave':
      return 0x6a6480;
    case 'ruins':
      return 0x7a6fa8;
    case 'volcano':
      return 0xff9f7a;
    case 'summit':
      return 0xdff0ff;
    case 'forest':
      return 0xbdf0b0;
    case 'beach':
      return 0xfff2cc;
    default:
      return 0xffffff;
  }
}

export { BIOME_PALETTES };
