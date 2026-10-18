import * as THREE from 'three';
import type { CreatureSpecies, Palette } from '../../../data/creatures';
import { Sculptor, V, clamp } from './sculptor';

/** Shared materials for one creature. */
export interface Skin {
  primary: THREE.Material;
  secondary: THREE.Material;
  accent: THREE.Material;
  dark: THREE.Material;
  white: THREE.Material;
  iris: THREE.Material;
  irisLight: THREE.Material;
  pupil: THREE.Material;
  blush: THREE.Material;
  bark: THREE.Material;
  leafA: THREE.Material;
  leafB: THREE.Material;
  gem: THREE.Material;
  glow: THREE.MeshBasicMaterial;
  eyeGlow: THREE.MeshBasicMaterial;
  flame: THREE.MeshBasicMaterial;
  bolt: THREE.MeshBasicMaterial;
  wisp: THREE.MeshBasicMaterial;
  wispCore: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
  /** Flame gradient: base and tip. */
  fb: number;
  ft: number;
  accentHex: number;
  eyeHex: number;
}

export function shade(color: number, hue: number, sat: number, light: number): number {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + hue + 1) % 1, clamp(hsl.s * sat, 0, 1), clamp(hsl.l * light, 0.05, 0.95));
  return c.getHex();
}

export function rnd(id: string, k: number): number {
  let h = 2166136261 ^ (k * 977);
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function isGrand(sp: CreatureSpecies): boolean {
  return sp.tier === 'stage3' || sp.tier === 'legendary' || sp.tier === 'mythical' || sp.tier === 'pseudo';
}

export function isLegend(sp: CreatureSpecies): boolean {
  return sp.tier === 'legendary' || sp.tier === 'mythical';
}

const RIM: Record<string, number> = {
  fire: 0xffb06a,
  water: 0x8fe3ff,
  grass: 0xc2ff8f,
  electric: 0xfff27a,
  shadow: 0xb58cff,
  crystal: 0xd6efff,
};

export function buildSkin(sc: Sculptor, sp: CreatureSpecies, shiny: boolean): Skin {
  const p: Palette = sp.palette;
  const hue = shiny ? 0.5 : 0;
  const sat = shiny ? 1.25 : 1;
  const light = shiny ? 1.14 : 1;
  const primary = shade(p.primary, hue, sat, light);
  const secondary = shade(p.secondary, hue, sat, light);
  const accent = shade(p.accent, hue, sat, light);
  const rimColor = shiny ? 0xfff2b8 : RIM[sp.element] ?? 0xffffff;
  const rim = { color: rimColor, strength: shiny ? 0.62 : 0.34, power: 2.5 };
  const shinyGlow = shiny ? 0.16 : 0;
  const glossy = sp.element === 'water' || sp.element === 'crystal';
  const mk = (c: number, outline = true): THREE.Material =>
    glossy
      ? sc.gloss(c, { roughness: sp.element === 'crystal' ? 0.34 : 0.3, metalness: sp.element === 'crystal' ? 0.22 : 0.06, emissive: c, intensity: 0.06 + shinyGlow, rim, outline })
      : sc.toon(c, { emissive: shiny ? c : 0, intensity: shinyGlow, rim, outline });
  const eyeHex = shade(p.eye, hue, 1, 1);
  const eyeBright = new THREE.Color(eyeHex).lerp(new THREE.Color(0xffffff), 0.3).getHex();
  const leafA = shade(0x2f8f3c, hue, sat, light);
  const leafB = shade(0x8ee07a, hue, sat, light);
  const flameBase = shade(0xff4a12, hue, 1, 1);
  const flameTip = shade(0xffe27a, hue, 1, 1);
  const wispColor = sp.element === 'shadow' ? shade(accent, 0, 1, 1) : accent;
  return {
    primary: mk(primary, true),
    secondary: mk(secondary, false),
    accent: sc.toon(accent, { emissive: accent, intensity: 0.5, rim }),
    dark: sc.toon(0x241a24, { rim: { color: rimColor, strength: 0.2, power: 3 } }),
    white: sc.toon(0xfaf6ee, { emissive: 0xffffff, intensity: 0.18 }),
    iris: sc.toon(eyeHex, { emissive: eyeHex, intensity: 0.28 }),
    irisLight: sc.toon(new THREE.Color(eyeHex).lerp(new THREE.Color(0xffffff), 0.45).getHex(), { emissive: eyeHex, intensity: 0.35 }),
    pupil: sc.toon(0x0b0910),
    blush: sc.toon(shade(0xff8aa0, hue, 1, 1), { emissive: 0xff6f8c, intensity: 0.25 }),
    bark: sc.toon(0x7a5a34),
    leafA: sc.toon(leafA, { rim }),
    leafB: sc.toon(leafB, { rim }),
    gem: sc.gloss(accent, { roughness: 0.16, metalness: 0.32, emissive: accent, intensity: 0.4, rim: { color: 0xffffff, strength: 0.5, power: 2.2 }, flat: true }),
    glow: sc.glow(0xffffff),
    eyeGlow: sc.glow(eyeBright),
    flame: sc.glow(0xffffff, { vertexColors: true }),
    bolt: sc.glow(new THREE.Color(accent).lerp(new THREE.Color(0xffffff), 0.4).getHex()),
    wisp: sc.glow(wispColor, { opacity: 0.62, side: THREE.DoubleSide }),
    wispCore: sc.glow(new THREE.Color(wispColor).multiplyScalar(0.55).getHex(), { opacity: 0.9 }),
    halo: sc.glow(accent, { opacity: 0.55, additive: true }),
    fb: flameBase,
    ft: flameTip,
    accentHex: accent,
    eyeHex,
  };
}

/* ------------------------------------------------------------------ */
/* Faces                                                               */
/* ------------------------------------------------------------------ */

export function eyes(sc: Sculptor, parent: THREE.Object3D, skin: Skin, x: number, y: number, z: number, r: number, glowing = false): void {
  for (const s of [-1, 1]) {
    const ex = s * x;
    if (glowing) {
      sc.ball(parent, ex, y, z, r * 1.08, skin.dark, 1, 1.1, 0.5);
      sc.ball(parent, ex, y, z + r * 0.2, r * 0.86, skin.eyeGlow, 1.1, 0.78, 0.45, [0, 0, -s * 0.38]);
      sc.ball(parent, ex + s * r * 0.05, y, z + r * 0.46, r * 0.28, skin.glow, 0.55, 1.25, 0.4, [0, 0, -s * 0.38]);
    } else {
      sc.ball(parent, ex, y, z, r, skin.white, 1, 1.1, 0.7);
      sc.ball(parent, ex, y - r * 0.02, z + r * 0.5, r * 0.72, skin.iris, 1, 1.08, 0.45);
      sc.ball(parent, ex, y - r * 0.26, z + r * 0.7, r * 0.42, skin.irisLight, 1, 0.7, 0.4);
      sc.ball(parent, ex, y, z + r * 0.74, r * 0.38, skin.pupil, 1, 1.15, 0.4);
      sc.ball(parent, ex - r * 0.24, y + r * 0.27, z + r * 0.86, r * 0.2, skin.glow, 1, 1, 0.5);
      sc.ball(parent, ex + r * 0.22, y - r * 0.25, z + r * 0.88, r * 0.09, skin.glow, 1, 1, 0.5);
    }
  }
}

export function brows(sc: Sculptor, parent: THREE.Object3D, skin: Skin, x: number, y: number, z: number, r: number, angle = 0.4): void {
  for (const s of [-1, 1]) sc.ball(parent, s * x, y, z, r, skin.dark, 1.5, 0.26, 0.5, [0, 0, s * angle]);
}

export function mouth(sc: Sculptor, parent: THREE.Object3D, skin: Skin, y: number, z: number, w: number, fangs = false): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const u = (i / 6) * 2 - 1;
    pts.push(V(u * w, y + u * u * w * 0.34, z - u * u * w * 0.7));
  }
  sc.tube(parent, pts, w * 0.075, skin.dark, (t) => 0.45 + 0.55 * Math.sin(Math.PI * t));
  if (fangs) for (const s of [-1, 1]) sc.cone(parent, s * w * 0.5, y - w * 0.04, z - w * 0.2, w * 0.1, w * 0.3, skin.white, Math.PI, 0);
}

export function blush(sc: Sculptor, parent: THREE.Object3D, skin: Skin, x: number, y: number, z: number, r: number): void {
  for (const s of [-1, 1]) sc.ball(parent, s * x, y, z, r, skin.blush, 1.25, 0.8, 0.3, [0, s * 0.5, 0]);
}

/* ------------------------------------------------------------------ */
/* Ears, crowns, tails, ridges (element flavoured)                      */
/* ------------------------------------------------------------------ */

/** Head-mounted ears whose silhouette depends on the element. `r` is the head radius. */
export function earPair(sc: Sculptor, head: THREE.Object3D, skin: Skin, sp: CreatureSpecies, r: number, size = 1): void {
  const el = sp.element;
  for (const s of [-1, 1]) {
    if (el === 'water') {
      sc.leaf(head, s * r * 0.6, r * 0.42, -r * 0.1, r * 1.25 * size, r * 0.08, r * 0.34, skin.primary, [0, 0, s > 0 ? 0.55 : Math.PI - 0.55]);
      sc.leaf(head, s * r * 0.64, r * 0.44, -r * 0.05, r * 0.8 * size, r * 0.09, r * 0.2, skin.accent, [0, 0, s > 0 ? 0.55 : Math.PI - 0.55]);
    } else if (el === 'grass') {
      sc.leaf(head, s * r * 0.5, r * 0.6, -r * 0.1, r * 1.3 * size, r * 0.07, r * 0.34, skin.leafA, [0, 0, s > 0 ? 1.0 : Math.PI - 1.0]);
      sc.leaf(head, s * r * 0.5, r * 0.62, -r * 0.05, r * 0.9 * size, r * 0.08, r * 0.2, skin.leafB, [0, 0, s > 0 ? 1.0 : Math.PI - 1.0]);
    } else if (el === 'electric') {
      sc.cone(head, s * r * 0.5, r * 1.15, -r * 0.1, r * 0.32, r * 1.55 * size, skin.primary, -0.1, -s * 0.22, 0, { scale: [1, 1, 0.55] });
      sc.cone(head, s * r * 0.5, r * 1.1, r * 0.0, r * 0.18, r * 1.1 * size, skin.secondary, -0.1, -s * 0.22, 0, { scale: [1, 1, 0.4] });
      sc.bolt(head, s * r * 0.72, r * 1.95 * size, -r * 0.1, r * 0.5, r * 0.36, skin.bolt, [0, 0, -s * 0.15]);
    } else if (el === 'shadow') {
      sc.tube(head, [V(s * r * 0.4, r * 0.6, -r * 0.1), V(s * r * 0.75, r * 1.15 * size, -r * 0.2), V(s * r * 0.72, r * 1.75 * size, -r * 0.5)], r * 0.22, skin.dark, (t) => 1 - t * 0.85);
      sc.cone(head, s * r * 0.68, r * 1.78 * size, -r * 0.52, r * 0.07, r * 0.3, skin.accent, -0.9, 0);
    } else if (el === 'crystal') {
      sc.gem(head, s * r * 0.5, r * 0.55, -r * 0.1, r * 0.2, r * 1.0 * size, skin.gem, [-0.1, 0, -s * 0.38]);
      sc.gem(head, s * r * 0.68, r * 0.55, -r * 0.2, r * 0.12, r * 0.62 * size, skin.gem, [-0.1, 0, -s * 0.8]);
    } else {
      sc.cone(head, s * r * 0.55, r * 1.0, -r * 0.08, r * 0.43, r * 1.25 * size, skin.primary, -0.12, -s * 0.24, 0, { scale: [1, 1, 0.55] });
      sc.cone(head, s * r * 0.55, r * 0.96, r * 0.02, r * 0.25, r * 0.9 * size, skin.secondary, -0.12, -s * 0.24, 0, { scale: [1, 1, 0.5] });
      sc.cone(head, s * r * 0.62, r * 1.5 * size, -r * 0.1, r * 0.17, r * 0.45, el === 'fire' ? skin.dark : skin.accent, -0.12, -s * 0.24);
    }
  }
}

/** Element flavoured ornament sitting on top of the head. */
export function crown(sc: Sculptor, head: THREE.Object3D, skin: Skin, sp: CreatureSpecies, r: number, scale = 1): void {
  const el = sp.element;
  const k = r * scale;
  if (el === 'fire') {
    for (let i = -2; i <= 2; i++) {
      const h = (1.35 - Math.abs(i) * 0.28) * k;
      sc.flame(head, i * k * 0.2, k * 0.82, -k * 0.2 - Math.abs(i) * k * 0.06, h, k * 0.24, skin.flame, skin.fb, skin.ft, -0.15 + i * 0.05, [-0.25, 0, -i * 0.2]);
    }
  } else if (el === 'water') {
    sc.leaf(head, 0, k * 0.8, -k * 0.35, k * 1.4, k * 0.07, k * 0.36, skin.accent, [0, 0, 1.2]);
    sc.leaf(head, 0, k * 0.78, -k * 0.35, k * 1.0, k * 0.08, k * 0.26, skin.primary, [0, 0, 1.5]);
    for (const s of [-1, 1]) sc.ball(head, s * k * 0.88, k * 0.1, -k * 0.1, k * 0.2, skin.accent, 0.5, 1, 1.4);
  } else if (el === 'grass') {
    sc.tube(head, [V(0, k * 0.8, -k * 0.2), V(0.02, k * 1.1, -k * 0.2), V(0, k * 1.3, -k * 0.15)], k * 0.06, skin.bark, (t) => 1 - t * 0.4);
    for (const s of [-1, 1]) {
      sc.leaf(head, 0, k * 1.3, -k * 0.15, k * 0.95, k * 0.06, k * 0.28, skin.leafB, [0.2, 0, s > 0 ? 0.55 : Math.PI - 0.55]);
      sc.leaf(head, 0, k * 1.0, -k * 0.2, k * 0.7, k * 0.06, k * 0.2, skin.leafA, [0.2, 0, s > 0 ? 0.25 : Math.PI - 0.25]);
    }
    sc.ball(head, 0, k * 1.36, -k * 0.12, k * 0.12, skin.accent);
  } else if (el === 'electric') {
    for (let i = -1; i <= 1; i++) sc.bolt(head, i * k * 0.3, k * (1.05 - Math.abs(i) * 0.12), -k * 0.15, k * (0.85 - Math.abs(i) * 0.12), k * 0.5, skin.bolt, [0, 0, -i * 0.3]);
  } else if (el === 'shadow') {
    for (let i = -1; i <= 1; i++) {
      sc.tube(head, [V(i * k * 0.2, k * 0.8, -k * 0.2), V(i * k * 0.45, k * 1.3, -k * 0.35), V(i * k * 0.2, k * (1.9 - Math.abs(i) * 0.3), -k * 0.5)], k * 0.12, skin.wisp, (t) => 1 - t * 0.9);
    }
  } else {
    for (let i = -1; i <= 1; i++) sc.gem(head, i * k * 0.22, k * 0.78, -k * 0.2, k * 0.17, k * (1.1 - Math.abs(i) * 0.3), skin.gem, [-0.2, 0, -i * 0.28]);
  }
}

/** Tail whose end treatment depends on the element. The group origin is the root of the tail. */
export function tailFor(sc: Sculptor, tail: THREE.Object3D, skin: Skin, sp: CreatureSpecies, len = 1, r = 0.1, rise = 1): void {
  const el = sp.element;
  const L = len;
  const pts = [V(0, 0, 0.04), V(0, 0.14 * L * rise, -0.18 * L), V(0, 0.34 * L * rise, -0.3 * L), V(0, 0.4 * L * rise, -0.5 * L)];
  const tip = V(0, 0.4 * L * rise, -0.5 * L);
  if (el === 'shadow') {
    sc.tube(tail, pts, r * 0.9, skin.dark, (t) => 1 - t * 0.6);
    sc.tube(tail, [tip, V(0, 0.55 * L * rise, -0.62 * L), V(0.1 * L, 0.8 * L * rise, -0.62 * L), V(-0.06 * L, 1.0 * L * rise, -0.5 * L)], r * 1.4, skin.wisp, (t) => 1 - t * 0.9);
    return;
  }
  sc.tube(tail, pts, r, skin.primary, (t) => 1 - t * 0.55);
  if (el === 'fire') {
    for (let i = -1; i <= 1; i++) sc.flame(tail, tip.x + i * r * 0.7, tip.y - 0.02, tip.z - 0.03, (0.5 - Math.abs(i) * 0.12) * L, r * 1.5, skin.flame, skin.fb, skin.ft, -0.1, [-0.9, 0, -i * 0.3]);
  } else if (el === 'water') {
    sc.leaf(tail, tip.x, tip.y, tip.z + 0.02, 0.5 * L, 0.04 * L, 0.2 * L, skin.accent, [0.5, 0, Math.PI / 2 + 0.2]);
    sc.leaf(tail, tip.x, tip.y, tip.z + 0.02, 0.32 * L, 0.045 * L, 0.14 * L, skin.secondary, [0.5, 0, Math.PI / 2 - 0.5]);
  } else if (el === 'grass') {
    for (let i = -1; i <= 1; i++) sc.leaf(tail, tip.x, tip.y, tip.z + 0.02, 0.5 * L, 0.04 * L, 0.14 * L, i === 0 ? skin.leafB : skin.leafA, [0.6, i * 0.5, Math.PI / 2 + i * 0.5]);
  } else if (el === 'electric') {
    sc.bolt(tail, tip.x, tip.y + 0.1 * L, tip.z - 0.05 * L, 0.7 * L, 0.5 * L, skin.bolt, [0.9, 0, 0.0]);
    sc.bolt(tail, tip.x, tip.y + 0.24 * L, tip.z - 0.22 * L, 0.55 * L, 0.4 * L, skin.bolt, [0.9, 0, 0.4]);
  } else {
    sc.gem(tail, tip.x, tip.y, tip.z, r * 0.9, 0.55 * L, skin.gem, [-1.2, 0, 0]);
    sc.gem(tail, tip.x + r, tip.y, tip.z, r * 0.6, 0.35 * L, skin.gem, [-1.0, 0, -0.5]);
    sc.gem(tail, tip.x - r, tip.y, tip.z, r * 0.6, 0.38 * L, skin.gem, [-1.0, 0, 0.5]);
  }
}

/** A row of spines/plates/leaves along the back. */
export function ridge(sc: Sculptor, parent: THREE.Object3D, skin: Skin, sp: CreatureSpecies, pts: Array<[number, number, number]>, size = 1): void {
  const el = sp.element;
  pts.forEach((p, i) => {
    const k = size * (1 - Math.abs(i - (pts.length - 1) / 2) * 0.12);
    const [x, y, z] = p;
    if (el === 'fire') sc.flame(parent, x, y, z, 0.32 * k, 0.07 * k, skin.flame, skin.fb, skin.ft, -0.05, [-0.5, 0, 0]);
    else if (el === 'water') sc.leaf(parent, x, y, z, 0.3 * k, 0.025 * k, 0.1 * k, skin.accent, [0, 0, Math.PI / 2 - 0.35]);
    else if (el === 'grass') sc.leaf(parent, x, y, z, 0.34 * k, 0.025 * k, 0.1 * k, i % 2 ? skin.leafA : skin.leafB, [0.1, i % 2 ? 0.5 : -0.5, Math.PI / 2]);
    else if (el === 'electric') sc.bolt(parent, x, y + 0.1 * k, z, 0.3 * k, 0.2 * k, skin.bolt, [0, 0.5, (i % 2 ? 1 : -1) * 0.2]);
    else if (el === 'shadow') sc.cone(parent, x, y + 0.1 * k, z, 0.06 * k, 0.28 * k, skin.accent, -0.5, 0);
    else sc.gem(parent, x, y - 0.02, z, 0.06 * k, 0.3 * k, skin.gem, [-0.3, 0, 0]);
  });
}

/** Floating star-shaped sparkles that mark shiny variants. */
export function sparkles(sc: Sculptor, skin: Skin, w: number, h: number): void {
  const spots: Array<[number, number, number, number]> = [
    [-0.7, 0.8, 0.5, 0.11],
    [0.75, 0.55, 0.4, 0.09],
    [0.1, 1.04, -0.5, 0.12],
    [-0.5, 0.25, -0.6, 0.07],
    [0.6, 0.95, 0.0, 0.075],
  ];
  for (const [fx, fy, fz, r] of spots) {
    const x = fx * w * 0.55;
    const y = fy * h;
    const z = fz * w * 0.55;
    sc.shard(sc.sway, x, y, z, r, skin.glow, 1, 0.2, 0.2);
    sc.shard(sc.sway, x, y, z, r, skin.glow, 0.2, 1, 0.2);
    sc.shard(sc.sway, x, y, z, r, skin.glow, 0.2, 0.2, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Limbs                                                               */
/* ------------------------------------------------------------------ */

export function legTo(sc: Sculptor, parent: THREE.Object3D, x: number, z: number, hipY: number, radius: number, upper: THREE.Material, paw: THREE.Material, toes = 3): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, hipY, z);
  parent.add(g);
  sc.seg(g, V(0, 0, 0), V(0, -hipY + radius * 1.1, 0.01), radius * 1.18, radius * 0.82, upper);
  const py = -hipY + radius * 0.7;
  sc.ball(g, 0, py, radius * 0.55, radius * 1.3, paw, 1.05, 0.62, 1.3);
  for (let i = 0; i < toes; i++) {
    const u = toes === 1 ? 0 : i / (toes - 1) - 0.5;
    sc.ball(g, u * radius * 1.3, py - radius * 0.05, radius * 1.5, radius * 0.42, paw, 1, 0.6, 1.2);
  }
  return g;
}

export function group(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Head for mammal-like creatures. The head group origin is the cranium center. */
export interface HeadOpts {
  snout?: number;
  cute?: boolean;
  fierce?: boolean;
  glow?: boolean;
  fangs?: boolean;
  ears?: boolean;
  wide?: number;
}

export function critterHead(sc: Sculptor, head: THREE.Group, skin: Skin, sp: CreatureSpecies, r: number, o: HeadOpts = {}): void {
  const snout = o.snout ?? 0.7;
  const mz = r * snout;
  const wide = o.wide ?? 1;
  sc.ball(head, 0, 0.02, 0, r, skin.primary, 1.02 * wide, 0.96, 1.04);
  sc.ball(head, 0, r * 0.2, -r * 0.05, r * 0.92, skin.primary, 1 * wide, 0.86, 0.92);
  sc.ball(head, 0, -r * 0.3, mz, r * 0.58, skin.secondary, 0.98 * wide, 0.74, 0.95);
  sc.ball(head, 0, -r * 0.1, mz + r * 0.5, r * 0.17, skin.dark, 1.15, 0.82, 0.82);
  mouth(sc, head, skin, -r * 0.52, mz + r * 0.34, r * 0.3, o.fangs === true);
  for (const s of [-1, 1]) sc.ball(head, s * r * 0.68 * wide, -r * 0.26, mz * 0.45, r * 0.34, skin.primary, 0.92, 0.92, 0.92);
  if (o.cute) blush(sc, head, skin, r * 0.62 * wide, -r * 0.18, r * 0.72, r * 0.15);
  const er = o.cute ? r * 0.31 : r * 0.27;
  eyes(sc, head, skin, r * 0.46 * wide, r * 0.22, r * 0.8, er, o.glow === true);
  if (o.fierce) brows(sc, head, skin, r * 0.46 * wide, r * 0.56, r * 0.76, r * 0.22, 0.42);
  if (o.ears !== false) earPair(sc, head, skin, sp, r);
}
