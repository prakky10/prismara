import * as THREE from 'three';
import type { CreatureSpecies } from '../../../data/creatures';
import { Sculptor, V } from './sculptor';
import type { V3 } from './sculptor';
import { blush, brows, crown, critterHead, earPair, eyes, group, isGrand, isLegend, legTo, mouth, ridge, tailFor } from './parts';
import type { Skin } from './parts';

/** Bird, serpent, floater, bug, mole, crustacean and moth body plans. */

const UP = new THREE.Vector3(0, 1, 0);

function alignY(dir: THREE.Vector3): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

function addWing(sc: Sculptor, w: THREE.Group, sd: number, baseZ: number): void {
  w.rotation.z = baseZ;
  sc.wings.push(w);
  sc.wingSide.push(sd);
  sc.wingBase.push(baseZ);
}

/* ------------------------------------------------------------------ */
/* Birds                                                               */
/* ------------------------------------------------------------------ */

export function buildBird(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const id = sp.id;
  const el = sp.element;
  const legend = isLegend(sp);
  const k = legend ? 1.25 : 1;
  const owl = id === 'nightfang';
  for (const x of [-0.14, 0.14]) {
    const leg = legTo(sc, s, x * k, 0.02, 0.54 * k, 0.05 * k, skin.accent, skin.accent, 3);
    sc.legs.push(leg);
  }
  sc.egg(s, 0, 0.84 * k, 0.0, 1.05 * k, 0.34 * k, skin.primary, 1, 1.05, -0.3, 0.3);
  sc.ball(s, 0, 0.8 * k, 0.2 * k, 0.27 * k, skin.secondary, 0.95, 1.1, 0.8);
  sc.ball(s, 0, 1.02 * k, 0.14 * k, 0.2 * k, skin.primary);
  const head = group(s, 0, 1.2 * k, 0.2 * k);
  sc.heads.push(head);
  const r = 0.25 * k;
  sc.ball(head, 0, 0, 0, r, skin.primary, 1.02, 1, 1);
  sc.ball(head, 0, r * 0.2, -r * 0.1, r * 0.9, skin.primary, 1, 0.85, 0.95);
  if (owl) {
    for (const sd of [-1, 1]) sc.ball(head, sd * r * 0.5, r * 0.08, r * 0.62, r * 0.55, skin.secondary, 1, 1, 0.35);
  } else {
    blush(sc, head, skin, r * 0.62, -r * 0.2, r * 0.6, r * 0.14);
  }
  sc.cone(head, 0, -r * 0.1, r * 1.05, r * 0.3, r * (owl ? 0.5 : 0.8), skin.accent, Math.PI / 2, 0);
  sc.cone(head, 0, -r * 0.34, r * 1.0, r * 0.22, r * 0.5, skin.secondary, Math.PI / 2, 0);
  if (owl) sc.cone(head, 0, -r * 0.3, r * 1.35, r * 0.1, r * 0.3, skin.accent, Math.PI / 2 + 0.7, 0);
  eyes(sc, head, skin, r * 0.5, r * 0.12, r * 0.68, r * (owl ? 0.34 : 0.38), el === 'shadow');
  if (owl) brows(sc, head, skin, r * 0.5, r * 0.55, r * 0.86, r * 0.24, 0.35);
  if (owl) {
    for (const sd of [-1, 1]) {
      sc.leaf(head, sd * r * 0.5, r * 0.8, -r * 0.1, r * 1.5, r * 0.08, r * 0.3, skin.primary, [0, 0, sd > 0 ? 1.2 : Math.PI - 1.2]);
      sc.leaf(head, sd * r * 0.5, r * 0.8, -r * 0.05, r * 0.9, r * 0.09, r * 0.18, skin.accent, [0, 0, sd > 0 ? 1.2 : Math.PI - 1.2]);
    }
  } else {
    crown(sc, head, skin, sp, r, 0.9);
  }
  if (legend) {
    sc.ring(head, 0, r * 0.1, -r * 0.9, r * 2.3, r * 0.05, skin.halo);
    sc.ring(head, 0, r * 0.1, -r * 0.92, r * 2.0, r * 0.03, skin.halo);
  }
  const featherMat = (i: number): THREE.Material => (el === 'crystal' ? (i % 2 ? skin.gem : skin.secondary) : i % 2 ? skin.primary : skin.secondary);
  for (const sd of [-1, 1]) {
    const w = group(s, sd * 0.26 * k, 0.9 * k, -0.02);
    addWing(sc, w, sd, sd * 0.18);
    const n = legend ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const a = 0.08 + i * 0.17;
      const len = (0.5 + 0.38 * Math.sin((0.25 + (i / (n - 1)) * 0.7) * Math.PI * 0.8)) * k;
      const rot: V3 = [Math.PI / 2, sd > 0 ? a : Math.PI - a, 0];
      sc.leaf(w, 0, i * 0.004, 0, len, 0.012, 0.085 * k, featherMat(i), rot, 'YXZ');
    }
    sc.ball(w, sd * 0.2 * k, 0.02, -0.05 * k, 0.26 * k, skin.primary, 1.1, 0.28, 0.75);
    sc.ball(w, sd * 0.42 * k, 0.0, -0.09 * k, 0.16 * k, skin.accent, 1.2, 0.22, 0.6);
    if (el === 'fire') for (let i = 0; i < 3; i++) sc.flame(w, sd * (0.55 + i * 0.12) * k, 0.03, -0.12 - i * 0.12, 0.3 * k, 0.05 * k, skin.flame, skin.fb, skin.ft, 0, [0, 0, -sd * 1.3]);
  }
  const tail = group(s, 0, 0.78 * k, -0.4 * k);
  sc.tails.push(tail);
  const fan = group(tail, 0, 0, 0);
  fan.rotation.x = -0.3;
  const tn = legend ? 7 : 5;
  for (let i = 0; i < tn; i++) {
    const phi = ((i - (tn - 1) / 2) / ((tn - 1) / 2)) * 0.55;
    const len = (0.6 - Math.abs(phi) * 0.4 + (el === 'fire' ? 0.2 : 0)) * k;
    if (el === 'fire') {
      sc.flame(fan, 0, 0, 0, len * 0.9, 0.08 * k, skin.flame, skin.fb, skin.ft, 0, [-Math.PI / 2 - 0.25, 0, phi]);
    } else sc.leaf(fan, 0, 0, 0, len, 0.012, 0.09 * k, featherMat(i), [Math.PI / 2, Math.PI / 2, phi], 'YXZ');
  }
  if (legend) {
    for (let i = 0; i < 3; i++) {
      sc.tube(tail, [V(0, 0, 0), V((i - 1) * 0.2, 0.05, -0.5), V((i - 1) * 0.35, -0.05, -1.0)], 0.04, skin.wisp, (t) => 1 - t * 0.8);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Serpents                                                            */
/* ------------------------------------------------------------------ */

export function buildSerpent(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const id = sp.id;
  const el = sp.element;
  const legend = isLegend(sp);
  const big = isGrand(sp);
  const pk = legend ? 1.15 : 1;
  const R = (legend ? 0.3 : big ? 0.27 : 0.21) * (id === 'coralisk' ? 1.05 : 1);
  const base: Array<[number, number, number]> = [
    [0, 0.3, -1.1],
    [0.18, 0.3, -0.75],
    [-0.14, 0.38, -0.36],
    [0.06, 0.55, -0.02],
    [0, 0.82, 0.22],
    [0, 1.1, 0.36],
    [0, 1.28, 0.44],
  ];
  const path = base.map(([x, y, z]) => V(x * pk, y * pk, z * pk));
  const taper = (t: number): number => 0.2 + 0.88 * Math.pow(Math.sin(Math.min(1, t * 1.12) * Math.PI * 0.5), 0.75);
  sc.tube(s, path, R, skin.primary, taper);
  const curve = new THREE.CatmullRomCurve3(path);
  for (let i = 0; i < 8; i++) {
    const t = 0.3 + i * 0.09;
    const p = curve.getPointAt(t);
    const rr = R * taper(t);
    sc.ball(s, p.x, p.y - rr * 0.55, p.z, rr * 0.62, skin.secondary, 0.75, 0.5, 1.2);
  }
  const ridgePts: Array<[number, number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const t = 0.18 + i * 0.1;
    const p = curve.getPointAt(t);
    ridgePts.push([p.x, p.y + R * taper(t) * 0.92, p.z]);
  }
  if (id === 'coralisk') {
    ridgePts.forEach(([x, y, z], i) => {
      const bk = 0.8 + (i % 3) * 0.25;
      sc.seg(s, V(x, y - 0.02, z), V(x + 0.06, y + 0.2 * bk, z), 0.045, 0.03, skin.accent);
      sc.seg(s, V(x + 0.06, y + 0.2 * bk, z), V(x + 0.16, y + 0.34 * bk, z), 0.03, 0.02, skin.accent);
      sc.seg(s, V(x + 0.06, y + 0.2 * bk, z), V(x - 0.06, y + 0.38 * bk, z), 0.03, 0.02, skin.accent);
      sc.ball(s, x + 0.16, y + 0.34 * bk, z, 0.04, skin.glow);
      sc.ball(s, x - 0.06, y + 0.38 * bk, z, 0.04, skin.glow);
    });
  } else ridge(sc, s, skin, sp, ridgePts, legend ? 1.4 : 1.1);

  const hp = path[path.length - 1];
  const head = group(s, hp.x, hp.y + 0.1 * pk, hp.z + 0.06);
  sc.heads.push(head);
  const hr = 0.26 * pk;
  const hd = group(head, 0, 0, 0);
  sc.ball(hd, 0, 0, 0, hr, skin.primary, 1.05, 0.9, 1.15);
  sc.ball(hd, 0, -hr * 0.2, hr * 0.9, hr * 0.6, skin.primary, 0.9, 0.7, 1.0);
  sc.ball(hd, 0, -hr * 0.55, hr * 0.8, hr * 0.55, skin.secondary, 0.85, 0.45, 1.05);
  for (const sd of [-1, 1]) sc.ball(hd, sd * hr * 0.2, -hr * 0.05, hr * 1.5, hr * 0.07, skin.dark, 1, 1, 0.8);
  mouth(sc, hd, skin, -hr * 0.4, hr * 1.1, hr * 0.45, big);
  const fierce = el === 'shadow' || big;
  eyes(sc, hd, skin, hr * 0.5, hr * 0.28, hr * 0.62, hr * 0.36, el === 'shadow');
  if (fierce) brows(sc, hd, skin, hr * 0.5, hr * 0.68, hr * 0.7, hr * 0.26, 0.4);
  else blush(sc, hd, skin, hr * 0.7, -hr * 0.05, hr * 0.5, hr * 0.14);
  earPair(sc, hd, skin, sp, hr, 1.05);
  crown(sc, hd, skin, sp, hr, 0.7);

  const tp = path[0];
  const tail = group(s, tp.x, tp.y, tp.z);
  sc.tails.push(tail);
  if (id === 'coralisk') {
    for (let i = 0; i < 5; i++) sc.leaf(tail, 0, 0, -0.04, 0.5 - Math.abs(i - 2) * 0.08, 0.02, 0.1, i % 2 ? skin.accent : skin.secondary, [Math.PI / 2, Math.PI / 2, (i - 2) * 0.35], 'YXZ');
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.1 + (i / 6) * Math.PI * 1.2;
      sc.leaf(head, 0, 0, -hr * 0.4, hr * 1.5, 0.02, hr * 0.28, i % 2 ? skin.accent : skin.secondary, [0, 0, a]);
    }
  } else if (id === 'thundrake') {
    sc.bolt(tail, 0, 0.02, -0.28, 0.7, 0.5, skin.bolt, [1.3, 0, 0]);
    sc.bolt(tail, 0, 0.02, -0.5, 0.45, 0.35, skin.bolt, [1.3, 0, 0.3]);
    for (const sd of [-1, 1]) {
      const w = group(s, sd * 0.14, 0.88 * pk, 0.1);
      addWing(sc, w, sd, sd * 0.5);
      sc.bolt(w, sd * 0.4, 0.15, -0.05, 0.85, 0.7, skin.bolt, [0, 0, -sd * 0.7], 0.04);
      sc.leaf(w, 0, 0, 0, 0.7, 0.015, 0.14, skin.accent, [0, 0, sd > 0 ? 0.5 : Math.PI - 0.5]);
      const leg = legTo(sc, s, sd * 0.22, 0.12, 0.58, 0.075, skin.primary, skin.accent, 3);
      sc.legs.push(leg);
    }
    for (const sd of [-1, 1]) {
      sc.tube(hd, [V(sd * hr * 0.3, -hr * 0.2, hr * 1.2), V(sd * hr * 1.0, -hr * 0.1, hr * 1.1), V(sd * hr * 1.6, -hr * 0.5, hr * 0.6), V(sd * hr * 2.0, -hr * 0.4, hr * 0.1)], hr * 0.05, skin.bolt, (t) => 1 - t * 0.6);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      sc.tube(tail, [V(0, 0, 0), V((i - 1) * 0.12, 0.1, -0.3), V((i - 1) * 0.3, -0.02 + i * 0.05, -0.6)], 0.08, skin.wisp, (t) => 1 - t * 0.85);
    }
    // eclipse disc behind the head
    sc.ball(head, 0, hr * 0.2, -hr * 1.6, hr * 2.1, skin.dark, 1, 1, 0.12);
    sc.put(head, new THREE.TorusGeometry(hr * 2.15, hr * 0.14, 8, 40), skin.halo, 0, hr * 0.2, -hr * 1.5);
    sc.put(head, new THREE.TorusGeometry(hr * 2.6, hr * 0.04, 6, 40, Math.PI * 1.4), skin.halo, 0, hr * 0.2, -hr * 1.4, { rot: [0, 0, 0.5] });
    for (let i = 0; i < 6; i++) {
      const p = curve.getPointAt(0.35 + i * 0.1);
      sc.ball(s, p.x, p.y + R * 0.7, p.z + 0.02, 0.045, skin.eyeGlow);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Floaters                                                            */
/* ------------------------------------------------------------------ */

function floaterFace(sc: Sculptor, parent: THREE.Object3D, skin: Skin, r: number, y: number, o: { glow?: boolean; fierce?: boolean; cute?: boolean; er?: number }): void {
  const er = o.er ?? r * 0.3;
  eyes(sc, parent, skin, r * 0.4, y + r * 0.1, r * 0.76, er, o.glow === true);
  if (o.fierce) brows(sc, parent, skin, r * 0.4, y + r * 0.1 + er * 1.15, r * 0.82, er * 0.75, 0.45);
  if (o.cute) blush(sc, parent, skin, r * 0.66, y - r * 0.12, r * 0.64, r * 0.12);
  mouth(sc, parent, skin, y - r * 0.28, r * 0.93, r * 0.2, o.fierce === true);
}

export function buildFloater(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const id = sp.id;
  const cy = 0.98;
  if (id === 'bubbloon') {
    const r = 0.46;
    sc.ball(s, 0, cy, 0, r, skin.primary, 1, 1.02, 1);
    sc.ball(s, 0, cy - r * 0.5, r * 0.18, r * 0.78, skin.secondary, 0.9, 0.6, 0.9);
    sc.ball(s, -r * 0.45, cy + r * 0.62, r * 0.55, r * 0.14, skin.glow, 1.5, 0.8, 0.25, [0, 0, 0.6]);
    floaterFace(sc, s, skin, r, cy, { cute: true, er: r * 0.3 });
    sc.ball(s, 0, cy + r * 1.0, 0, 0.12, skin.accent, 1, 0.8, 1);
    sc.tube(s, [V(0, cy + r, 0), V(0.03, cy + r + 0.12, 0), V(0.1, cy + r + 0.22, 0.02)], 0.03, skin.bark, () => 1);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26;
      sc.cone(s, Math.sin(a) * r * 0.6, cy - r - 0.04, Math.cos(a) * r * 0.4, 0.07, 0.28, skin.accent, Math.PI, 0);
    }
    for (const sd of [-1, 1]) {
      const f = group(s, sd * r * 0.95, cy - 0.04, -0.04);
      sc.leaf(f, 0, 0, 0, 0.32, 0.03, 0.12, skin.accent, [0, 0, sd > 0 ? 0 : Math.PI]);
      addWing(sc, f, sd, sd * 0.2);
    }
    for (let i = 0; i < 3; i++) sc.ball(s, Math.sin(i * 2.1) * 0.75, cy + 0.3 + i * 0.2, Math.cos(i * 2.1) * 0.5, 0.05 + i * 0.015, skin.halo);
    const tail = group(s, 0, cy - 0.1, -r * 0.9);
    sc.tails.push(tail);
    sc.tube(tail, [V(0, 0, 0), V(0.1, -0.1, -0.2), V(-0.05, -0.2, -0.3), V(0.08, -0.15, -0.42)], 0.07, skin.primary, (t) => 1 - t * 0.5);
    sc.leaf(tail, 0.08, -0.15, -0.42, 0.28, 0.03, 0.1, skin.accent, [0.6, 0, -0.3]);
    return;
  }
  if (id === 'puffathom') {
    const r = 0.6;
    sc.ball(s, 0, cy, 0, r, skin.primary, 1.05, 1.0, 1.0);
    sc.ball(s, 0, cy - r * 0.45, r * 0.2, r * 0.82, skin.secondary, 0.95, 0.62, 0.95);
    const n = 34;
    for (let i = 0; i < n; i++) {
      const yy = 1 - (i / (n - 1)) * 1.7;
      const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = i * 2.399963;
      const d = V(Math.cos(th) * rr, yy, Math.sin(th) * rr);
      if (d.z > 0.45 && d.y < 0.55 && d.y > -0.5) continue;
      const k = d.y < -0.2 ? 0.7 : 1;
      sc.cone(s, d.x * r * 1.0, cy + d.y * r * 0.98, d.z * r * 1.02, 0.07, 0.3 * k, i % 2 ? skin.accent : skin.secondary, alignY(d)[0], alignY(d)[2], alignY(d)[1]);
    }
    floaterFace(sc, s, skin, r, cy, { fierce: false, cute: false, er: r * 0.24 });
    sc.ring(s, 0, cy - r * 0.38, r * 0.96, r * 0.15, 0.04, skin.accent, 0, 0);
    for (const sd of [-1, 1]) {
      const f = group(s, sd * r * 0.92, cy - 0.04, -0.06);
      sc.leaf(f, 0, 0, 0, 0.6, 0.03, 0.2, skin.accent, [0, 0, sd > 0 ? -0.1 : Math.PI + 0.1]);
      sc.leaf(f, 0, 0, 0, 0.4, 0.035, 0.14, skin.secondary, [0, 0, sd > 0 ? -0.5 : Math.PI + 0.5]);
      addWing(sc, f, sd, sd * 0.2);
    }
    sc.leaf(s, 0, cy + r * 0.95, -0.1, 0.6, 0.03, 0.2, skin.accent, [0, 0, 1.4]);
    sc.leaf(s, 0, cy + r * 0.9, -0.1, 0.4, 0.035, 0.14, skin.secondary, [0, 0, 1.0]);
    const tail = group(s, 0, cy - 0.1, -r * 0.9);
    sc.tails.push(tail);
    for (let i = 0; i < 3; i++) sc.leaf(tail, 0, 0, -0.04, 0.55, 0.03, 0.12, i === 1 ? skin.accent : skin.secondary, [Math.PI / 2, Math.PI / 2, (i - 1) * 0.45], 'YXZ');
    return;
  }
  if (id === 'mossprite') {
    const r = 0.44;
    sc.ball(s, 0, cy, 0, r, skin.primary, 1, 0.98, 1);
    for (let i = 0; i < 22; i++) {
      const yy = 1 - (i / 21) * 1.5;
      const rr = Math.sqrt(1 - yy * yy);
      const th = i * 2.4;
      const d = V(Math.cos(th) * rr, yy, Math.sin(th) * rr);
      if (d.z > 0.4 && d.y < 0.5 && d.y > -0.4) continue;
      sc.leaf(s, d.x * r * 0.95, cy + d.y * r * 0.95, d.z * r * 0.95, 0.2, 0.02, 0.06, i % 2 ? skin.leafA : skin.leafB, [0, Math.atan2(-d.z, d.x), Math.asin(Math.max(-1, Math.min(1, d.y)))], 'YXZ');
    }
    sc.ball(s, 0, cy - r * 0.3, r * 0.3, r * 0.7, skin.secondary, 0.9, 0.7, 0.8);
    floaterFace(sc, s, skin, r, cy, { cute: true, er: r * 0.3 });
    sc.ball(s, 0, cy + r * 0.88, -0.02, r * 0.5, skin.leafA, 1, 0.5, 1);
    sc.tube(s, [V(0, cy + r * 0.95, 0), V(0, cy + r * 1.3, 0), V(0.02, cy + r * 1.5, 0)], 0.03, skin.bark, () => 1);
    for (const sd of [-1, 1]) sc.leaf(s, 0, cy + r * 1.5, 0, 0.32, 0.02, 0.1, skin.leafB, [0, 0, sd > 0 ? 0.6 : Math.PI - 0.6]);
    for (const sd of [-1, 1]) {
      const w = group(s, sd * r * 0.5, cy + 0.1, -r * 0.7);
      sc.leaf(w, 0, 0, 0, 0.55, 0.015, 0.2, skin.accent, [0.2, 0, sd > 0 ? 0.55 : Math.PI - 0.55]);
      sc.leaf(w, 0, -0.04, 0, 0.35, 0.015, 0.14, skin.leafB, [0.2, 0, sd > 0 ? -0.3 : Math.PI + 0.3]);
      addWing(sc, w, sd, sd * 0.1);
    }
    for (const sd of [-1, 1]) sc.ball(s, sd * 0.1, cy - r - 0.05, 0.05, 0.07, skin.secondary, 1, 0.9, 1.3);
    const tail = group(s, 0, cy - 0.2, -r * 0.9);
    sc.tails.push(tail);
    sc.leaf(tail, 0, 0, 0, 0.3, 0.02, 0.08, skin.leafA, [0.5, 0, -0.5]);
    return;
  }
  if (id === 'bloomwisp') {
    const fy = cy + 0.14;
    const r = 0.4;
    const petals = 9;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      const pm = i % 2 ? skin.primary : skin.accent;
      sc.leaf(s, Math.cos(a) * r * 0.55, fy + Math.sin(a) * r * 0.55, -0.1 - (i % 2) * 0.03, 0.46, 0.03, 0.15, pm, [0, 0, a]);
    }
    sc.ball(s, 0, fy, 0, r, skin.secondary, 1, 1, 0.9);
    floaterFace(sc, s, skin, r, fy, { cute: true, er: r * 0.3 });
    sc.egg(s, 0, fy - 0.55, -0.1, 0.5, 0.2, skin.leafA, 1, 1, 0, 0.1);
    for (const sd of [-1, 1]) {
      const w = group(s, sd * 0.18, fy - 0.45, -0.1);
      sc.leaf(w, 0, 0, 0, 0.5, 0.02, 0.14, skin.leafB, [0.3, 0, sd > 0 ? -0.6 : Math.PI + 0.6]);
      addWing(sc, w, sd, sd * 0.1);
    }
    const tail = group(s, 0, fy - 0.7, -0.1);
    sc.tails.push(tail);
    for (let i = 0; i < 4; i++) sc.tube(tail, [V(0, 0, 0), V((i - 1.5) * 0.06, -0.1, (i % 2 ? 1 : -1) * 0.05), V((i - 1.5) * 0.12, -0.22, 0)], 0.025, skin.bark, (t) => 1 - t * 0.6);
    for (let i = 0; i < 4; i++) sc.ball(s, Math.sin(i * 1.7) * 0.7, fy + 0.4 + (i % 2) * 0.4, Math.cos(i * 1.7) * 0.4, 0.04, skin.glow);
    return;
  }
  // gloomlet: little ghost
  const r = 0.46;
  sc.ball(s, 0, cy + 0.12, 0, r, skin.primary, 1, 1.0, 1);
  const skirt: Array<[number, number]> = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    skirt.push([r * (0.4 + 0.62 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5)), cy - 0.46 + t * 0.64]);
  }
  sc.lathe(s, skirt, skin.primary, 0, 0, 0, undefined, 20);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sc.cone(s, Math.cos(a) * r * 0.62, cy - 0.5, Math.sin(a) * r * 0.62, 0.11, 0.3, skin.primary, Math.PI, 0);
    sc.cone(s, Math.cos(a + 0.4) * r * 0.5, cy - 0.5, Math.sin(a + 0.4) * r * 0.5, 0.05, 0.5, skin.wisp, Math.PI, 0);
  }
  sc.ball(s, 0, cy + 0.08, r * 0.55, r * 0.7, skin.dark, 1.1, 0.9, 0.55);
  eyes(sc, s, skin, r * 0.38, cy + 0.12, r * 0.84, r * 0.28, true);
  mouth(sc, s, skin, cy - 0.1, r * 0.95, r * 0.15);
  for (const sd of [-1, 1]) {
    const g = group(s, sd * r * 0.95, cy - 0.1, 0.05);
    sc.arms.push(g);
    sc.seg(g, V(0, 0, 0), V(sd * 0.12, -0.2, 0.08), 0.08, 0.05, skin.primary);
    sc.ball(g, sd * 0.12, -0.24, 0.1, 0.07, skin.accent);
  }
  crown(sc, s, skin, sp, r, 0.7);
  const tail = group(s, 0, cy - 0.2, -r * 0.8);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0), V(0, -0.1, -0.25), V(0.1, -0.3, -0.45)], 0.1, skin.wisp, (t) => 1 - t * 0.9);
}

/* ------------------------------------------------------------------ */
/* Bugs                                                                */
/* ------------------------------------------------------------------ */

function bugLeg(sc: Sculptor, parent: THREE.Object3D, skin: Skin, sd: number, x: number, y: number, z: number, scale: number, mat: THREE.Material): void {
  const g = group(parent, x, y, z);
  g.rotation.y = sd * 0.15;
  sc.seg(g, V(0, 0, 0), V(sd * 0.16 * scale, 0.08 * scale, 0), 0.04 * scale, 0.035 * scale, mat);
  sc.seg(g, V(sd * 0.16 * scale, 0.08 * scale, 0), V(sd * 0.3 * scale, -y + 0.05, 0.02), 0.035 * scale, 0.02 * scale, mat);
  sc.ball(g, sd * 0.3 * scale, -y + 0.03, 0.04, 0.045 * scale, skin.secondary, 1, 0.5, 1.4);
  sc.legs.push(g);
}

export function buildBug(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const id = sp.id;
  const y = 0.46;
  if (id === 'teslapede') {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const z = -0.9 + i * 0.2;
      const r = 0.2 - Math.abs(i - 4) * 0.012;
      const yy = y + Math.sin(i * 0.7) * 0.03;
      sc.ball(s, 0, yy, z, r, skin.primary, 1.0, 0.85, 1.0);
      sc.ball(s, 0, yy + r * 0.55, z, r * 0.62, skin.secondary, 0.9, 0.5, 1.0);
      sc.ring(s, 0, yy, z, r * 0.9, 0.022, skin.bolt, 0, 0, 0);
      if (i > 0 && i < n - 1) for (const sd of [-1, 1]) bugLeg(sc, s, skin, sd, sd * r * 0.8, yy - 0.04, z, 0.9, skin.dark);
    }
    const head = group(s, 0, y + 0.06, 0.96);
    sc.heads.push(head);
    sc.ball(head, 0, 0, 0, 0.23, skin.primary, 1.1, 0.95, 1.0);
    sc.ball(head, 0, -0.08, 0.14, 0.14, skin.secondary, 1, 0.7, 1);
    eyes(sc, head, skin, 0.11, 0.06, 0.16, 0.085);
    mouth(sc, head, skin, -0.13, 0.2, 0.08);
    for (const sd of [-1, 1]) {
      sc.tube(head, [V(sd * 0.1, 0.16, 0.05), V(sd * 0.25, 0.34, 0.16), V(sd * 0.36, 0.48, 0.3)], 0.022, skin.accent, () => 1);
      sc.bolt(head, sd * 0.36, 0.56, 0.3, 0.2, 0.14, skin.bolt, [0, 0, -sd * 0.4]);
      sc.cone(head, sd * 0.1, -0.14, 0.22, 0.04, 0.2, skin.dark, Math.PI - 0.4, sd * -0.4);
    }
    const tail = group(s, 0, y, -0.98);
    sc.tails.push(tail);
    for (const sd of [-1, 1]) sc.cone(tail, sd * 0.07, 0.02, -0.14, 0.04, 0.28, skin.accent, -1.4, sd * 0.2);
    sc.bolt(tail, 0, 0.12, -0.3, 0.3, 0.2, skin.bolt, [1.4, 0, 0]);
    return;
  }
  const crystal = id === 'shardling';
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) bugLeg(sc, s, skin, sd, sd * 0.2, y - 0.06, -0.24 + i * 0.26, 1, skin.dark);
  sc.egg(s, 0, y, -0.4, 0.8, 0.3, skin.primary, 1, 0.85, 0, 0.2);
  sc.egg(s, 0, y - 0.04, -0.4, 0.7, 0.28, skin.secondary, 0.95, 0.5);
  sc.ball(s, 0, y + 0.03, 0.04, 0.24, skin.primary, 1, 0.9, 1.0);
  if (crystal) {
    const sizes = [0.5, 0.36, 0.44, 0.3, 0.38, 0.28];
    sizes.forEach((h, i) => {
      const a = i * 1.1;
      sc.gem(s, Math.sin(a) * 0.18, y + 0.2, -0.65 + (i / 5) * 0.8, 0.09 + (i % 2) * 0.03, h, skin.gem, [-0.3 + Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.5]);
    });
    sc.shard(s, 0, y + 0.22, -0.4, 0.2, skin.primary, 1.3, 0.55, 1.7);
  } else {
    for (const sd of [-1, 1]) sc.ball(s, sd * 0.13, y + 0.2, -0.46, 0.27, skin.secondary, 0.78, 0.7, 1.55, [0.1, 0, sd * -0.15]);
    for (let i = 0; i < 4; i++) sc.ring(s, 0, y + 0.02, -0.7 + i * 0.18, 0.31 - Math.abs(i - 1.2) * 0.02, 0.026, skin.accent, 0, 0, 0);
  }
  const head = group(s, 0, y + 0.08, 0.42);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.22, skin.primary, 1.1, 0.94, 1);
  sc.ball(head, 0, -0.06, 0.16, 0.13, skin.secondary, 1, 0.75, 1);
  blush(sc, head, skin, 0.16, -0.05, 0.14, 0.05);
  eyes(sc, head, skin, 0.11, 0.05, 0.15, 0.09);
  mouth(sc, head, skin, -0.12, 0.21, 0.07);
  for (const sd of [-1, 1]) {
    sc.tube(head, [V(sd * 0.1, 0.14, 0.06), V(sd * 0.22, 0.32, 0.2), V(sd * 0.3, 0.46, 0.36)], 0.022, crystal ? skin.secondary : skin.dark, () => 1);
    if (crystal) sc.gem(head, sd * 0.3, 0.46, 0.36, 0.05, 0.2, skin.gem, [0.7, 0, -sd * 0.4]);
    else sc.bolt(head, sd * 0.3, 0.5, 0.36, 0.2, 0.14, skin.bolt, [0, 0, -sd * 0.5]);
    sc.cone(head, sd * 0.09, -0.16, 0.2, 0.035, 0.16, skin.dark, Math.PI - 0.5, sd * -0.5);
  }
  if (crystal) sc.gem(head, 0, 0.16, 0.12, 0.05, 0.3, skin.gem, [0.8, 0, 0]);
  const tail = group(s, 0, y, -0.8);
  sc.tails.push(tail);
  if (crystal) sc.gem(tail, 0, 0.04, -0.1, 0.07, 0.3, skin.gem, [-1.5, 0, 0]);
  else {
    sc.ball(tail, 0, 0.04, -0.1, 0.09, skin.bolt, 1, 1, 1);
    sc.bolt(tail, 0, 0.14, -0.2, 0.26, 0.18, skin.bolt, [1.2, 0, 0]);
  }
}

/* ------------------------------------------------------------------ */
/* Moles                                                               */
/* ------------------------------------------------------------------ */

export function buildMole(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const hulk = sp.tier === 'stage3';
  const r = hulk ? 0.62 : 0.5;
  for (const sd of [-1, 1]) {
    const leg = legTo(sc, s, sd * r * 0.55, -r * 0.45, r * 0.55, hulk ? 0.14 : 0.11, skin.primary, skin.secondary, 3);
    sc.legs.push(leg);
  }
  sc.egg(s, 0, r * 0.95, -0.04, r * 2.5, r * 0.95, skin.primary, 1, 0.9, 0, 0.3);
  sc.egg(s, 0, r * 0.55, r * 0.14, r * 1.8, r * 0.78, skin.secondary, 0.9, 0.62);
  const head = group(s, 0, r * 0.95, r * 0.95);
  sc.heads.push(head);
  const hr = r * 0.52;
  sc.ball(head, 0, 0, 0, hr, skin.primary, 1.1, 0.95, 1.0);
  sc.ball(head, 0, -hr * 0.35, hr * 0.7, hr * 0.55, skin.secondary, 0.9, 0.7, 1.0);
  sc.cone(head, 0, -hr * 0.25, hr * 1.35, hr * 0.38, hr * 0.7, skin.secondary, Math.PI / 2, 0);
  sc.ball(head, 0, -hr * 0.2, hr * 1.7, hr * 0.2, skin.dark, 1.1, 0.9, 0.9);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sc.cone(head, Math.cos(a) * hr * 0.2, -hr * 0.2 + Math.sin(a) * hr * 0.2, hr * 1.8, hr * 0.04, hr * 0.2, skin.accent, Math.PI / 2, 0);
  }
  mouth(sc, head, skin, -hr * 0.62, hr * 1.1, hr * 0.38, hulk);
  eyes(sc, head, skin, hr * 0.56, hr * 0.34, hr * 0.64, hr * 0.3);
  if (hulk) brows(sc, head, skin, hr * 0.56, hr * 0.8, hr * 0.7, hr * 0.22, 0.4);
  else blush(sc, head, skin, hr * 0.8, -hr * 0.1, hr * 0.6, hr * 0.13);
  for (const sd of [-1, 1]) sc.ball(head, sd * hr * 0.75, hr * 0.5, -hr * 0.1, hr * 0.28, skin.primary, 1, 0.8, 0.5);
  for (const sd of [-1, 1]) {
    const arm = group(s, sd * r * 0.85, r * 0.7, r * 0.35);
    sc.arms.push(arm);
    sc.seg(arm, V(0, 0, 0), V(sd * 0.04, -0.3, 0.16), r * 0.24, r * 0.2, skin.primary);
    sc.ball(arm, sd * 0.04, -0.36, 0.2, r * 0.26, skin.secondary, 1.1, 0.8, 1.1);
    for (let i = -1; i <= 1; i++) sc.cone(arm, sd * 0.04 + i * r * 0.15, -0.46, 0.34, r * 0.07, r * 0.5, skin.accent, 1.3, i * 0.2);
  }
  const back: Array<[number, number, number]> = [];
  for (let i = 0; i < 5; i++) back.push([0, r * 1.78 - Math.abs(i - 2) * 0.05, -r * 0.55 + i * r * 0.28]);
  ridge(sc, s, skin, sp, back, hulk ? 1.5 : 1.1);
  if (hulk) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      sc.shard(s, Math.sin(a) * r * 0.5, r * 1.7 + (i % 2) * 0.05, -r * 0.7 + (i / 5) * r * 1.2, 0.2, skin.dark, 1, 0.8, 1.2, [a, a * 2, 0]);
    }
    for (let i = 0; i < 5; i++) sc.seg(s, V(Math.sin(i * 1.3) * r * 0.5, r * 1.6, -r * 0.5 + i * r * 0.25), V(Math.sin(i * 1.3) * r * 0.9, r * 1.2, -r * 0.5 + i * r * 0.25), 0.025, 0.02, skin.bolt, false);
    for (const sd of [-1, 1]) sc.cone(head, sd * hr * 0.6, hr * 0.85, hr * 0.1, hr * 0.14, hr * 0.8, skin.dark, 0.3, -sd * 0.4);
  }
  const tail = group(s, 0, r * 0.7, -r * 1.3);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0.1), V(0, 0.1, -0.16), V(0, 0.22, -0.3)], 0.07, skin.primary, (t) => 1 - t * 0.4);
  sc.flame(tail, 0, 0.22, -0.3, 0.3, 0.06, skin.flame, skin.fb, skin.ft, -0.05, [-0.4, 0, 0]);
}

/* ------------------------------------------------------------------ */
/* Crustacean                                                          */
/* ------------------------------------------------------------------ */

export function buildCrustacean(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      const g = group(s, sd * 0.3, 0.46, -0.3 + i * 0.28);
      sc.seg(g, V(0, 0, 0), V(sd * 0.2, 0.06, 0), 0.055, 0.05, skin.primary);
      sc.seg(g, V(sd * 0.2, 0.06, 0), V(sd * 0.36, -0.42, 0.02), 0.05, 0.035, skin.secondary);
      sc.ball(g, sd * 0.36, -0.43, 0.04, 0.06, skin.accent, 1, 0.5, 1.4);
      sc.legs.push(g);
    }
  }
  sc.egg(s, 0, 0.56, 0.1, 0.85, 0.38, skin.primary, 1.2, 0.72, 0, 0.1);
  sc.egg(s, 0, 0.48, 0.16, 0.6, 0.32, skin.secondary, 1.1, 0.5);
  const shell = group(s, 0, 0.7, -0.16);
  sc.tails.push(shell);
  const prof: Array<[number, number]> = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    prof.push([Math.max(0.0001, 0.4 * Math.pow(1 - t, 0.9) * (1 + 0.1 * Math.sin(t * 38))), t * 0.8]);
  }
  sc.lathe(shell, prof, skin.secondary, 0, 0, 0, { rot: [-0.25, 0, 0] }, 20);
  sc.ball(shell, 0, 0.12, 0.2, 0.2, skin.accent, 1.1, 0.8, 0.9);
  sc.ball(shell, 0, 0.8, -0.16, 0.08, skin.glow);
  crown(sc, shell, skin, sp, 0.3, 0.5);
  const head = group(s, 0, 0.7, 0.42);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.2, skin.primary, 1.1, 0.8, 0.9);
  mouth(sc, head, skin, -0.07, 0.17, 0.08);
  blush(sc, head, skin, 0.14, -0.04, 0.12, 0.05);
  for (const sd of [-1, 1]) {
    sc.seg(s, V(sd * 0.12, 0.8, 0.44), V(sd * 0.14, 1.0, 0.5), 0.03, 0.025, skin.primary);
  }
  eyes(sc, s, skin, 0.14, 1.06, 0.5, 0.09);
  for (const sd of [-1, 1]) {
    const claw = group(s, sd * 0.42, 0.56, 0.34);
    sc.arms.push(claw);
    sc.seg(claw, V(0, 0, 0), V(sd * 0.12, -0.04, 0.3), 0.09, 0.075, skin.primary);
    sc.ball(claw, sd * 0.12, -0.04, 0.34, 0.15, skin.accent, 1.2, 0.9, 1.1);
    sc.leaf(claw, sd * 0.1, 0.02, 0.4, 0.34, 0.04, 0.09, skin.accent, [0, -Math.PI / 2, 0.22]);
    sc.leaf(claw, sd * 0.1, -0.1, 0.4, 0.3, 0.04, 0.08, skin.secondary, [0, -Math.PI / 2, -0.22]);
  }
  for (let i = 0; i < 3; i++) sc.ball(s, 0.15 + i * 0.05, 0.9 + i * 0.1, 0.62 + i * 0.04, 0.03 + i * 0.01, skin.halo);
}

/* ------------------------------------------------------------------ */
/* Moth                                                                */
/* ------------------------------------------------------------------ */

export function buildMoth(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  sc.egg(s, 0, 1.02, -0.06, 0.62, 0.17, skin.primary, 1, 1, 0.9, 0.3);
  for (let i = 0; i < 6; i++) sc.ball(s, Math.sin(i * 2) * 0.1, 1.38 + (i % 3) * 0.05, 0.02 + Math.cos(i * 2) * 0.08, 0.14, skin.secondary);
  sc.ball(s, 0, 1.34, 0.04, 0.2, skin.secondary);
  for (const x of [-0.09, 0.09]) {
    const leg = legTo(sc, s, x, -0.02, 0.8, 0.03, skin.dark, skin.dark, 2);
    sc.legs.push(leg);
  }
  const head = group(s, 0, 1.56, 0.12);
  sc.heads.push(head);
  const r = 0.17;
  sc.ball(head, 0, 0, 0, r, skin.primary, 1.1, 0.95, 1);
  blush(sc, head, skin, r * 0.65, -r * 0.2, r * 0.6, r * 0.14);
  eyes(sc, head, skin, r * 0.5, r * 0.08, r * 0.7, r * 0.42);
  mouth(sc, head, skin, -r * 0.5, r * 0.88, r * 0.2);
  for (const sd of [-1, 1]) {
    sc.tube(head, [V(sd * r * 0.3, r * 0.8, r * 0.2), V(sd * r * 0.9, r * 2.0, r * 0.2), V(sd * r * 1.5, r * 2.8, r * 0.1)], r * 0.06, skin.secondary, () => 1);
    for (let i = 0; i < 5; i++) sc.leaf(head, sd * r * (0.55 + i * 0.22), r * (1.2 + i * 0.35), r * 0.2, r * 0.9, r * 0.03, r * 0.12, skin.accent, [0, 0, sd > 0 ? 0.3 : Math.PI - 0.3]);
  }
  crown(sc, head, skin, sp, r, 0.5);
  for (const sd of [-1, 1]) {
    const w = group(s, sd * 0.12, 1.36, -0.06);
    addWing(sc, w, sd, sd * 0.2);
    const flip = (a: number): number => (sd > 0 ? a : Math.PI - a);
    sc.leaf(w, 0, 0, -0.04, 0.95, 0.012, 0.36, skin.secondary, [0, 0, flip(0.35)]);
    sc.leaf(w, 0, 0, -0.03, 0.78, 0.014, 0.26, skin.primary, [0, 0, flip(0.38)]);
    sc.leaf(w, 0, -0.04, -0.04, 0.68, 0.012, 0.26, skin.primary, [0, 0, flip(-0.5)]);
    sc.leaf(w, 0, -0.04, -0.05, 0.54, 0.014, 0.18, skin.secondary, [0, 0, flip(-0.52)]);
    for (let i = 0; i < 4; i++) {
      const L = 0.3 + i * 0.16;
      sc.gem(w, sd * L * Math.cos(0.35), L * Math.sin(0.35) + 0.04, -0.02, 0.025, 0.18, skin.gem, [0, 0, sd > 0 ? -1.2 : 1.2]);
    }
    sc.ring(w, sd * 0.5, 0.2, -0.0, 0.09, 0.022, skin.accent);
    sc.ball(w, sd * 0.5, 0.2, -0.005, 0.055, skin.iris, 1, 1, 0.3);
    sc.ball(w, sd * 0.5 - 0.015, 0.22, 0.0, 0.02, skin.glow, 1, 1, 0.4);
    sc.gem(w, sd * 0.78, 0.42, -0.02, 0.05, 0.25, skin.gem, [0, 0, sd > 0 ? -0.9 : 0.9]);
  }
  const tail = group(s, 0, 0.86, -0.18);
  sc.tails.push(tail);
  sc.gem(tail, 0, -0.04, -0.06, 0.07, 0.28, skin.gem, [Math.PI + 0.4, 0, 0]);
}

export { ridge, tailFor, critterHead };
