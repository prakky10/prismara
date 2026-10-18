/**
 * Per-biome arena dioramas. Each builder dresses the scene in layers: sky dome,
 * far silhouettes, mid props, near props, terrain with a worn battle pad under
 * each creature, and gentle ambient motion (sway, drifting particles).
 */

import * as THREE from 'three';
import { Kit, Motes, fbm, instance, mix, propMat, ridge, rng, smoothstep, sway, type Inst } from './kit';
import {
  archGeo, broadleafGeo, buildingGeo, crystalGeo, fernGeo, flowerGeo, iceGeo, lampGeo, logGeo, mushroomGeo,
  palmGeo, pillarGeo, pineGeo, pylonGeo, rockGeo, spireGeo, stalagmiteGeo, tuftGeo, umbrellaGeo,
} from './props';
import { clouds, hillsHeight, pads, ringTint, scatter, shafts, terrain, type ArenaCtx, type PadSpot } from './scaffold';

export interface ArenaFog {
  color: number;
  near: number;
  far: number;
}

export interface ArenaBuild {
  fog: ArenaFog;
  tick: (t: number) => void;
}

type Builder = (ctx: ArenaCtx) => ArenaFog;

const PI = Math.PI;

function add(ctx: ArenaCtx, ...objs: THREE.Object3D[]): void {
  for (const o of objs) ctx.scene.add(o);
}

function sky(ctx: ArenaCtx, stops: Array<[number, number]>, below: number, glow?: { u: number; v: number; color: number; size: number }): void {
  const dome = ctx.kit.skyDome(stops, below, 120, glow);
  dome.scale.y = 0.3;
  ctx.scene.add(dome);
}

function motes(ctx: ArenaCtx, o: ConstructorParameters<typeof Motes>[2]): void {
  if (ctx.reduced) return;
  const m = new Motes(ctx.kit, ctx.dot, o);
  ctx.scene.add(m.points);
  ctx.tick.push((t) => m.update(t));
}

function spreadColors(list: Inst[], colors: number[], seed: number): Inst[] {
  const r = rng(seed);
  for (const it of list) it.color = colors[Math.floor(r() * colors.length)];
  return list;
}

function grassMap(ctx: ArenaCtx, a: number, b: number, seed: number, extra?: (c: CanvasRenderingContext2D, s: number, r: () => number) => void): THREE.Texture {
  return ctx.kit.noiseTex(256, a, b, 5, seed, (c, s, r) => {
    for (let i = 0; i < 700; i++) {
      c.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
      const x = r() * s;
      const y = r() * s;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
      c.stroke();
    }
    extra?.(c, s, r);
  });
}

function tintFn(base: number, edge: number, flat: number, hi = 0): (x: number, z: number, h: number, r: number) => THREE.Color {
  const b = new THREE.Color(base);
  const e = new THREE.Color(edge);
  const c = new THREE.Color();
  return (x, z, h, r) => {
    const n = fbm(x * 0.2, z * 0.2, 4, 3);
    c.copy(b).lerp(e, smoothstep(flat, flat + 9, r) * 0.7 + smoothstep(0, 3, h) * hi);
    c.multiplyScalar((0.82 + n * 0.36) * ringTint(r, flat));
    return c.clone();
  };
}

/* ------------------------------------------------------------------ meadow */

const meadow: Builder = (ctx) => {
  const { kit } = ctx;
  sky(ctx, [[0, 0xe6f3ff], [0.12, 0xbfe0ff], [0.5, 0x8fc7ff], [1, 0x4c90e0]], 0x7fb06a, { u: 0.75, v: 0.03, color: 0xfff0c0, size: 260 });
  terrain(ctx, {
    h: hillsHeight({ flat: 9.5, amp: 3.4, seed: 2 }),
    map: grassMap(ctx, 0x3b8a45, 0x66b955, 1, (c, s, r) => {
      for (let i = 0; i < 26; i++) {
        c.fillStyle = 'rgba(120,90,50,0.25)';
        c.beginPath();
        c.ellipse(r() * s, r() * s, 4 + r() * 10, 3 + r() * 6, r() * 3, 0, PI * 2);
        c.fill();
      }
    }),
    repeat: 7,
    tint: tintFn(0xffffff, 0xcfe8b0, 9.5, 0.1),
  });
  pads(ctx, { base: 0x8a6c46, worn: 0xb89a6c, edge: 0xd7c49a, rim: 0x6f5a3c });

  ridge(kit, { radius: 34, a0: PI * 0.8, a1: PI * 2.2, baseY: 0, height: 6, rough: 0.9, seed: 3, color: 0x5fa060, top: 0x7cc176 });
  const far = ridge(kit, { radius: 46, a0: PI * 0.78, a1: PI * 2.22, baseY: -0.5, height: 11, rough: 1.1, seed: 5, color: 0x86afc4, top: 0xaecfe6, jag: 0.8 });
  const far2 = ridge(kit, { radius: 58, a0: PI * 0.76, a1: PI * 2.24, baseY: -1, height: 14, rough: 1.4, seed: 8, color: 0xa7c4dd, top: 0xd0e4f6, jag: 0.5 });
  add(ctx, ridge(kit, { radius: 25, a0: PI * 0.82, a1: PI * 2.18, baseY: 0, height: 4, rough: 0.7, seed: 12, color: 0x3f8f49, top: 0x58aa5a }), far, far2);

  const treeM = sway(kit, propMat(kit), 0.05, 1.1);
  const trees = scatter(ctx, 18, { rMin: 11, rMax: 16, h: 4, seed: 21 }, (x, y, z, r) => ({ x, y, z, s: 0.9 + r() * 0.7, ry: r() * 6, color: r() > 0.5 ? 0xffffff : 0xdff0c8 }));
  const trees2 = scatter(ctx, 24, { rMin: 17, rMax: 25, h: 4, seed: 22, free: true }, (x, y, z, r) => ({ x, y, z, s: 1.2 + r() * 0.9, ry: r() * 6, color: 0xb8d8b0 }));
  add(ctx, instance(kit, broadleafGeo(), treeM, [...trees, ...trees2], { cast: true, receive: true }));

  const tuftM = sway(kit, propMat(kit), 0.25, 1.6);
  add(ctx, instance(kit, tuftGeo(), tuftM, scatter(ctx, 190, { rMin: 6.8, rMax: 15, h: 0.5, seed: 31, a0: PI * 0.7, a1: PI * 2.3 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.1, ry: r() * 6 })), { receive: true }));
  const flowerM = sway(kit, propMat(kit, { roughness: 0.7 }), 0.2, 1.9);
  add(ctx, instance(kit, flowerGeo(), flowerM, spreadColors(scatter(ctx, 120, { rMin: 6.8, rMax: 14, h: 0.4, seed: 41, a0: PI * 0.7, a1: PI * 2.3 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 0.6, ry: r() * 6 })), [0xffffff, 0xffd84a, 0xff8ab0, 0xb08aff, 0xff7a5a], 3), { tint: 0.05 }));
  const rockM = propMat(kit);
  add(ctx, instance(kit, rockGeo(0x8d8f96, 0x7ea06a), rockM, scatter(ctx, 16, { rMin: 9.5, rMax: 17, h: 1, seed: 51 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.6, ry: r() * 6 })), { cast: true, receive: true }));

  clouds(ctx, 7, { y: [7.5, 11], z: [-46, -34], spread: 90, color: 0xffffff, opacity: 0.85, scale: 14, seed: 6 });
  motes(ctx, { count: 70, center: [0, 2.5, -2], extent: [34, 5, 26], color: 0xfff2b0, size: 0.14, velocity: [0.18, 0.06, 0.05], wobble: 0.35, opacity: 0.55, seed: 4 });
  return { color: 0xcfe6f8, near: 28, far: 105 };
};

/* ------------------------------------------------------------------ forest */

const forest: Builder = (ctx) => {
  const { kit } = ctx;
  sky(ctx, [[0, 0xcfe0d0], [0.15, 0x9cc4c8], [0.5, 0x6ea8c8], [1, 0x3a74a8]], 0x24402a, { u: 0.7, v: 0.04, color: 0xfff0b0, size: 200 });
  terrain(ctx, {
    h: hillsHeight({ flat: 9.5, amp: 2.8, seed: 7 }),
    map: grassMap(ctx, 0x2a5e32, 0x4a7a3c, 11, (c, s, r) => {
      const leaf = ['rgba(150,90,40,0.5)', 'rgba(190,140,50,0.45)', 'rgba(110,60,30,0.5)'];
      for (let i = 0; i < 160; i++) {
        c.fillStyle = leaf[Math.floor(r() * 3)];
        c.beginPath();
        c.ellipse(r() * s, r() * s, 1.5 + r() * 2.5, 1 + r() * 1.5, r() * 3, 0, PI * 2);
        c.fill();
      }
    }),
    repeat: 7,
    tint: tintFn(0xf4f4f4, 0x9ab88a, 9.5, 0),
  });
  pads(ctx, { base: 0x6e5a3a, worn: 0x9a8458, edge: 0xc4b080, rim: 0x4e402a });

  add(ctx,
    ridge(kit, { radius: 25, a0: PI * 0.82, a1: PI * 2.18, baseY: 0, height: 5, rough: 1.2, seed: 13, color: 0x1f4a2a, top: 0x2a5e34, jag: 1 }),
    ridge(kit, { radius: 36, a0: PI * 0.8, a1: PI * 2.2, baseY: 0, height: 8, rough: 1.6, seed: 15, color: 0x2f5e48, top: 0x3d7660, jag: 1 }),
    ridge(kit, { radius: 50, a0: PI * 0.78, a1: PI * 2.22, baseY: -1, height: 13, rough: 1.4, seed: 17, color: 0x6a8f98, top: 0x8fb0b8, jag: 0.6 }));

  const treeM = sway(kit, propMat(kit), 0.04, 1.0);
  const pineList = [
    ...scatter(ctx, 20, { rMin: 10.5, rMax: 14.5, h: 4.5, seed: 61 }, (x, y, z, r) => ({ x, y, z, s: 1.0 + r() * 0.7, ry: r() * 6, color: r() > 0.5 ? 0xffffff : 0xd6e8d0 })),
    ...scatter(ctx, 40, { rMin: 15, rMax: 23, h: 4.5, seed: 62, free: true }, (x, y, z, r) => ({ x, y, z, s: 1.3 + r() * 0.9, ry: r() * 6, color: 0xb4cfb4 })),
    ...scatter(ctx, 46, { rMin: 24, rMax: 34, h: 4.5, seed: 63, free: true }, (x, y, z, r) => ({ x, y, z, s: 1.8 + r() * 1.2, ry: r() * 6, color: 0x9ab8a8 })),
  ];
  add(ctx, instance(kit, pineGeo(), treeM, pineList, { cast: true, receive: true }));
  const bl = scatter(ctx, 12, { rMin: 11, rMax: 16, h: 4.5, seed: 64 }, (x, y, z, r) => ({ x, y, z, s: 0.9 + r() * 0.6, ry: r() * 6, color: 0xc8dcb0 }));
  add(ctx, instance(kit, broadleafGeo(0x2a6a34, 0x3d8240), treeM, bl, { cast: true, receive: true }));

  const shroom = propMat(kit, { roughness: 0.6 });
  add(ctx,
    instance(kit, mushroomGeo(0xd8442e), shroom, scatter(ctx, 22, { rMin: 8, rMax: 14, h: 0.5, seed: 71, a0: PI * 0.7, a1: PI * 2.3 }, (x, y, z, r) => ({ x, y, z, s: 0.7 + r() * 1.4, ry: r() * 6 }))),
    instance(kit, mushroomGeo(0xc08a4a, false), shroom, scatter(ctx, 20, { rMin: 8, rMax: 14, h: 0.5, seed: 72, a0: PI * 0.7, a1: PI * 2.3 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.3, ry: r() * 6 }))));
  const fernM = sway(kit, propMat(kit), 0.3, 1.5);
  add(ctx, instance(kit, fernGeo(), fernM, scatter(ctx, 70, { rMin: 7.6, rMax: 15, h: 0.6, seed: 73, a0: PI * 0.7, a1: PI * 2.3 }, (x, y, z, r) => ({ x, y, z, s: 0.9 + r() * 1.2, ry: r() * 6 })), { receive: true }));
  add(ctx, instance(kit, logGeo(), propMat(kit), scatter(ctx, 5, { rMin: 10, rMax: 15, h: 0.6, seed: 74 }, (x, y, z, r) => ({ x, y, z, s: 1 + r() * 0.6, ry: r() * 6 })), { cast: true, receive: true }));
  add(ctx, instance(kit, rockGeo(0x70787a, 0x4a7a3a), propMat(kit), scatter(ctx, 14, { rMin: 9.5, rMax: 16, h: 1, seed: 75 }, (x, y, z, r) => ({ x, y, z, s: 0.7 + r() * 1.3, ry: r() * 6 })), { cast: true, receive: true }));

  shafts(ctx, [[-7, -10, 3.2, 13], [-2, -13, 2.4, 14], [5, -12, 3, 14], [10, -8, 2.2, 12]], 0xfff0b0, 0.09);
  motes(ctx, { count: 60, center: [0, 2, -3], extent: [30, 4.5, 24], color: 0xdfff80, size: 0.2, velocity: [0.05, 0.04, 0.03], wobble: 0.8, opacity: 0.8, seed: 5 });
  motes(ctx, { count: 36, center: [0, 5, -4], extent: [30, 8, 24], color: 0xc89a50, size: 0.12, velocity: [0.1, -0.25, 0.05], wobble: 0.5, opacity: 0.55, additive: false, seed: 6 });
  return { color: 0x9fc2b4, near: 14, far: 66 };
};

/* -------------------------------------------------------------------- city */

function windowTextures(kit: Kit): { map: THREE.Texture; glow: THREE.Texture } {
  const paintWin = (lit: boolean) => (c: CanvasRenderingContext2D, w: number, h: number): void => {
    const r = rng(77);
    c.fillStyle = lit ? '#000' : '#8a93a2';
    c.fillRect(0, 0, w, h);
    const cell = 16;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const on = r() < 0.38;
        const tone = r();
        if (lit) {
          if (!on) continue;
          c.fillStyle = tone > 0.5 ? '#ffd890' : '#bfe0ff';
        } else {
          c.fillStyle = on ? '#e8d9a8' : tone > 0.5 ? '#36404f' : '#2a3342';
        }
        c.fillRect(x + 3, y + 3, cell - 6, cell - 7);
      }
    }
  };
  return { map: kit.tex(64, 64, paintWin(false)), glow: kit.tex(64, 64, paintWin(true)) };
}

const city: Builder = (ctx) => {
  const { kit } = ctx;
  sky(ctx, [[0, 0xf0e6dc], [0.1, 0xcfd6e2], [0.5, 0xa8b6cc], [1, 0x7c90b0]], 0x5c6470, { u: 0.8, v: 0.03, color: 0xffd8a8, size: 240 });
  const H = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    return 0.16 * smoothstep(9.8, 10.3, r) * (1 - smoothstep(12.6, 13.2, r)) + fbm(x * 0.1, z * 0.1, 3, 2) * 0.0;
  };
  terrain(ctx, {
    h: H,
    map: kit.noiseTex(256, 0x666b74, 0x7e848d, 6, 21, (c, s, r) => {
      c.strokeStyle = 'rgba(20,24,30,0.35)';
      c.lineWidth = 1.5;
      for (let i = 0; i <= 4; i++) {
        c.beginPath(); c.moveTo((i * s) / 4, 0); c.lineTo((i * s) / 4, s); c.stroke();
        c.beginPath(); c.moveTo(0, (i * s) / 4); c.lineTo(s, (i * s) / 4); c.stroke();
      }
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        let x = r() * s; let y = r() * s;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 14; y += (r() - 0.5) * 14; c.lineTo(x, y); }
        c.stroke();
      }
      c.fillStyle = 'rgba(240,200,60,0.5)';
      for (let i = 0; i < 4; i++) c.fillRect(i * (s / 4) + 6, s / 2 - 1.5, 14, 3);
    }),
    repeat: 8,
    tint: (x, z, h, r) => new THREE.Color(r > 10 && r < 13 ? 0xc4c8d0 : 0xffffff).multiplyScalar(0.85 + fbm(x * 0.3, z * 0.3, 5, 2) * 0.3 + h),
  });
  pads(ctx, { base: 0x4a5058, worn: 0x7a828c, edge: 0xe8c850, rim: 0x3a3f46 });

  // Far skyline: dark boxes fading into haze.
  const skyBox = kit.track(new THREE.BoxGeometry(1, 1, 1));
  const skyMat = kit.track(new THREE.MeshBasicMaterial({ color: 0x7686a0 }));
  const sky2Mat = kit.track(new THREE.MeshBasicMaterial({ color: 0x95a3ba }));
  const rr = rng(88);
  const farList: Inst[] = [];
  const farList2: Inst[] = [];
  for (let i = 0; i < 70; i++) {
    const a = PI * 0.8 + (i / 69) * PI * 1.4;
    const second = i % 2 === 0;
    const rad = second ? 52 : 40;
    const h = 5 + rr() * 14;
    (second ? farList2 : farList).push({ x: Math.cos(a) * rad, y: h / 2 - 0.5, z: Math.sin(a) * rad, sx: 2 + rr() * 3.5, sy: h, sz: 2 + rr() * 3 });
  }
  add(ctx, instance(kit, skyBox, skyMat, farList), instance(kit, skyBox.clone(), sky2Mat, farList2));

  // Mid buildings with lit windows.
  const win = windowTextures(kit);
  const bMat = kit.track(new THREE.MeshStandardMaterial({ map: win.map, emissiveMap: win.glow, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.85, metalness: 0.05 }));
  const variants: Array<[number, number, number]> = [[4, 9, 4], [5, 13, 4.5], [3.5, 7, 3.5], [6, 17, 5], [4.5, 11, 4]];
  const tints = [0xffffff, 0xe6dccf, 0xd4dce8, 0xe8d4d0, 0xcfd8cf];
  variants.forEach(([w, h, d], vi) => {
    const list = scatter(ctx, 5, { rMin: 15 + (vi % 2) * 3, rMax: 24, h, seed: 90 + vi, a0: PI * 0.84, a1: PI * 2.16, free: true }, (x, y, z, r, a) => ({ x, y, z, ry: -a + PI / 2 + (r() - 0.5) * 0.3, color: tints[Math.floor(r() * tints.length)] }));
    add(ctx, instance(kit, buildingGeo(w, h, d), bMat, list, { cast: false, receive: false, tint: 0.06 }));
  });

  // Street furniture near the plaza edge.
  const lampList = scatter(ctx, 14, { rMin: 10.4, rMax: 12.4, h: 2.8, seed: 101, a0: PI * 0.85, a1: PI * 2.15 }, (x, y, z, _r, a) => ({ x, y: y + 0.16, z, ry: -a + PI / 2 + PI, s: 1 }));
  add(ctx, instance(kit, lampGeo(), propMat(kit, { metalness: 0.4 }), lampList, { cast: true }));
  const bulbGeo = kit.track(new THREE.SphereGeometry(0.1, 8, 6));
  const bulbMat = kit.track(new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false }));
  const bulbs: Inst[] = lampList.map((l) => ({ x: l.x + Math.cos(l.ry ?? 0) * 0.62, y: (l.y ?? 0) + 2.66, z: l.z - Math.sin(l.ry ?? 0) * 0.62 }));
  add(ctx, instance(kit, bulbGeo, bulbMat, bulbs));
  const halo = new THREE.BufferGeometry();
  halo.setAttribute('position', new THREE.Float32BufferAttribute(bulbs.flatMap((b) => [b.x, (b.y ?? 0) - 0.05, b.z]), 3));
  kit.track(halo);
  add(ctx, new THREE.Points(halo, kit.track(new THREE.PointsMaterial({ map: ctx.dot, color: 0xffcf80, size: 1.5, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }))));
  add(ctx, instance(kit, pylonGeo(), propMat(kit, { metalness: 0.5, roughness: 0.6 }), scatter(ctx, 5, { rMin: 13.5, rMax: 16.5, h: 6, seed: 102, a0: PI * 0.9, a1: PI * 2.1 }, (x, y, z, r) => ({ x, y, z, ry: r() * 6, s: 1.2 })), { cast: true }));
  const crate = kit.track(new THREE.BoxGeometry(1, 1, 1));
  const crateMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 }));
  add(ctx, instance(kit, crate, crateMat, scatter(ctx, 9, { rMin: 9, rMax: 12.5, h: 0.9, seed: 103, a0: PI * 0.8, a1: PI * 2.2 }, (x, y, z, r) => { const s = 0.5 + r() * 0.5; return { x, y: y + s / 2, z, s, ry: r() * 6, color: r() > 0.5 ? 0xffffff : 0xb0b8c0 }; }), { cast: true, receive: true }));
  add(ctx, instance(kit, rockGeo(0x8a8f96), propMat(kit), scatter(ctx, 8, { rMin: 11, rMax: 15, h: 0.8, seed: 104 }, (x, y, z, r) => ({ x, y, z, s: 0.7 + r() * 0.9, ry: r() * 6 })), { cast: true, receive: true }));

  clouds(ctx, 5, { y: [8, 11], z: [-46, -36], spread: 90, color: 0xe8ecf2, opacity: 0.6, scale: 14, seed: 9 });
  motes(ctx, { count: 50, center: [0, 3, -4], extent: [34, 7, 26], color: 0xd8dce4, size: 0.1, velocity: [0.12, 0.1, 0.04], wobble: 0.4, opacity: 0.4, additive: false, seed: 8 });
  return { color: 0xc4ccd8, near: 24, far: 100 };
};

/* ------------------------------------------------------------------- beach */

const beach: Builder = (ctx) => {
  const { kit } = ctx;
  sky(ctx, [[0, 0xcfe6f6], [0.1, 0xa8d4f4], [0.5, 0x7cc4f4], [1, 0x4aa6e8]], 0x2f8fd0, { u: 0.72, v: 0.04, color: 0xfff4c8, size: 280 });
  const H = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const dune = fbm(x * 0.12, z * 0.12, 9, 3) * 1.4 * smoothstep(9.5, 12, r) * smoothstep(3, -12, z) * (1 - smoothstep(12, 14, r));
    return dune - 1.3 * smoothstep(10.4, 14, r);
  };
  terrain(ctx, {
    h: H,
    map: kit.noiseTex(256, 0xc8b074, 0xdcc68e, 6, 31, (c, s, r) => {
      c.strokeStyle = 'rgba(150,120,60,0.18)';
      c.lineWidth = 1;
      for (let y = 0; y < s; y += 7) {
        c.beginPath();
        for (let x = 0; x <= s; x += 8) c.lineTo(x, y + Math.sin(x * 0.07 + y) * 1.8);
        c.stroke();
      }
      for (let i = 0; i < 260; i++) {
        c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,90,50,0.35)';
        c.fillRect(r() * s, r() * s, 1, 1);
      }
    }),
    repeat: 7,
    tint: (x, z, h, r) => {
      const wet = 1 - smoothstep(-0.9, 0.0, h);
      return new THREE.Color(0xffffff).lerp(new THREE.Color(0xb8a888), wet * 0.8).multiplyScalar(0.9 + fbm(x * 0.25, z * 0.25, 2, 2) * 0.2 * ringTint(r, 9.5));
    },
  });
  pads(ctx, { base: 0xc2a86c, worn: 0xe6d29a, edge: 0xf6ecc4, rim: 0x9a8454 });

  // Animated sea.
  const seaGeo = kit.track(new THREE.PlaneGeometry(110, 110, ctx.reduced ? 28 : 52, ctx.reduced ? 28 : 52));
  seaGeo.rotateX(-PI / 2);
  const shimmer = kit.noiseTex(256, 0x1d86c0, 0x4fb6e0, 7, 37, (c, s, r) => {
    for (let i = 0; i < 220; i++) {
      c.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.3})`;
      c.fillRect(r() * s, r() * s, 2 + r() * 6, 1);
    }
  });
  shimmer.repeat.set(10, 10);
  const seaMat = kit.track(new THREE.MeshStandardMaterial({ map: shimmer, color: 0xffffff, roughness: 0.2, metalness: 0.18, transparent: true, opacity: 0.9 }));
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = -0.3;
  sea.receiveShadow = true;
  add(ctx, sea);
  const seaPos = seaGeo.getAttribute('position');
  const baseXZ = Float32Array.from({ length: seaPos.count * 2 }, (_, i) => (i % 2 === 0 ? seaPos.getX(i >> 1) : seaPos.getZ(i >> 1)));

  const foamMat = kit.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
  const foams = [11.6, 12.5].map((r0, i) => {
    const g = kit.track(new THREE.RingGeometry(r0, r0 + 0.22 - i * 0.08, 72));
    g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, foamMat);
    m.position.y = -0.22;
    add(ctx, m);
    return m;
  });
  ctx.tick.push((t) => {
    shimmer.offset.set(t * 0.012, t * 0.018);
    if (!ctx.reduced) {
      for (let i = 0; i < seaPos.count; i++) {
        const x = baseXZ[i * 2];
        const z = baseXZ[i * 2 + 1];
        seaPos.setY(i, Math.sin(x * 0.4 + t * 0.9) * 0.05 + Math.sin(z * 0.33 + t * 0.7) * 0.05);
      }
      seaPos.needsUpdate = true;
      seaGeo.computeVertexNormals();
    }
    foams.forEach((f, i) => {
      const k = 1 + Math.sin(t * 0.7 + i * 2) * 0.012;
      f.scale.set(k, 1, k);
    });
    foamMat.opacity = 0.32 + Math.sin(t * 0.9) * 0.1;
  });

  // Distant islands rising out of the sea.
  add(ctx,
    ridge(kit, { radius: 36, a0: PI * 1.05, a1: PI * 1.55, baseY: -0.5, height: 4, rough: 1.5, seed: 33, color: 0x3a8a74, top: 0x58aa7c, jag: 0.4 }),
    ridge(kit, { radius: 50, a0: PI * 0.85, a1: PI * 1.3, baseY: -0.6, height: 7, rough: 1.2, seed: 35, color: 0x7aa8b8, top: 0x9cc6d0, jag: 0.6 }),
    ridge(kit, { radius: 62, a0: PI * 1.3, a1: PI * 2.15, baseY: -0.6, height: 8, rough: 1.2, seed: 37, color: 0xa2c2d6, top: 0xc6e0ee, jag: 0.5 }));

  const palmM = sway(kit, propMat(kit), 0.12, 1.3);
  const palms = scatter(ctx, 10, { rMin: 9.8, rMax: 12.4, h: 5, seed: 111 }, (x, y, z, r, a) => ({ x, y, z, s: 0.9 + r() * 0.5, ry: -a + PI / 2 + (r() - 0.5) * 2.2 }));
  add(ctx, instance(kit, palmGeo(), palmM, palms, { cast: true, receive: true }));
  add(ctx, instance(kit, rockGeo(0xb9a887, 0xcbbd9a), propMat(kit), scatter(ctx, 18, { rMin: 9.8, rMax: 13, h: 1, seed: 112 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.5, ry: r() * 6 })), { cast: true, receive: true }));
  // Sea stacks.
  add(ctx, instance(kit, rockGeo(0x7a7468, 0x9a9688, 1.6), propMat(kit), scatter(ctx, 9, { rMin: 17, rMax: 30, h: 4, seed: 113, free: true }, (x, _y, z, r) => ({ x, y: -0.6, z, s: 2.5 + r() * 3.5, ry: r() * 6 })), { cast: true }));
  add(ctx, instance(kit, umbrellaGeo(), propMat(kit), [{ x: -12.2, y: H(-12.2, -1.5), z: -1.5, ry: 0.6, rz: 0.12 }, { x: 11.8, y: H(11.8, -4.5), z: -4.5, ry: 2.4, rz: -0.1 }], { cast: true }));
  const grassM = sway(kit, propMat(kit), 0.25, 1.7);
  add(ctx, instance(kit, tuftGeo(0xb4b45a), grassM, scatter(ctx, 80, { rMin: 9.8, rMax: 13, h: 0.5, seed: 114, a0: PI * 0.8, a1: PI * 2.2 }, (x, y, z, r) => ({ x, y, z, s: 0.9 + r() * 1.0, ry: r() * 6 })), { receive: true }));
  add(ctx, instance(kit, mushroomGeo(0xf2a0b0, false), propMat(kit), scatter(ctx, 16, { rMin: 7.5, rMax: 11, h: 0.3, seed: 115, a0: PI * 0.8, a1: PI * 2.2 }, (x, y, z, r) => ({ x, y, z, s: 0.35 + r() * 0.3, ry: r() * 6, rz: 1.4 })), { receive: true }));

  clouds(ctx, 6, { y: [8, 11], z: [-46, -36], spread: 90, color: 0xffffff, opacity: 0.85, scale: 13, seed: 14 });
  motes(ctx, { count: 50, center: [0, 1.5, -4], extent: [36, 3, 28], color: 0xffffff, size: 0.1, velocity: [0.3, 0.05, 0.05], wobble: 0.3, opacity: 0.5, seed: 12 });
  return { color: 0xd6ecff, near: 30, far: 115 };
};

/* ----------------------------------------------------------------- volcano */

function lavaTex(kit: Kit, glow: boolean): THREE.Texture {
  return kit.tex(256, 256, (c, s) => {
    const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm((x / s) * 5, (y / s) * 5, 44, 4, 5);
        const crack = Math.abs(n - 0.5) < 0.05 ? 1 : 0;
        const t = glow ? crack : Math.min(1, Math.max(0, (0.55 - Math.abs(n - 0.5)) * 1.6));
        const i = (y * s + x) * 4;
        const hot = glow ? crack * 255 : 0;
        img.data[i] = glow ? hot : 60 + t * 150;
        img.data[i + 1] = glow ? hot * 0.4 : 18 + t * 70;
        img.data[i + 2] = glow ? hot * 0.1 : 10 + t * 12;
        img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  });
}

function crackPaint(color: string, widthScale: number, seed: number): (c: CanvasRenderingContext2D, s: number, r: () => number) => void {
  return (c, s) => {
    const r = rng(seed);
    c.strokeStyle = color;
    c.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      let x = r() * s;
      let y = r() * s;
      let a = r() * PI * 2;
      c.lineWidth = (1.5 + r() * 2.5) * widthScale;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 9; k++) {
        a += (r() - 0.5) * 1.2;
        x += Math.cos(a) * (8 + r() * 12);
        y += Math.sin(a) * (8 + r() * 12);
        c.lineTo(x, y);
      }
      c.stroke();
    }
  };
}

const volcano: Builder = (ctx) => {
  const { kit } = ctx;
  sky(ctx, [[0, 0xe0702a], [0.1, 0xa8401e], [0.5, 0x4a1a16], [1, 0x1c0a0c]], 0x1a0b08, { u: 0.75, v: 0.02, color: 0xff7a30, size: 300 });
  const H = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const moat = -1.5 * smoothstep(9.6, 11.4, r) * (1 - smoothstep(14.5, 17.5, r));
    const back = smoothstep(4, -16, z) + smoothstep(12, 22, Math.abs(x)) * 0.7;
    const wall = smoothstep(15.5, 26, r) * (1.2 + back * 6) * (0.4 + fbm(x * 0.09, z * 0.09, 6, 4));
    return moat + wall * (1 - smoothstep(2, 9, z) * 0.9);
  };
  const crackMap = kit.noiseTex(256, 0x241c1a, 0x3e302a, 6, 51, crackPaint('rgba(255,110,30,0.45)', 0.7, 52));
  const crackGlow = kit.tex(256, 256, (c, s) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, s, s);
    crackPaint('#c8541a', 0.7, 52)(c, s, rng(1));
  });
  const ground = terrain(ctx, {
    h: H,
    map: crackMap,
    repeat: 7,
    tint: (x, z, h, r) => new THREE.Color(0xffffff).multiplyScalar((0.7 + fbm(x * 0.2, z * 0.2, 8, 3) * 0.5) * ringTint(r, 9.5) * (h < -0.3 ? 0.55 : 1)),
    emissive: { map: crackGlow, color: 0xffffff, intensity: 0.5 },
  });
  const groundMat = ground.material as THREE.MeshStandardMaterial;
  pads(ctx, { base: 0x2a2220, worn: 0x4a3a32, edge: 0x6a4a38, rim: 0x1c1614, glow: 0xff8a30 });

  // Lava moat.
  const lava = lavaTex(kit, false);
  lava.repeat.set(9, 9);
  const lavaMat = kit.track(new THREE.MeshStandardMaterial({ map: lava, emissiveMap: lava, emissive: 0xffffff, emissiveIntensity: 0.85, color: 0xffffff, roughness: 0.5 }));
  const lavaGeo = kit.track(new THREE.PlaneGeometry(76, 76));
  lavaGeo.rotateX(-PI / 2);
  const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
  lavaMesh.position.y = -0.62;
  add(ctx, lavaMesh);

  // Far volcano cone with a glowing crater.
  const coneGeo = kit.track(new THREE.ConeGeometry(24, 17, 12, 1, true));
  const coneMat = kit.track(new THREE.MeshBasicMaterial({ color: 0x3a1a16 }));
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(8, 6.5, -50);
  const craterGeo = kit.track(new THREE.CircleGeometry(3.6, 16));
  craterGeo.rotateX(-PI / 2);
  const crater = new THREE.Mesh(craterGeo, kit.track(new THREE.MeshBasicMaterial({ color: 0xff8a34, toneMapped: false })));
  crater.position.set(8, 14.6, -50);
  add(ctx, cone, crater,
    ridge(kit, { radius: 26, a0: PI * 0.82, a1: PI * 2.18, baseY: 0, height: 6, rough: 1.4, seed: 53, color: 0x241210, top: 0x3a1c16, jag: 1 }),
    ridge(kit, { radius: 38, a0: PI * 0.8, a1: PI * 2.2, baseY: 0, height: 9, rough: 1.6, seed: 55, color: 0x4a2018, top: 0x6a2e20, jag: 1 }),
    ridge(kit, { radius: 56, a0: PI * 0.78, a1: PI * 2.22, baseY: -1, height: 14, rough: 1.3, seed: 57, color: 0x6a2c20, top: 0x92402a, jag: 0.8 }));

  add(ctx, instance(kit, spireGeo(0x2a2220, 0x4a3a34), propMat(kit), scatter(ctx, 11, { rMin: 11.5, rMax: 20, h: 5, seed: 121 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.3, ry: r() * 6 })), { cast: true, receive: true }));
  add(ctx, instance(kit, rockGeo(0x2e2622, 0x5a3a2c), propMat(kit), scatter(ctx, 26, { rMin: 9.2, rMax: 18, h: 1, seed: 122 }, (x, y, z, r) => ({ x, y, z, s: 0.6 + r() * 1.6, ry: r() * 6 })), { cast: true, receive: true }));
  // Glowing ember rocks.
  const emberRock = kit.track(new THREE.MeshStandardMaterial({ color: 0x2a1a14, emissive: 0xff5a14, emissiveIntensity: 1.2, flatShading: true, roughness: 0.8 }));
  add(ctx, instance(kit, new THREE.IcosahedronGeometry(0.22, 0), emberRock, scatter(ctx, 20, { rMin: 8.5, rMax: 12, h: 0.4, seed: 123, a0: PI * 0.75, a1: PI * 2.25 }, (x, y, z, r) => ({ x, y: y + 0.1, z, s: 0.6 + r() * 1.2, sy: 0.6, ry: r() * 6 }))));

  const l1 = new THREE.PointLight(0xff6a24, 16, 18, 2);
  l1.position.set(-8, 1.2, -9);
  const l2 = new THREE.PointLight(0xff7a30, 14, 18, 2);
  l2.position.set(9, 1.2, -10);
  add(ctx, l1, l2);
  ctx.tick.push((t) => {
    lava.offset.set(t * 0.01, -t * 0.015);
    l1.intensity = 16 + Math.sin(t * 3.1) * 3 + Math.sin(t * 7.3) * 1.5;
    l2.intensity = 14 + Math.sin(t * 2.7 + 1) * 3 + Math.sin(t * 6.1) * 1.5;
    groundMat.emissiveIntensity = 0.5 + Math.sin(t * 1.3) * 0.15;
    lavaMat.emissiveIntensity = 0.8 + Math.sin(t * 1.1) * 0.15;
  });

  motes(ctx, { count: 90, center: [0, 5, -4], extent: [34, 11, 28], color: 0xff8a30, size: 0.1, velocity: [0.1, 0.85, 0.05], wobble: 0.45, opacity: 0.85, seed: 20 });
  motes(ctx, { count: 40, center: [0, 5, -6], extent: [34, 12, 26], color: 0x3a3030, size: 0.34, velocity: [0.25, 0.3, 0.05], wobble: 0.6, opacity: 0.3, additive: false, seed: 21 });
  return { color: 0x6a2a1e, near: 14, far: 80 };
};

/* ------------------------------------------------------------------- ruins */

const ruins: Builder = (ctx) => {
  const { kit } = ctx;
  sky(ctx, [[0, 0xdfe4ea], [0.12, 0xc0c8d4], [0.5, 0x94a2ba], [1, 0x6c80a2]], 0x4a5a4a, { u: 0.78, v: 0.03, color: 0xfff0d0, size: 240 });
  terrain(ctx, {
    h: hillsHeight({ flat: 9.5, amp: 2.4, seed: 14 }),
    map: kit.noiseTex(256, 0x667058, 0x8a9078, 6, 61, (c, s, r) => {
      c.strokeStyle = 'rgba(30,34,28,0.55)';
      c.lineWidth = 2;
      for (let row = 0; row < 6; row++) {
        const y = (row * s) / 6;
        c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke();
        let x = r() * 30;
        while (x < s) {
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 3, y + s / 6); c.stroke();
          x += 28 + r() * 40;
        }
      }
      for (let i = 0; i < 40; i++) {
        c.fillStyle = `rgba(70,120,60,${0.15 + r() * 0.25})`;
        c.beginPath(); c.ellipse(r() * s, r() * s, 6 + r() * 14, 4 + r() * 8, r() * 3, 0, PI * 2); c.fill();
      }
    }),
    repeat: 7,
    tint: tintFn(0xffffff, 0xb0c4a0, 9.5, 0),
  });
  pads(ctx, { base: 0x7a7e72, worn: 0xa8ac9e, edge: 0xc8c8b8, rim: 0x5a5e54 });

  // Far colonnade silhouette.
  const colG = kit.track(new THREE.CylinderGeometry(0.6, 0.7, 1, 6));
  const colM = kit.track(new THREE.MeshBasicMaterial({ color: 0x8a96a8 }));
  const rr = rng(131);
  const cols: Inst[] = [];
  for (let i = 0; i < 16; i++) {
    const a = PI * 1.3 + (i / 15) * PI * 0.55;
    const h = 5 + rr() * 8;
    cols.push({ x: Math.cos(a) * 42, y: h / 2 - 0.5, z: Math.sin(a) * 42, sy: h, sx: 1 + rr() * 0.6, sz: 1 + rr() * 0.6 });
  }
  add(ctx, instance(kit, colG, colM, cols),
    ridge(kit, { radius: 26, a0: PI * 0.82, a1: PI * 2.18, baseY: 0, height: 4.5, rough: 1.1, seed: 63, color: 0x4a5e48, top: 0x5f7a5c }),
    ridge(kit, { radius: 36, a0: PI * 0.8, a1: PI * 2.2, baseY: 0, height: 8, rough: 1.5, seed: 65, color: 0x6a7a80, top: 0x8a9aa6, jag: 0.7 }),
    ridge(kit, { radius: 52, a0: PI * 0.78, a1: PI * 2.22, baseY: -1, height: 13, rough: 1.2, seed: 67, color: 0x8e9cb2, top: 0xb4c2d6, jag: 0.6 }));

  const stone = propMat(kit);
  const pil = (kind: 'tall' | 'mid' | 'stump', n: number, seed: number, rMin: number, rMax: number): THREE.InstancedMesh =>
    instance(kit, pillarGeo(kind), stone, scatter(ctx, n, { rMin, rMax, h: kind === 'tall' ? 4.2 : kind === 'mid' ? 2.6 : 1, seed }, (x, y, z, r) => ({ x, y, z, s: 0.9 + r() * 0.5, ry: r() * 6, rz: (r() - 0.5) * 0.06 })), { cast: true, receive: true });
  add(ctx, pil('tall', 7, 141, 11, 19), pil('mid', 7, 142, 10.5, 17), pil('stump', 10, 143, 9.5, 16));
  add(ctx, instance(kit, archGeo(), stone, scatter(ctx, 3, { rMin: 14, rMax: 20, h: 5, seed: 144, a0: PI * 1.1, a1: PI * 1.9 }, (x, y, z, _r, a) => ({ x, y, z, ry: Math.atan2(-Math.cos(a), -Math.sin(a)), s: 1.2 })), { cast: true, receive: true }));
  const colFall = kit.track(new THREE.CylinderGeometry(0.42, 0.46, 3, 8));
  add(ctx, instance(kit, colFall, kit.track(new THREE.MeshStandardMaterial({ color: 0x9a9c94, roughness: 1, flatShading: true })), scatter(ctx, 4, { rMin: 10, rMax: 15, h: 0.9, seed: 145 }, (x, y, z, r) => ({ x, y: y + 0.4, z, rz: PI / 2, ry: r() * 6 })), { cast: true, receive: true }));
  const blockG = kit.track(new THREE.BoxGeometry(1, 1, 1));
  const blockM = kit.track(new THREE.MeshStandardMaterial({ color: 0x8a8e86, roughness: 1, flatShading: true }));
  add(ctx, instance(kit, blockG, blockM, scatter(ctx, 22, { rMin: 9, rMax: 16, h: 0.9, seed: 146 }, (x, y, z, r) => { const s = 0.35 + r() * 0.6; return { x, y: y + s * 0.4, z, s, sx: 1 + r() * 0.8, ry: r() * 6, rx: (r() - 0.5) * 0.3, rz: (r() - 0.5) * 0.3 }; }), { cast: true, receive: true }));
  add(ctx, instance(kit, rockGeo(0x808680, 0x5c8a4c), stone, scatter(ctx, 18, { rMin: 9.5, rMax: 18, h: 1, seed: 147 }, (x, y, z, r) => ({ x, y, z, s: 0.5 + r() * 1.1, ry: r() * 6 })), { cast: true, receive: true }));
  // Ivy clumps and hanging creepers.
  const ivyM = sway(kit, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 0.25, 1.4);
  kit.track(ivyM);
  const ivyCols = [0x3f7a40, 0x4f9048, 0x346a38];
  const ivyList = spreadColors(scatter(ctx, 70, { rMin: 9.8, rMax: 19, h: 2.5, seed: 148 }, (x, y, z, r) => ({ x, y: y + 0.15 + r() * 1.6 * (r() > 0.6 ? 1 : 0), z, s: 0.5 + r() * 0.8, sy: 0.6 + r(), ry: r() * 6 })), ivyCols, 5);
  add(ctx, instance(kit, new THREE.IcosahedronGeometry(0.4, 1), ivyM, ivyList, { cast: true, tint: 0.1 }));

  shafts(ctx, [[-4, -12, 3, 14]], 0xfff0c8, 0.08);
  motes(ctx, { count: 60, center: [0, 3, -3], extent: [34, 7, 26], color: 0xf6e8c0, size: 0.1, velocity: [0.1, 0.03, 0.05], wobble: 0.5, opacity: 0.45, seed: 30 });
  motes(ctx, { count: 24, center: [0, 5, -4], extent: [30, 9, 24], color: 0x6a9a4a, size: 0.16, velocity: [0.18, -0.35, 0.05], wobble: 0.7, opacity: 0.6, additive: false, seed: 31 });
  return { color: 0xb0b9c6, near: 18, far: 90 };
};

/* -------------------------------------------------------------- cave / crystal */

interface CavePalette {
  skyTop: number;
  skyHorizon: number;
  fog: number;
  groundA: number;
  groundB: number;
  wallA: number;
  wallB: number;
  rock: number;
  tip: number;
  crystals: number[];
  light1: number;
  light2: number;
  pad: { base: number; worn: number; edge: number; rim: number; glow: number };
}

function caveBuilder(p: CavePalette): Builder {
  return (ctx) => {
    const { kit } = ctx;
    sky(ctx, [[0, p.skyHorizon], [0.15, p.skyHorizon], [0.6, p.skyTop], [1, p.skyTop]], p.skyTop);
    terrain(ctx, {
      h: hillsHeight({ flat: 9.5, amp: 5, seed: 17, side: 0.9 }),
      map: kit.noiseTex(256, p.groundA, p.groundB, 6, 71, (c, s, r) => {
        for (let i = 0; i < 160; i++) {
          c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)';
          c.beginPath(); c.ellipse(r() * s, r() * s, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, PI * 2); c.fill();
        }
      }),
      repeat: 7,
      roughness: 0.75,
      tint: tintFn(0xffffff, 0x7080a8, 9.5, 0),
    });
    pads(ctx, p.pad);

    add(ctx,
      ridge(kit, { radius: 24, a0: PI * 0.78, a1: PI * 2.22, baseY: 0, height: 11, rough: 1.8, seed: 73, color: p.wallA, top: p.wallB, jag: 1.4 }),
      ridge(kit, { radius: 36, a0: PI * 0.76, a1: PI * 2.24, baseY: 0, height: 14, rough: 1.4, seed: 75, color: mix(p.wallA, p.skyTop, 0.5).getHex(), top: mix(p.wallB, p.skyTop, 0.5).getHex(), jag: 1.2 }));

    const rockM = propMat(kit);
    add(ctx, instance(kit, stalagmiteGeo(p.rock, p.tip), rockM, scatter(ctx, 16, { rMin: 11, rMax: 19, h: 3, seed: 151 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.5, ry: r() * 6 })), { cast: true, receive: true }));
    // Stalactites hanging in the dark above the far wall.
    const hang = scatter(ctx, 26, { rMin: 15, rMax: 32, h: 3, seed: 152, free: true }, (x, _y, z, r) => ({ x, y: 10.6 + r() * 1.6, z, s: 1.1 + r() * 1.4, rx: PI, ry: r() * 6 }));
    add(ctx, instance(kit, stalagmiteGeo(p.rock, p.rock), rockM, hang));
    add(ctx, instance(kit, rockGeo(p.rock, p.tip), rockM, scatter(ctx, 22, { rMin: 9.2, rMax: 17, h: 1, seed: 153 }, (x, y, z, r) => ({ x, y, z, s: 0.5 + r() * 1.5, ry: r() * 6 })), { cast: true, receive: true }));

    // Glowing crystal clusters, one emissive material per colour.
    p.crystals.forEach((color, i) => {
      const mat = kit.track(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, roughness: 0.25, metalness: 0.1, flatShading: true, vertexColors: true }));
      const list = scatter(ctx, 9, { rMin: 10, rMax: 18, h: 2, seed: 160 + i }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.8, ry: r() * 6, color: 0xffffff }));
      add(ctx, instance(kit, crystalGeo(), mat, list, { cast: true }));
      ctx.tick.push((t) => { mat.emissiveIntensity = 1.2 + Math.sin(t * 1.4 + i * 2.1) * 0.35; });
    });
    // Shallow glowing pools.
    const poolGeo = kit.track(new THREE.CircleGeometry(1, 24));
    poolGeo.rotateX(-PI / 2);
    const poolMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x103050, emissive: p.crystals[0], emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.3 }));
    add(ctx, instance(kit, poolGeo, poolMat, scatter(ctx, 5, { rMin: 10, rMax: 15, h: 0.3, seed: 154 }, (x, y, z, r) => ({ x, y: y + 0.03, z, sx: 1 + r() * 1.4, sz: 0.8 + r() * 0.8, ry: r() * 6 })), { receive: true }));

    const l1 = new THREE.PointLight(p.light1, 12, 16, 2);
    l1.position.set(-9, 1.6, -6);
    const l2 = new THREE.PointLight(p.light2, 10, 16, 2);
    l2.position.set(10, 1.6, -9);
    add(ctx, l1, l2);
    ctx.tick.push((t) => { l1.intensity = 12 + Math.sin(t * 1.3) * 2; l2.intensity = 10 + Math.sin(t * 1.1 + 2) * 2; });

    motes(ctx, { count: 70, center: [0, 3, -4], extent: [32, 7, 26], color: p.crystals[0], size: 0.09, velocity: [0.04, 0.22, 0.03], wobble: 0.5, opacity: 0.8, seed: 40 });
    motes(ctx, { count: 22, center: [0, 1.4, -5], extent: [36, 1.5, 26], color: p.fog, size: 3.2, velocity: [0.35, 0, 0.1], wobble: 0.4, opacity: 0.17, additive: false, seed: 41 });
    return { color: p.fog, near: 9, far: 52 };
  };
}

const cave = caveBuilder({
  skyTop: 0x0a0f1c, skyHorizon: 0x1a2644, fog: 0x16203a, groundA: 0x262c3c, groundB: 0x3c4660, wallA: 0x10162a, wallB: 0x242e48,
  rock: 0x3a4256, tip: 0x5e6a8c, crystals: [0x4fd8ff, 0xa070ff, 0xff70c0], light1: 0x4fb8ff, light2: 0xa070ff,
  pad: { base: 0x2a3042, worn: 0x4a5670, edge: 0x7088b0, rim: 0x1c2232, glow: 0x4fd8ff },
});

const crystal = caveBuilder({
  skyTop: 0x1a1236, skyHorizon: 0x3a2a70, fog: 0x32286a, groundA: 0x32305a, groundB: 0x504a88, wallA: 0x201a46, wallB: 0x40368a,
  rock: 0x4a4478, tip: 0x8a80d0, crystals: [0xc080ff, 0x60e0ff, 0xff80d0], light1: 0xb080ff, light2: 0x60e0ff,
  pad: { base: 0x3a3664, worn: 0x5a5498, edge: 0x9a90e0, rim: 0x262248, glow: 0xc080ff },
});

/* ------------------------------------------------------------------ summit */

const summit: Builder = (ctx) => {
  const { kit } = ctx;
  sky(ctx, [[0, 0xffffff], [0.12, 0xe4f0ff], [0.5, 0xbcd8ff], [1, 0x6aa8f0]], 0xdceaff, { u: 0.74, v: 0.04, color: 0xfff8e0, size: 300 });
  const H = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const rim = fbm(x * 0.2, z * 0.2, 19, 3) * 1.1 * smoothstep(8.6, 10, r) * (1 - smoothstep(11, 12.4, r)) * smoothstep(5, -8, z);
    return rim - 9 * smoothstep(10.4, 13.6, r);
  };
  terrain(ctx, {
    h: H,
    map: kit.noiseTex(256, 0xeaf2fb, 0xc4d4e8, 5, 81, (c, s, r) => {
      for (let i = 0; i < 260; i++) {
        c.fillStyle = r() > 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(120,150,190,0.25)';
        c.fillRect(r() * s, r() * s, 1, 1 + r() * 1);
      }
      for (let i = 0; i < 12; i++) {
        c.fillStyle = 'rgba(120,130,150,0.3)';
        c.beginPath(); c.ellipse(r() * s, r() * s, 5 + r() * 10, 3 + r() * 5, r() * 3, 0, PI * 2); c.fill();
      }
    }),
    repeat: 7,
    roughness: 0.8,
    tint: (x, z, h, r) => new THREE.Color(h < -1 ? 0xaebccc : 0xffffff).multiplyScalar(0.92 + fbm(x * 0.2, z * 0.2, 3, 2) * 0.12 * ringTint(r, 9.5)),
  });
  pads(ctx, { base: 0xb8c6d8, worn: 0xe6eef8, edge: 0xffffff, rim: 0x8a9cb4 });

  // Cloud sea below the platform.
  const sea = new THREE.Mesh(kit.track(new THREE.CircleGeometry(80, 32)), kit.track(new THREE.MeshBasicMaterial({ color: 0xe4eefc })));
  sea.rotation.x = -PI / 2;
  sea.position.y = -3.6;
  const puffGeo = kit.track(new THREE.SphereGeometry(1, 10, 7));
  const puffMat = kit.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }));
  const rr = rng(171);
  const puffs: Inst[] = [];
  for (let i = 0; i < (ctx.reduced ? 40 : 90); i++) {
    const a = rr() * PI * 2;
    const rad = 12 + rr() * 38;
    const s = 2.2 + rr() * 4;
    puffs.push({ x: Math.cos(a) * rad, y: -3.4 + rr() * 2.4, z: Math.sin(a) * rad, sx: s * 1.5, sy: s * 0.5, sz: s, ry: rr() * 3 });
  }
  const puffMesh = instance(kit, puffGeo, puffMat, puffs, { tint: 0.04 });
  const cloudGroup = new THREE.Group();
  cloudGroup.add(sea, puffMesh);
  add(ctx, cloudGroup);
  ctx.tick.push((t) => { cloudGroup.rotation.y = t * 0.006; });

  add(ctx,
    ridge(kit, { radius: 34, a0: PI * 0.8, a1: PI * 2.2, baseY: -2, height: 11, rough: 1.4, seed: 83, color: 0x5a7496, top: 0xe4eeff, jag: 1.4 }),
    ridge(kit, { radius: 48, a0: PI * 0.78, a1: PI * 2.22, baseY: -3, height: 16, rough: 1.2, seed: 85, color: 0x7e98b8, top: 0xf0f6ff, jag: 1.1 }),
    ridge(kit, { radius: 62, a0: PI * 0.76, a1: PI * 2.24, baseY: -3, height: 19, rough: 1.0, seed: 87, color: 0xa4bad4, top: 0xfafcff, jag: 0.8 }));

  add(ctx, instance(kit, iceGeo(), kit.track(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.15, metalness: 0.1, emissive: 0x5aa8e0, emissiveIntensity: 0.3, transparent: true, opacity: 0.92 })), scatter(ctx, 14, { rMin: 9.4, rMax: 11.6, h: 2.4, seed: 181, a0: PI * 0.9, a1: PI * 2.1 }, (x, y, z, r) => ({ x, y, z, s: 0.8 + r() * 1.6, ry: r() * 6 })), { cast: true }));
  add(ctx, instance(kit, rockGeo(0x8a9cb4, 0xffffff), propMat(kit), scatter(ctx, 18, { rMin: 9, rMax: 12, h: 1, seed: 182 }, (x, y, z, r) => ({ x, y, z, s: 0.7 + r() * 1.6, ry: r() * 6 })), { cast: true, receive: true }));
  const drift = kit.track(new THREE.SphereGeometry(1, 10, 6));
  add(ctx, instance(kit, drift, kit.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })), scatter(ctx, 14, { rMin: 7.8, rMax: 10.2, h: 0.6, seed: 183, a0: PI * 0.7, a1: PI * 2.3 }, (x, y, z, r) => ({ x, y: y - 0.05, z, sx: 0.5 + r() * 0.9, sy: 0.2, sz: 0.5 + r() * 0.6, ry: r() * 6 })), { receive: true, tint: 0.03 }));
  const pineM = sway(kit, propMat(kit), 0.04, 1.0);
  add(ctx, instance(kit, pineGeo(0x6a8a9a, 0x8aa8b8), pineM, scatter(ctx, 8, { rMin: 9.8, rMax: 11.4, h: 4.5, seed: 184, a0: PI * 1.05, a1: PI * 1.95 }, (x, y, z, r) => ({ x, y, z, s: 0.7 + r() * 0.6, ry: r() * 6, color: 0xffffff })), { cast: true, receive: true }));

  motes(ctx, { count: 150, center: [0, 6, -3], extent: [36, 16, 28], color: 0xffffff, size: 0.09, velocity: [-0.35, -0.75, 0.1], wobble: 0.4, opacity: 0.85, additive: false, seed: 50 });
  motes(ctx, { count: 40, center: [0, 3, -3], extent: [30, 6, 24], color: 0xcfeaff, size: 0.12, velocity: [0.05, 0.05, 0.02], wobble: 0.6, opacity: 0.8, seed: 51 });
  return { color: 0xdceaff, near: 40, far: 170 };
};

/* --------------------------------------------------------------- entry point */

const BUILDERS: Record<string, Builder> = { meadow, forest, city, beach, volcano, ruins, cave, crystal, summit };

export function buildArena(biome: string, scene: THREE.Scene, kit: Kit, spots: PadSpot[], reduced: boolean): ArenaBuild {
  const builder = BUILDERS[biome] ?? meadow;
  const ctx: ArenaCtx = { kit, scene, reduced, pads: spots, tick: [], dot: kit.softDot(), H: () => 0 };
  const fog = builder(ctx);
  return {
    fog,
    tick: (t) => {
      kit.wind.value = t;
      for (const fn of ctx.tick) fn(t);
    },
  };
}
