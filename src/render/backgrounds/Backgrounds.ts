/**
 * Parallax battle backgrounds, generated per biome.
 *
 * Each biome gets three painted layers (sky/distant, mid hills, near ground)
 * plus a set of ambient particle recipes (clouds, petals, ash, fireflies,
 * mist). Layers are generated once into canvas textures and then tiled as
 * `TileSprite`s, so scrolling them costs nothing.
 */

import Phaser from 'phaser';
import type { Biome } from '../tiles/TilePainter';

export const BG_WIDTH = 512;
export const BG_HEIGHT = 288;

interface BiomeArt {
  skyTop: number;
  skyBottom: number;
  sun: number;
  far: number;
  mid: number;
  near: number;
  ground: number;
  groundDark: number;
  haze: number;
}

const ART: Record<Biome, BiomeArt> = {
  meadow: {
    skyTop: 0x8fd0ff,
    skyBottom: 0xdff0ff,
    sun: 0xfff3b0,
    far: 0x9fd9a8,
    mid: 0x74c07f,
    near: 0x5aa564,
    ground: 0x6fbf5a,
    groundDark: 0x4f9a3e,
    haze: 0xffffff,
  },
  forest: {
    skyTop: 0x7fb8d8,
    skyBottom: 0xc8e8d0,
    sun: 0xfff0b0,
    far: 0x6fa878,
    mid: 0x4f8858,
    near: 0x3a6b42,
    ground: 0x4f9a48,
    groundDark: 0x356b32,
    haze: 0xdff5e0,
  },
  city: {
    skyTop: 0xa8b8d8,
    skyBottom: 0xe0e8f5,
    sun: 0xfff6d0,
    far: 0x9aa8c4,
    mid: 0x7d8aa6,
    near: 0x66728c,
    ground: 0xbfb5a4,
    groundDark: 0x9a9182,
    haze: 0xf5f8ff,
  },
  beach: {
    skyTop: 0x7fc8ff,
    skyBottom: 0xfff0d0,
    sun: 0xfff0a0,
    far: 0x6fc0e8,
    mid: 0x4fa8d8,
    near: 0x35b6e8,
    ground: 0xf0dfa8,
    groundDark: 0xd0bb80,
    haze: 0xffffff,
  },
  volcano: {
    skyTop: 0x3a2430,
    skyBottom: 0x8f4a35,
    sun: 0xff8f4a,
    far: 0x5a3428,
    mid: 0x46281f,
    near: 0x331d17,
    ground: 0x5c4038,
    groundDark: 0x3d2a24,
    haze: 0xff9f6a,
  },
  cave: {
    skyTop: 0x241f30,
    skyBottom: 0x3a3348,
    sun: 0x7fffe5,
    far: 0x322c42,
    mid: 0x2a2538,
    near: 0x221d2e,
    ground: 0x4a4550,
    groundDark: 0x322e3a,
    haze: 0x8e5cff,
  },
  ruins: {
    skyTop: 0x2a2440,
    skyBottom: 0x4a3f6e,
    sun: 0x8e5cff,
    far: 0x3f3860,
    mid: 0x342e50,
    near: 0x2a2540,
    ground: 0x5a5470,
    groundDark: 0x3e394f,
    haze: 0xc0a0ff,
  },
  summit: {
    skyTop: 0x2f4a8f,
    skyBottom: 0xbfdff5,
    sun: 0xffffff,
    far: 0x9fc0e0,
    mid: 0xbcd8ee,
    near: 0xd8ecf8,
    ground: 0xdfe8f5,
    groundDark: 0xb8c6dc,
    haze: 0xffffff,
  },
};

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function key(layer: string, biome: Biome): string {
  return `bg:${biome}:${layer}`;
}

function newCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

function paintSky(ctx: CanvasRenderingContext2D, art: BiomeArt): void {
  const grad = ctx.createLinearGradient(0, 0, 0, BG_HEIGHT);
  grad.addColorStop(0, hex(art.skyTop));
  grad.addColorStop(1, hex(art.skyBottom));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);

  // A soft sun / moon disc with a glow.
  const sunX = BG_WIDTH * 0.72;
  const sunY = BG_HEIGHT * 0.26;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
  glow.addColorStop(0, `${hex(art.sun)}ff`);
  glow.addColorStop(0.35, `${hex(art.sun)}66`);
  glow.addColorStop(1, `${hex(art.sun)}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);
  ctx.fillStyle = hex(art.sun);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
  ctx.fill();
}

function paintLayer(
  ctx: CanvasRenderingContext2D,
  color: number,
  baseY: number,
  amplitude: number,
  step: number,
  seed: number,
  addTrees: boolean,
): void {
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  ctx.moveTo(0, BG_HEIGHT);
  for (let x = 0; x <= BG_WIDTH; x += step) {
    const t = (x / step + seed) * 1.1;
    const y = baseY + Math.sin(t) * amplitude + Math.sin(t * 2.3) * (amplitude * 0.35);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(BG_WIDTH, BG_HEIGHT);
  ctx.closePath();
  ctx.fill();

  if (addTrees) {
    ctx.fillStyle = hex(color);
    for (let x = 12; x < BG_WIDTH; x += 34) {
      const h = 26 + ((x * 7919 + seed * 104729) % 18);
      const y = baseY + Math.sin((x / step + seed) * 1.1) * amplitude;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + 12, y + 2);
      ctx.lineTo(x - 12, y + 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Paint every background layer for a biome and register the textures. */
export function paintBackground(scene: Phaser.Scene, biome: Biome): void {
  const art = ART[biome];
  if (scene.textures.exists(key('sky', biome))) return;

  const sky = newCanvas(BG_WIDTH, BG_HEIGHT);
  if (sky) {
    paintSky(sky.ctx, art);
    scene.textures.addCanvas(key('sky', biome), sky.canvas);
  }

  const far = newCanvas(BG_WIDTH, BG_HEIGHT);
  if (far) {
    far.ctx.clearRect(0, 0, BG_WIDTH, BG_HEIGHT);
    paintLayer(far.ctx, art.far, BG_HEIGHT * 0.62, 16, 64, 0.4, true);
    scene.textures.addCanvas(key('far', biome), far.canvas);
  }

  const mid = newCanvas(BG_WIDTH, BG_HEIGHT);
  if (mid) {
    mid.ctx.clearRect(0, 0, BG_WIDTH, BG_HEIGHT);
    paintLayer(mid.ctx, art.mid, BG_HEIGHT * 0.78, 12, 48, 1.7, true);
    scene.textures.addCanvas(key('mid', biome), mid.canvas);
  }

  const near = newCanvas(BG_WIDTH, BG_HEIGHT);
  if (near) {
    near.ctx.clearRect(0, 0, BG_WIDTH, BG_HEIGHT);
    paintLayer(near.ctx, art.near, BG_HEIGHT * 0.92, 8, 32, 3.1, false);
    scene.textures.addCanvas(key('near', biome), near.canvas);
  }
}

export interface BackgroundLayers {
  sky: Phaser.GameObjects.TileSprite;
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
  near: Phaser.GameObjects.TileSprite;
}

/** Build the parallax stack for a scene, sized to the given viewport. */
export function createBackground(
  scene: Phaser.Scene,
  biome: Biome,
  width: number,
  height: number,
): BackgroundLayers {
  paintBackground(scene, biome);
  const make = (layer: string, depth: number, scroll: number): Phaser.GameObjects.TileSprite => {
    const sprite = scene.add.tileSprite(0, 0, width, height, key(layer, biome));
    sprite.setOrigin(0, 0);
    sprite.setDepth(depth);
    sprite.setScrollFactor(0);
    sprite.setData('parallax', scroll);
    return sprite;
  };
  return {
    sky: make('sky', -40, 0),
    far: make('far', -39, 0.06),
    mid: make('mid', -38, 0.14),
    near: make('near', -37, 0.28),
  };
}

/** Drift the parallax layers horizontally by a small amount. */
export function scrollBackground(layers: BackgroundLayers, dx: number): void {
  for (const layer of [layers.far, layers.mid, layers.near]) {
    const factor = (layer.getData('parallax') as number) ?? 0;
    layer.tilePositionX += dx * factor;
  }
}

export interface AmbientRecipe {
  /** Emitter-controlling flags the scene switches on. */
  clouds: boolean;
  petals: boolean;
  ash: boolean;
  fireflies: boolean;
  mist: boolean;
  stars: boolean;
  /** Base tint for ambient particles. */
  tint: number;
}

export function ambientFor(biome: Biome, timeOfDay: 'day' | 'night'): AmbientRecipe {
  const night = timeOfDay === 'night';
  switch (biome) {
    case 'meadow':
      return { clouds: true, petals: true, ash: false, fireflies: night, mist: false, stars: night, tint: 0xfff3c0 };
    case 'forest':
      return { clouds: false, petals: true, ash: false, fireflies: night, mist: true, stars: night, tint: 0xdfffb0 };
    case 'city':
      return { clouds: true, petals: false, ash: false, fireflies: night, mist: false, stars: night, tint: 0xdff0ff };
    case 'beach':
      return { clouds: true, petals: false, ash: false, fireflies: false, mist: true, stars: night, tint: 0xfff0d0 };
    case 'volcano':
      return { clouds: false, petals: false, ash: true, fireflies: false, mist: false, stars: false, tint: 0xff9f6a };
    case 'cave':
      return { clouds: false, petals: false, ash: false, fireflies: false, mist: true, stars: false, tint: 0x8e5cff };
    case 'ruins':
      return { clouds: false, petals: false, ash: false, fireflies: true, mist: true, stars: true, tint: 0xc0a0ff };
    case 'summit':
      return { clouds: true, petals: false, ash: false, fireflies: false, mist: true, stars: night, tint: 0xffffff };
    default:
      return { clouds: false, petals: false, ash: false, fireflies: false, mist: false, stars: false, tint: 0xffffff };
  }
}

export function ambientColorFor(biome: Biome): number {
  return ART[biome].haze;
}
