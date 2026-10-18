import * as THREE from 'three';
import { getSpecies } from '../../data/creatures';
import type { BodyPlan, CreatureSpecies, Palette } from '../../data/creatures';

export type CreatureMood = 'idle' | 'attack' | 'hurt' | 'faint' | 'celebrate';

export interface CreatureModel {
  root: THREE.Group;
  update(seconds: number, mood?: CreatureMood): void;
  dispose(): void;
}

interface Skin {
  primary: THREE.MeshStandardMaterial;
  secondary: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  iris: THREE.MeshStandardMaterial;
  pupil: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
}

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

function group(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function shade(color: number, hue: number, sat: number, light: number): number {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + hue) % 1, clamp(hsl.s * sat, 0, 1), clamp(hsl.l * light, 0.07, 0.93));
  return c.getHex();
}

class Sculptor {
  readonly root = new THREE.Group();
  readonly sway = new THREE.Group();
  readonly heads: THREE.Object3D[] = [];
  readonly tails: THREE.Object3D[] = [];
  readonly wings: THREE.Object3D[] = [];
  readonly wingSide: number[] = [];
  readonly wingBase: number[] = [];
  readonly legs: THREE.Object3D[] = [];
  readonly arms: THREE.Object3D[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.root.add(this.sway);
  }

  material(color: number, roughness = 0.72, emissive = 0, intensity = 0.35): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: clamp(roughness, 0.55, 0.85),
      metalness: 0.05,
      emissive,
      emissiveIntensity: intensity,
    });
    this.mats.push(m);
    return m;
  }

  add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    this.geos.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  ball(parent: THREE.Object3D, x: number, y: number, z: number, r: number, material: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
    const mesh = this.add(parent, new THREE.SphereGeometry(1, 18, 14), material, x, y, z);
    mesh.scale.set(r * sx, r * sy, r * sz);
    return mesh;
  }

  limb(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, length: number, material: THREE.Material, rx = 0, rz = 0): THREE.Mesh {
    const mesh = this.add(parent, new THREE.CapsuleGeometry(radius, length, 6, 12), material, x, y, z);
    mesh.rotation.set(rx, 0, rz);
    return mesh;
  }

  cone(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, height: number, material: THREE.Material, rx = 0, rz = 0): THREE.Mesh {
    const mesh = this.add(parent, new THREE.ConeGeometry(radius, height, 14), material, x, y, z);
    mesh.rotation.set(rx, 0, rz);
    return mesh;
  }

  ring(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, tube: number, material: THREE.Material, rx = 0, rz = 0): THREE.Mesh {
    const mesh = this.add(parent, new THREE.TorusGeometry(radius, tube, 6, 18), material, x, y, z);
    mesh.rotation.set(rx, 0, rz);
    return mesh;
  }

  tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material, taper: (t: number) => number): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points);
    const seg = 18;
    const radial = 8;
    const geo = new THREE.TubeGeometry(curve, seg, radius, radial, false);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      curve.getPointAt(t, c);
      const k = Math.max(0.02, taper(t));
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
        pos.setXYZ(idx, p.x, p.y, p.z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return this.add(parent, geo, material, 0, 0, 0);
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.geos.length = 0;
    this.mats.length = 0;
    this.root.clear();
  }
}

function buildSkin(sc: Sculptor, p: Palette, shiny: boolean): Skin {
  const hue = shiny ? 0.5 : 0;
  const sat = shiny ? 1.3 : 1;
  const light = shiny ? 1.12 : 1;
  const accent = shade(p.accent, hue, sat, light);
  return {
    primary: sc.material(shade(p.primary, hue, sat, light), 0.74),
    secondary: sc.material(shade(p.secondary, hue, sat, light), 0.8),
    accent: sc.material(accent, 0.6, accent, 0.45),
    dark: sc.material(0x241a16, 0.72),
    iris: sc.material(p.eye, 0.5),
    pupil: sc.material(0x0b0908, 0.45),
    white: sc.material(0xf8f3e6, 0.62),
    glow: sc.material(0xffffff, 0.4, 0xffffff, 0.9),
  };
}

function eyes(sc: Sculptor, parent: THREE.Object3D, skin: Skin, x: number, y: number, z: number, r: number): void {
  for (const s of [-1, 1]) {
    sc.ball(parent, s * x, y, z, r, skin.white, 1, 1.1, 0.72);
    sc.ball(parent, s * x, y, z + r * 0.34, r * 0.66, skin.iris, 1, 1, 0.62);
    sc.ball(parent, s * x, y, z + r * 0.56, r * 0.32, skin.pupil, 1, 1, 0.6);
    sc.ball(parent, s * x - r * 0.2, y + r * 0.22, z + r * 0.64, r * 0.17, skin.glow);
  }
}

function ear(sc: Sculptor, parent: THREE.Object3D, skin: Skin, x: number, height: number, width: number, tilt: number, tip: THREE.Material): void {
  const g = group(parent, x, height * 0.2, -0.03);
  g.rotation.z = -tilt * (x >= 0 ? 1 : -1);
  g.rotation.x = -0.12;
  sc.cone(g, 0, height * 0.5, 0, width, height, skin.primary);
  sc.cone(g, 0, height * 0.48, width * 0.22, width * 0.58, height * 0.68, skin.secondary);
  sc.cone(g, 0, height * 0.9, 0, width * 0.45, height * 0.32, tip);
}

function legTo(sc: Sculptor, parent: THREE.Object3D, x: number, z: number, hipY: number, radius: number, upper: THREE.Material, paw: THREE.Material): THREE.Group {
  const g = group(parent, x, hipY, z);
  sc.limb(g, 0, -hipY * 0.5, 0, radius, Math.max(0.1, hipY - radius * 3.2), upper);
  const py = -hipY + radius * 0.7;
  sc.ball(g, 0, py, radius * 0.55, radius * 1.3, paw, 1.05, 0.62, 1.3);
  for (let i = -1; i <= 1; i++) sc.ball(g, i * radius * 0.62, py - radius * 0.08, radius * 1.4, radius * 0.42, paw, 1, 0.6, 1.2);
  return g;
}

function simpleHead(sc: Sculptor, head: THREE.Group, skin: Skin, r: number, muzzle = 0.72): void {
  const mz = r * muzzle;
  sc.ball(head, 0, 0.02, 0, r, skin.primary, 1, 0.96, 1.04);
  sc.ball(head, 0, r * 0.2, -r * 0.05, r * 0.92, skin.primary, 1, 0.86, 0.92);
  sc.ball(head, 0, -r * 0.3, mz, r * 0.6, skin.secondary, 0.98, 0.74, 0.92);
  sc.ball(head, 0, -r * 0.14, mz + r * 0.5, r * 0.2, skin.dark);
  sc.ball(head, 0, -r * 0.52, mz + r * 0.28, r * 0.16, skin.dark, 1.6, 0.28, 0.5);
  for (const s of [-1, 1]) sc.ball(head, s * r * 0.68, -r * 0.26, mz * 0.45, r * 0.34, skin.primary, 0.92, 0.92, 0.92);
  for (const s of [-1, 1]) sc.ball(head, s * r * 0.48, r * 0.46, r * 0.44, r * 0.36, skin.primary, 1, 0.52, 0.66);
  eyes(sc, head, skin, r * 0.46, r * 0.22, r * 0.8, r * 0.3);
}

function adorn(sc: Sculptor, sp: CreatureSpecies, skin: Skin, y: number, z: number): void {
  const s = sc.sway;
  const el = sp.element;
  const grand = sp.tier === 'stage3' || sp.tier === 'legendary' || sp.tier === 'mythical' || sp.tier === 'pseudo';
  if (el === 'fire') {
    for (let i = -1; i <= 1; i++) sc.cone(s, i * 0.13, y + 0.16, z + i * 0.1, 0.09, grand ? 0.44 : 0.3, skin.accent, -0.2, i * 0.25);
  } else if (el === 'water') {
    sc.cone(s, 0, y + 0.18, z, 0.12, grand ? 0.46 : 0.32, skin.accent, -0.2, 0);
    for (const sd of [-1, 1]) sc.ball(s, sd * 0.3, y + 0.02, z - 0.05, 0.1, skin.accent, 1, 0.6, 1.4);
  } else if (el === 'grass') {
    for (let i = 0; i < 4; i++) {
      const a = -0.5 + i * 0.34;
      sc.ball(s, Math.sin(a) * 0.26, y + 0.14, z - Math.cos(a) * 0.2, 0.16, skin.accent, 0.45, 1.1, 0.75);
      sc.ball(s, Math.sin(a) * 0.3, y + 0.16, z - Math.cos(a) * 0.24, 0.05, skin.secondary);
    }
  } else if (el === 'electric') {
    for (let i = -1; i <= 1; i++) sc.cone(s, i * 0.18, y + 0.2, z + i * 0.08, 0.06, 0.28, skin.accent, 0, i * 0.2);
  } else if (el === 'shadow') {
    for (let i = 0; i < 3; i++) sc.ball(s, Math.sin(i * 2) * 0.22, y + 0.16, z - i * 0.16, 0.16, skin.accent, 1, 0.9, 0.7);
  } else {
    for (let i = 0; i < 3; i++) sc.cone(s, (i - 1) * 0.16, y + 0.24 - Math.abs(i - 1) * 0.05, z - 0.02, 0.075, 0.32, skin.accent, 0, (i - 1) * 0.3);
  }
  if (grand) for (const sd of [-1, 1]) sc.cone(s, sd * 0.26, y + 0.24, z - 0.1, 0.07, 0.34, skin.secondary, -0.5, sd * 0.5);
}

function buildQuadruped(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const grand = sp.tier === 'stage3' || sp.tier === 'legendary' || sp.tier === 'pseudo';
  const hip = grand ? 0.78 : 0.64;
  for (const z of [-0.42, 0.4]) for (const x of [-0.28, 0.28]) {
    const leg = legTo(sc, s, x, z, hip, grand ? 0.11 : 0.1, skin.primary, skin.secondary);
    leg.rotation.z = x > 0 ? -0.05 : 0.05;
    sc.legs.push(leg);
  }
  sc.ball(s, 0, hip + 0.14, -0.06, 0.44, skin.primary, 0.9, 0.84, 1.3);
  sc.ball(s, 0, hip - 0.08, 0.22, 0.32, skin.secondary, 0.86, 0.62, 1.1);
  sc.ball(s, 0, hip + 0.08, -0.54, 0.28, skin.primary, 1, 0.94, 0.9);
  const head = group(s, 0, hip + 0.5, 0.46);
  sc.heads.push(head);
  simpleHead(sc, head, skin, 0.3, 0.72);
  const tip = sp.element === 'fire' ? skin.dark : skin.accent;
  ear(sc, head, skin, 0.17, 0.36, 0.13, 0.24, tip);
  ear(sc, head, skin, -0.17, 0.36, 0.13, 0.24, tip);
  const tail = group(s, 0, hip + 0.3, -0.68);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0), V(0, 0.14, -0.18), V(0, 0.34, -0.3), V(0, 0.4, -0.5)], 0.1, skin.primary, (t) => 1 - t * 0.62);
  sc.ball(tail, 0, 0.42, -0.55, 0.11, skin.accent, 1, 1, 1.4);
  adorn(sc, sp, skin, hip + 0.44, -0.36);
}

function buildBiped(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const grand = sp.tier === 'stage3' || sp.tier === 'legendary' || sp.tier === 'pseudo';
  const hip = grand ? 0.78 : 0.66;
  for (const x of [-0.22, 0.22]) {
    const leg = legTo(sc, s, x, 0, hip, 0.11, skin.primary, skin.secondary);
    leg.rotation.z = x > 0 ? -0.06 : 0.06;
    sc.legs.push(leg);
  }
  sc.ball(s, 0, hip + 0.42, 0, 0.42, skin.primary, 1, 1.06, 0.84);
  sc.ball(s, 0, hip + 0.26, 0.19, 0.3, skin.secondary, 0.92, 0.86, 0.66);
  for (const x of [-0.44, 0.44]) {
    const arm = group(s, x, hip + 0.62, 0.02);
    arm.rotation.z = x > 0 ? -0.26 : 0.26;
    sc.limb(arm, 0, -0.24, 0, 0.085, 0.4, skin.primary);
    sc.ball(arm, 0, -0.5, 0.04, 0.12, skin.secondary, 1, 0.92, 1.16);
    sc.arms.push(arm);
  }
  const head = group(s, 0, hip + 1.06, 0.02);
  sc.heads.push(head);
  simpleHead(sc, head, skin, 0.3, 0.66);
  ear(sc, head, skin, 0.16, 0.3, 0.12, 0.2, skin.accent);
  ear(sc, head, skin, -0.16, 0.3, 0.12, 0.2, skin.accent);
  const tail = group(s, 0, hip + 0.2, -0.36);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0), V(0, -0.14, -0.2), V(0, -0.3, -0.36)], 0.08, skin.primary, (t) => 1 - t * 0.5);
  adorn(sc, sp, skin, hip + 0.86, -0.32);
}

function buildBird(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const r = sp.tier === 'legendary' || sp.tier === 'mythical' ? 0.4 : 0.32;
  for (const x of [-0.14, 0.14]) {
    const leg = legTo(sc, s, x, 0.02, 0.52, 0.05, skin.accent, skin.accent);
    sc.legs.push(leg);
  }
  sc.ball(s, 0, 0.8, 0.02, r, skin.primary, 1, 1.06, 1.32);
  sc.ball(s, 0, 0.74, 0.18, r * 0.8, skin.secondary, 0.95, 0.9, 0.9);
  const head = group(s, 0, 1.16, 0.16);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.24, skin.primary, 1, 0.98, 1);
  sc.ball(head, 0, 0.16, -0.02, 0.22, skin.primary, 1, 0.8, 0.9);
  sc.cone(head, 0, -0.02, 0.26, 0.08, 0.24, skin.accent, Math.PI / 2, 0);
  eyes(sc, head, skin, 0.12, 0.07, 0.17, 0.075);
  for (const sd of [-1, 1]) {
    const w = group(s, sd * 0.26, 0.88, -0.02);
    w.rotation.z = sd * 0.18;
    sc.ball(w, sd * 0.3, 0.06, -0.05, 0.4, skin.primary, 1.15, 0.9, 0.22);
    sc.ball(w, sd * 0.54, 0.02, -0.1, 0.26, skin.secondary, 1.2, 0.85, 0.2);
    for (let i = 0; i < 3; i++) sc.cone(w, sd * (0.5 + i * 0.14), -0.04, -0.2, 0.06, 0.3, skin.accent, Math.PI / 2, sd * 0.35);
    sc.wings.push(w);
    sc.wingSide.push(sd);
    sc.wingBase.push(w.rotation.z);
  }
  const tail = group(s, 0, 0.74, -0.38);
  sc.tails.push(tail);
  for (let i = -1; i <= 1; i++) sc.cone(tail, i * 0.12, 0.02, -0.24, 0.09, 0.5, skin.primary, Math.PI / 2 + 0.2, i * 0.3);
}

function buildSerpent(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const big = sp.tier === 'legendary' || sp.tier === 'pseudo';
  sc.tube(s, [V(0, 0.3, -1.05), V(0.07, 0.36, -0.62), V(-0.06, 0.46, -0.2), V(0, 0.68, 0.16), V(0, 0.96, 0.34), V(0, 1.18, 0.42)], big ? 0.27 : 0.21, skin.primary, (t) => 0.75 + 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.05)));
  for (let i = 0; i < 4; i++) sc.ball(s, 0, 0.34, -0.8 + i * 0.3, 0.2 - i * 0.02, skin.secondary, 0.9, 0.5, 1.1);
  const head = group(s, 0, 1.3, 0.5);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.26, skin.primary, 1, 0.9, 1.15);
  sc.ball(head, 0, -0.08, 0.3, 0.16, skin.secondary, 0.9, 0.66, 1.05);
  sc.ball(head, 0, -0.04, 0.44, 0.05, skin.dark);
  sc.ball(head, 0, -0.14, 0.4, 0.05, skin.dark, 1.7, 0.3, 0.5);
  eyes(sc, head, skin, 0.12, 0.09, 0.19, 0.075);
  ear(sc, head, skin, 0.13, 0.3, 0.1, 0.35, skin.accent);
  ear(sc, head, skin, -0.13, 0.3, 0.1, 0.35, skin.accent);
  const tail = group(s, 0, 0.3, -1.05);
  sc.tails.push(tail);
  sc.cone(tail, 0, 0.02, -0.2, 0.12, 0.36, skin.accent, -1.25, 0);
  adorn(sc, sp, skin, 0.72, -0.5);
}

function buildFloater(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const r = sp.tier === 'basic' ? 0.44 : 0.58;
  sc.ball(s, 0, 0.98, 0, r, skin.primary, 1, 0.96, 1);
  sc.ball(s, 0, 0.76, 0.1, r * 0.86, skin.secondary, 0.95, 0.7, 0.95);
  sc.ball(s, 0, 1.0 + r * 0.94, -0.02, 0.16, skin.accent, 1, 1, 1);
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.3;
    sc.cone(s, Math.sin(a) * r * 0.8, 0.42, Math.cos(a) * r * 0.5, 0.07, 0.38, skin.accent, Math.PI, 0);
  }
  eyes(sc, s, skin, r * 0.42, 1.1, r * 0.82, 0.13);
  sc.ball(s, 0, 0.94, r * 0.96, 0.05, skin.dark);
  for (const sd of [-1, 1]) {
    const fin = group(s, sd * r * 0.86, 0.94, -0.06);
    fin.rotation.z = sd * 0.2;
    sc.ball(fin, sd * 0.16, 0, 0, 0.2, skin.accent, 1, 0.4, 0.75);
    sc.wings.push(fin);
    sc.wingSide.push(sd);
    sc.wingBase.push(fin.rotation.z);
  }
  const tail = group(s, 0, 0.88, -r * 0.9);
  sc.tails.push(tail);
  sc.cone(tail, 0, 0, -0.2, 0.16, 0.42, skin.accent, -1.3, 0);
  adorn(sc, sp, skin, 1.0 + r * 0.7, -0.2);
}

function buildBug(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const y = 0.46;
  if (sp.id === 'teslapede') {
    for (let i = 0; i < 9; i++) {
      const z = -0.86 + i * 0.2;
      const r = 0.19 - Math.abs(i - 4) * 0.012;
      sc.ball(s, 0, y + Math.sin(i * 0.7) * 0.03, z, r, skin.primary, 1, 0.85, 1);
      sc.ball(s, 0, y + r * 0.8, z, r * 0.5, skin.accent, 1, 0.8, 1);
    }
    for (let i = 1; i < 8; i++) for (const sd of [-1, 1]) {
      const leg = group(s, sd * 0.16, y, -0.86 + i * 0.2);
      leg.rotation.z = sd * 0.7;
      sc.limb(leg, 0, -0.12, 0, 0.032, 0.2, skin.dark);
      sc.ball(leg, 0, -0.24, 0, 0.05, skin.secondary, 1, 0.6, 1.2);
      sc.legs.push(leg);
    }
    const head = group(s, 0, y + 0.06, 0.94);
    sc.heads.push(head);
    sc.ball(head, 0, 0, 0, 0.2, skin.primary);
    eyes(sc, head, skin, 0.12, 0.05, 0.14, 0.07);
    for (const sd of [-1, 1]) sc.tube(head, [V(sd * 0.1, 0.14, 0.05), V(sd * 0.24, 0.3, 0.16), V(sd * 0.34, 0.42, 0.3)], 0.02, skin.accent, () => 1);
    const tail = group(s, 0, y, -0.94);
    sc.tails.push(tail);
    sc.cone(tail, 0, 0.02, -0.12, 0.08, 0.24, skin.accent, -1.3, 0);
    return;
  }
  sc.ball(s, 0, y, -0.42, 0.32, skin.primary, 1, 0.86, 1.12);
  sc.ball(s, 0, y + 0.02, 0.06, 0.26, skin.primary, 1, 0.9, 1);
  sc.ball(s, 0, y - 0.04, -0.42, 0.3, skin.secondary, 0.98, 0.5, 1.05);
  for (let i = 0; i < 3; i++) sc.ball(s, 0, y + 0.2, -0.62 + i * 0.24, 0.24, skin.secondary, 1.4, 0.6, 1.15);
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leg = group(s, sd * 0.22, y - 0.06, -0.24 + i * 0.24);
    leg.rotation.z = sd * 0.6;
    sc.limb(leg, 0, -0.16, 0, 0.04, 0.26, skin.dark);
    sc.ball(leg, 0, -0.32, 0, 0.06, skin.secondary, 1, 0.6, 1.2);
    sc.legs.push(leg);
  }
  const head = group(s, 0, y + 0.06, 0.42);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.2, skin.primary, 1, 0.94, 1);
  sc.ball(head, 0, -0.06, 0.18, 0.12, skin.secondary);
  eyes(sc, head, skin, 0.13, 0.04, 0.15, 0.075);
  for (const sd of [-1, 1]) sc.tube(head, [V(sd * 0.1, 0.12, 0.06), V(sd * 0.22, 0.3, 0.2), V(sd * 0.3, 0.44, 0.36)], 0.022, skin.dark, () => 1);
  const tail = group(s, 0, y, -0.72);
  sc.tails.push(tail);
  sc.cone(tail, 0, 0.04, -0.1, 0.09, 0.26, skin.accent, -1.3, 0);
  adorn(sc, sp, skin, y + 0.34, -0.5);
}

function buildMole(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  const hulk = sp.tier === 'stage3';
  const r = hulk ? 0.62 : 0.5;
  sc.ball(s, 0, r * 0.9, -0.04, r, skin.primary, 1, 0.8, 1.3);
  sc.ball(s, 0, r * 0.52, 0.12, r * 0.86, skin.secondary, 0.95, 0.62, 1.15);
  for (let i = 0; i < 4; i++) sc.ball(s, 0, r * 1.52, -0.44 + i * 0.3, 0.22, skin.secondary, 1.35, 0.75, 1.1);
  if (hulk) for (let i = 0; i < 3; i++) sc.cone(s, (i - 1) * 0.3, r * 1.68, -0.3 + i * 0.3, 0.1, 0.3, skin.accent, 0, 0);
  sc.ball(s, 0, r * 0.76, r * 1.02, 0.2, skin.primary, 1, 0.8, 1.1);
  sc.ball(s, 0, r * 0.72, r * 1.42, 0.08, skin.dark);
  eyes(sc, s, skin, 0.16, r * 1.02, r * 1.02, 0.06);
  for (const sd of [-1, 1]) {
    const arm = group(s, sd * 0.42, r * 0.62, 0.34);
    sc.limb(arm, 0, -0.16, 0, 0.1, 0.3, skin.primary);
    sc.cone(arm, 0, -0.34, 0.14, 0.15, 0.4, skin.accent, 1.2, 0);
    sc.arms.push(arm);
  }
  const tail = group(s, 0, r * 0.7, -0.72);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0), V(0, 0.1, -0.16), V(0, 0.22, -0.3)], 0.07, skin.primary, (t) => 1 - t * 0.4);
}


function buildCrustacean(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {
    const leg = group(s, sd * 0.3, 0.44, -0.3 + i * 0.3);
    leg.rotation.z = sd * -0.5;
    sc.limb(leg, sd * 0.14, -0.14, 0, 0.055, 0.28, skin.primary);
    sc.ball(leg, sd * 0.26, -0.3, 0, 0.07, skin.secondary, 1, 0.6, 1.3);
    sc.legs.push(leg);
  }
  sc.ball(s, 0, 0.54, 0.1, 0.38, skin.primary, 1, 0.85, 1.1);
  const shell = group(s, 0, 0.68, -0.14);
  sc.tails.push(shell);
  sc.limb(shell, 0, 0.3, 0, 0.34, 0.46, skin.secondary);
  sc.cone(shell, 0, 0.66, 0, 0.36, 0.3, skin.secondary);
  sc.ball(shell, 0, 0.82, 0, 0.13, skin.glow, 1, 1, 1);
  sc.cone(shell, 0, 0.98, 0, 0.18, 0.16, skin.primary);
  for (const sd of [-1, 1]) {
    const claw = group(s, sd * 0.42, 0.52, 0.42);
    sc.limb(claw, 0, -0.14, 0, 0.07, 0.24, skin.primary);
    sc.ball(claw, 0, -0.3, 0.06, 0.16, skin.accent, 1.2, 0.9, 0.8);
    sc.cone(claw, sd * 0.06, -0.34, 0.22, 0.07, 0.22, skin.accent, 1.2, 0);
    sc.arms.push(claw);
    sc.limb(s, sd * 0.1, 0.78, 0.4, 0.03, 0.14, skin.primary);
    sc.ball(s, sd * 0.1, 0.88, 0.4, 0.062, skin.iris);
  }
  adorn(sc, sp, skin, 0.82, 0.2);
}

function buildMoth(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  sc.ball(s, 0, 1.02, -0.03, 0.17, skin.primary, 1, 1.5, 1.1);
  sc.ball(s, 0, 1.36, 0.06, 0.2, skin.secondary);
  for (const x of [-0.09, 0.09]) {
    const leg = legTo(sc, s, x, -0.02, 0.8, 0.028, skin.dark, skin.dark);
    sc.legs.push(leg);
  }
  const head = group(s, 0, 1.54, 0.1);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.16, skin.primary);
  eyes(sc, head, skin, 0.11, 0.02, 0.12, 0.07);
  for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) sc.ball(head, sd * (0.08 + i * 0.03), 0.16 + i * 0.05, 0.02 - i * 0.01, 0.035, skin.accent);
  for (const sd of [-1, 1]) {
    const w = group(s, sd * 0.12, 1.34, -0.06);
    w.rotation.z = sd * 0.3;
    w.rotation.y = sd * 0.4;
    sc.ball(w, sd * 0.44, 0.05, -0.05, 0.5, skin.secondary, 1.1, 0.85, 0.26);
    sc.ball(w, sd * 0.3, -0.26, 0.05, 0.32, skin.primary, 1, 0.8, 0.26);
    for (let i = 0; i < 3; i++) sc.ring(w, sd * (0.3 + i * 0.16), 0.06, -0.05, 0.12, 0.02, skin.accent, Math.PI / 2, 0);
    sc.wings.push(w);
    sc.wingSide.push(sd);
    sc.wingBase.push(w.rotation.z);
  }
  const tail = group(s, 0, 0.86, -0.1);
  sc.tails.push(tail);
  sc.cone(tail, 0, -0.1, -0.1, 0.1, 0.3, skin.primary, Math.PI, 0);
  adorn(sc, sp, skin, 1.6, -0.05);
}

function buildEmberkit(sc: Sculptor, skin: Skin): void {
  const s = sc.sway;
  const cream = sc.material(0xffe7c4, 0.78);
  const rust = sc.material(0x4a2a18, 0.72);
  const amber = sc.material(0xffb020, 0.5, 0xff9a00, 0.25);
  const hip = 0.32;
  for (const z of [-0.32, 0.32]) for (const x of [-0.2, 0.2]) {
    const leg = legTo(sc, s, x, z, hip, 0.09, skin.primary, cream);
    leg.rotation.z = x > 0 ? -0.09 : 0.09;
    sc.legs.push(leg);
  }
  sc.ball(s, 0, hip + 0.16, -0.02, 0.42, skin.primary, 1.04, 0.92, 1.16);
  sc.ball(s, 0, hip + 0.02, 0.2, 0.32, cream, 0.96, 0.74, 1.02);
  sc.ball(s, 0, hip + 0.1, -0.46, 0.28, skin.primary, 1, 0.9, 0.92);
  const head = group(s, 0, hip + 0.5, 0.4);
  sc.heads.push(head);
  sc.ball(head, 0, 0.02, 0, 0.37, skin.primary, 1.02, 0.96, 1.02);
  sc.ball(head, 0, -0.06, 0.16, 0.28, cream, 1.08, 0.82, 0.78);
  sc.ball(head, 0, -0.08, 0.28, 0.2, cream, 0.98, 0.72, 0.86);
  sc.ball(head, 0, -0.04, 0.44, 0.07, rust);
  sc.ball(head, 0, -0.18, 0.36, 0.05, rust, 1.45, 0.28, 0.46);
  for (const sd of [-1, 1]) sc.ball(head, sd * 0.24, -0.06, 0.16, 0.12, cream, 1, 0.9, 0.86);
  for (const sd of [-1, 1]) {
    sc.ball(head, sd * 0.15, 0.05, 0.28, 0.1, skin.white, 1, 1.04, 0.58);
    sc.ball(head, sd * 0.15, 0.05, 0.315, 0.072, amber, 1, 1, 0.52);
    sc.ball(head, sd * 0.15, 0.05, 0.34, 0.04, skin.pupil, 1, 1, 0.5);
    sc.ball(head, sd * 0.11, 0.09, 0.355, 0.028, skin.glow);
    sc.ball(head, sd * 0.16, 0.24, 0.1, 0.08, skin.primary, 1.15, 0.34, 0.55);
  }
  const earMount = group(head, 0, 0.22, 0);
  ear(sc, earMount, skin, 0.2, 0.34, 0.18, 0.28, rust);
  ear(sc, earMount, skin, -0.2, 0.34, 0.18, 0.28, rust);
  const tail = group(s, 0, hip + 0.22, -0.46);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0.04), V(0.1, 0.14, -0.1), V(-0.08, 0.32, -0.2), V(0.04, 0.5, -0.34)], 0.16, skin.primary, (t) => (1 - t * 0.32) * (0.9 + 0.5 * Math.sin(Math.PI * t)));
  sc.tube(tail, [V(0.1, 0.04, 0.02), V(0.18, 0.18, -0.12), V(0.04, 0.36, -0.22), V(0.08, 0.48, -0.32)], 0.09, skin.accent, (t) => (1 - t * 0.4) * (0.7 + 0.45 * Math.sin(Math.PI * t)));
  sc.tube(tail, [V(-0.1, 0.04, 0.02), V(-0.16, 0.18, -0.12), V(-0.06, 0.34, -0.22), V(-0.04, 0.46, -0.3)], 0.08, skin.accent, (t) => (1 - t * 0.42) * (0.65 + 0.4 * Math.sin(Math.PI * t)));
  sc.ball(tail, 0.02, 0.54, -0.36, 0.09, cream, 0.85, 1.2, 0.7);
}

function buildDrizzlet(sc: Sculptor, skin: Skin): void {
  const s = sc.sway;
  const cream = sc.material(0xdff2ff, 0.78);
  const fin = sc.material(0x1f7fbf, 0.66, 0x2ea8ff, 0.3);
  const hip = 0.34;
  for (const z of [-0.4, 0.26]) for (const x of [-0.22, 0.22]) {
    const leg = legTo(sc, s, x, z, hip, 0.075, skin.primary, cream);
    leg.rotation.z = x > 0 ? -0.1 : 0.1;
    sc.legs.push(leg);
    sc.ball(leg, 0, -hip + 0.05, 0.1, 0.08, fin, 1.4, 0.26, 0.95);
  }
  sc.ball(s, 0, hip + 0.1, -0.08, 0.34, skin.primary, 0.78, 0.58, 1.6);
  sc.ball(s, 0, hip + 0.02, 0.3, 0.26, cream, 0.82, 0.52, 1.12);
  sc.ball(s, 0, hip + 0.08, -0.58, 0.2, skin.primary, 0.88, 0.66, 0.82);
  sc.ball(s, 0, hip + 0.18, -0.18, 0.14, fin, 0.32, 0.5, 0.95);
  for (const sd of [-1, 1]) {
    const f = group(s, sd * 0.36, hip + 0.02, -0.06);
    f.rotation.z = sd * 0.25;
    sc.ball(f, sd * 0.16, 0, -0.04, 0.2, fin, 1, 0.34, 0.85);
    sc.wings.push(f);
    sc.wingSide.push(sd);
    sc.wingBase.push(f.rotation.z);
  }
  const head = group(s, 0, hip + 0.34, 0.52);
  sc.heads.push(head);
  sc.ball(head, 0, 0.02, 0.02, 0.36, skin.primary, 1.06, 0.96, 1.08);
  sc.ball(head, 0, -0.08, 0.26, 0.2, cream, 1.02, 0.7, 0.86);
  sc.ball(head, 0, -0.04, 0.44, 0.05, skin.dark);
  sc.ball(head, 0, -0.16, 0.34, 0.04, skin.dark, 1.35, 0.26, 0.42);
  for (const sd of [-1, 1]) sc.ball(head, sd * 0.22, -0.05, 0.18, 0.1, cream, 1, 0.88, 0.84);
  for (const sd of [-1, 1]) sc.ball(head, sd * 0.16, 0.36, -0.06, 0.07, skin.primary, 1.15, 0.65, 0.8);
  for (const sd of [-1, 1]) {
    sc.ball(head, sd * 0.13, 0.05, 0.40, 0.098, skin.white, 1, 1.02, 0.55);
    sc.ball(head, sd * 0.13, 0.05, 0.43, 0.07, skin.iris, 1, 1, 0.5);
    sc.ball(head, sd * 0.13, 0.05, 0.455, 0.036, skin.pupil, 1, 1, 0.48);
    sc.ball(head, sd * 0.1, 0.09, 0.47, 0.026, skin.glow);
    sc.tube(head, [V(sd * 0.18, -0.02, 0.28), V(sd * 0.28, 0, 0.32)], 0.007, skin.white, () => 1);
  }
  const tail = group(s, 0, hip + 0.08, -0.62);
  sc.tails.push(tail);
  sc.tube(tail, [V(0, 0, 0.04), V(0.06, -0.02, -0.14), V(-0.04, 0.06, -0.28), V(0, 0.16, -0.22)], 0.09, skin.primary, (t) => 0.95 - t * 0.3);
  sc.ball(tail, 0, 0.18, -0.18, 0.09, fin, 0.38, 0.62, 0.8);
}

function buildSproutle(sc: Sculptor, skin: Skin): void {
  const s = sc.sway;
  const leafDark = sc.material(0x2f8f3c, 0.72);
  const leafLight = sc.material(0x8ee07a, 0.76);
  const bark = sc.material(0x7a5a34, 0.8);
  const hip = 0.36;
  for (const z of [-0.32, 0.34]) for (const x of [-0.28, 0.28]) {
    const leg = legTo(sc, s, x, z, hip, 0.11, skin.primary, skin.secondary);
    leg.rotation.z = x > 0 ? -0.22 : 0.22;
    sc.legs.push(leg);
  }
  sc.ball(s, 0, hip + 0.2, 0, 0.42, skin.primary, 0.96, 0.72, 1.05);
  sc.ball(s, 0, hip + 0.06, 0.24, 0.3, skin.secondary, 0.9, 0.6, 1.05);
  const shell = group(s, 0, hip + 0.34, -0.04);
  sc.tails.push(shell);
  sc.ball(shell, 0, 0.06, 0, 0.5, leafDark, 1, 0.5, 1.1);
  sc.ball(shell, 0, 0.14, 0, 0.4, leafLight, 1, 0.42, 1.05);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    sc.ball(shell, Math.cos(a) * 0.34, 0.16, Math.sin(a) * 0.36, 0.16, leafDark, 1, 0.34, 1);
  }
  const sprout = group(s, 0, hip + 0.58, -0.06);
  sc.tails.push(sprout);
  sc.tube(sprout, [V(0, 0, 0), V(0.02, 0.14, 0.02), V(-0.02, 0.26, 0.04)], 0.04, bark, (t) => 1 - t * 0.35);
  for (const sd of [-1, 1]) {
    const leaf = sc.ball(sprout, sd * 0.18, 0.3, 0.04, 0.16, leafLight, 1.4, 0.32, 0.95);
    leaf.rotation.z = sd * 0.7;
    leaf.rotation.x = -0.28;
    const tip = sc.ball(sprout, sd * 0.32, 0.26, 0.05, 0.11, skin.accent, 1.25, 0.3, 0.72);
    tip.rotation.z = sd * 1;
    tip.rotation.x = -0.18;
  }
  const head = group(s, 0, hip + 0.4, 0.46);
  sc.heads.push(head);
  sc.ball(head, 0, 0, 0, 0.3, skin.primary, 1.02, 0.96, 1.02);
  sc.ball(head, 0, -0.08, 0.2, 0.18, skin.secondary, 1, 0.74, 0.86);
  sc.ball(head, 0, -0.04, 0.36, 0.048, skin.dark);
  sc.ball(head, 0, -0.15, 0.28, 0.04, skin.dark, 1.45, 0.26, 0.42);
  for (const sd of [-1, 1]) sc.ball(head, sd * 0.18, -0.04, 0.14, 0.09, skin.secondary, 1, 0.86, 0.86);
  for (const sd of [-1, 1]) {
    sc.ball(head, sd * 0.1, 0.04, 0.31, 0.092, skin.white, 1, 1.02, 0.52);
    sc.ball(head, sd * 0.1, 0.04, 0.34, 0.064, skin.iris, 1, 1, 0.48);
    sc.ball(head, sd * 0.1, 0.04, 0.358, 0.032, skin.pupil);
    sc.ball(head, sd * 0.075, 0.075, 0.37, 0.02, skin.glow);
    sc.ball(head, sd * 0.11, 0.18, 0.08, 0.065, skin.primary, 1.2, 0.34, 0.5);
  }
}

function signature(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  if (sp.id === 'infernyx') {
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36;
      const t = group(s, Math.sin(a) * 0.26, 1.16, -0.62);
      sc.tails.push(t);
      sc.tube(t, [V(0, 0, 0), V(Math.sin(a) * 0.14, 0.34, -0.26), V(Math.sin(a) * 0.3, 0.62, -0.42)], 0.075, skin.primary, (u) => (1 - u) * (0.7 + 0.7 * Math.sin(Math.PI * u)));
    }
  } else if (sp.id === 'solarion') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      sc.cone(s, Math.cos(a) * 0.44, 1.66 + Math.sin(a) * 0.36, -0.34, 0.075, 0.34, skin.accent, 0, -a);
    }
    sc.ball(s, 0, 1.62, -0.3, 0.3, skin.secondary, 1, 1, 0.5);
  } else if (sp.id === 'lumicorn') {
    sc.cone(s, 0, 1.72, 0.6, 0.075, 0.44, skin.accent, -0.5, 0);
    for (let i = 0; i < 6; i++) sc.ball(s, -0.24 + i * 0.1, 1.34 + i * 0.02, -0.34 + i * 0.1, 0.09, skin.secondary, 1, 1, 0.6);
  } else if (sp.id === 'shroomble') {
    sc.ball(s, 0, 2.06, 0, 0.44, skin.primary, 1, 0.52, 1);
    for (let i = 0; i < 5; i++) sc.ball(s, Math.sin(i * 1.3) * 0.24, 2.2, Math.cos(i * 1.3) * 0.2, 0.09, skin.secondary);
  } else if (sp.id === 'aetherion') {
    sc.cone(s, 0, 1.82, 0.1, 0.06, 0.4, skin.accent, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sc.cone(s, Math.cos(a) * 0.3, 1.7 + Math.sin(a) * 0.22, -0.02, 0.05, 0.3, skin.accent, 0, -a);
    }
  }
}

function buildByPlan(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  if (sp.id === 'emberkit') buildEmberkit(sc, skin);
  else if (sp.id === 'drizzlet') buildDrizzlet(sc, skin);
  else if (sp.id === 'sproutle') buildSproutle(sc, skin);
  else {
    const plan: BodyPlan = sp.body;
    if (plan === 'quadruped') buildQuadruped(sc, sp, skin);
    else if (plan === 'biped') buildBiped(sc, sp, skin);
    else if (plan === 'bird') buildBird(sc, sp, skin);
    else if (plan === 'serpent') buildSerpent(sc, sp, skin);
    else if (plan === 'floater') buildFloater(sc, sp, skin);
    else if (plan === 'bug') buildBug(sc, sp, skin);
    else if (plan === 'mole') buildMole(sc, sp, skin);
    else if (plan === 'crustacean') buildCrustacean(sc, sp, skin);
    else buildMoth(sc, sp, skin);
  }
  signature(sc, sp, skin);
}

function animate(sc: Sculptor, seconds: number, mood: CreatureMood): void {
  const t = Number.isFinite(seconds) ? seconds : 0;
  const b = sc.sway;
  let bob = Math.sin(t * 2.1) * 0.035;
  let yaw = Math.sin(t * 0.9) * 0.035;
  let lunge = 0;
  let pitch = 0;
  let roll = 0;
  let scale = 1;
  let headPitch = Math.sin(t * 2.1 + 0.7) * 0.06;
  let tailAmp = 0.26;
  let tailSpeed = 1.6;
  let wingAmp = 0.16;
  let wingSpeed = 5;
  let wingBias = 0;
  let legAmp = 0.04;
  let armAmp = 0.06;
  if (mood === 'attack') {
    const a = (Math.sin(t * 7) + 1) * 0.5;
    lunge = a * 0.22;
    bob += a * 0.05;
    pitch = -0.18 * a;
    headPitch = -0.3 - a * 0.2;
    tailAmp = 0.5;
    tailSpeed = 9;
    wingAmp = 0.6;
    wingSpeed = 14;
    legAmp = 0.14;
    armAmp = 0.4;
  } else if (mood === 'hurt') {
    lunge = -0.16;
    pitch = 0.22;
    roll = Math.sin(t * 24) * 0.06;
    headPitch = 0.3;
    tailAmp = 0.14;
    tailSpeed = 16;
    wingAmp = 0.08;
    wingSpeed = 18;
    legAmp = 0.02;
    armAmp = 0.03;
  } else if (mood === 'faint') {
    roll = 1.3;
    bob = -0.24;
    scale = 0.88;
    headPitch = 0.5;
    tailAmp = 0.06;
    tailSpeed = 1.2;
    wingBias = 0.55;
    wingAmp = 0.03;
    legAmp = 0.01;
    armAmp = 0.01;
  } else if (mood === 'celebrate') {
    const hop = Math.abs(Math.sin(t * 5.4));
    bob = hop * 0.3;
    yaw = Math.sin(t * 3.2) * 0.34;
    pitch = -hop * 0.1;
    headPitch = -0.22 - hop * 0.12;
    tailAmp = 0.5;
    tailSpeed = 8;
    wingAmp = 0.75;
    wingSpeed = 12;
    legAmp = 0.1;
    armAmp = 0.5;
  }
  b.position.set(0, bob, lunge);
  b.rotation.set(pitch, yaw, roll);
  b.scale.setScalar(scale);
  for (let i = 0; i < sc.heads.length; i++) sc.heads[i].rotation.x = headPitch;
  for (let i = 0; i < sc.tails.length; i++) {
    sc.tails[i].rotation.y = Math.sin(t * tailSpeed + i * 0.7) * tailAmp * (1 + i * 0.2);
    sc.tails[i].rotation.x = Math.sin(t * tailSpeed * 0.7 + i) * 0.06;
  }
  for (let i = 0; i < sc.wings.length; i++) sc.wings[i].rotation.z = sc.wingBase[i] + sc.wingSide[i] * (Math.sin(t * wingSpeed + i) * wingAmp - wingBias);
  for (let i = 0; i < sc.legs.length; i++) sc.legs[i].rotation.x = Math.sin(t * 3 + i * 1.6) * legAmp;
  for (let i = 0; i < sc.arms.length; i++) sc.arms[i].rotation.x = Math.sin(t * 2.4 + i * 1.6) * armAmp;
}

export function createCreatureModel(speciesId: string, shiny = false): CreatureModel {
  const sp = getSpecies(speciesId);
  const sc = new Sculptor();
  const skin = buildSkin(sc, sp.palette, shiny);
  buildByPlan(sc, sp, skin);
  sc.root.name = shiny ? sp.id + '-shiny' : sp.id;
  return {
    root: sc.root,
    update: (seconds: number, mood: CreatureMood = 'idle'): void => animate(sc, seconds, mood),
    dispose: (): void => sc.dispose(),
  };
}
