import * as THREE from 'three';
import { fbm, hash2 } from './Noise';

type PixelFn = (x: number, y: number) => [number, number, number, number];

function make(size: number, fn: PixelFn): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, r * 255));
      data[i + 1] = Math.max(0, Math.min(255, g * 255));
      data[i + 2] = Math.max(0, Math.min(255, b * 255));
      data[i + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Soft mottled greyscale; multiplied over vertex colours for grass/dirt/plaster grain. */
export function grainTexture(): THREE.DataTexture {
  const size = 256;
  return make(size, (x, y) => {
    const u = (x / size) * 8;
    const v = (y / size) * 8;
    const n = fbm(u, v, 3, 4, 8);
    const fine = hash2(x, y, 5);
    // short bright blade-like flecks
    const fleck = hash2(x >> 1, y >> 2, 9) > 0.93 ? 0.07 : 0;
    const pit = fine > 0.965 ? -0.1 : 0;
    const val = 0.8 + n * 0.24 + (fine - 0.5) * 0.06 + fleck + pit;
    return [val, val, val, 1];
  });
}

/** Warm wooden floor boards, 2x2 world units per repeat. */
export function plankTexture(): THREE.DataTexture {
  const size = 256;
  return make(size, (x, y) => {
    const row = Math.floor(y / 64);
    const inRow = y % 64;
    const offset = (row % 2) * 96;
    const col = Math.floor(((x + offset) % size) / 128);
    const jointX = (x + offset) % 128;
    const tone = 0.86 + hash2(row, col + (row % 2) * 7, 3) * 0.2;
    let v = tone + (fbm(x * 0.02, y * 0.35, 6, 2) - 0.5) * 0.12;
    if (inRow < 2 || inRow > 61) v *= 0.62;
    if (jointX < 2) v *= 0.66;
    return [v, v * 0.97, v * 0.94, 1];
  });
}

/** Greyscale roof shingles; 1 repeat = one shingle course set. */
export function shingleTexture(): THREE.DataTexture {
  const size = 128;
  return make(size, (x, y) => {
    const row = Math.floor(y / 16);
    const inRow = y % 16;
    const shift = (row % 2) * 16;
    const col = Math.floor(((x + shift) % size) / 32);
    const tone = 0.84 + hash2(row, col, 11) * 0.22;
    let v = tone;
    if (inRow > 12) v *= 0.7 - (inRow - 12) * 0.04;
    if ((x + shift) % 32 < 1.5) v *= 0.75;
    v += (hash2(x, y, 2) - 0.5) * 0.05;
    return [v, v, v, 1];
  });
}

/** Greyscale striped wallpaper with small diamond motifs; 1 repeat = 2 world units. */
export function wallpaperTexture(): THREE.DataTexture {
  const size = 128;
  return make(size, (x, y) => {
    const px = x % 16;
    let v = px < 8 ? 0.98 : 0.89;
    const dy = y % 32;
    if (px >= 6 && px <= 9 && Math.abs(dy - 16) + Math.abs(px - 7.5) < 3.2) v *= 0.82;
    if (px === 0 || px === 8) v *= 0.94;
    v += (fbm(x * 0.2, y * 0.2, 17, 2) - 0.5) * 0.06;
    return [v, v, v, 1];
  });
}

/** Greyscale stone bricks (4 x 8 per repeat) with dark mortar lines. */
export function brickTexture(): THREE.DataTexture {
  const size = 128;
  return make(size, (x, y) => {
    const row = Math.floor(y / 16);
    const shifted = (x + (row % 2) * 16) % size;
    const col = Math.floor(shifted / 32);
    let v = 0.82 + hash2(row, col, 21) * 0.2 + (fbm(x * 0.25, y * 0.25, 5, 2) - 0.5) * 0.12;
    if (y % 16 < 1.5 || shifted % 32 < 1.5) v *= 0.58;
    return [v, v, v, 1];
  });
}

/** Soft fading band used for window light on the floor: bright at v=0, gone by v=1. */
export function shaftTexture(): THREE.DataTexture {
  const size = 32;
  return make(size, (x, y) => {
    const u = x / (size - 1);
    const v = y / (size - 1);
    const across = Math.pow(Math.max(0, 1 - Math.abs(u - 0.5) * 2), 0.6);
    const along = Math.pow(Math.max(0, 1 - v), 1.3);
    const val = across * along;
    return [val, val, val, 1];
  });
}

/** Radial falloff used for floor glow halos (blend additively). */
export function glowTexture(): THREE.DataTexture {
  const size = 32;
  return make(size, (x, y) => {
    const d = Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) * 2;
    const val = Math.pow(Math.max(0, 1 - d), 2);
    return [val, val, val, 1];
  });
}

/** Tileable ripple pattern: bright thin lines on a mid-blue base (also used as emissive map). */
export function rippleTexture(): THREE.DataTexture {
  const size = 128;
  return make(size, (x, y) => {
    const u = (x / size) * 6;
    const v = (y / size) * 6;
    const a = fbm(u, v, 21, 3, 6);
    const b = fbm(u * 1.7 + 3, v * 1.7 + 9, 33, 2, 10);
    const ridge = Math.pow(1 - Math.abs(a * 2 - 1), 6) * 0.9 + Math.pow(1 - Math.abs(b * 2 - 1), 8) * 0.5;
    const base = 0.55 + a * 0.15;
    const val = Math.min(1, base + ridge * 0.5);
    return [val * 0.9, val * 0.97, val, 1];
  });
}
