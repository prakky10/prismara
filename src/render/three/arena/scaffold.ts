/**
 * Arena scaffolding shared by every biome: terrain mesh, battle pads, prop
 * scattering that keeps the camera-to-creature corridors clear, and cloud /
 * light-shaft helpers.
 */

import * as THREE from 'three';
import { Kit, rng, fbm, smoothstep, hex, type Inst } from './kit';

export interface PadSpot {
  x: number;
  z: number;
  r: number;
}

export interface ArenaCtx {
  kit: Kit;
  scene: THREE.Scene;
  reduced: boolean;
  pads: PadSpot[];
  tick: Array<(t: number) => void>;
  dot: THREE.Texture;
  H: (x: number, z: number) => number;
}

const CAM_Z = 16;

/** True when a prop of height h at (x, z) would sit in a creature's line of sight or on a pad. */
export function blocked(pads: PadSpot[], x: number, z: number, h: number): boolean {
  if (h > 1.2 && z > 3) return true;
  if (z > 9.5) return true;
  for (const p of pads) {
    if (Math.hypot(x - p.x, z - p.z) < p.r + 1.4) return true;
    const dx = p.x - 0;
    const dz = p.z - CAM_Z;
    const len2 = dx * dx + dz * dz;
    const t = ((x - 0) * dx + (z - CAM_Z) * dz) / len2;
    if (t > 0 && t < 1.02) {
      const cross = Math.abs((x - 0) * dz - (z - CAM_Z) * dx) / Math.sqrt(len2);
      if (cross < 1.5 + h * 0.4) return true;
    }
  }
  return false;
}

export interface ScatterOpts {
  rMin: number;
  rMax: number;
  a0?: number;
  a1?: number;
  h: number;
  seed: number;
  /** Skip the view-corridor test (far, fog-covered or very low props). */
  free?: boolean;
}

export function scatter(
  ctx: ArenaCtx,
  count: number,
  o: ScatterOpts,
  make: (x: number, y: number, z: number, rand: () => number, angle: number) => Inst,
): Inst[] {
  const n = ctx.reduced ? Math.ceil(count * 0.55) : count;
  const rand = rng(o.seed);
  const out: Inst[] = [];
  const a0 = o.a0 ?? Math.PI * 0.86;
  const a1 = o.a1 ?? Math.PI * 2.14;
  for (let tries = 0; out.length < n && tries < n * 12; tries++) {
    const a = a0 + rand() * (a1 - a0);
    const r = o.rMin + rand() * (o.rMax - o.rMin);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!o.free && blocked(ctx.pads, x, z, o.h)) continue;
    out.push(make(x, ctx.H(x, z), z, rand, a));
  }
  return out;
}

export interface TerrainOpts {
  h: (x: number, z: number) => number;
  map: THREE.Texture;
  tint: (x: number, z: number, h: number, r: number) => THREE.Color;
  repeat: number;
  size?: number;
  segments?: number;
  roughness?: number;
  emissive?: { map: THREE.Texture; color: number; intensity: number };
}

export function terrain(ctx: ArenaCtx, o: TerrainOpts): THREE.Mesh {
  const size = o.size ?? 76;
  const seg = ctx.reduced ? 72 : 120;
  const geo = ctx.kit.track(new THREE.PlaneGeometry(size, size, seg, seg));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = o.h(x, z);
    pos.setY(i, h);
    uv.setXY(i, x / o.repeat, z / o.repeat);
    const c = o.tint(x, z, h, Math.hypot(x, z));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = ctx.kit.track(
    new THREE.MeshStandardMaterial({
      map: o.map,
      vertexColors: true,
      roughness: o.roughness ?? 1,
      metalness: 0,
      emissive: o.emissive ? o.emissive.color : 0x000000,
      emissiveMap: o.emissive ? o.emissive.map : null,
      emissiveIntensity: o.emissive ? o.emissive.intensity : 0,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  ctx.H = o.h;
  return mesh;
}

export interface PadStyle {
  base: number;
  worn: number;
  edge: number;
  rim: number;
  /** Optional glowing ring colour (embers, runes, crystal light). */
  glow?: number;
}

export function pads(ctx: ArenaCtx, style: PadStyle): void {
  const { kit } = ctx;
  const map = kit.noiseTex(256, style.base, style.worn, 5, 41, (c, s, r) => {
    const mid = s / 2;
    // Worn centre and scuffed outer band.
    const g = c.createRadialGradient(mid, mid, 0, mid, mid, mid);
    g.addColorStop(0, `${hex(style.worn)}cc`);
    g.addColorStop(0.55, `${hex(style.worn)}33`);
    g.addColorStop(0.8, 'rgba(0,0,0,0)');
    g.addColorStop(1, `${hex(style.edge)}ee`);
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.strokeStyle = hex(style.edge);
    c.lineWidth = 5;
    c.globalAlpha = 0.65;
    c.beginPath();
    c.arc(mid, mid, mid * 0.86, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(mid, mid, mid * 0.62, 0, Math.PI * 2);
    c.stroke();
    // Tick marks around the inner ring like a worn arena inlay.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.beginPath();
      c.moveTo(mid + Math.cos(a) * mid * 0.74, mid + Math.sin(a) * mid * 0.74);
      c.lineTo(mid + Math.cos(a) * mid * 0.8, mid + Math.sin(a) * mid * 0.8);
      c.stroke();
    }
    c.globalAlpha = 0.35;
    for (let i = 0; i < 90; i++) {
      c.fillStyle = r() > 0.5 ? hex(style.edge) : hex(style.worn);
      c.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 2);
    }
    c.globalAlpha = 1;
  });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  let glowMap: THREE.Texture | null = null;
  if (style.glow !== undefined) {
    glowMap = kit.tex(256, 256, (c, s) => {
      const mid = s / 2;
      c.fillStyle = '#000';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = hex(style.glow as number);
      c.lineWidth = 4;
      c.beginPath();
      c.arc(mid, mid, mid * 0.86, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath();
        c.moveTo(mid + Math.cos(a) * mid * 0.62, mid + Math.sin(a) * mid * 0.62);
        c.lineTo(mid + Math.cos(a) * mid * 0.8, mid + Math.sin(a) * mid * 0.8);
        c.stroke();
      }
    }, false);
  }
  const top = kit.track(
    new THREE.MeshStandardMaterial({
      map,
      roughness: 0.95,
      metalness: 0,
      emissive: glowMap ? 0xffffff : 0x000000,
      emissiveMap: glowMap,
      emissiveIntensity: glowMap ? 0.8 : 0,
    }),
  );
  const side = kit.track(new THREE.MeshStandardMaterial({ color: style.rim, roughness: 1, metalness: 0 }));
  ctx.pads.forEach((p, idx) => {
    const geo = kit.track(new THREE.CylinderGeometry(p.r, p.r + 0.1, 0.1, 56));
    const mesh = new THREE.Mesh(geo, [side, top, side]);
    mesh.position.set(p.x, 0.0, p.z);
    mesh.rotation.y = idx * 1.3;
    mesh.receiveShadow = true;
    ctx.scene.add(mesh);
  });
  if (glowMap) {
    ctx.tick.push((t) => {
      top.emissiveIntensity = 0.65 + Math.sin(t * 1.6) * 0.25;
    });
  }
}

/** Gentle mottled elevation: flat arena plateau, rolling rim, mostly behind the fighters. */
export function hillsHeight(o: { flat: number; amp: number; seed: number; side?: number }): (x: number, z: number) => number {
  return (x, z) => {
    const r = Math.hypot(x, z);
    const t = smoothstep(o.flat, o.flat + 8, r);
    if (t <= 0) return 0;
    const back = smoothstep(5, -16, z);
    const side = smoothstep(10, 20, Math.abs(x)) * (o.side ?? 0.6);
    const w = Math.max(back, side);
    const front = 1 - smoothstep(0, 8, z) * 0.8;
    const n = fbm(x * 0.075 + 3, z * 0.075 + 7, o.seed, 4);
    return t * o.amp * (0.18 + w) * (n * 1.5 - 0.2) * front;
  };
}

export function ringTint(r: number, flat: number): number {
  // A slightly lighter worn track around the arena edge.
  const d = Math.abs(r - (flat - 0.8));
  return 1 + 0.12 * Math.max(0, 1 - d / 0.9);
}

/** Soft cloud sprites that slowly slide across the sky band. */
export function clouds(ctx: ArenaCtx, count: number, o: { y: [number, number]; z: [number, number]; spread: number; color: number; opacity: number; scale: number; seed: number }): void {
  const { kit } = ctx;
  const tex = kit.tex(128, 64, (c, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 9; i++) {
      const x = w * (0.2 + r() * 0.6);
      const y = h * (0.45 + r() * 0.25);
      const rad = h * (0.28 + r() * 0.3);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
  }, false);
  const rand = rng(o.seed);
  const n = ctx.reduced ? Math.ceil(count / 2) : count;
  const sprites: Array<{ s: THREE.Sprite; x: number; sp: number }> = [];
  for (let i = 0; i < n; i++) {
    const mat = kit.track(new THREE.SpriteMaterial({ map: tex, color: o.color, transparent: true, opacity: o.opacity * (0.6 + rand() * 0.4), depthWrite: false, fog: false, toneMapped: false }));
    const s = new THREE.Sprite(mat);
    const sc = o.scale * (0.7 + rand() * 0.7);
    s.scale.set(sc * 2, sc, 1);
    const x = (rand() - 0.5) * o.spread;
    s.position.set(x, o.y[0] + rand() * (o.y[1] - o.y[0]), o.z[0] + rand() * (o.z[1] - o.z[0]));
    ctx.scene.add(s);
    sprites.push({ s, x, sp: 0.15 + rand() * 0.25 });
  }
  ctx.tick.push((t) => {
    for (const c of sprites) {
      const half = o.spread / 2;
      c.s.position.x = ((((c.x + t * c.sp + half) % o.spread) + o.spread) % o.spread) - half;
    }
  });
}

/** Slanted additive light shafts. */
export function shafts(ctx: ArenaCtx, spots: Array<[number, number, number, number]>, color: number, opacity: number): void {
  const { kit } = ctx;
  const tex = kit.tex(32, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const e = c.createLinearGradient(0, 0, w, 0);
    e.addColorStop(0, 'rgba(0,0,0,1)');
    e.addColorStop(0.5, 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = e;
    c.fillRect(0, 0, w, h);
  }, false);
  const geo = kit.track(new THREE.PlaneGeometry(1, 1));
  const mats: THREE.MeshBasicMaterial[] = [];
  spots.forEach(([x, z, w, h], i) => {
    const mat = kit.track(new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(w, h, 1);
    m.position.set(x, h * 0.42, z);
    m.rotation.set(0, 0.2 * i, -0.28);
    ctx.scene.add(m);
  });
  if (!ctx.reduced) ctx.tick.push((t) => mats.forEach((m, i) => (m.opacity = opacity * (0.75 + Math.sin(t * 0.4 + i * 1.9) * 0.25))));
}
