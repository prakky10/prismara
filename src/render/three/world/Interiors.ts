import * as THREE from 'three';
import type { MapDef } from '../../../world/maps';
import { hash2 } from './Noise';
import { Mesher } from './Mesher';
import { brickTexture, glowTexture, grainTexture, shaftTexture, wallpaperTexture } from './Textures';

/**
 * Procedural interior dioramas. Everything is derived from the map id, tile grid and NPC kinds;
 * collision is never touched. Furniture only fills tiles that are already solid (counters) or
 * hugs the walls with a shallow footprint, and never covers an NPC tile or a warp.
 */

export type RoomKind = 'lab' | 'house' | 'shop' | 'heal' | 'trial';
export type Element = 'grass' | 'electric' | 'water' | 'fire' | 'crystal';

export interface InteriorTheme {
  kind: RoomKind;
  element: Element | null;
  wallTex: 'paper' | 'plaster' | 'brick';
  paper: number;
  wain: number;
  trim: number;
  floorA: number;
  floorB: number;
  /** Floor is tiled (checker decals) rather than wooden planks. */
  checker: boolean;
}

const ELEMENTS: Record<Element, { main: number; dark: number; accent: number }> = {
  grass: { main: 0x4cae4a, dark: 0x1f5a34, accent: 0xc4f070 },
  electric: { main: 0xf2c92e, dark: 0x5c4a10, accent: 0x8ae0ff },
  water: { main: 0x3f9be0, dark: 0x173f78, accent: 0xa4ecff },
  fire: { main: 0xe8512a, dark: 0x6a2012, accent: 0xffc455 },
  crystal: { main: 0xa07cf0, dark: 0x40306e, accent: 0xeadcff },
};

const ELEMENT_BY_TOWN: Record<string, Element> = {
  thistlebrook: 'grass', voltspire: 'electric', tidehaven: 'water', ashfall: 'fire', geode: 'crystal',
};

export function roomKindFor(map: MapDef): RoomKind | null {
  if (map.indoor !== true) return null;
  const id = map.id;
  if (id === 'lumen-lab') return 'lab';
  if (id.endsWith('-trial')) return 'trial';
  if (id.endsWith('-heal')) return 'heal';
  if (id.endsWith('-shop')) return 'shop';
  if (id.endsWith('-house')) return 'house';
  if (map.npcs.some((n) => n.kind === 'trial')) return 'trial';
  if (map.npcs.some((n) => n.kind === 'heal')) return 'heal';
  if (map.npcs.some((n) => n.kind === 'shop')) return 'shop';
  return 'house';
}

function elementFor(map: MapDef): Element {
  const town = map.id.split('-')[0];
  return ELEMENT_BY_TOWN[town] ?? 'crystal';
}

const SHOP_PAPER = [0xcfe9d8, 0xf6d9c3, 0xd7e1f5, 0xf5ecc2, 0xe6d3f0];

function shade(hex: number, f: number): number {
  return new THREE.Color(hex).multiplyScalar(f).getHex();
}
function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
function idSeed(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function interiorTheme(map: MapDef): InteriorTheme | null {
  const kind = roomKindFor(map);
  if (!kind) return null;
  const seed = idSeed(map.id);
  switch (kind) {
    case 'lab':
      return { kind, element: null, wallTex: 'plaster', paper: 0xdde9ea, wain: 0x5f8189, trim: 0xe9e5da, floorA: 0xb4bcc0, floorB: 0x8f9a9f, checker: true };
    case 'heal':
      return { kind, element: null, wallTex: 'plaster', paper: 0xfbe4e6, wain: 0xf6efe8, trim: 0xe7d6cb, floorA: 0xf3e9dd, floorB: 0xf0c6cd, checker: true };
    case 'shop': {
      const paper = SHOP_PAPER[seed % SHOP_PAPER.length];
      return { kind, element: null, wallTex: 'paper', paper, wain: shade(mix(paper, 0x3a6a5a, 0.7), 0.85), trim: 0x7a5638, floorA: 0xc89258, floorB: 0xad7743, checker: false };
    }
    case 'trial': {
      const element = elementFor(map);
      const e = ELEMENTS[element];
      return { kind, element, wallTex: 'brick', paper: mix(0x9a95a6, e.dark, 0.28), wain: shade(e.dark, 0.9), trim: 0x4c4656, floorA: mix(0x625d70, e.dark, 0.18), floorB: mix(0x4c4858, e.dark, 0.25), checker: true };
    }
    default:
      return { kind, element: null, wallTex: 'paper', paper: 0xf3d9b5, wain: 0x8a5a3a, trim: 0x6b4a2e, floorA: 0xc89258, floorB: 0xad7743, checker: false };
  }
}

export interface InteriorScene {
  update(seconds: number): void;
  dispose(): void;
}

type Kind = 'box' | 'cyl' | 'sph' | 'cone' | 'oct' | 'tri' | 'disc';
type Side = 'N' | 'W' | 'E';
type IMat = 'matte' | 'gloss' | 'glow';

const BOOKS = [0xb5473a, 0x3a6ab5, 0x3f8f55, 0xd8a53a, 0x7a4aa8, 0x2f3a4a, 0xe2dccb, 0x2f8a8a];
const GOODS = [0xf25c8b, 0xffd24a, 0x4fc3f7, 0x7ad46a, 0xff8a3a, 0xb59cff, 0xffffff, 0xe0506e];
const LIQUID = [0x7be07a, 0x57c7f2, 0xf06a9a, 0xffd24a, 0xb08cff];
const WALL_H = 2.2;

export function buildInterior(map: MapDef, root: THREE.Group, reduced: boolean): InteriorScene | null {
  const theme = interiorTheme(map);
  if (!theme) return null;
  const W = map.width;
  const H = map.height;
  const seed = idSeed(map.id);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const group = new THREE.Group();
  group.name = 'interior';
  root.add(group);
  const rnd = (a: number, b: number, c = 0) => hash2(a, b, seed + c);

  /* ------------------------------------------------------------ materials */
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p);
    mats.push(m);
    return m;
  };
  const tex = <T extends THREE.Texture>(t: T): T => (texs.push(t), t);
  const grain = tex(grainTexture());
  const wallMap = tex(theme.wallTex === 'paper' ? wallpaperTexture() : theme.wallTex === 'brick' ? brickTexture() : grainTexture());
  const paperM = std({ vertexColors: true, map: wallMap, roughness: 0.92 });
  const trimM = std({ vertexColors: true, map: grain, roughness: 0.72 });
  const fabricM = std({ vertexColors: true, map: grain, roughness: 1 });
  const metalM = std({ vertexColors: true, roughness: 0.3, metalness: 0.7 });
  const glassM = std({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false });
  const noCast = new Set<THREE.Material>([glassM]);
  const pulses: { mat: THREE.MeshStandardMaterial; base: number; amp: number; speed: number }[] = [];
  const glows = new Map<number, THREE.MeshStandardMaterial>();
  const glow = (hex: number, intensity = 1) => {
    const key = hex * 8 + Math.round(intensity * 2);
    let m = glows.get(key);
    if (!m) {
      m = std({ color: hex, emissive: hex, emissiveIntensity: intensity, roughness: 0.4 });
      glows.set(key, m);
      noCast.add(m);
    }
    return m;
  };
  const pulse = (hex: number, intensity: number, amp: number, speed: number) => {
    const m = glow(hex, intensity);
    if (!pulses.some((p) => p.mat === m)) pulses.push({ mat: m, base: intensity, amp, speed });
    return m;
  };
  const warmGlow = glow(0xffe2a8, 1.1);

  /* --------------------------------------------------------- merged parts */
  const parts = new Map<THREE.Material, Mesher>();
  const part = (m: THREE.Material) => {
    let p = parts.get(m);
    if (!p) parts.set(m, (p = new Mesher()));
    return p;
  };
  const bx = (m: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) => {
    part(m).box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
  };
  const tilt = (m: THREE.Material, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: number, rx: number, ry: number, rz: number) => {
    part(m).box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz);
  };
  const unit: Record<Kind, THREE.BufferGeometry> = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
    disc: new THREE.CylinderGeometry(0.5, 0.5, 1, 56),
    sph: new THREE.IcosahedronGeometry(0.5, 1),
    cone: new THREE.ConeGeometry(0.5, 1, 8),
    oct: new THREE.OctahedronGeometry(0.5, 0),
    tri: new THREE.CylinderGeometry(0.5, 0.5, 1, 3),
  };
  geos.push(...Object.values(unit));
  const mm = new THREE.Matrix4();
  const mq = new THREE.Quaternion();
  const me = new THREE.Euler();
  const mp = new THREE.Vector3();
  const ms = new THREE.Vector3();
  const shp = (m: THREE.Material, k: Kind, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: number, rx = 0, ry = 0, rz = 0) => {
    me.set(rx, ry, rz);
    mq.setFromEuler(me);
    mm.compose(mp.set(cx, cy, cz), mq, ms.set(sx, sy, sz));
    part(m).addGeo(unit[k], mm, color);
  };
  /** Flat disc / ring lying on the floor (y is its centre height). */
  const disc = (m: THREE.Material, cx: number, cz: number, r: number, y: number, h: number, color: number) => {
    shp(m, 'disc', cx, y, cz, r * 2, h, r * 2, color);
  };

  /* ------------------------------------------------------------ instances */
  const imats: Record<IMat, THREE.Material> = {
    matte: std({ color: 0xffffff, roughness: 0.7 }),
    gloss: std({ color: 0xffffff, roughness: 0.2, metalness: 0.12 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  mats.push(imats.glow);
  type Bag = { kind: Kind; mat: IMat; p: number[]; s: number[]; r: number[]; c: number[] };
  const bags = new Map<string, Bag>();
  const inst = (kind: Kind, mat: IMat, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, ry = 0, rz = 0) => {
    const key = kind + mat;
    let b = bags.get(key);
    if (!b) bags.set(key, (b = { kind, mat, p: [], s: [], r: [], c: [] }));
    b.p.push(x, y, z);
    b.s.push(sx, sy, sz);
    b.r.push(0, ry, rz);
    b.c.push(color);
  };

  /* --------------------------------------------------------------- lights */
  const maxLights = reduced ? 2 : 5;
  const lights: THREE.PointLight[] = [];
  const flickers: { light: THREE.PointLight; base: number; amp: number; speed: number; phase: number }[] = [];
  const lamp = (x: number, y: number, z: number, color: number, intensity: number, distance: number, flicker = 0) => {
    if (lights.length >= maxLights) return;
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    group.add(l);
    lights.push(l);
    if (flicker > 0) flickers.push({ light: l, base: intensity, amp: flicker, speed: 6 + lights.length, phase: lights.length * 1.7 });
  };

  /* -------------------------------------------------------- decals (flat) */
  const decalGeos = new Mesher();
  const shaftMap = tex(shaftTexture());
  const haloMap = tex(glowTexture());
  const decalMat = (map: THREE.Texture, color: number, opacity: number) => {
    const m = new THREE.MeshBasicMaterial({
      map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    mats.push(m);
    return m;
  };
  const shaftM = decalMat(shaftMap, 0xffd79a, 0.5);
  const haloMats = new Map<number, THREE.MeshBasicMaterial>();
  const haloMesh = new Map<THREE.MeshBasicMaterial, Mesher>();
  const halo = (x: number, z: number, r: number, color: number, opacity = 0.45) => {
    const key = color * 100 + Math.round(opacity * 100);
    let m = haloMats.get(key);
    if (!m) {
      m = decalMat(haloMap, color, opacity);
      haloMats.set(key, m);
      haloMesh.set(m, new Mesher());
    }
    const below = new THREE.Vector3(x, -1, z);
    haloMesh.get(m)?.quad(
      new THREE.Vector3(x - r, 0.03, z - r), new THREE.Vector3(x + r, 0.03, z - r),
      new THREE.Vector3(x + r, 0.03, z + r), new THREE.Vector3(x - r, 0.03, z + r), 0xffffff, below,
    );
  };
  const pool = (cx: number, w: number) => {
    const a = new THREE.Vector3(cx - w / 2, 0.025, 1.06);
    const b = new THREE.Vector3(cx + w / 2, 0.025, 1.06);
    const c = new THREE.Vector3(cx + w / 2 + 1.5, 0.025, 3.9);
    const d = new THREE.Vector3(cx - w / 2 + 1.5, 0.025, 3.9);
    decalGeos.quad(a, b, c, d, 0xffffff, new THREE.Vector3(cx, -1, 2.5));
  };

  /* --------------------------------------------------------- reservations */
  const reserved: [number, number][] = [];
  for (const n of map.npcs) reserved.push([n.x, n.y]);
  for (const w of map.warps) {
    for (let j = 0; j < (w.height ?? 1); j++) for (let i = 0; i < (w.width ?? 1); i++) reserved.push([w.x + i, w.y + j]);
  }
  const hitsReserved = (x0: number, z0: number, x1: number, z1: number) =>
    reserved.some(([tx, tz]) => x0 < tx + 1 && x1 > tx && z0 < tz + 1 && z1 > tz);
  const door = map.warps[0];
  const doorX = door?.x ?? Math.floor(W / 2);
  const doorW = door?.width ?? 1;
  const ax = doorX + 0.5;
  const mid = W / 2;

  /* ------------------------------------------------- wall-relative helpers */
  const wpos = (side: Side, along: number, off: number): [number, number] =>
    side === 'N' ? [along, 1 + off] : side === 'W' ? [1 + off, along] : [W - 1 - off, along];
  const rectOf = (side: Side, a0: number, a1: number, o0: number, o1: number): [number, number, number, number] => {
    if (side === 'N') return [a0, 1 + o0, a1, 1 + o1];
    if (side === 'W') return [1 + o0, a0, 1 + o1, a1];
    return [W - 1 - o1, a0, W - 1 - o0, a1];
  };
  const free = (side: Side, a0: number, a1: number, o0: number, o1: number) => {
    const [x0, z0, x1, z1] = rectOf(side, a0, a1, o0, o1);
    return !hitsReserved(x0, z0, x1, z1);
  };
  const wb = (m: THREE.Material, side: Side, a0: number, a1: number, o0: number, o1: number, y0: number, y1: number, color: number) => {
    const [x0, z0, x1, z1] = rectOf(side, a0, a1, o0, o1);
    bx(m, x0, y0, z0, x1, y1, z1, color);
  };
  const wshp = (m: THREE.Material, k: Kind, side: Side, along: number, off: number, y: number, sA: number, sy: number, sD: number, color: number, rx = 0, rz = 0) => {
    const [x, z] = wpos(side, along, off);
    const swap = side !== 'N';
    shp(m, k, x, y, z, swap ? sD : sA, sy, swap ? sA : sD, color, rx, 0, rz);
  };
  const winst = (k: Kind, mat: IMat, side: Side, along: number, off: number, y: number, sA: number, sy: number, sD: number, color: number) => {
    const [x, z] = wpos(side, along, off);
    const swap = side !== 'N';
    inst(k, mat, x, y, z, swap ? sD : sA, sy, swap ? sA : sD, color);
  };

  /* ----------------------------------------------------------- the shell */
  const paper = theme.paper;
  const trimC = theme.trim;
  bx(paperM, 0, 0, 0, W, WALL_H, 1, paper);
  bx(paperM, 0, 0, 1, 1, WALL_H, H - 1, paper);
  bx(paperM, W - 1, 0, 1, W, WALL_H, H - 1, paper);
  // Caps: wall tops in trim colour so the thin side-wall strips still read.
  bx(trimM, -0.05, WALL_H, -0.05, W + 0.05, WALL_H + 0.09, 1.06, shade(trimC, 0.85));
  bx(trimM, -0.05, WALL_H, 1, 1.05, WALL_H + 0.09, H - 0.95, shade(trimC, 0.85));
  bx(trimM, W - 1.05, WALL_H, 1, W + 0.05, WALL_H + 0.09, H - 0.95, shade(trimC, 0.85));
  // Back wall: baseboard, wainscot with panel grooves, chair rail, crown moulding.
  bx(trimM, 1, 0, 1, W - 1, 0.16, 1.05, shade(trimC, 0.8));
  bx(fabricM, 1, 0.16, 1, W - 1, 0.86, 1.03, theme.wain);
  for (let x = 1.5; x < W - 1; x += 1) bx(trimM, x - 0.015, 0.22, 1.03, x + 0.015, 0.8, 1.045, shade(theme.wain, 0.78));
  bx(trimM, 1, 0.86, 1, W - 1, 0.94, 1.07, trimC);
  bx(trimM, 1, WALL_H - 0.13, 1, W - 1, WALL_H, 1.09, trimC);
  // Side walls: same rails, mostly seen edge-on but visible as a band along the top.
  for (const [x0, x1] of [[1, 1.05], [W - 1.05, W - 1]] as const) {
    bx(trimM, x0, 0, 1, x1, 0.16, H - 1, shade(trimC, 0.8));
    bx(fabricM, x0, 0.16, 1, x1, 0.86, H - 1, theme.wain);
    bx(trimM, x0, WALL_H - 0.13, 1, x1, WALL_H, H - 1, trimC);
  }
  // Low front wall (kept below knee height so it never hides the player), with a doorway gap.
  const lowC = shade(trimC, 0.9);
  for (const [a, b] of [[0, doorX], [doorX + doorW, W]] as const) {
    if (b <= a) continue;
    bx(trimM, a, 0, H - 1, b, 0.32, H, lowC);
    bx(trimM, a, 0.32, H - 1.04, b, 0.38, H + 0.04, trimC);
  }
  for (const px of [doorX - 0.06, doorX + doorW + 0.06]) bx(trimM, px - 0.08, 0, H - 1.06, px + 0.08, 0.52, H + 0.06, shade(trimC, 0.7));
  bx(trimM, doorX, 0, H - 1, doorX + doorW, 0.05, H, 0xa9a39a);
  // Doormat in the warp tile row.
  bx(fabricM, doorX + 0.12, 0, H - 1.85, doorX + doorW - 0.12, 0.025, H - 1.15, mix(theme.wain, 0xb04040, 0.5));
  bx(fabricM, doorX + 0.2, 0.025, H - 1.77, doorX + doorW - 0.2, 0.032, H - 1.23, 0xe8d8b0);

  /* --------------------------------------------------- wall decorations */
  const windows: number[] = [];
  const windowAt = (cx: number, w = 1.1, y0 = 1.05, y1 = 1.95, curtain: number | null = 0xc0504d) => {
    windows.push(cx);
    const frame = shade(trimC, 1.15);
    bx(trimM, cx - w / 2 - 0.07, y0 - 0.07, 1, cx + w / 2 + 0.07, y1 + 0.07, 1.07, frame);
    bx(warmGlow, cx - w / 2, y0, 1.06, cx + w / 2, y1, 1.085, 0xffffff);
    bx(trimM, cx - 0.02, y0, 1.08, cx + 0.02, y1, 1.11, frame);
    bx(trimM, cx - w / 2, (y0 + y1) / 2 - 0.02, 1.08, cx + w / 2, (y0 + y1) / 2 + 0.02, 1.11, frame);
    bx(trimM, cx - w / 2 - 0.14, y0 - 0.1, 1, cx + w / 2 + 0.14, y0 - 0.04, 1.22, frame);
    if (curtain !== null) {
      for (const s of [-1, 1]) {
        const x0 = cx + s * (w / 2 + 0.02) - (s > 0 ? 0 : 0.24);
        bx(fabricM, x0, y0 - 0.2, 1.06, x0 + 0.24, y1 + 0.1, 1.17, curtain);
        bx(fabricM, x0 + 0.08, y0 - 0.2, 1.17, x0 + 0.1, y1 + 0.1, 1.18, shade(curtain, 0.78));
      }
      bx(metalM, cx - w / 2 - 0.2, y1 + 0.1, 1.08, cx + w / 2 + 0.2, y1 + 0.14, 1.12, 0xd7b04c);
    }
    pool(cx, w * 0.9);
  };
  const pictureAt = (cx: number, cy: number, w: number, h: number, key: number) => {
    const frameC = pick([0x7a5638, 0xd7b04c, 0x3f3a44, 0xe8e0d0], rnd(key, 3));
    bx(trimM, cx - w / 2 - 0.05, cy - h / 2 - 0.05, 1, cx + w / 2 + 0.05, cy + h / 2 + 0.05, 1.06, frameC);
    const sky = pick([0x9ad0f2, 0xf2c89a, 0xb8e0c0, 0xd8c2f2], rnd(key, 4));
    bx(fabricM, cx - w / 2, cy - h / 2, 1.05, cx + w / 2, cy + h / 2, 1.075, sky);
    bx(fabricM, cx - w / 2, cy - h / 2, 1.075, cx + w / 2, cy - h / 2 + h * 0.38, 1.09, pick([0x5fae5a, 0x7aa0c8, 0xc89a5a], rnd(key, 5)));
    shp(glow(0xfff0a0, 0.6), 'sph', cx + w * 0.22, cy + h * 0.2, 1.09, h * 0.22, h * 0.22, 0.03, 0xffffff);
  };
  function pick<T>(list: T[], r: number): T {
    return list[Math.floor(r * list.length) % list.length];
  }

  const shelfUnit = (
    side: Side, a0: number, a1: number,
    o: { depth: number; h: number; tiers: number; fill: 'books' | 'jars' | 'goods'; wood?: number; tag?: number },
  ) => {
    if (!free(side, a0, a1, 0, o.depth)) return;
    const wood = o.wood ?? shade(trimC, 0.85);
    const tag = o.tag ?? 0;
    wb(trimM, side, a0, a1, 0, 0.03, 0.04, o.h, shade(wood, 0.6));
    for (const a of [a0, a1 - 0.05]) wb(trimM, side, a, a + 0.05, 0, o.depth, 0, o.h, wood);
    const gap = (o.h - 0.1) / o.tiers;
    for (let k = 0; k <= o.tiers; k++) wb(trimM, side, a0, a1, 0, o.depth, 0.06 + k * gap, 0.1 + k * gap, wood);
    for (let k = 0; k < o.tiers; k++) {
      const yb = 0.1 + k * gap;
      let a = a0 + 0.09;
      let n = 0;
      while (a < a1 - 0.1 && n < 60) {
        n++;
        const r = rnd(Math.round(a * 20) + tag, k, 40 + (side === 'N' ? 0 : side === 'W' ? 1 : 2));
        const r2 = rnd(Math.round(a * 20) + tag, k, 60);
        if (o.fill === 'books') {
          const w = 0.045 + r * 0.05;
          const h = gap * (0.55 + r2 * 0.35);
          if (r2 > 0.93) { a += 0.12; continue; }
          winst('box', 'matte', side, a + w / 2, o.depth * 0.5, yb + h / 2, w, h, o.depth * 0.62, pick(BOOKS, r));
          a += w + 0.005;
        } else if (o.fill === 'jars') {
          const rad = 0.085 + r * 0.02;
          const h = gap * 0.6;
          winst('cyl', 'gloss', side, a + rad, o.depth * 0.5, yb + h / 2, rad * 2, h, rad * 2, pick([0xe8f2f0, 0xdcecf0], r2));
          winst('cyl', 'matte', side, a + rad, o.depth * 0.5, yb + h * 0.5, rad * 1.7, h * 0.7, rad * 1.7, pick(LIQUID, r));
          winst('cyl', 'matte', side, a + rad, o.depth * 0.5, yb + h + 0.02, rad * 1.6, 0.04, rad * 1.6, 0x5a3d26);
          a += rad * 2 + 0.07;
        } else {
          const kind = r2 < 0.4 ? 'box' : r2 < 0.75 ? 'cyl' : 'sph';
          const w = 0.1 + r * 0.08;
          const h = kind === 'sph' ? w : gap * (0.35 + r * 0.3);
          winst(kind, kind === 'box' ? 'matte' : 'gloss', side, a + w / 2, o.depth * 0.5, yb + h / 2, w, h, kind === 'box' ? o.depth * 0.5 : w, pick(GOODS, r2 * 3.7 + r));
          if (kind === 'box' && r > 0.5) winst('box', 'matte', side, a + w / 2, o.depth * 0.5 + 0.01, yb + h * 0.55, w * 1.02, h * 0.28, o.depth * 0.5 + 0.01, 0xffffff);
          a += w + 0.035;
        }
      }
    }
  };

  const pottedPlant = (x: number, z: number, h = 0.55, potC = 0xc8713f, leaf = 0x3f9a4a) => {
    if (hitsReserved(x - 0.2, z - 0.2, x + 0.2, z + 0.2)) return;
    inst('cyl', 'matte', x, 0.14, z, 0.3, 0.28, 0.3, potC);
    inst('cyl', 'matte', x, 0.29, z, 0.34, 0.04, 0.34, shade(potC, 0.8));
    inst('cyl', 'matte', x, 0.29, z, 0.26, 0.03, 0.26, 0x4a3524);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rnd(Math.round(x * 4), Math.round(z * 4), 9);
      const lh = h * (0.7 + 0.3 * rnd(i, Math.round(x * 4), 3));
      inst('sph', 'matte', x + Math.cos(a) * 0.1, 0.32 + lh * 0.55, z + Math.sin(a) * 0.1, 0.2, lh, 0.2, shade(leaf, 0.85 + 0.3 * rnd(i, Math.round(z * 4), 4)), a);
    }
    inst('sph', 'matte', x, 0.32 + h * 0.7, z, 0.3, h * 0.8, 0.3, leaf);
  };

  /* ------------------------------------------------------- counter tiles */
  const counterRow = (kind: 'bench' | 'shop' | 'heal') => {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (map.tiles[y]?.[x] !== 'W') continue;
        const left = map.tiles[y][x - 1] === 'W' && x - 1 >= 1;
        const right = map.tiles[y][x + 1] === 'W' && x + 1 < W - 1;
        if (map.npcs.some((n) => n.x === x && n.y === y)) continue;
        const x0 = left ? x : x + 0.03;
        const x1 = right ? x + 1 : x + 0.97;
        const r = rnd(x, y, 5);
        if (kind === 'bench') {
          bx(trimM, x0, 0, y + 0.05, x1, 0.84, y + 0.96, 0xe8ecee);
          bx(trimM, x0, 0, y + 0.93, x1, 0.1, y + 0.98, 0x56636b);
          bx(trimM, x + 0.48, 0.14, y + 0.955, x + 0.52, 0.78, y + 0.97, 0x9aa6ac);
          bx(metalM, x + 0.4, 0.5, y + 0.96, x + 0.44, 0.62, y + 0.99, 0xc9d3d8);
          bx(metalM, x + 0.56, 0.5, y + 0.96, x + 0.6, 0.62, y + 0.99, 0xc9d3d8);
          bx(metalM, x0 - 0.01, 0.84, y, x1 + 0.01, 0.9, y + 1, 0xcdd6da);
          bx(metalM, x0, 0.9, y, x1, 1.0, y + 0.06, 0xb6c2c8);
          const t = x === 10 && !right ? 9 : Math.floor(r * 5);
          if (t === 0) {
            inst('sph', 'gloss', x + 0.32, 0.99, y + 0.5, 0.2, 0.2, 0.2, pick(LIQUID, rnd(x, y, 1)));
            inst('cyl', 'gloss', x + 0.32, 1.12, y + 0.5, 0.06, 0.16, 0.06, 0xe8f2f0);
            inst('cyl', 'gloss', x + 0.68, 1.0, y + 0.45, 0.14, 0.22, 0.14, 0xe8f2f0);
            inst('cyl', 'matte', x + 0.68, 0.96, y + 0.45, 0.12, 0.12, 0.12, pick(LIQUID, rnd(x, y, 2)));
          } else if (t === 1) {
            bx(trimM, x + 0.15, 0.9, y + 0.3, x + 0.85, 0.96, y + 0.5, 0x4a5258);
            for (let i = 0; i < 5; i++) {
              inst('cyl', 'gloss', x + 0.22 + i * 0.14, 1.04, y + 0.4, 0.05, 0.2, 0.05, 0xe8f2f0);
              inst('cyl', 'matte', x + 0.22 + i * 0.14, 1.0, y + 0.4, 0.04, 0.1, 0.04, pick(LIQUID, rnd(i, x, 3)));
            }
          } else if (t === 2) {
            bx(metalM, x + 0.3, 0.9, y + 0.3, x + 0.7, 0.96, y + 0.7, 0x4a5258);
            bx(metalM, x + 0.44, 0.96, y + 0.38, x + 0.5, 1.28, y + 0.44, 0xdfe5e8);
            shp(metalM, 'cyl', x + 0.47, 1.3, y + 0.48, 0.1, 0.22, 0.1, 0x2f363a, Math.PI / 2.4, 0, 0);
          } else if (t === 3) {
            bx(fabricM, x + 0.2, 0.9, y + 0.3, x + 0.55, 0.915, y + 0.7, 0xfff7e6);
            bx(fabricM, x + 0.3, 0.915, y + 0.35, x + 0.65, 0.93, y + 0.75, 0xeedfc0);
            inst('cyl', 'gloss', x + 0.78, 0.99, y + 0.5, 0.16, 0.18, 0.16, pick(LIQUID, rnd(x, y, 4)));
          } else {
            inst('cyl', 'gloss', x + 0.3, 1.02, y + 0.5, 0.18, 0.26, 0.18, 0xe8f2f0);
            inst('cyl', 'matte', x + 0.3, 0.97, y + 0.5, 0.15, 0.15, 0.15, pick(LIQUID, rnd(x, y, 6)));
            inst('sph', 'gloss', x + 0.7, 1.0, y + 0.45, 0.22, 0.22, 0.22, pick(LIQUID, rnd(x, y, 7)));
          }
          if (x === 10 && !right) {
            // The prism lens: a glowing triangular prism on a small stand.
            bx(metalM, x + 0.3, 0.9, y + 0.3, x + 0.7, 0.96, y + 0.7, 0x4a5258);
            shp(pulse(0x6ff2ff, 1.1, 0.35, 2.2), 'tri', x + 0.5, 1.12, y + 0.5, 0.3, 0.42, 0.3, 0xffffff, Math.PI / 2, 0.2, 0);
            halo(x + 0.5, y + 1.6, 0.9, 0x5ae6ff, 0.35);
            lamp(x + 0.5, 1.6, y + 1.4, 0x7ff6ff, 2.4, 6);
          }
        } else if (kind === 'shop') {
          const wood = shade(trimC, 0.9);
          bx(trimM, x0, 0, y + 0.05, x1, 0.84, y + 0.96, wood);
          bx(trimM, x0, 0.14, y + 0.955, x1, 0.74, y + 0.97, shade(wood, 1.18));
          bx(trimM, x0 - 0.02, 0.84, y, x1 + 0.02, 0.92, y + 1, 0xf2e6cf);
          bx(fabricM, x0, 0.92, y + 0.03, x1, 0.97, y + 0.2, theme.wain);
          if (!right) {
            bx(metalM, x + 0.2, 0.92, y + 0.3, x + 0.8, 1.06, y + 0.7, 0xd8d3c8);
            bx(metalM, x + 0.22, 1.06, y + 0.55, x + 0.78, 1.34, y + 0.66, 0xc8c2b6);
            bx(glow(0x7fffd0, 0.9), x + 0.3, 1.12, y + 0.665, x + 0.7, 1.26, y + 0.68, 0xffffff);
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bx(metalM, x + 0.28 + i * 0.12, 1.08 + j * 0.0, y + 0.34 + j * 0.06, x + 0.34 + i * 0.12, 1.1, y + 0.38 + j * 0.06, 0x55606a);
            bx(metalM, x + 0.24, 1.06, y + 0.22, x + 0.76, 1.08, y + 0.28, 0xffd24a);
          } else if (!left) {
            inst('cyl', 'gloss', x + 0.5, 1.05, y + 0.5, 0.3, 0.28, 0.3, 0xe8f2f0);
            for (let i = 0; i < 6; i++) inst('sph', 'gloss', x + 0.4 + (i % 3) * 0.1, 1.0 + (i % 2) * 0.08 + Math.floor(i / 3) * 0.06, y + 0.45 + (i % 2) * 0.08, 0.09, 0.09, 0.09, pick(GOODS, i / 6));
          } else {
            for (let i = 0; i < 3; i++) inst('box', 'matte', x + 0.2 + i * 0.25, 1.0, y + 0.5, 0.18, 0.16, 0.2, pick(GOODS, rnd(x, i, 8)));
            inst('sph', 'gloss', x + 0.5, 0.98, y + 0.72, 0.14, 0.14, 0.14, pick(GOODS, r));
          }
        } else {
          bx(trimM, x0, 0, y + 0.05, x1, 0.86, y + 0.96, 0xf6efe8);
          bx(fabricM, x0 - 0.02, 0.86, y, x1 + 0.02, 0.94, y + 1, 0xf2b6c4);
        }
      }
    }
  };

  /* ---------------------------------------------------------- room kinds */
  const nHasCounter = map.tiles.some((row, y) => y > 0 && y < H - 1 && row.slice(1, W - 1).includes('W'));

  const buildLab = () => {
    windowAt(4.3, 1.0, 1.05, 1.95, 0x5fa5a0);
    windowAt(11.6, 1.0, 1.05, 1.95, 0x5fa5a0);
    // Chalkboard with a prism sketch and formulas.
    bx(trimM, 5.35, 0.9, 1, 9.75, 2.0, 1.07, 0x7a5638);
    bx(fabricM, 5.45, 1.0, 1.06, 9.65, 1.9, 1.09, 0x2f4a40);
    bx(trimM, 5.45, 0.95, 1.06, 9.65, 1.0, 1.13, 0x7a5638);
    for (let i = 0; i < 3; i++) bx(fabricM, 5.7 + i * 0.22, 0.96, 1.13, 5.85 + i * 0.22, 0.985, 1.15, pick([0xf2f2e6, 0xf2b6c4, 0xb6e0f2], i / 3));
    tilt(fabricM, 6.7, 1.45, 1.1, 0.7, 0.03, 0.01, 0xf0f0e0, 0, 0, 1.0);
    tilt(fabricM, 7.35, 1.45, 1.1, 0.7, 0.03, 0.01, 0xf0f0e0, 0, 0, -1.0);
    bx(fabricM, 6.45, 1.08, 1.09, 7.6, 1.11, 1.1, 0xf0f0e0);
    for (const [c, y] of [[0xff7a7a, 1.52], [0xffd24a, 1.45], [0x7aff9a, 1.38], [0x7ad0ff, 1.31]] as const) {
      bx(glow(c, 0.7), 7.7, y - 0.012, 1.09, 8.5, y + 0.012, 1.1, 0xffffff);
    }
    for (let i = 0; i < 5; i++) bx(fabricM, 8.7, 1.72 - i * 0.12, 1.09, 8.7 + 0.5 + rnd(i, 2) * 0.4, 1.74 - i * 0.12, 1.1, 0xf0f0e0);
    for (let i = 0; i < 4; i++) bx(fabricM, 5.65, 1.74 - i * 0.12, 1.09, 5.65 + 0.4 + rnd(i, 3) * 0.5, 1.76 - i * 0.12, 1.1, 0xf0f0e0);
    shelfUnit('N', 1.15, 3.55, { depth: 0.42, h: 1.95, tiers: 4, fill: 'books', tag: 1 });
    shelfUnit('N', 13.5, 14.9, { depth: 0.42, h: 1.95, tiers: 4, fill: 'books', tag: 2 });
    // Cracked lens on a stand.
    if (free('N', 12.5, 13.3, 0, 0.5)) {
      wb(trimM, 'N', 12.55, 13.25, 0, 0.5, 0, 0.85, 0x6b4a2e);
      wb(metalM, 'N', 12.5, 13.3, -0.0, 0.52, 0.85, 0.9, 0xd7b04c);
      bx(metalM, 12.78, 0.9, 1.2, 13.02, 1.05, 1.32, 0xd7b04c);
      shp(pulse(0xa88cff, 0.55, 0.25, 1.3), 'oct', 12.9, 1.3, 1.26, 0.55, 0.62, 0.16, 0xffffff, 0, 0, 0.1);
      tilt(fabricM, 12.9, 1.3, 1.36, 0.02, 0.7, 0.03, 0x2a2438, 0, 0, 0.5);
      tilt(fabricM, 12.82, 1.38, 1.36, 0.02, 0.3, 0.03, 0x2a2438, 0, 0, -0.7);
      halo(12.9, 2.1, 0.8, 0x8c6aff, 0.22);
    }
    // Specimen jar shelf (west) and analysis console (east).
    shelfUnit('W', 5.2, 7.4, { depth: 0.38, h: 1.4, tiers: 3, fill: 'jars', tag: 3 });
    if (free('E', 5.2, 7.0, 0, 0.5)) {
      wb(trimM, 'E', 5.2, 7.0, 0, 0.5, 0, 0.9, 0xcfd6d8);
      wb(metalM, 'E', 5.15, 7.05, 0, 0.55, 0.9, 0.95, 0x56636b);
      wb(glow(0x5aff9a, 0.9), 'E', 5.3, 6.9, 0.12, 0.4, 0.95, 0.97, 0xffffff);
      for (let i = 0; i < 4; i++) wshp(glow(pick([0xff6a6a, 0xffd24a, 0x7aff9a, 0x7ad0ff], i / 4), 1), 'sph', 'E', 5.45 + i * 0.4, 0.45, 1.0, 0.08, 0.06, 0.08, 0xffffff);
      wshp(metalM, 'cyl', 'E', 5.45, 0.25, 1.3, 0.2, 0.6, 0.2, 0xd8e4e8);
      wshp(glow(0x7ad0ff, 0.8), 'cyl', 'E', 5.45, 0.25, 1.3, 0.14, 0.45, 0.14, 0xffffff);
    }
    // Floor cables from the console toward the benches.
    const cable: [number, number][] = [[W - 1.5, 6.4], [W - 3.2, 6.3], [W - 4.2, 5.4], [W - 5.2, 4.9], [W - 5.4, 4.2]];
    for (let i = 0; i < cable.length - 1; i++) {
      const [x0, z0] = cable[i];
      const [x1, z1] = cable[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      tilt(fabricM, (x0 + x1) / 2, 0.02, (z0 + z1) / 2, len, 0.025, 0.05, 0x23272b, 0, -Math.atan2(z1 - z0, x1 - x0), 0);
      if (i % 2 === 0) bx(glow(0x5aff9a, 0.8), (x0 + x1) / 2 - 0.03, 0.035, (z0 + z1) / 2 - 0.03, (x0 + x1) / 2 + 0.03, 0.045, (z0 + z1) / 2 + 0.03, 0xffffff);
    }
    // A safety-striped mat in front of the benches.
    for (let i = 0; i < 12; i++) bx(fabricM, 5 + i * 0.5, 0.0, 4.35, 5.25 + i * 0.5, 0.012, 4.55, i % 2 ? 0x2a2a2e : 0xf2c92e);
    counterRow('bench');
    lamp(8.5, 2.1, 3.4, 0xfff0d0, 4.2, 9);
    lamp(11.8, 1.9, 4.0, 0xffe0b0, 2.2, 6);
  };

  const buildHouse = () => {
    windowAt(3.6, 1.1, 1.05, 1.95, 0xd9777a);
    pictureAt(6.2, 1.55, 0.6, 0.45, 1);
    pictureAt(12.3, 1.55, 0.45, 0.6, 2);
    // Hearth: stone breast with a mantel, firebox, logs and flickering flames.
    const hx0 = 8.0;
    const hx1 = 10.0;
    if (free('N', hx0, hx1, 0, 0.55)) {
      const stone = 0x9b958c;
      // Open firebox: two jambs, a lintel, a sooty back and a stone hearth slab.
      wb(trimM, 'N', hx0, hx0 + 0.3, 0, 0.55, 0, 1.2, stone);
      wb(trimM, 'N', hx1 - 0.3, hx1, 0, 0.55, 0, 1.2, stone);
      wb(trimM, 'N', hx0 + 0.3, hx1 - 0.3, 0, 0.55, 0.85, 1.2, shade(stone, 0.92));
      wb(trimM, 'N', hx0 + 0.3, hx1 - 0.3, 0, 0.06, 0, 0.85, 0x1d1815);
      wb(trimM, 'N', hx0 + 0.3, hx1 - 0.3, 0, 0.55, 0, 0.06, 0x6e685f);
      wb(trimM, 'N', hx0 + 0.15, hx1 - 0.15, 0, 0.3, 1.2, WALL_H, stone);
      wb(trimM, 'N', hx0 - 0.12, hx1 + 0.12, 0, 0.62, 1.2, 1.3, 0x6b4a2e);
      for (let r = 1; r < 4; r++) {
        wb(trimM, 'N', hx0, hx0 + 0.3, 0.54, 0.565, r * 0.3 - 0.01, r * 0.3 + 0.01, 0x6e685f);
        wb(trimM, 'N', hx1 - 0.3, hx1, 0.54, 0.565, r * 0.3 - 0.01, r * 0.3 + 0.01, 0x6e685f);
      }
      const fireC = [0xff8a2a, 0xffc24a, 0xff5a1c];
      for (let i = 0; i < 3; i++) {
        inst('cone', 'glow', 9 + (i - 1) * 0.26, 0.22 + (i === 1 ? 0.06 : 0), 1.26, 0.24, 0.4 + (i === 1 ? 0.14 : 0), 0.24, fireC[i]);
      }
      inst('cyl', 'matte', 9, 0.11, 1.34, 0.1, 0.62, 0.1, 0x4a3020, 0, Math.PI / 2);
      inst('cyl', 'matte', 9, 0.12, 1.2, 0.09, 0.56, 0.09, 0x3a2418, 0, Math.PI / 2);
      // Candles and a clock on the mantel.
      for (const cx of [8.3, 9.7]) {
        inst('cyl', 'matte', cx, 1.4, 1.3, 0.05, 0.2, 0.05, 0xf6eed8);
        inst('sph', 'glow', cx, 1.54, 1.3, 0.05, 0.08, 0.05, 0xffd070);
      }
      bx(trimM, 8.85, 1.3, 1.2, 9.15, 1.55, 1.3, 0x7a5638);
      halo(9, 2.7, 1.5, 0xff9a40, 0.3);
      lamp(9, 0.9, 2.1, 0xff9a4a, 5, 8, 0.35);
    }
    // Cottage rug.
    const rx = ax;
    const rz = 5.9;
    bx(fabricM, rx - 2.1, 0, rz - 1.3, rx + 2.1, 0.012, rz + 1.3, 0x9a3f3a);
    bx(fabricM, rx - 1.9, 0.012, rz - 1.1, rx + 1.9, 0.02, rz + 1.1, 0xe8d3a6);
    bx(fabricM, rx - 1.7, 0.02, rz - 0.9, rx + 1.7, 0.026, rz + 0.9, 0x4f7f8a);
    for (let i = 0; i < 5; i++) bx(fabricM, rx - 1.2 + i * 0.6, 0.026, rz - 0.15, rx - 0.9 + i * 0.6, 0.032, rz + 0.15, i % 2 ? 0xe8d3a6 : 0xd77a5a);
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) bx(fabricM, rx - 2.1 + i * 0.5 + 0.1, 0, rz + s * 1.3 + (s > 0 ? 0 : -0.1), rx - 2.1 + i * 0.5 + 0.15, 0.012, rz + s * 1.3 + (s > 0 ? 0.1 : 0), 0xe8d3a6);
    // Bed in the north-west corner.
    if (free('W', 1.25, 3.3, 0, 0.7)) {
      wb(trimM, 'W', 1.25, 3.3, 0, 0.7, 0.12, 0.34, 0x7a5638);
      wb(trimM, 'W', 1.2, 1.32, 0, 0.7, 0.0, 0.78, 0x6b4a2e);
      wb(trimM, 'W', 3.24, 3.3, 0, 0.7, 0.0, 0.5, 0x6b4a2e);
      wb(fabricM, 'W', 1.34, 3.24, 0.03, 0.67, 0.34, 0.44, 0xf4efe2);
      wb(fabricM, 'W', 1.95, 3.26, 0.02, 0.68, 0.44, 0.5, 0x4a79c4);
      wb(fabricM, 'W', 1.95, 3.26, 0.02, 0.68, 0.5, 0.52, 0xe8c24a);
      wshp(fabricM, 'sph', 'W', 1.6, 0.35, 0.5, 0.42, 0.14, 0.36, 0xfff8ec);
    }
    // Dish cabinet and plants along the west wall.
    if (free('W', 4.6, 6.4, 0, 0.45)) {
      wb(trimM, 'W', 4.6, 6.4, 0, 0.45, 0, 0.9, 0x8a5a3a);
      wb(trimM, 'W', 4.55, 6.45, 0, 0.5, 0.9, 0.95, 0x6b4a2e);
      wb(trimM, 'W', 4.7, 6.3, 0, 0.04, 0.95, 1.65, 0x6b4a2e);
      for (const a of [4.7, 6.26]) wb(trimM, 'W', a, a + 0.04, 0, 0.3, 0.95, 1.65, 0x8a5a3a);
      for (const y of [1.28, 1.65]) wb(trimM, 'W', 4.7, 6.3, 0, 0.3, y - 0.02, y + 0.02, 0x8a5a3a);
      for (let i = 0; i < 4; i++) winst('cyl', 'gloss', 'W', 4.9 + i * 0.4, 0.14, 0.99, 0.26, 0.04, 0.26, pick([0xf2f2ec, 0x9ad0f2, 0xf2c89a], i / 4));
      for (let i = 0; i < 3; i++) winst('cyl', 'gloss', 'W', 5.0 + i * 0.5, 0.14, 1.34, 0.18, 0.1, 0.18, pick([0xe0506e, 0xf2f2ec, 0xffd24a], i / 3));
    }
    // Dining nook against the east wall: table, stools, tea.
    if (free('E', 4.3, 6.2, 0, 0.58)) {
      wb(trimM, 'E', 4.45, 5.95, 0, 0.55, 0.62, 0.69, 0x9a6a3e);
      for (const a of [4.5, 5.85]) for (const o of [0.04, 0.46]) wb(trimM, 'E', a - 0.03, a + 0.07, o, o + 0.09, 0, 0.62, 0x6b4a2e);
      wb(fabricM, 'E', 4.45, 5.95, 0, 0.55, 0.69, 0.71, 0xf2e6cf);
      winst('sph', 'gloss', 'E', 4.8, 0.28, 0.8, 0.2, 0.17, 0.2, 0xe8a07a);
      winst('cyl', 'gloss', 'E', 4.8, 0.28, 0.9, 0.06, 0.06, 0.06, 0xe8a07a);
      winst('cyl', 'gloss', 'E', 5.3, 0.2, 0.75, 0.09, 0.08, 0.09, 0xf2f2ec);
      winst('cyl', 'gloss', 'E', 5.5, 0.4, 0.75, 0.09, 0.08, 0.09, 0xf2f2ec);
      winst('sph', 'matte', 'E', 5.35, 0.36, 0.77, 0.18, 0.1, 0.14, 0xd8a560);
    }
    for (const a of [4.0, 6.4]) {
      if (free('E', a - 0.2, a + 0.2, 0.05, 0.45)) {
        winst('cyl', 'matte', 'E', a, 0.27, 0.42, 0.34, 0.07, 0.34, 0xb5473a);
        for (const o of [-0.1, 0.1]) for (const p of [-0.1, 0.1]) winst('cyl', 'matte', 'E', a + o, 0.27 + p, 0.2, 0.04, 0.4, 0.04, 0x6b4a2e);
      }
    }
    pottedPlant(1.4, H - 1.5, 0.7);
    pottedPlant(W - 1.4, H - 1.5, 0.55, 0xd8a04a, 0x4aa85a);
    pottedPlant(W - 1.4, 1.5, 0.95, 0xc8713f, 0x2f8a4a);
    pottedPlant(2.0, 1.4, 0.5, 0xe0c090, 0x6ac06a);
    lamp(ax, 2.1, 5.6, 0xffe2b0, 4.2, 10);
  };

  const buildShop = () => {
    // Striped awning along the top of the back wall.
    const stripe = pick([0xe0506e, 0x2f9e66, 0x3f74d6, 0xe8a23a], rnd(1, 1));
    for (let i = 0; i < Math.floor(W - 2) * 2; i++) {
      bx(fabricM, 1 + i * 0.5, 1.86, 1, 1.5 + i * 0.5, 2.1, 1.14, i % 2 ? 0xf6f1e4 : stripe);
      bx(fabricM, 1 + i * 0.5, 1.82, 1.14, 1.5 + i * 0.5, 1.88, 1.17, i % 2 ? 0xf6f1e4 : stripe);
    }
    const lc = 1.1;
    const lr = W - 1.1;
    shelfUnit('N', lc, 5.0, { depth: 0.42, h: 1.72, tiers: 4, fill: 'goods', tag: 11, wood: shade(trimC, 1.05) });
    shelfUnit('N', 9.0, lr, { depth: 0.42, h: 1.72, tiers: 4, fill: 'goods', tag: 12, wood: shade(trimC, 1.05) });
    // Centre of the back wall: window, posters and either a stock counter or the real counter row.
    windowAt(mid, 1.5, 0.95, 1.7, stripe);
    for (const [px, c] of [[5.55, 0xf2c89a], [8.45, 0xb6d8f2]] as const) {
      bx(trimM, px - 0.3, 0.95, 1, px + 0.3, 1.72, 1.04, 0xffffff);
      bx(fabricM, px - 0.26, 0.99, 1.04, px + 0.26, 1.68, 1.06, c);
      shp(glow(0xff7a3a, 0.5), 'sph', px, 1.4, 1.07, 0.22, 0.22, 0.03, 0xffffff);
      bx(fabricM, px - 0.2, 1.05, 1.06, px + 0.2, 1.12, 1.07, 0xffffff);
    }
    if (!nHasCounter && free('N', 5.2, 8.8, 0, 0.55)) {
      wb(trimM, 'N', 5.2, 8.8, 0, 0.55, 0, 0.9, shade(trimC, 0.95));
      wb(trimM, 'N', 5.2, 8.8, 0.06, 0.5, 0.2, 0.8, shade(trimC, 1.2));
      wb(trimM, 'N', 5.15, 8.85, -0.0, 0.58, 0.9, 0.96, 0xf2e6cf);
      wb(metalM, 'N', 7.9, 8.5, 0.1, 0.45, 0.96, 1.1, 0xd8d3c8);
      wb(metalM, 'N', 8.0, 8.4, 0.2, 0.43, 1.1, 1.32, 0xc8c2b6);
      wb(glow(0x7fffd0, 0.9), 'N', 8.04, 8.36, 0.42, 0.435, 1.14, 1.26, 0xffffff);
      for (let i = 0; i < 5; i++) winst('box', 'matte', 'N', 5.5 + i * 0.28, 0.25, 1.02, 0.2, 0.12, 0.26, pick(GOODS, rnd(i, 4, 1)));
      winst('sph', 'gloss', 'N', 7.2, 0.25, 1.04, 0.16, 0.16, 0.16, 0xe0506e);
      winst('sph', 'gloss', 'N', 7.45, 0.3, 1.04, 0.16, 0.16, 0.16, 0xf2c92e);
    }
    shelfUnit('E', 3.3, 6.6, { depth: 0.38, h: 1.3, tiers: 3, fill: 'goods', tag: 13, wood: shade(trimC, 1.05) });
    shelfUnit('W', 5.2, 7.9, { depth: 0.38, h: 1.3, tiers: 3, fill: 'goods', tag: 14, wood: shade(trimC, 1.05) });
    // Crates of produce in the south corners (kept beside the doorway, clear of its lane).
    for (const [side, a] of [['E', H - 2.6], ['W', H - 2.6]] as const) {
      if (!free(side, a - 0.4, a + 0.4, 0, 0.5)) continue;
      wb(trimM, side, a - 0.4, a + 0.4, 0, 0.5, 0, 0.36, 0xb98a56);
      wb(trimM, side, a - 0.36, a + 0.36, 0.04, 0.46, 0.34, 0.38, 0x8a6238);
      for (let i = 0; i < 5; i++) winst('sph', 'gloss', side, a - 0.28 + i * 0.14, 0.14 + (i % 2) * 0.12, 0.42, 0.14, 0.14, 0.14, pick([0xe0506e, 0xff8a3a, 0x7ad46a], rnd(i, a * 3 | 0, 2)));
    }
    counterRow('shop');
    pottedPlant(Math.max(1.4, doorX - 1.3), H - 1.5, 0.7);
    pottedPlant(Math.min(W - 1.4, doorX + doorW + 1.3), H - 1.5, 0.7, 0xd8a04a, 0x4aa85a);
    lamp(mid, 2.1, 3.0, 0xffe2b0, 4.4, 10);
    lamp(mid, 1.5, 2.0, 0xffd29a, 1.8, 6);
  };

  const buildHeal = () => {
    windowAt(2.0, 0.9, 1.05, 1.9, 0xf2a2b6);
    windowAt(11.4, 0.9, 1.05, 1.9, 0xf2a2b6);
    // Reception counter along the back wall with the healing machine.
    const cx0 = 3.4;
    const cx1 = 7.6;
    const px = 5.5;
    if (free('N', cx0, cx1, 0, 0.5)) {
      wb(trimM, 'N', cx0, cx1, 0, 0.5, 0, 0.92, 0xf6efe8);
      wb(fabricM, 'N', cx0 + 0.1, cx1 - 0.1, 0.46, 0.5, 0.18, 0.82, 0xf2b6c4);
      wb(trimM, 'N', cx0 - 0.04, cx1 + 0.04, 0, 0.55, 0.92, 0.98, 0xf2c6d0);
      // Machine: base plate, glowing ball slots, a glass dome and a soft pink core.
      wb(metalM, 'N', px - 0.65, px + 0.65, 0.04, 0.42, 0.98, 1.06, 0xe8e4e0);
      for (let i = 0; i < 6; i++) {
        const col = i % 2 ? 0xff6f91 : 0xffffff;
        inst('sph', 'glow', px - 0.42 + (i % 3) * 0.42, 1.12, 0.16 + Math.floor(i / 3) * 0.19 + 1, 0.15, 0.15, 0.15, col);
      }
      wb(metalM, 'N', px - 0.3, px + 0.3, 0.1, 0.4, 1.06, 1.14, 0xf6efe8);
      shp(pulse(0xff9ec0, 1.2, 0.5, 2.4), 'sph', px, 1.32, 1.26, 0.3, 0.3, 0.3, 0xffffff);
      shp(glassM, 'sph', px, 1.32, 1.26, 0.44, 0.44, 0.44, 0xffffff);
      // Cross emblem plaque on the wall above.
      shp(trimM, 'disc', px, 1.82, 1.05, 0.56, 0.05, 0.56, 0xffffff, Math.PI / 2, 0, 0);
      const red = glow(0xff5f86, 0.55);
      bx(red, px - 0.06, 1.58, 1.07, px + 0.06, 2.06, 1.1, 0xffffff);
      bx(red, px - 0.24, 1.76, 1.07, px + 0.24, 1.88, 1.1, 0xffffff);
      halo(px, 2.3, 1.6, 0xff9ec0, 0.4);
      lamp(px, 1.8, 2.0, 0xffb5d0, 5.5, 8);
      // Bell and a vase.
      winst('sph', 'gloss', 'N', cx0 + 0.4, 0.28, 1.03, 0.14, 0.1, 0.14, 0xd7b04c);
      winst('cyl', 'gloss', 'N', cx1 - 0.4, 0.28, 1.13, 0.1, 0.22, 0.1, 0x9ad0f2);
      for (let i = 0; i < 3; i++) winst('sph', 'matte', 'N', cx1 - 0.4 + (i - 1) * 0.06, 0.28, 1.3 + i * 0.03, 0.08, 0.08, 0.08, pick([0xff6f91, 0xffd24a, 0xffffff], i / 3));
    }
    pictureAt(9.2, 1.6, 0.55, 0.45, 5);
    pictureAt(13.0, 1.6, 0.45, 0.55, 6);
    // Waiting benches.
    const bench = (side: Side, a0: number, a1: number) => {
      if (!free(side, a0, a1, 0, 0.45)) return;
      wb(trimM, side, a0, a1, 0, 0.12, 0.4, 0.95, shade(trimC, 0.85));
      wb(fabricM, side, a0, a1, 0.1, 0.45, 0.36, 0.46, 0xf2a2b6);
      for (const a of [a0 + 0.06, a1 - 0.16]) wb(trimM, side, a, a + 0.1, 0.12, 0.4, 0, 0.36, shade(trimC, 0.7));
    };
    bench('W', 5.0, 7.2);
    bench('E', 5.0, 7.2);
    bench('N', 8.4, 10.6);
    pottedPlant(12.3, 1.45, 0.9, 0xf0e6d8, 0x3f9a4a);
    pottedPlant(1.4, 1.45, 0.8, 0xf0e6d8, 0x4aa85a);
    pottedPlant(1.4, H - 1.5, 0.7, 0xf2c6d0, 0x4aa85a);
    pottedPlant(W - 1.4, H - 1.5, 0.7, 0xf2c6d0, 0x3f9a4a);
    // Floor mat leading to the counter.
    bx(fabricM, ax - 0.7, 0, 4.6, ax + 0.7, 0.012, 8.6, 0xf2b6c4);
    bx(fabricM, ax - 0.6, 0.012, 4.7, ax + 0.6, 0.02, 8.5, 0xfff5f0);
    lamp(mid, 2.1, 5.4, 0xfff0dc, 3.2, 10);
  };

  const buildTrial = () => {
    const el = theme.element ?? 'crystal';
    const E = ELEMENTS[el];
    const midX = mid;
    // Banners and slit windows on the back wall.
    const banner = (cx: number) => {
      bx(metalM, cx - 0.42, 1.98, 1, cx + 0.42, 2.03, 1.1, 0xd7b04c);
      bx(fabricM, cx - 0.34, 0.85, 1.05, cx + 0.34, 2.0, 1.1, E.main);
      bx(fabricM, cx - 0.34, 0.85, 1.1, cx - 0.28, 1.95, 1.11, E.accent);
      bx(fabricM, cx + 0.28, 0.85, 1.1, cx + 0.34, 1.95, 1.11, E.accent);
      tilt(fabricM, cx, 0.86, 1.07, 0.48, 0.48, 0.05, E.main, 0, 0, Math.PI / 4);
      tilt(fabricM, cx, 1.52, 1.12, 0.3, 0.3, 0.03, E.accent, 0, 0, Math.PI / 4);
      shp(glow(E.accent, 0.5), 'sph', cx, 1.52, 1.14, 0.12, 0.12, 0.04, 0xffffff);
    };
    for (const cx of [3.4, 6.6, W - 6.6, W - 3.4]) banner(cx);
    windowAt(5.0, 0.55, 1.0, 1.95, null);
    windowAt(W - 5.0, 0.55, 1.0, 1.95, null);
    // Great sigil behind the Keeper.
    const sx = midX + 0.5;
    shp(glow(E.accent, 0.8), 'disc', sx, 1.45, 1.06, 1.0, 0.04, 1.0, 0xffffff, Math.PI / 2, 0, 0);
    shp(metalM, 'disc', sx, 1.45, 1.05, 1.2, 0.04, 1.2, 0xd7b04c, Math.PI / 2, 0, 0);
    shp(pulse(E.main, 0.9, 0.3, 1.6), 'oct', sx, 1.45, 1.1, 0.7, 0.9, 0.12, 0xffffff);
    halo(sx, 3.3, 2.2, E.main, 0.28);
    // Element totems: braziers / coils / basins / planters / crystals.
    const totem = (side: Side, along: number) => {
      const [x, z] = wpos(side, along, 0.28);
      if (hitsReserved(x - 0.3, z - 0.3, x + 0.3, z + 0.3)) return;
      const base = shade(trimC, 1.1);
      shp(trimM, 'cyl', x, 0.2, z, 0.56, 0.4, 0.56, base);
      if (el === 'fire') {
        shp(metalM, 'cyl', x, 0.52, z, 0.42, 0.26, 0.42, 0x2a2024);
        shp(glow(0xff6a1c, 1.4), 'cyl', x, 0.66, z, 0.34, 0.04, 0.34, 0xffffff);
        for (let i = 0; i < 3; i++) inst('cone', 'glow', x + (i - 1) * 0.1, 0.84 + (i === 1 ? 0.08 : 0), z, 0.16, 0.34 + (i === 1 ? 0.12 : 0), 0.16, pick([0xff9a30, 0xffd060, 0xff6a1c], i / 3));
        lamp(x, 0.9, z + 0.4, 0xff8a40, 3.4, 7, 0.4);
      } else if (el === 'electric') {
        shp(metalM, 'cyl', x, 0.65, z, 0.2, 0.5, 0.2, 0x56606a);
        shp(metalM, 'cyl', x, 0.98, z, 0.14, 0.2, 0.14, 0x8a96a0);
        shp(pulse(0xfff08a, 1.5, 0.5, 5), 'sph', x, 1.18, z, 0.3, 0.3, 0.3, 0xffffff);
        for (let i = 0; i < 3; i++) shp(metalM, 'tri', x, 0.7 + i * 0.12, z, 0.34 - i * 0.05, 0.03, 0.34 - i * 0.05, 0xd7b04c);
        lamp(x, 1.1, z + 0.4, 0xffe27a, 3, 7, 0.5);
      } else if (el === 'water') {
        shp(glow(0x66c8ff, 0.9), 'cyl', x, 0.43, z, 0.46, 0.05, 0.46, 0xffffff);
        shp(trimM, 'cyl', x, 0.58, z, 0.12, 0.3, 0.12, base);
        shp(glow(0x9be8ff, 1), 'sph', x, 0.8, z, 0.22, 0.2, 0.22, 0xffffff);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          shp(glow(0x9be8ff, 0.8), 'sph', x + Math.cos(a) * 0.17, 0.55, z + Math.sin(a) * 0.17, 0.07, 0.13, 0.07, 0xffffff);
        }
        lamp(x, 0.9, z + 0.4, 0x6ac8ff, 3, 7);
      } else if (el === 'grass') {
        shp(trimM, 'cyl', x, 0.46, z, 0.5, 0.1, 0.5, 0x4a3524);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          inst('sph', 'matte', x + Math.cos(a) * 0.14, 0.72, z + Math.sin(a) * 0.14, 0.18, 0.48, 0.18, pick([0x3f9a4a, 0x5fc060, 0x2f8a3d], i / 6), a);
        }
        for (let i = 0; i < 3; i++) inst('sph', 'glow', x + (i - 1) * 0.14, 0.95 + i * 0.05, z + (i % 2) * 0.1, 0.09, 0.09, 0.09, 0xcfff7a);
        lamp(x, 1.0, z + 0.4, 0xa8ff6a, 2.8, 7);
      } else {
        for (const [dx, dz, s, h] of [[0, 0, 0.3, 0.6], [0.16, 0.1, 0.2, 0.4], [-0.15, 0.08, 0.22, 0.36]] as const) {
          shp(pulse(0xb890ff, 0.8, 0.3, 1.8 + s), 'oct', x + dx, 0.45 + h * 0.6, z + dz, s * 1.2, h * 1.5, s * 1.2, 0xffffff, 0, dx * 5, dx);
        }
        lamp(x, 1.0, z + 0.4, 0xb890ff, 3, 7);
      }
    };
    totem('N', 1.7);
    totem('N', W - 1.7);
    totem('W', 7.5);
    totem('E', 7.5);
    // Floor: carpet runner from the door, raised dais and element markings.
    const cx = ax;
    bx(fabricM, cx - 0.65, 0, 9.6, cx + 0.65, 0.012, H - 1.1, E.dark);
    bx(fabricM, cx - 0.52, 0.012, 9.6, cx + 0.52, 0.018, H - 1.1, mix(E.main, 0x000000, 0.25));
    bx(metalM, cx - 0.65, 0, 9.6, cx - 0.6, 0.02, H - 1.1, 0xd7b04c);
    bx(metalM, cx + 0.6, 0, 9.6, cx + 0.65, 0.02, H - 1.1, 0xd7b04c);
    const dz = 6.9;
    const R = 3.1;
    disc(trimM, cx, dz, R + 0.14, 0.015, 0.03, shade(trimC, 0.85));
    disc(trimM, cx, dz, R, 0.035, 0.07, mix(0x8a8594, E.dark, 0.2));
    const ringGeo = new THREE.RingGeometry(R - 0.34, R - 0.22, 56);
    const ring2 = new THREE.RingGeometry(R - 1.2, R - 1.12, 48);
    geos.push(ringGeo, ring2);
    const flat = new THREE.Matrix4();
    for (const [g, c] of [[ringGeo, E.main], [ring2, E.accent]] as const) {
      flat.makeRotationX(-Math.PI / 2).setPosition(cx, 0.078, dz);
      part(glow(c, 0.7)).addGeo(g, flat, 0xffffff);
    }
    // Element glyph: crossed diamonds.
    for (const a of [0, Math.PI / 4]) tilt(glow(E.main, 0.8), cx, 0.082, dz, 1.4, 0.012, 1.4, 0xffffff, 0, a, 0);
    tilt(glow(E.accent, 1), cx, 0.09, dz, 0.5, 0.012, 0.5, 0xffffff, 0, Math.PI / 4, 0);
    halo(cx, dz, 2.6, E.main, 0.22);
    // Side benches for spectators.
    for (const side of ['W', 'E'] as const) {
      if (!free(side, 9.6, 11.2, 0, 0.4)) continue;
      wb(trimM, side, 9.6, 11.2, 0, 0.4, 0.3, 0.38, shade(trimC, 1.2));
      for (const a of [9.68, 11.04]) wb(trimM, side, a, a + 0.1, 0.02, 0.38, 0, 0.3, shade(trimC, 0.8));
    }
    lamp(cx, 2.2, 5.5, mix(0xffe2b0, E.main, 0.25), 4.6, 11);
  };

  switch (theme.kind) {
    case 'lab': buildLab(); break;
    case 'house': buildHouse(); break;
    case 'shop': buildShop(); break;
    case 'heal': buildHeal(); break;
    default: buildTrial();
  }

  /* ----------------------------------------------------- tiled floor decals */
  const floorTiles: THREE.InstancedMesh[] = [];
  if (theme.checker) {
    const tileM = std({ color: theme.floorB, roughness: 0.82, map: grain });
    const pts: [number, number][] = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if ((x + y) % 2 === 1) pts.push([x, y]);
    const im = new THREE.InstancedMesh(unit.box, tileM, pts.length);
    const d = new THREE.Object3D();
    pts.forEach(([x, y], i) => {
      d.position.set(x + 0.5, 0.006, y + 0.5);
      d.scale.set(1, 0.012, 1);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    group.add(im);
    floorTiles.push(im);
  }

  /* ------------------------------------------------------------ finalise */
  for (const [material, mesher] of parts) {
    if (mesher.empty) continue;
    const geo = mesher.build();
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = !noCast.has(material);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const instanced: THREE.InstancedMesh[] = [];
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const b of bags.values()) {
    const n = b.p.length / 3;
    const mesh = new THREE.InstancedMesh(unit[b.kind], imats[b.mat], n);
    for (let i = 0; i < n; i++) {
      dummy.position.set(b.p[i * 3], b.p[i * 3 + 1], b.p[i * 3 + 2]);
      dummy.scale.set(b.s[i * 3], b.s[i * 3 + 1], b.s[i * 3 + 2]);
      dummy.rotation.set(b.r[i * 3], b.r[i * 3 + 1], b.r[i * 3 + 2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.setHex(b.c[i]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = b.mat !== 'glow';
    mesh.receiveShadow = true;
    group.add(mesh);
    instanced.push(mesh);
  }
  // Window light pools (one merged mesh) and glow halos (one per colour).
  if (!decalGeos.empty) {
    const g = decalGeos.build();
    geos.push(g);
    const m = new THREE.Mesh(g, shaftM);
    m.renderOrder = 2;
    group.add(m);
  }
  for (const [m, mesher] of haloMesh) {
    if (mesher.empty) continue;
    const g = mesher.build();
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 2;
    group.add(mesh);
  }

  let dead = false;
  return {
    update(seconds: number) {
      if (reduced || dead) return;
      for (const p of pulses) p.mat.emissiveIntensity = p.base + Math.sin(seconds * p.speed) * p.amp;
      for (const f of flickers) {
        f.light.intensity = f.base * (1 + Math.sin(seconds * f.speed + f.phase) * f.amp * 0.5 + Math.sin(seconds * f.speed * 2.7) * f.amp * 0.3);
      }
    },
    dispose() {
      if (dead) return;
      dead = true;
      for (const im of [...instanced, ...floorTiles]) im.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
      group.clear();
      root.remove(group);
    },
  };
}
