import * as THREE from 'three';
import type { CreatureSpecies } from '../../../data/creatures';
import { Sculptor, V } from './sculptor';
import { brows, blush, crown, critterHead, earPair, eyes, group, isGrand, isLegend, legTo, mouth, ridge, rnd, tailFor } from './parts';
import type { Skin } from './parts';

/** Quadruped, starter and biped body plans. */

function whiskers(sc: Sculptor, head: THREE.Object3D, skin: Skin, r: number, z: number, y: number): void {
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      sc.tube(head, [V(s * r * 0.3, y - i * r * 0.1, z), V(s * r * 0.75, y + r * 0.04 - i * r * 0.2, z - r * 0.08), V(s * r * 1.2, y - r * 0.02 - i * r * 0.32, z - r * 0.24)], r * 0.018, skin.white, (t) => 1 - t * 0.7);
    }
  }
}

function arm(sc: Sculptor, parent: THREE.Object3D, skin: Skin, sd: number, x: number, y: number, len: number, r: number, hand: THREE.Material, claws: THREE.Material | null, splay = 0.26): THREE.Group {
  const g = group(parent, x, y, 0.02);
  g.rotation.z = -sd * splay;
  sc.seg(g, V(0, 0, 0), V(0, -len, 0.05), r * 1.15, r * 0.82, skin.primary);
  sc.ball(g, 0, -len - r * 0.4, 0.06, r * 1.45, hand, 1, 0.95, 1.1);
  if (claws) for (let i = -1; i <= 1; i++) sc.cone(g, i * r * 0.8, -len - r * 1.5, 0.1, r * 0.34, r * 1.3, claws, 0.25, 0);
  sc.arms.push(g);
  return g;
}

interface QuadStyle {
  horse: boolean;
  toad: boolean;
  fluff: boolean;
  lion: boolean;
  maw: boolean;
  shell: boolean;
  titan: boolean;
  otter: boolean;
}

export function buildQuadruped(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const id = sp.id;
  const el = sp.element;
  const grand = isGrand(sp);
  const st: QuadStyle = {
    horse: id === 'lumicorn',
    toad: id === 'facetoad',
    fluff: id === 'ampuff' || id === 'stormfleece',
    lion: id === 'solarion',
    maw: id === 'duskmaw',
    shell: id === 'thornshell',
    titan: id === 'grovetitan',
    otter: el === 'water',
  };
  const fierce = el === 'shadow' || (grand && el !== 'water' && el !== 'grass');
  const cute = !fierce && (sp.tier === 'basic' || sp.tier === 'stage2');
  const hip = st.horse ? 0.98 : st.toad ? 0.36 : st.otter ? 0.5 : st.lion ? 0.88 : grand ? 0.78 : 0.64;
  const len = st.horse ? 1.5 : st.otter ? 1.6 : st.toad ? 1.15 : st.lion ? 1.45 : 1.3 + rnd(id, 2) * 0.1;
  const rad = (grand ? 0.47 : 0.42) * (st.toad ? 1.12 : st.horse ? 0.84 : st.otter ? 0.8 : st.fluff ? 1.12 : st.shell || st.titan ? 1.05 : 1);
  const legR = (grand ? 0.115 : 0.1) * (st.horse ? 0.78 : 1) * (st.otter ? 0.88 : 1) * (st.toad ? 1.15 : 1);
  const zf = len * 0.3;
  const zb = -len * 0.32;
  const lx = 0.28 * (st.toad ? 1.3 : 1);
  for (const z of [zb, zf]) {
    for (const x of [-lx, lx]) {
      const leg = legTo(sc, s, x, z, hip, legR, skin.primary, skin.secondary, st.otter ? 5 : 3);
      leg.rotation.z = x > 0 ? -0.05 : 0.05;
      sc.legs.push(leg);
    }
  }
  const bodyY = hip + 0.16;
  sc.egg(s, 0, bodyY, -0.04, len, rad, skin.primary, st.toad ? 1.15 : 0.95, 0.88);
  sc.egg(s, 0, hip - 0.04, len * 0.08, len * 0.7, rad * 0.82, skin.secondary, 0.9, 0.62);
  for (const sd of [-1, 1]) sc.ball(s, sd * 0.3, hip + 0.12, zb + 0.1, rad * 0.62, skin.primary, 0.85, 1, 1);
  sc.ball(s, 0, hip + 0.12, zf + 0.14, 0.27, skin.secondary, 0.9, 0.9, 0.8);
  sc.ball(s, 0, hip + 0.36, zf + 0.2, 0.25, skin.primary);

  const hr = st.toad || st.maw ? 0.36 : st.horse ? 0.26 : grand ? 0.33 : 0.3;
  const hy = hip + (st.horse ? 0.98 : st.toad ? 0.36 : st.otter ? 0.42 : 0.52);
  const hz = len * (st.horse ? 0.52 : 0.36);
  const head = group(s, 0, hy, hz);
  sc.heads.push(head);
  if (st.horse) sc.seg(s, V(0, hip + 0.36, len * 0.28), V(0, hy - 0.05, hz - 0.02), 0.2, 0.15, skin.primary);
  const hd = group(head, 0, 0, 0);
  if (st.horse) hd.rotation.x = 0.5;
  critterHead(sc, hd, skin, sp, hr, {
    snout: st.horse ? 1.2 : st.maw ? 0.9 : 0.7,
    cute,
    fierce,
    glow: el === 'shadow',
    fangs: st.maw || (fierce && grand),
    ears: !(st.fluff || st.toad),
    wide: st.toad ? 1.3 : 1,
  });
  if (st.otter) whiskers(sc, hd, skin, hr, hr * 1.1, -hr * 0.2);
  if (!st.fluff && !st.lion && !st.horse) crown(sc, hd, skin, sp, hr, grand ? 0.9 : 0.7);

  if (st.toad) {
    for (const sd of [-1, 1]) sc.ball(hd, sd * hr * 0.6, hr * 0.5, hr * 0.5, hr * 0.34, skin.primary, 1, 0.9, 1);
    mouth(sc, hd, skin, -hr * 0.3, hr * 1.05, hr * 0.7);
    for (const sd of [-1, 1]) sc.gem(hd, sd * hr * 0.35, hr * 0.7, -hr * 0.3, hr * 0.14, hr * 0.8, skin.gem, [-0.2, 0, -sd * 0.3]);
  }
  if (st.maw) {
    sc.ball(hd, 0, -hr * 0.42, hr * 1.05, hr * 0.46, skin.dark, 1.15, 0.5, 0.8);
    for (let i = -2; i <= 2; i++) {
      sc.cone(hd, i * hr * 0.17, -hr * 0.28, hr * 1.2, hr * 0.06, hr * 0.28, skin.white, Math.PI, 0);
      sc.cone(hd, i * hr * 0.17, -hr * 0.56, hr * 1.2, hr * 0.06, hr * 0.24, skin.white, 0, 0);
    }
  }
  if (st.horse) {
    sc.gem(hd, 0, hr * 0.7, hr * 0.85, hr * 0.14, hr * 1.9, skin.gem, [1.1, 0, 0]);
    for (let i = 0; i < 7; i++) sc.gem(s, 0, hip + 0.9 - i * 0.07, len * 0.28 - i * 0.08 - 0.04, 0.055, 0.28, skin.gem, [-0.5 - i * 0.04, 0, 0]);
  }
  if (st.lion) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const h = hr * (i % 2 ? 1.1 : 1.6);
      sc.flame(head, Math.cos(a) * hr * 0.95, Math.sin(a) * hr * 0.95, -hr * 0.45, h, hr * 0.3, skin.flame, skin.fb, skin.ft, 0, [0, 0, a - Math.PI / 2]);
    }
    sc.ring(head, 0, 0, -hr * 0.6, hr * 2.15, hr * 0.045, skin.halo);
    sc.ring(head, 0, 0, -hr * 0.62, hr * 2.45, hr * 0.03, skin.halo);
    crown(sc, head, skin, sp, hr, 0.7);
  }
  if (st.fluff) {
    for (const sd of [-1, 1]) sc.ball(head, sd * hr * 0.85, hr * 0.15, -hr * 0.05, hr * 0.32, skin.secondary, 0.6, 1.2, 0.85, [0, 0, sd * 0.4]);
    for (let i = 0; i < 6; i++) sc.ball(head, (i - 2.5) * hr * 0.22, hr * 0.9, hr * 0.0, hr * 0.26, skin.secondary);
    if (id === 'stormfleece') {
      for (const sd of [-1, 1]) sc.tube(head, [V(sd * hr * 0.7, hr * 0.5, -hr * 0.1), V(sd * hr * 1.3, hr * 0.8, -hr * 0.1), V(sd * hr * 1.45, hr * 0.1, -hr * 0.05), V(sd * hr * 1.1, -hr * 0.1, hr * 0.1)], hr * 0.17, skin.accent, (t) => 1 - t * 0.6);
    } else {
      for (let i = -1; i <= 1; i += 2) sc.bolt(head, i * hr * 0.4, hr * 1.35, 0, hr * 0.8, hr * 0.5, skin.bolt, [0, 0, -i * 0.3]);
    }
    const puffs = id === 'stormfleece' ? 16 : 11;
    for (let i = 0; i < puffs; i++) {
      const a = i * 2.39996;
      const f = i / puffs;
      const pr = 0.2 + rnd(id, 10 + i) * 0.08;
      sc.ball(s, Math.sin(a) * rad * 0.9, bodyY + Math.abs(Math.cos(a)) * rad * 0.82, -len * 0.38 + f * len * 0.72, pr * (id === 'stormfleece' ? 1.15 : 1), skin.secondary);
    }
    for (let i = 0; i < 3; i++) sc.bolt(s, (i - 1) * 0.28, bodyY + rad + 0.22, -0.3 + i * 0.25, 0.3, 0.2, skin.bolt, [0, 0.4, (i - 1) * 0.3]);
  }
  if (st.shell) {
    sc.ball(s, 0, bodyY + rad * 0.62, -0.1, 0.58, skin.leafA, 1.0, 0.62, 1.15);
    sc.ball(s, 0, bodyY + rad * 0.7, -0.1, 0.46, skin.leafB, 1, 0.5, 1.05);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      sc.cone(s, Math.cos(a) * 0.46, bodyY + rad * 0.78 + Math.sin(a * 2) * 0.03, -0.1 + Math.sin(a) * 0.5, 0.075, 0.34, skin.bark, Math.sin(a) * 0.7, -Math.cos(a) * 0.7);
    }
    sc.ball(s, 0, bodyY + rad * 1.18, -0.1, 0.12, skin.accent);
  }
  if (st.titan) {
    sc.seg(s, V(0, bodyY + rad * 0.7, -0.15), V(0.04, bodyY + rad * 0.7 + 0.6, -0.2), 0.17, 0.11, skin.bark);
    const cy = bodyY + rad * 0.7 + 0.78;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sc.ball(s, Math.cos(a) * 0.28, cy + (i % 2) * 0.08, -0.2 + Math.sin(a) * 0.26, 0.26, i % 2 ? skin.leafA : skin.leafB);
    }
    sc.ball(s, 0.02, cy + 0.2, -0.2, 0.3, skin.leafB);
    for (let i = 0; i < 4; i++) sc.ball(s, Math.cos(i * 1.7) * 0.4, cy + 0.04 + Math.sin(i) * 0.1, -0.2 + Math.sin(i * 1.7) * 0.36, 0.06, skin.accent);
  }

  const tail = group(s, 0, hip + 0.3, zb - 0.06);
  sc.tails.push(tail);
  if (id === 'infernyx') {
    for (let i = 0; i < 5; i++) {
      const a = -0.8 + i * 0.4;
      const t = group(tail, 0, 0, 0);
      t.rotation.y = a * 0.6;
      sc.tails.push(t);
      sc.tube(t, [V(0, 0, 0), V(Math.sin(a) * 0.1, 0.3, -0.26), V(Math.sin(a) * 0.24, 0.62, -0.4)], 0.075, skin.primary, (u) => (1 - u * 0.6) * (0.8 + 0.5 * Math.sin(Math.PI * u)));
      sc.flame(t, Math.sin(a) * 0.24, 0.6, -0.4, 0.42, 0.1, skin.flame, skin.fb, skin.ft, -0.08, [-0.3, 0, 0]);
    }
  } else if (st.lion) {
    tailFor(sc, tail, skin, sp, 1.2, 0.1, 0.9);
    sc.flame(tail, 0, 0.45, -0.58, 0.6, 0.16, skin.flame, skin.fb, skin.ft, -0.1, [-0.4, 0, 0]);
  } else if (st.otter) {
    tailFor(sc, tail, skin, sp, 1.35, 0.115, 0.25);
  } else {
    tailFor(sc, tail, skin, sp, st.horse ? 1.5 : st.fluff ? 0.5 : 1, st.fluff ? 0.13 : 0.1, st.horse ? 0.4 : 1);
  }

  if (!st.fluff && !st.toad && (grand || sp.tier === 'stage2' || st.shell)) {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 5; i++) pts.push([0, bodyY + rad * 0.86 - Math.abs(i - 2) * 0.03, -len * 0.3 + i * len * 0.14]);
    if (!st.shell && !st.titan) ridge(sc, s, skin, sp, pts, grand ? 1.1 : 0.8);
  }
  if (st.toad) {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 5; i++) pts.push([(i - 2) * 0.14, bodyY + rad * 0.82, -0.2 + (i % 2) * 0.16]);
    ridge(sc, s, skin, sp, pts, 1.3);
  }
  if (grand && !st.lion && el !== 'shadow') {
    for (const sd of [-1, 1]) sc.cone(s, sd * (rad * 0.8), bodyY + 0.15, zf - 0.1, 0.07, 0.3, skin.accent, 0, -sd * 0.9);
  }
  if (el === 'shadow') {
    for (let i = 0; i < 3; i++) {
      sc.tube(s, [V(0.2 - i * 0.2, bodyY + rad * 0.8, -0.2 + i * 0.1), V(0.3 - i * 0.2, bodyY + rad * 1.3, -0.35 + i * 0.1), V(0.1 - i * 0.2, bodyY + rad * 1.9 - i * 0.1, -0.6 + i * 0.1)], 0.07, skin.wisp, (t) => 1 - t * 0.9);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Starters                                                            */
/* ------------------------------------------------------------------ */

export function buildEmberkit(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const cream = sc.toon(0xffe7c4, { rim: { color: 0xffd2a0, strength: 0.3 } });
  const rust = sc.toon(0x4a2a18);
  const hip = 0.32;
  for (const z of [-0.32, 0.32]) {
    for (const x of [-0.2, 0.2]) {
      const leg = legTo(sc, s, x, z, hip, 0.09, skin.primary, cream);
      leg.rotation.z = x > 0 ? -0.09 : 0.09;
      sc.legs.push(leg);
    }
  }
  sc.egg(s, 0, hip + 0.16, -0.02, 1.05, 0.42, skin.primary, 1.0, 0.9);
  sc.egg(s, 0, hip - 0.02, 0.14, 0.7, 0.34, cream, 0.9, 0.6);
  sc.ball(s, 0, hip + 0.1, -0.46, 0.28, skin.primary, 1, 0.9, 0.92);
  sc.ball(s, 0, hip + 0.24, 0.26, 0.2, cream, 1.1, 0.9, 0.9);
  const head = group(s, 0, hip + 0.5, 0.4);
  sc.heads.push(head);
  sc.ball(head, 0, 0.02, 0, 0.37, skin.primary, 1.04, 0.96, 1.02);
  sc.ball(head, 0, -0.06, 0.16, 0.28, cream, 1.08, 0.82, 0.78);
  sc.ball(head, 0, -0.08, 0.28, 0.2, cream, 0.98, 0.72, 0.86);
  sc.ball(head, 0, -0.04, 0.44, 0.07, rust, 1.1, 0.85, 0.85);
  mouth(sc, head, skin, -0.2, 0.4, 0.09);
  for (const sd of [-1, 1]) {
    sc.ball(head, sd * 0.26, -0.08, 0.14, 0.14, cream, 1, 0.9, 0.86);
    sc.ball(head, sd * 0.19, -0.1, 0.12, 0.055, rust, 1.3, 0.5, 0.2, [0, 0, 0]);
    sc.ball(head, sd * 0.06, 0.24, 0.3, 0.07, skin.primary, 1.15, 0.34, 0.55);
  }
  blush(sc, head, skin, 0.25, -0.05, 0.28, 0.07);
  eyes(sc, head, skin, 0.15, 0.06, 0.27, 0.11);
  const earMount = group(head, 0, 0.12, 0);
  earPair(sc, earMount, skin, sp, 0.37, 0.85);
  crown(sc, head, skin, sp, 0.37, 0.6);
  const tail = group(s, 0, hip + 0.22, -0.46);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0.04), V(0.1, 0.14, -0.1), V(-0.08, 0.32, -0.2), V(0.04, 0.5, -0.34)], 0.16, skin.primary, (t) => (1 - t * 0.32) * (0.9 + 0.5 * Math.sin(Math.PI * t)));
  sc.flame(tail, 0.02, 0.46, -0.32, 0.55, 0.14, skin.flame, skin.fb, skin.ft, -0.12, [-0.35, 0, 0]);
  sc.flame(tail, 0.12, 0.42, -0.28, 0.36, 0.09, skin.flame, skin.fb, skin.ft, 0.06, [-0.3, 0, -0.25]);
  sc.flame(tail, -0.1, 0.4, -0.28, 0.32, 0.08, skin.flame, skin.fb, skin.ft, -0.06, [-0.3, 0, 0.25]);
  sc.ball(tail, 0.02, 0.5, -0.32, 0.09, cream, 0.85, 1.2, 0.7);
}

export function buildDrizzlet(sc: Sculptor, _sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const cream = sc.toon(0xdff2ff, { rim: { color: 0xbfeaff, strength: 0.3 } });
  const fin = sc.gloss(0x1f7fbf, { roughness: 0.35, emissive: 0x2ea8ff, intensity: 0.25, rim: { color: 0x8fe3ff, strength: 0.4 } });
  const hip = 0.34;
  for (const z of [-0.4, 0.26]) {
    for (const x of [-0.22, 0.22]) {
      const leg = legTo(sc, s, x, z, hip, 0.075, skin.primary, cream, 4);
      leg.rotation.z = x > 0 ? -0.1 : 0.1;
      sc.legs.push(leg);
      sc.ball(leg, 0, -hip + 0.05, 0.12, 0.09, fin, 1.4, 0.24, 1.0);
    }
  }
  sc.egg(s, 0, hip + 0.1, -0.12, 1.3, 0.3, skin.primary, 1.15, 0.9, 0, 0.2);
  sc.egg(s, 0, hip - 0.02, 0.22, 0.7, 0.26, cream, 0.95, 0.6);
  sc.leaf(s, 0, hip + 0.3, -0.34, 0.5, 0.025, 0.14, fin, [0, 0, 1.05]);
  sc.leaf(s, 0, hip + 0.28, -0.1, 0.34, 0.025, 0.1, fin, [0, 0, 1.2]);
  for (const sd of [-1, 1]) {
    const f = group(s, sd * 0.32, hip + 0.02, -0.06);
    f.rotation.z = sd * 0.25;
    sc.leaf(f, 0, 0, -0.04, 0.34, 0.02, 0.15, fin, [1.5, 0, sd > 0 ? 0 : Math.PI], 'YXZ');
    sc.wings.push(f);
    sc.wingSide.push(sd);
    sc.wingBase.push(f.rotation.z);
  }
  const head = group(s, 0, hip + 0.34, 0.52);
  sc.heads.push(head);
  sc.ball(head, 0, 0.02, 0.02, 0.36, skin.primary, 1.08, 0.96, 1.06);
  sc.ball(head, 0, -0.08, 0.26, 0.2, cream, 1.02, 0.7, 0.86);
  sc.ball(head, 0, -0.04, 0.44, 0.055, skin.dark, 1.25, 0.85, 0.8);
  mouth(sc, head, skin, -0.16, 0.4, 0.1);
  for (const sd of [-1, 1]) sc.ball(head, sd * 0.22, -0.05, 0.18, 0.11, cream, 1, 0.88, 0.84);
  for (const sd of [-1, 1]) sc.ball(head, sd * 0.2, 0.36, -0.06, 0.1, skin.primary, 1.15, 0.7, 0.8);
  blush(sc, head, skin, 0.27, -0.03, 0.27, 0.07);
  eyes(sc, head, skin, 0.13, 0.05, 0.38, 0.105);
  whiskers(sc, head, skin, 0.3, 0.35, -0.04);
  for (const sd of [-1, 1]) sc.leaf(head, sd * 0.3, 0.2, 0.0, 0.34, 0.025, 0.1, fin, [0, 0, sd > 0 ? 0.5 : Math.PI - 0.5]);
  sc.leaf(head, 0, 0.32, -0.08, 0.3, 0.025, 0.08, fin, [0, 0, 1.2]);
  const tail = group(s, 0, hip + 0.08, -0.7);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0.04), V(0.06, -0.02, -0.14), V(-0.04, 0.06, -0.28), V(0, 0.16, -0.22)], 0.09, skin.primary, (t) => 0.95 - t * 0.3);
  sc.leaf(tail, 0, 0.2, -0.2, 0.3, 0.03, 0.1, fin, [0.5, 0, Math.PI / 2 + 0.3]);
  sc.leaf(tail, 0, 0.18, -0.22, 0.22, 0.03, 0.08, fin, [0.5, 0, Math.PI / 2 - 0.4]);
  sc.ball(s, 0.1, hip + 0.7, 0.9, 0.05, skin.halo);
}

export function buildSproutle(sc: Sculptor, _sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const hip = 0.36;
  for (const z of [-0.32, 0.34]) {
    for (const x of [-0.28, 0.28]) {
      const leg = legTo(sc, s, x, z, hip, 0.11, skin.primary, skin.secondary);
      leg.rotation.z = x > 0 ? -0.22 : 0.22;
      sc.legs.push(leg);
    }
  }
  sc.egg(s, 0, hip + 0.2, 0, 1.0, 0.42, skin.primary, 0.96, 0.72, 0, 0.2);
  sc.egg(s, 0, hip + 0.02, 0.2, 0.6, 0.3, skin.secondary, 0.9, 0.6);
  const shell = group(s, 0, hip + 0.34, -0.04);
  sc.tails.push(shell);
  sc.ball(shell, 0, 0.06, 0, 0.5, skin.leafA, 1, 0.5, 1.1);
  sc.ball(shell, 0, 0.14, 0, 0.4, skin.leafB, 1, 0.42, 1.05);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sc.leaf(shell, Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.32, 0.3, 0.025, 0.1, i % 2 ? skin.leafA : skin.leafB, [Math.PI / 2, -a, 0.15], 'YXZ');
  }
  const sprout = group(s, 0, hip + 0.58, -0.06);
  sc.tails.push(sprout);
  sc.tube(sprout, [V(0, 0, 0), V(0.02, 0.14, 0.02), V(-0.02, 0.26, 0.04)], 0.04, skin.bark, (t) => 1 - t * 0.35);
  for (const sd of [-1, 1]) {
    sc.leaf(sprout, 0, 0.27, 0.04, 0.4, 0.03, 0.14, skin.leafB, [0.1, 0, sd > 0 ? 0.55 : Math.PI - 0.55]);
    sc.leaf(sprout, 0, 0.27, 0.04, 0.2, 0.035, 0.08, skin.accent, [0.1, 0, sd > 0 ? 0.55 : Math.PI - 0.55]);
  }
  sc.ball(sprout, 0, 0.3, 0.04, 0.06, skin.accent);
  const head = group(s, 0, hip + 0.4, 0.46);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.3, skin.primary, 1.04, 0.96, 1.02);
  sc.ball(head, 0, -0.08, 0.2, 0.18, skin.secondary, 1, 0.74, 0.86);
  sc.ball(head, 0, -0.04, 0.36, 0.05, skin.dark, 1.2, 0.85, 0.8);
  mouth(sc, head, skin, -0.14, 0.32, 0.08);
  for (const sd of [-1, 1]) sc.ball(head, sd * 0.18, -0.04, 0.14, 0.09, skin.secondary, 1, 0.86, 0.86);
  blush(sc, head, skin, 0.22, -0.04, 0.22, 0.06);
  eyes(sc, head, skin, 0.1, 0.04, 0.3, 0.092);
  for (const sd of [-1, 1]) {
    sc.leaf(head, sd * 0.18, 0.2, -0.04, 0.34, 0.025, 0.1, skin.leafB, [0, 0, sd > 0 ? 0.3 : Math.PI - 0.3]);
  }
}

/* ------------------------------------------------------------------ */
/* Bipeds                                                              */
/* ------------------------------------------------------------------ */

function buildOtterBiped(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const grand = isGrand(sp);
  const hip = grand ? 0.78 : 0.66;
  for (const x of [-0.22, 0.22]) {
    const leg = legTo(sc, s, x, 0, hip, 0.12, skin.primary, skin.secondary, 5);
    leg.rotation.z = x > 0 ? -0.06 : 0.06;
    sc.legs.push(leg);
  }
  sc.lathe(s, [[0.0001, -0.5], [0.3, -0.45], [0.42, -0.2], [0.4, 0.1], [0.3, 0.38], [0.18, 0.5], [0.0001, 0.54]], skin.primary, 0, hip + 0.42, 0, { scale: [1, 1, 0.84] }, 20);
  sc.ball(s, 0, hip + 0.3, 0.2, 0.3, skin.secondary, 0.92, 1.0, 0.6);
  for (const x of [-0.46, 0.46]) {
    const sd = x > 0 ? 1 : -1;
    const a = arm(sc, s, skin, sd, x, hip + 0.66, 0.42, 0.09, skin.secondary, skin.dark);
    sc.leaf(a, 0, -0.2, -0.04, 0.3, 0.02, 0.1, skin.accent, [0, 0, -Math.PI / 2 + sd * 0.4]);
  }
  const head = group(s, 0, hip + 1.1, 0.02);
  sc.heads.push(head);
  critterHead(sc, head, skin, sp, 0.3, { snout: 0.66, cute: !grand, fierce: false });
  whiskers(sc, head, skin, 0.3, 0.34, -0.06);
  crown(sc, head, skin, sp, 0.3, 0.9);
  const tail = group(s, 0, hip + 0.1, -0.34);
  sc.tails.push(tail);
  tailFor(sc, tail, skin, sp, 1.3, 0.13, 0.15);
  sc.ring(s, 0, hip - 0.1, 0, 0.78, 0.035, skin.halo, Math.PI / 2, 0);
  sc.ring(s, 0, hip + 0.55, 0, 0.62, 0.025, skin.halo, Math.PI / 2, 0);
}

function buildShroomble(sc: Sculptor, _sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const hip = 0.36;
  for (const x of [-0.2, 0.2]) {
    const leg = legTo(sc, s, x, 0.02, hip, 0.12, skin.secondary, skin.secondary);
    sc.legs.push(leg);
  }
  sc.lathe(s, [[0.0001, -0.45], [0.3, -0.4], [0.42, -0.15], [0.38, 0.18], [0.3, 0.42], [0.0001, 0.48]], skin.secondary, 0, hip + 0.48, 0, { scale: [1, 1, 0.9] }, 20);
  for (const x of [-0.42, 0.42]) arm(sc, s, skin, x > 0 ? 1 : -1, x, hip + 0.55, 0.25, 0.08, skin.secondary, null, 0.5);
  const head = group(s, 0, hip + 0.96, 0.04);
  sc.heads.push(head);
  const r = 0.36;
  sc.ball(head, 0, 0, 0, r, skin.secondary, 1.05, 0.95, 1);
  blush(sc, head, skin, r * 0.62, -r * 0.2, r * 0.7, r * 0.17);
  eyes(sc, head, skin, r * 0.38, r * 0.05, r * 0.78, r * 0.3);
  sc.ball(head, 0, -r * 0.18, r * 0.98, r * 0.07, skin.dark, 1.2, 0.8, 0.8);
  mouth(sc, head, skin, -r * 0.45, r * 0.86, r * 0.25);
  const cap = group(head, 0, r * 0.42, -0.02);
  sc.lathe(cap, [[0.0001, 0.0], [0.7, 0.0], [0.78, 0.06], [0.72, 0.18], [0.55, 0.32], [0.3, 0.42], [0.0001, 0.46]], skin.primary, 0, 0, 0, { rot: [-0.1, 0, 0] }, 24);
  sc.lathe(cap, [[0.0001, -0.06], [0.3, -0.06], [0.66, -0.02]], skin.accent, 0, 0, 0, { rot: [-0.1, 0, 0] }, 24);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.2;
    const rr = 0.18 + (i % 3) * 0.12;
    sc.ball(cap, Math.cos(a) * rr, 0.46 - rr * 0.55, Math.sin(a) * rr, 0.1 + (i % 2) * 0.03, skin.white, 1, 0.4, 1);
  }
  sc.tube(cap, [V(0, 0.42, 0), V(0.04, 0.55, 0), V(0, 0.65, 0.02)], 0.03, skin.bark, (t) => 1 - t * 0.3);
  sc.leaf(cap, 0, 0.62, 0.02, 0.28, 0.02, 0.09, skin.leafB, [0, 0, 0.6]);
  for (let i = 0; i < 4; i++) sc.ball(s, Math.sin(i * 1.7) * 0.7, hip + 0.9 + (i % 2) * 0.35, Math.cos(i * 1.7) * 0.6, 0.04, skin.glow);
  const tail = group(s, 0, hip + 0.2, -0.3);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0), V(0, -0.05, -0.15), V(0, 0.03, -0.3)], 0.07, skin.secondary, (t) => 1 - t * 0.5);
}

function buildVinesnap(sc: Sculptor, _sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const hip = 0.5;
  for (const x of [-0.2, 0.2]) {
    const leg = legTo(sc, s, x, 0, hip, 0.1, skin.bark, skin.bark, 4);
    leg.rotation.z = x > 0 ? -0.2 : 0.2;
    sc.legs.push(leg);
  }
  sc.lathe(s, [[0.0001, -0.5], [0.26, -0.44], [0.34, -0.1], [0.28, 0.3], [0.2, 0.55], [0.0001, 0.6]], skin.primary, 0, hip + 0.52, 0, { scale: [1, 1, 0.9] }, 18);
  sc.ball(s, 0, hip + 0.4, 0.22, 0.24, skin.secondary, 0.8, 1.2, 0.5);
  for (const sd of [-1, 1]) {
    const g = group(s, sd * 0.34, hip + 0.8, 0);
    sc.arms.push(g);
    sc.tube(g, [V(0, 0, 0), V(sd * 0.2, -0.2, 0.08), V(sd * 0.1, -0.45, 0.2), V(sd * 0.22, -0.6, 0.34)], 0.07, skin.leafA, (t) => 1 - t * 0.5);
    sc.leaf(g, sd * 0.22, -0.6, 0.34, 0.3, 0.02, 0.09, skin.leafB, [0.4, 0, sd > 0 ? -1.0 : Math.PI + 1.0]);
  }
  const head = group(s, 0, hip + 1.2, 0.1);
  sc.heads.push(head);
  sc.ball(head, 0, 0.0, 0.0, 0.18, skin.primary);
  const up = group(head, 0, 0.04, 0);
  up.rotation.x = -0.35;
  sc.ball(up, 0, 0.14, 0.12, 0.42, skin.primary, 1.12, 0.52, 1.0);
  const lo = group(head, 0, -0.04, 0);
  lo.rotation.x = 0.28;
  sc.ball(lo, 0, -0.1, 0.12, 0.38, skin.secondary, 1.08, 0.46, 0.95);
  sc.ball(head, 0, 0.0, 0.2, 0.34, skin.accent, 1.05, 0.5, 0.8);
  for (let i = -3; i <= 3; i++) {
    const zz = 0.12 + 0.34 * Math.cos((i / 3) * 1.2);
    const xx = 0.36 * Math.sin((i / 3) * 1.2);
    sc.cone(up, xx, 0.02, zz, 0.045, 0.18, skin.white, Math.PI, 0);
    sc.cone(lo, xx, 0.02, zz, 0.04, 0.15, skin.white, 0, 0);
  }
  for (const sd of [-1, 1]) {
    sc.tube(up, [V(sd * 0.2, 0.32, 0.2), V(sd * 0.24, 0.5, 0.2)], 0.035, skin.leafA, () => 1);
    sc.leaf(up, sd * 0.26, 0.4, 0.3, 0.3, 0.02, 0.08, skin.leafB, [0, 0, sd > 0 ? 0.4 : Math.PI - 0.4]);
  }
  eyes(sc, up, skin, 0.2, 0.24, 0.42, 0.13);
  brows(sc, up, skin, 0.2, 0.42, 0.45, 0.1, 0.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    sc.leaf(head, Math.cos(a) * 0.1, -0.25, Math.sin(a) * 0.1, 0.34, 0.02, 0.1, i % 2 ? skin.leafA : skin.leafB, [Math.PI / 2 + 0.6, -a, 0], 'YXZ');
  }
  const tail = group(s, 0, hip + 0.1, -0.3);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0), V(0, -0.1, -0.2), V(0.1, 0, -0.4)], 0.06, skin.leafA, (t) => 1 - t * 0.5);
  sc.leaf(tail, 0.1, 0, -0.4, 0.3, 0.02, 0.09, skin.leafB, [0.3, 0, 0.3]);
}

function buildCloaked(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const big = sp.tier === 'stage3';
  const k = big ? 1.3 : 1;
  const hem = 0.14;
  for (const x of [-0.14, 0.14]) {
    const leg = legTo(sc, s, x * k, 0.05, 0.28, 0.07, skin.dark, skin.dark, 3);
    sc.legs.push(leg);
  }
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = hem + t * 1.2 * k;
    const r = (0.2 + 0.42 * Math.pow(1 - t, 1.5) + Math.sin(t * Math.PI) * 0.1) * k;
    pts.push([i === 12 ? 0.0001 : r, y]);
  }
  sc.lathe(s, pts, skin.primary, 0, 0, 0, { scale: [1, 1, 0.9] }, 22);
  sc.lathe(s, [[0.0001, hem + 0.2], [0.3 * k, hem + 0.2], [0.2 * k, hem + 0.7 * k], [0.0001, hem + 0.7 * k]], skin.secondary, 0, 0.0, 0.14, { scale: [0.6, 1, 0.5] }, 14);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    sc.cone(s, Math.cos(a) * 0.5 * k, hem, Math.sin(a) * 0.45 * k, 0.1 * k, 0.28 * k, skin.primary, Math.PI, 0);
    sc.cone(s, Math.cos(a + 0.35) * 0.62 * k, hem + 0.05, Math.sin(a + 0.35) * 0.55 * k, 0.04 * k, 0.4 * k, skin.wisp, Math.PI, 0);
  }
  for (const sd of [-1, 1]) {
    const g = group(s, sd * 0.44 * k, 1.0 * k, 0.04);
    g.rotation.z = -sd * 0.4;
    sc.arms.push(g);
    sc.seg(g, V(0, 0, 0), V(0, -0.5 * k, 0.1), 0.12 * k, 0.07 * k, skin.primary);
    sc.ball(g, 0, -0.55 * k, 0.12, 0.09 * k, skin.dark);
    for (let i = -1; i <= 1; i++) sc.cone(g, i * 0.05, -0.68 * k, 0.16, 0.025 * k, 0.2 * k, skin.accent, 0.3, i * 0.2);
    if (big) sc.cone(g, 0, 0.1, 0, 0.1, 0.4, skin.accent, 0, -sd * 0.9);
  }
  const head = group(s, 0, 1.45 * k, 0.04);
  sc.heads.push(head);
  const r = 0.32 * k;
  sc.ball(head, 0, 0, 0, r, skin.primary, 1.05, 1.0, 1.0);
  sc.cone(head, 0, r * 0.7, -r * 0.5, r * 0.55, r * 1.4, skin.primary, -1.2, 0);
  sc.ball(head, 0, -0.02 * k, r * 0.35, r * 0.78, skin.dark, 0.95, 0.9, 0.7);
  eyes(sc, head, skin, r * 0.34, r * 0.04, r * 0.8, r * 0.26, true);
  brows(sc, head, skin, r * 0.34, r * 0.42, r * 0.9, r * 0.2, 0.45);
  mouth(sc, head, skin, -r * 0.4, r * 0.88, r * 0.22, true);
  earPair(sc, head, skin, sp, r, big ? 1.1 : 0.8);
  crown(sc, head, skin, sp, r, big ? 0.9 : 0.6);
  for (let i = 0; i < 3; i++) {
    const t = group(s, (i - 1) * 0.3, 0.7, -0.4);
    sc.tails.push(t);
    sc.tube(t, [V(0, 0, 0), V((i - 1) * 0.14, 0.2, -0.3), V((i - 1) * 0.3, -0.1, -0.6)], 0.09, skin.wisp, (u) => 1 - u * 0.9);
  }
  for (let i = 0; i < 4; i++) sc.ball(s, Math.sin(i * 1.9) * 0.8 * k, 0.5 + (i % 2) * 0.8, Math.cos(i * 1.9) * 0.5, 0.06, skin.wisp);
}

function buildMantis(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const hip = 0.7;
  for (const x of [-0.2, 0.2]) {
    const leg = legTo(sc, s, x, -0.15, hip, 0.065, skin.secondary, skin.accent, 2);
    leg.rotation.z = x > 0 ? -0.25 : 0.25;
    sc.legs.push(leg);
    const leg2 = legTo(sc, s, x * 1.1, 0.18, hip - 0.05, 0.055, skin.secondary, skin.accent, 2);
    leg2.rotation.z = x > 0 ? -0.3 : 0.3;
    sc.legs.push(leg2);
  }
  sc.egg(s, 0, hip + 0.3, 0.0, 1.0, 0.24, skin.primary, 1, 1, -0.0, 0.1);
  sc.egg(s, 0, hip + 0.04, -0.34, 0.9, 0.23, skin.secondary, 1, 0.9, 0.5);
  sc.ball(s, 0, hip + 0.55, 0.0, 0.2, skin.primary, 1.1, 1.0, 0.9);
  sc.ball(s, 0, hip + 0.4, 0.15, 0.18, skin.secondary, 0.9, 1.1, 0.6);
  for (let i = 0; i < 5; i++) sc.gem(s, 0, hip + 0.45 - i * 0.02, -0.4 + i * 0.16 - 0.12, 0.05, 0.28, skin.gem, [-0.3, 0, 0]);
  for (const sd of [-1, 1]) {
    const g = group(s, sd * 0.3, hip + 0.62, 0.05);
    sc.arms.push(g);
    sc.seg(g, V(0, 0, 0), V(sd * 0.1, 0.08, 0.34), 0.07, 0.055, skin.primary);
    sc.seg(g, V(sd * 0.1, 0.08, 0.34), V(sd * 0.12, -0.12, 0.5), 0.055, 0.05, skin.primary);
    sc.gem(g, sd * 0.12, 0.0, 0.5, 0.07, 0.8, skin.gem, [Math.PI - 0.5, 0, 0]);
    sc.gem(g, sd * 0.12, -0.05, 0.6, 0.04, 0.4, skin.gem, [Math.PI - 0.5, 0, sd * 0.2]);
  }
  const head = group(s, 0, hip + 0.88, 0.1);
  sc.heads.push(head);
  const r = 0.2;
  sc.ball(head, 0, 0, 0, r, skin.primary, 1.2, 0.9, 1);
  sc.ball(head, 0, -r * 0.5, r * 0.4, r * 0.55, skin.secondary, 0.9, 0.9, 0.8);
  eyes(sc, head, skin, r * 0.62, r * 0.18, r * 0.62, r * 0.42);
  mouth(sc, head, skin, -r * 0.55, r * 0.8, r * 0.3);
  for (const sd of [-1, 1]) {
    sc.tube(head, [V(sd * r * 0.3, r * 0.8, r * 0.2), V(sd * r * 0.9, r * 2.0, r * 0.3), V(sd * r * 1.6, r * 2.6, r * 0.5)], r * 0.07, skin.secondary, (t) => 1 - t * 0.5);
    sc.gem(head, sd * r * 1.6, r * 2.6, r * 0.5, r * 0.16, r * 0.7, skin.gem, [0.5, 0, -sd * 0.9]);
  }
  crown(sc, head, skin, sp, r, 0.8);
  for (const sd of [-1, 1]) {
    const w = group(s, sd * 0.1, hip + 0.7, -0.15);
    w.rotation.z = sd * 0.5;
    sc.leaf(w, 0, 0, 0, 0.8, 0.012, 0.16, skin.gem, [0, 0, sd > 0 ? 0.0 : Math.PI]);
    sc.leaf(w, 0, 0, 0, 0.55, 0.015, 0.1, skin.accent, [0, 0.0, sd > 0 ? -0.35 : Math.PI + 0.35]);
    sc.wings.push(w);
    sc.wingSide.push(sd);
    sc.wingBase.push(w.rotation.z);
  }
  const tail = group(s, 0, hip + 0.0, -0.74);
  sc.tails.push(tail);
  sc.gem(tail, 0, 0, 0, 0.09, 0.4, skin.gem, [-1.9, 0, 0]);
}

export function buildBiped(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  if (sp.id === 'shroomble') buildShroomble(sc, sp, skin);
  else if (sp.id === 'vinesnap') buildVinesnap(sc, sp, skin);
  else if (sp.id === 'shadeling' || sp.id === 'umbrawraith') buildCloaked(sc, sp, skin);
  else if (sp.id === 'prismantis') buildMantis(sc, sp, skin);
  else buildOtterBiped(sc, sp, skin);
}

export { isLegend };
