/**
 * Shared procedural toolkit for the battle arenas and the title vista:
 * seeded noise, canvas textures, merged prop geometry, instancing, wind sway,
 * drifting particles and skyline ridges. Everything allocates through a Kit so
 * one dispose() releases it all.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise in [0,1]; `period` (cells) makes it tile when > 0. */
export function vnoise(x: number, y: number, seed = 1, period = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const w = (v: number): number => (period > 0 ? ((v % period) + period) % period : v);
  const a = hash2(w(x0), w(y0), seed);
  const b = hash2(w(x0 + 1), w(y0), seed);
  const c = hash2(w(x0), w(y0 + 1), seed);
  const d = hash2(w(x0 + 1), w(y0 + 1), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x: number, y: number, seed = 1, octaves = 4, period = 0): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq, seed + i * 17, period > 0 ? period * freq : 0);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function mix(a: number, b: number, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export class Kit {
  private readonly items: Array<{ dispose(): void }> = [];
  /** Shared wind clock for every sway material. */
  readonly wind = { value: 0 };

  track<T extends { dispose(): void }>(item: T): T {
    this.items.push(item);
    return item;
  }

  dispose(): void {
    for (const item of this.items) item.dispose();
    this.items.length = 0;
  }

  tex(size: number, height: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) paint(ctx, size, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return this.track(texture);
  }

  /** Tiling mottled texture between two colours with a per-biome overlay. */
  noiseTex(size: number, a: number, b: number, scale: number, seed: number, overlay?: (ctx: CanvasRenderingContext2D, size: number, r: () => number) => void): THREE.CanvasTexture {
    return this.tex(size, size, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const ca = new THREE.Color(a);
      const cb = new THREE.Color(b);
      const tmp = new THREE.Color();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const n = fbm((x / w) * scale, (y / h) * scale, seed, 4, scale);
          const fine = vnoise((x / w) * scale * 12, (y / h) * scale * 12, seed + 5, scale * 12) - 0.5;
          const t = Math.min(1, Math.max(0, (n - 0.5) * 2.4 + 0.5 + fine * 0.18));
          tmp.copy(ca).lerp(cb, t);
          const i = (y * w + x) * 4;
          const c = tmp.getHex();
          img.data[i] = ((c >> 16) & 255);
          img.data[i + 1] = ((c >> 8) & 255);
          img.data[i + 2] = (c & 255);
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      overlay?.(ctx, w, rng(seed + 99));
    });
  }

  softDot(): THREE.CanvasTexture {
    return this.tex(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, false);
  }

  /** Vertical sky gradient on a back-faced dome (stops are [position 0..1 from horizon, colour]). */
  skyDome(stops: Array<[number, number]>, below: number, radius = 120, glow?: { u: number; v: number; color: number; size: number }): THREE.Mesh {
    const texture = this.tex(1024, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      // canvas y=0 is the zenith, y=h/2 the horizon
      const sorted = [...stops].sort((p, q) => p[0] - q[0]);
      for (const [p, c] of sorted) g.addColorStop(Math.max(0, Math.min(1, 0.5 - p * 0.5)), hex(c));
      g.addColorStop(0.5001, hex(below));
      g.addColorStop(1, hex(below));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (glow) {
        const gx = glow.u * w;
        const gy = (0.5 - glow.v * 0.5) * h;
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, glow.size);
        rg.addColorStop(0, hex(glow.color));
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = rg;
        ctx.fillRect(gx - glow.size, gy - glow.size, glow.size * 2, glow.size * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }, false);
    const geo = this.track(new THREE.SphereGeometry(radius, 32, 16));
    const mat = this.track(new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -10;
    return mesh;
  }
}

export interface Part {
  geo: THREE.BufferGeometry;
  color: number;
  at?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  jitter?: number;
  /** Colour the top-facing surfaces differently (snow caps, moss). */
  cap?: number;
  /** Dispose the source geometry after merging (default true). */
  keep?: boolean;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** Merge several primitives into one vertex-coloured, flat-shaded geometry. */
export function compose(parts: Part[], seed = 1): THREE.BufferGeometry {
  const out: THREE.BufferGeometry[] = [];
  const colour = new THREE.Color();
  const capColour = new THREE.Color();
  parts.forEach((part, pi) => {
    let g = part.geo.clone();
    tmpE.set(...(part.rot ?? [0, 0, 0]), 'YXZ');
    tmpQ.setFromEuler(tmpE);
    const s = part.scale ?? [1, 1, 1];
    tmpM.compose(new THREE.Vector3(...(part.at ?? [0, 0, 0])), tmpQ, new THREE.Vector3(...s));
    g.applyMatrix4(tmpM);
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const col = new Float32Array(pos.count * 3);
    const jit = part.jitter ?? 0.1;
    for (let i = 0; i < pos.count; i += 3) {
      // One tone per triangle keeps the faceted look.
      const h = hash2(Math.floor(pos.getX(i) * 31 + pi), Math.floor(pos.getY(i) * 37 + pos.getZ(i) * 29), seed);
      const k = 1 + (h - 0.5) * 2 * jit;
      for (let v = 0; v < 3; v++) {
        const up = part.cap !== undefined && nor.getY(i + v) > 0.55;
        colour.set(up ? (capColour.set(part.cap as number), capColour).getHex() : part.color);
        col[(i + v) * 3] = colour.r * k;
        col[(i + v) * 3 + 1] = colour.g * k;
        col[(i + v) * 3 + 2] = colour.b * k;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.push(g);
    if (!part.keep) part.geo.dispose();
  });
  const merged = mergeGeometries(out, false);
  for (const g of out) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}

export interface Inst {
  x: number;
  y?: number;
  z: number;
  s?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  ry?: number;
  rx?: number;
  rz?: number;
  color?: number;
}

export function instance(
  kit: Kit,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  list: Inst[],
  opts: { cast?: boolean; receive?: boolean; tint?: number } = {},
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  mesh.count = list.length;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  const r = rng(list.length * 7 + 3);
  list.forEach((it, i) => {
    const s = it.s ?? 1;
    e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0, 'YXZ');
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x, it.y ?? 0, it.z), q, new THREE.Vector3((it.sx ?? 1) * s, (it.sy ?? 1) * s, (it.sz ?? 1) * s));
    mesh.setMatrixAt(i, m);
    const t = opts.tint ?? 0.12;
    const k = 1 + (r() - 0.5) * 2 * t;
    col.set(it.color ?? 0xffffff).multiplyScalar(k);
    mesh.setColorAt(i, col);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = opts.cast ?? false;
  mesh.receiveShadow = opts.receive ?? false;
  mesh.frustumCulled = false;
  kit.track(geo);
  return mesh;
}

export function propMat(kit: Kit, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return kit.track(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0, ...extra }));
}

/** Wind sway driven by kit.wind; weights by local height so bases stay planted. */
export function sway(kit: Kit, mat: THREE.Material, amp: number, speed = 1.2): THREE.Material {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayT = kit.wind;
    shader.vertexShader =
      'uniform float uSwayT;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float swPh = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;
        #else
          float swPh = 0.0;
        #endif
        float swH = max(position.y, 0.0);
        transformed.x += sin(uSwayT * ${speed.toFixed(2)} + swPh) * ${amp.toFixed(3)} * swH * swH * 0.3;
        transformed.z += cos(uSwayT * ${(speed * 0.8).toFixed(2)} + swPh * 1.3) * ${amp.toFixed(3)} * swH * swH * 0.22;`,
      );
  };
  mat.customProgramCacheKey = () => `sway-${amp}-${speed}`;
  return mat;
}

export interface MoteOptions {
  count: number;
  center: [number, number, number];
  extent: [number, number, number];
  color: number;
  size: number;
  /** Base drift velocity (units / second). */
  velocity: [number, number, number];
  wobble?: number;
  opacity?: number;
  additive?: boolean;
  seed?: number;
}

export class Motes {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly pos: Float32Array;
  private readonly phase: Float32Array;
  private last = -1;
  private readonly o: MoteOptions;

  constructor(kit: Kit, dot: THREE.Texture, o: MoteOptions) {
    this.o = o;
    const r = rng(o.seed ?? 11);
    this.base = new Float32Array(o.count * 3);
    this.pos = new Float32Array(o.count * 3);
    this.phase = new Float32Array(o.count);
    for (let i = 0; i < o.count; i++) {
      for (let k = 0; k < 3; k++) {
        this.base[i * 3 + k] = (r() - 0.5) * o.extent[k];
      }
      this.phase[i] = r() * Math.PI * 2;
    }
    const geo = kit.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = kit.track(
      new THREE.PointsMaterial({
        map: dot,
        color: o.color,
        size: o.size,
        transparent: true,
        opacity: o.opacity ?? 0.7,
        depthWrite: false,
        blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: true,
      }),
    );
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.update(0);
  }

  update(t: number): void {
    const { count, center, extent, velocity, wobble = 0.3 } = this.o;
    for (let i = 0; i < count; i++) {
      const p = this.phase[i];
      for (let k = 0; k < 3; k++) {
        // Wrap the drifting coordinate inside the box.
        const span = extent[k];
        let v = this.base[i * 3 + k] + velocity[k] * t;
        v = ((((v + span / 2) % span) + span) % span) - span / 2;
        const w = k === 1 ? Math.sin(t * 0.9 + p) : Math.sin(t * 0.6 + p * (k + 1));
        this.pos[i * 3 + k] = center[k] + v + w * wobble;
      }
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.last = t;
  }

  get lastTime(): number {
    return this.last;
  }
}

export interface RidgeOptions {
  radius: number;
  a0: number;
  a1: number;
  baseY: number;
  height: number;
  rough: number;
  seed: number;
  color: number;
  top: number;
  segments?: number;
  /** 0 = rolling, 1 = jagged. */
  jag?: number;
}

/** A noisy skyline wall in an arc around the arena, flat-shaded for atmospheric layers. */
export function ridge(kit: Kit, o: RidgeOptions): THREE.Mesh {
  const seg = o.segments ?? 96;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const cBot = new THREE.Color(o.color);
  const cTop = new THREE.Color(o.top);
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const a = o.a0 + (o.a1 - o.a0) * u;
    const n = fbm(u * o.rough * 6, o.seed, o.seed, 4);
    const j = vnoise(u * o.rough * 40, 3, o.seed + 9) - 0.5;
    const h = o.height * (0.25 + n * 1.1 + (o.jag ?? 0) * j * 0.8);
    const x = Math.cos(a) * o.radius;
    const z = Math.sin(a) * o.radius;
    pos.push(x, o.baseY - 6, z, x, o.baseY + Math.max(0.2, h), z);
    col.push(cBot.r, cBot.g, cBot.b, cTop.r, cTop.g, cTop.b);
    if (i < seg) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = kit.track(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = kit.track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
