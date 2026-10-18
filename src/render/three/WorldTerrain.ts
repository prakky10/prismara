import * as THREE from 'three';
import { tileNameFor, type MapDef } from '../../world/maps';
import { fbm, hash2, smoothstep } from './world/Noise';
import { Mesher } from './world/Mesher';
import { grainTexture, plankTexture, rippleTexture, shingleTexture } from './world/Textures';

/** One authored building: meshes that can be ray-tested and materials that fade as a unit. */
export interface TerrainBuilding {
  meshes: THREE.Mesh[];
  parts: { material: THREE.MeshStandardMaterial; min: number }[];
  /** 0 = solid, 1 = fully faded; driven by World3D. */
  fade: number;
}

export interface WorldTerrain {
  root: THREE.Group;
  buildings: TerrainBuilding[];
  update(seconds: number): void;
  dispose(): void;
}

type Bag = { g: THREE.BufferGeometry; m: THREE.Material; p: number[]; s: number[]; r: number[]; c: number[] };

const enum K { Grass, Tall, Path, Sand, Snow, Cave, Crystal, Ruin, Water, Lava, Wood, Void, Scorch }

const PALETTE: Record<number, [number, number]> = {
  [K.Grass]: [0x5db552, 0x3f9645],
  [K.Tall]: [0x2f9a44, 0x1e7a3a],
  [K.Path]: [0xe4cc98, 0xcdab74],
  [K.Sand]: [0xebd6a0, 0xd9bf86],
  [K.Snow]: [0xf7fafd, 0xd9e5f3],
  [K.Cave]: [0x535060, 0x3a3742],
  [K.Crystal]: [0x6e6098, 0x4d4374],
  [K.Ruin]: [0xa89f8c, 0x887f6f],
  [K.Water]: [0x3f7f88, 0x2a5f78],
  [K.Lava]: [0x2f1612, 0x24100d],
  [K.Wood]: [0xc89258, 0xad7743],
  [K.Void]: [0x15131a, 0x100e14],
  [K.Scorch]: [0x62503f, 0x463530],
};
const PAL_COLORS = new Map<number, [THREE.Color, THREE.Color]>();
for (const [k, [a, b]] of Object.entries(PALETTE)) PAL_COLORS.set(Number(k), [new THREE.Color(a), new THREE.Color(b)]);
const HEIGHT: Record<number, number> = { [K.Water]: -0.3, [K.Lava]: -0.24 };

const PLASTER: Record<string, number> = { R: 0xf2e8d2, H: 0xfbe6e4, S: 0xe6eef7, V: 0xece3f5 };
const ROOF: Record<string, number> = { R: 0xc4603f, H: 0xe0506e, S: 0x3f74d6, V: 0x7e4fc6 };

function shade(hex: number, f: number): number {
  return new THREE.Color(hex).multiplyScalar(f).getHex();
}

export function createWorldTerrain(map: MapDef, reducedEffects = false): WorldTerrain {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const bags: Bag[] = [];
  const buildings: TerrainBuilding[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T): T => (geos.push(g), g);
  const mat = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p);
    mats.push(m);
    return m;
  };
  const tex = <T extends THREE.Texture>(t: T): T => (texs.push(t), t);
  const W = map.width;
  const H = map.height;
  const indoor = map.indoor === true;
  const snowy = map.biome === 'summit';
  const grain = tex(grainTexture());

  /* ------------------------------------------------------------ geometry */
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const trunkG = keep(new THREE.CylinderGeometry(0.075, 0.125, 1, 7));
  const blobG = keep(new THREE.IcosahedronGeometry(0.5, 1));
  const pineG = keep(new THREE.ConeGeometry(0.5, 1, 7));
  const headG = keep(new THREE.IcosahedronGeometry(0.05, 0));
  const rockG = keep(new THREE.DodecahedronGeometry(0.22, 0));
  const crystalG = keep(new THREE.OctahedronGeometry(0.42, 0));
  const puffG = keep(new THREE.IcosahedronGeometry(0.5, 1));
  const tuftG = (() => {
    const m = new Mesher();
    const cone = new THREE.ConeGeometry(0.04, 0.32, 3);
    const mt = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      const lean = k === 0 ? 0 : 0.32;
      e.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
      q.setFromEuler(e);
      const h = k === 0 ? 1.15 : 0.8 + (k % 2) * 0.2;
      mt.compose(new THREE.Vector3(Math.cos(a) * 0.05 * (k ? 1 : 0), 0.16 * h, Math.sin(a) * 0.05 * (k ? 1 : 0)), q, new THREE.Vector3(1, h, 1));
      m.addGeo(cone, mt, 0xffffff);
    }
    cone.dispose();
    return keep(m.build());
  })();

  /* ----------------------------------------------------------- materials */
  const std = (color: number, rough = 0.86, extra: THREE.MeshStandardMaterialParameters = {}) => mat({ color, roughness: rough, ...extra });
  const leafM = std(0xffffff, 0.8, { flatShading: true });
  const trunkM = std(0x70482c, 0.85, { flatShading: true });
  const pineM = std(0xffffff, 0.78, { flatShading: true });
  const bushM = std(0xffffff, 0.82, { flatShading: true });
  const bladeM = std(0xffffff, 0.8, { side: THREE.DoubleSide });
  const flowerM = std(0xffffff, 0.45);
  const stemM = std(0x3f8f3f, 0.8);
  const rockM = std(0xffffff, 0.95, { flatShading: true });
  const capM = std(0xf7fbff, 0.55);
  const caveM = std(0xffffff, 0.95, { flatShading: true });
  const caveBaseM = std(0x2a2830, 0.95);
  const cryM = mat({ color: 0x9a8cff, roughness: 0.2, emissive: 0x6a5cff, emissiveIntensity: 0.4, flatShading: true });
  const ruinM = std(0xffffff, 0.92, { flatShading: true });
  const fenceM = std(0xd2b88c, 0.8);
  const plankM = std(0xa9743e, 0.78, { map: grain });
  const woodM = std(0x6b4a2e, 0.82);
  const stoneM = std(0x9b958c, 0.9);
  const plasterM = std(0xf0e6d2, 0.9, { map: grain });
  const doorM = std(0xb06f3c, 0.6);
  const goldM = mat({ color: 0xd7b04c, roughness: 0.35, metalness: 0.6 });
  const glassM = mat({ color: 0xffe6b0, roughness: 0.25, emissive: 0xffc56a, emissiveIntensity: 0.5 });
  const signM = std(0xefe2bd, 0.7);
  const magM = mat({ color: 0x37d6c8, roughness: 0.32, metalness: 0.5, emissive: 0x14ffe0, emissiveIntensity: 0.7 });
  const grassCapM = std(0x58b24f, 0.85);
  const puffM = mat({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false });

  /* -------------------------------------------------- instancing helpers */
  const bag = (g: THREE.BufferGeometry, m: THREE.Material) => {
    let b = bags.find((x) => x.g === g && x.m === m);
    if (!b) bags.push((b = { g, m, p: [], s: [], r: [], c: [] }));
    return b;
  };
  const put = (
    g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, tint = 0xffffff, ry = 0, rz = 0, rx = 0,
  ) => {
    const b = bag(g, m);
    b.p.push(x, y, z);
    b.s.push(sx, sy, sz);
    b.r.push(rx, ry, rz);
    b.c.push(tint);
  };
  const ch = (x: number, y: number) => map.tiles[y]?.[x] ?? 'x';
  const nameAt = (x: number, y: number) => tileNameFor(ch(x, y), map.biome);

  /* -------------------------------------------------------------- ground */
  const kindOf = (name: string): K => {
    if (indoor) return name === 'empty' ? K.Void : K.Wood;
    switch (name) {
      case 'water': case 'bridge': return K.Water;
      case 'lava': return K.Lava;
      case 'sand': return K.Sand;
      case 'snow': return K.Snow;
      case 'path': case 'door': case 'window': case 'wall': case 'roof': case 'roof-heal': case 'roof-shop': case 'roof-trial': return K.Path;
      case 'cave-floor': case 'cave-wall': return K.Cave;
      case 'crystal-floor': case 'crystal-wall': case 'crystal-smashable': return K.Crystal;
      case 'ruin-floor': case 'ruin-wall': return K.Ruin;
      case 'tallgrass': return K.Tall;
      case 'empty': return K.Void;
      default:
        if (map.biome === 'cave') return K.Cave;
        if (map.biome === 'ruins') return K.Ruin;
        if (map.biome === 'summit') return K.Snow;
        if (map.biome === 'volcano') return K.Scorch;
        return K.Grass;
    }
  };
  const PAD = indoor ? 3 : 6;
  const SUB = 5;
  const GW = W + PAD * 2;
  const GH = H + PAD * 2;
  const kindGrid = new Uint8Array(GW * GH);
  for (let j = -PAD; j < H + PAD; j++) {
    for (let i = -PAD; i < W + PAD; i++) {
      const inside = i >= 0 && j >= 0 && i < W && j < H;
      let k: K;
      if (inside) k = kindOf(nameAt(i, j));
      else if (indoor) k = K.Void;
      else k = kindOf(nameAt(Math.min(W - 1, Math.max(0, i)), Math.min(H - 1, Math.max(0, j))));
      kindGrid[(j + PAD) * GW + (i + PAD)] = k;
    }
  }
  const kindAt = (i: number, j: number): K => {
    const ci = Math.min(W + PAD - 1, Math.max(-PAD, i));
    const cj = Math.min(H + PAD - 1, Math.max(-PAD, j));
    return kindGrid[(cj + PAD) * GW + (ci + PAD)] as K;
  };
  const scratch = new THREE.Color();
  const colorFor = (k: K, px: number, pz: number, ti: number, tj: number, out: THREE.Color) => {
    const pal = PAL_COLORS.get(k) ?? [new THREE.Color(0x808080), new THREE.Color(0x707070)];
    const t = fbm(px * 0.23, pz * 0.23, 40 + k, 3);
    out.copy(pal[0]).lerp(pal[1], Math.min(1, Math.max(0, (t - 0.25) * 2.0)));
    let v = 1 + (hash2(Math.round(px * SUB), Math.round(pz * SUB), k) - 0.5) * 0.07;
    if (k === K.Cave || k === K.Ruin || k === K.Crystal || k === K.Wood) v *= 0.92 + hash2(ti, tj, 77) * 0.16;
    if (k === K.Path && hash2(Math.round(px * 7), Math.round(pz * 7), 5) > 0.93) v *= 0.84;
    if (k === K.Grass && fbm(px * 0.9, pz * 0.9, 12, 2) > 0.72) out.lerp(scratch.setHex(0x76c85e), 0.3);
    if (k === K.Scorch && hash2(Math.round(px * 6), Math.round(pz * 6), 3) > 0.96) out.lerp(scratch.setHex(0xb44a22), 0.6);
    out.multiplyScalar(v);
  };
  const sm = (t: number) => smoothstep(0.34, 0.66, t);
  const wet = new THREE.Color(0xc9b27c);
  const foam = new THREE.Color(0xeaf6f4);
  const vw = GW * SUB + 1;
  const vh = GH * SUB + 1;
  const gPos = new Float32Array(vw * vh * 3);
  const gCol = new Float32Array(vw * vh * 3);
  const gUv = new Float32Array(vw * vh * 2);
  const acc = new THREE.Color();
  const tmp = new THREE.Color();
  for (let gz = 0; gz < vh; gz++) {
    for (let gx = 0; gx < vw; gx++) {
      const px = -PAD + gx / SUB;
      const pz = -PAD + gz / SUB;
      const u = px - 0.5;
      const v = pz - 0.5;
      const i0 = Math.floor(u);
      const j0 = Math.floor(v);
      const su = sm(u - i0 + (hash2(gx, gz, 1) - 0.5) * 0.3);
      const sv = sm(v - j0 + (hash2(gx, gz, 2) - 0.5) * 0.3);
      const ks = [kindAt(i0, j0), kindAt(i0 + 1, j0), kindAt(i0, j0 + 1), kindAt(i0 + 1, j0 + 1)];
      const ws = [(1 - su) * (1 - sv), su * (1 - sv), (1 - su) * sv, su * sv];
      const ti = [i0, i0 + 1, i0, i0 + 1];
      const tj = [j0, j0, j0 + 1, j0 + 1];
      acc.setRGB(0, 0, 0);
      let h = 0;
      let ww = 0;
      let lava = 0;
      for (let n = 0; n < 4; n++) {
        if (ws[n] < 0.002) continue;
        colorFor(ks[n], px, pz, ti[n], tj[n], tmp);
        acc.r += tmp.r * ws[n];
        acc.g += tmp.g * ws[n];
        acc.b += tmp.b * ws[n];
        h += (HEIGHT[ks[n]] ?? 0) * ws[n];
        if (ks[n] === K.Water) ww += ws[n];
        if (ks[n] === K.Lava) lava += ws[n];
      }
      const same = ks[0] === ks[1] && ks[1] === ks[2] && ks[2] === ks[3];
      if (!same) {
        const e = Math.max(4 * su * (1 - su), 4 * sv * (1 - sv));
        acc.multiplyScalar(1 - 0.09 * e);
      }
      if (ww > 0.02 && ww < 0.98) acc.lerp(wet, 0.6 * Math.sin(Math.PI * ww));
      if (ww > 0.05 && h > -0.2 && h < -0.04) acc.lerp(foam, 0.35 * (1 - Math.abs(h + 0.12) / 0.08));
      if (lava > 0.02 && lava < 0.98) acc.multiplyScalar(0.7);
      const o = gz * vw + gx;
      gPos[o * 3] = px;
      gPos[o * 3 + 1] = h;
      gPos[o * 3 + 2] = pz;
      gCol[o * 3] = acc.r;
      gCol[o * 3 + 1] = acc.g;
      gCol[o * 3 + 2] = acc.b;
      const uvScale = indoor ? 0.5 : 0.25;
      gUv[o * 2] = px * uvScale;
      gUv[o * 2 + 1] = pz * uvScale;
    }
  }
  const gIdx = new Uint32Array((vw - 1) * (vh - 1) * 6);
  let gi = 0;
  for (let gz = 0; gz < vh - 1; gz++) {
    for (let gx = 0; gx < vw - 1; gx++) {
      const a = gz * vw + gx;
      const b = a + 1;
      const c = a + vw;
      const d = c + 1;
      gIdx[gi++] = a; gIdx[gi++] = c; gIdx[gi++] = b;
      gIdx[gi++] = b; gIdx[gi++] = c; gIdx[gi++] = d;
    }
  }
  const groundG = keep(new THREE.BufferGeometry());
  groundG.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  groundG.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  groundG.setAttribute('uv', new THREE.BufferAttribute(gUv, 2));
  groundG.setIndex(new THREE.BufferAttribute(gIdx, 1));
  groundG.computeVertexNormals();
  groundG.computeBoundingSphere();
  const plank = indoor ? tex(plankTexture()) : null;
  const groundM = mat({ vertexColors: true, map: plank ?? grain, roughness: 0.95 });
  const ground = new THREE.Mesh(groundG, groundM);
  ground.receiveShadow = true;
  root.add(ground);

  /* --------------------------------------------------------- water, lava */
  const ripple = tex(rippleTexture());
  const rippleB = tex(ripple.clone());
  rippleB.needsUpdate = true;
  rippleB.repeat.set(0.7, 0.7);
  const waterM = mat({
    color: 0x4a9be0, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.8, depthWrite: false,
    map: ripple, emissive: 0x2a6fb0, emissiveMap: rippleB, emissiveIntensity: 0.45,
  });
  const lavaM = mat({
    color: 0xff5a1c, roughness: 0.5, map: ripple, emissive: 0xff4a10, emissiveMap: rippleB, emissiveIntensity: 1.0,
  });
  const liquid = (kindMatch: K[], y: number, material: THREE.Material, extend: boolean) => {
    const m = new Mesher();
    const ref = new THREE.Vector3();
    let count = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        if (!kindMatch.includes(kindAt(i, j))) continue;
        const e = (di: number, dj: number) => (extend && !kindMatch.includes(kindAt(i + di, j + dj)) ? 0.14 : 0);
        const x0 = i - e(-1, 0);
        const x1 = i + 1 + e(1, 0);
        const z0 = j - e(0, -1);
        const z1 = j + 1 + e(0, 1);
        ref.set(i, y - 1, j);
        const s = 0.3;
        m.quad(
          new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x0, y, z1),
          0xffffff, ref, [x0 * s, z0 * s, x1 * s, z0 * s, x1 * s, z1 * s, x0 * s, z1 * s],
        );
        count++;
      }
    }
    if (!count) return;
    const mesh = new THREE.Mesh(keep(m.build()), material);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    root.add(mesh);
  };
  liquid([K.Water], -0.1, waterM, true);
  liquid([K.Lava], -0.07, lavaM, false);

  /* ----------------------------------------------------------- buildings */
  const seen = new Set<string>();
  const roofs = new Set(['R', 'H', 'S', 'V']);
  const smoke: { x: number; y: number; z: number; seed: number }[] = [];
  const glowColor = 0xffe0a0;
  const flowerColors = [0xf25c8b, 0xffd24a, 0xffffff, 0xb59cff];
  const buildBuilding = (
    minX: number, maxX: number, minY: number, y1: number, kind: string, doorX: number, doorY: number,
  ) => {
    const x0 = minX;
    const x1 = maxX + 1;
    const z0 = minY;
    const zf = doorX >= 0 ? doorY + 0.32 : y1 + 1;
    const w = x1 - x0;
    const d = zf - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + zf) / 2;
    const wallH = 2.3;
    const plaster = PLASTER[kind] ?? PLASTER.R;
    const roofCol = ROOF[kind] ?? ROOF.R;
    const timber = 0x7a5638;
    const B = new Mesher();
    const G = new Mesher();
    const R = new Mesher();
    B.box(cx, 0.14, cz, w + 0.12, 0.28, d + 0.12, 0x9a948c);
    B.box(cx, 0.28 + (wallH - 0.28) / 2, cz, w, wallH - 0.28, d, plaster);
    B.box(cx, wallH - 0.07, cz, w + 0.1, 0.14, d + 0.1, timber);
    for (const px of [x0 + 0.04, x1 - 0.04]) for (const pz of [z0 + 0.04, zf - 0.04]) B.box(px, wallH / 2, pz, 0.16, wallH, 0.16, timber);
    // Local-to-world box on a vertical face. orient 'z' faces +/-z, 'x' faces +/-x.
    const fb = (orient: 'x' | 'z', face: number, along: number, sign: number, u: number, v: number, n: number, sw: number, sh: number, sd: number, color: number, target: Mesher = B) => {
      if (orient === 'z') target.box(along + u, v, face + sign * n, sw, sh, sd, color);
      else target.box(face + sign * n, v, along + u, sd, sh, sw, color);
    };
    const windowAt = (orient: 'x' | 'z', face: number, along: number, sign: number) => {
      fb(orient, face, along, sign, 0, 1.25, 0.02, 0.72, 0.72, 0.06, timber);
      fb(orient, face, along, sign, 0, 1.25, 0.055, 0.54, 0.54, 0.03, glowColor, G);
      fb(orient, face, along, sign, 0, 1.25, 0.075, 0.05, 0.56, 0.03, timber);
      fb(orient, face, along, sign, 0, 1.25, 0.075, 0.56, 0.05, 0.03, timber);
      fb(orient, face, along, sign, 0, 0.9, 0.08, 0.86, 0.07, 0.18, 0x9b958c);
      for (const s of [-1, 1]) fb(orient, face, along, sign, s * 0.44, 1.25, 0.04, 0.16, 0.66, 0.04, shade(roofCol, 0.95));
      fb(orient, face, along, sign, 0, 0.85, 0.12, 0.66, 0.12, 0.15, 0x6b4a2e);
      fb(orient, face, along, sign, 0, 0.94, 0.12, 0.62, 0.08, 0.13, 0x3f8f3f);
      for (let k = 0; k < 4; k++) {
        const hv = hash2(Math.round(along * 10) + k, Math.round(face * 10), 91);
        fb(orient, face, along, sign, -0.24 + k * 0.16, 1.0, 0.12, 0.07, 0.07, 0.07, flowerColors[Math.floor(hv * flowerColors.length)]);
      }
    };
    if (doorX >= 0) {
      const dc = doorX + 0.5;
      B.box(dc, 0.9, zf + 0.035, 0.68, 1.8, 0.07, timber);
      B.box(dc, 0.82, zf + 0.075, 0.5, 1.64, 0.05, 0xb06f3c);
      B.box(dc, 0.82, zf + 0.105, 0.03, 1.6, 0.02, 0x8a5128);
      B.box(dc + 0.15, 0.8, zf + 0.115, 0.05, 0.05, 0.04, 0xd7b04c);
      B.box(dc, 0.05, zf + 0.22, 0.95, 0.1, 0.38, 0x9b958c);
      G.box(dc, 1.35, zf + 0.105, 0.2, 0.2, 0.02, glowColor);
      B.box(dc, 1.98, zf + 0.06, 0.8, 0.12, 0.1, timber);
      if (kind === 'H') {
        B.box(dc, 2.0, zf + 0.12, 0.34, 0.34, 0.03, 0xffffff);
        B.box(dc, 2.0, zf + 0.14, 0.24, 0.07, 0.03, 0xe0506e);
        B.box(dc, 2.0, zf + 0.14, 0.07, 0.24, 0.03, 0xe0506e);
      } else if (kind === 'S') {
        for (let k = 0; k < 5; k++) B.box(dc - 0.5 + k * 0.25 + 0.125, 1.82, zf + 0.26, 0.25, 0.05, 0.5, k % 2 ? 0xf4efe2 : 0x2f9e66, 0.45, 0, 0);
      } else if (kind === 'V') {
        B.box(dc, 2.0, zf + 0.12, 0.26, 0.26, 0.04, 0xe6b325, 0, 0, Math.PI / 4);
      }
    }
    for (let yy = minY; yy <= y1; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        if (ch(xx, yy) !== 'w') continue;
        if (yy === (doorX >= 0 ? doorY : y1)) windowAt('z', zf, xx + 0.5, 1);
        else if (xx === minX) windowAt('x', x0, yy + 0.5, -1);
        else if (xx === maxX) windowAt('x', x1, yy + 0.5, 1);
      }
    }
    // Roof: gabled prism with overhanging eaves, shingles and a ridge cap.
    const alongX = w >= d;
    const A = (alongX ? w : d) / 2 + 0.3;
    const S = (alongX ? d : w) / 2;
    const P = S + 0.3;
    const eaveY = wallH - 0.02;
    const rise = Math.min(1.5, Math.max(0.8, S * 0.62));
    const ridgeY = eaveY + rise;
    const slope = rise / S;
    const outerY = ridgeY - slope * P;
    const t = 0.09;
    const wp = (a: number, p: number, y: number) => (alongX ? new THREE.Vector3(cx + a, y, cz + p) : new THREE.Vector3(cx + p, y, cz + a));
    const above = wp(0, 0, ridgeY + 3);
    const below = wp(0, 0, eaveY - 2);
    const mid = wp(0, 0, (ridgeY + outerY) / 2);
    const vL = Math.hypot(P, ridgeY - outerY) * 1.3;
    const roofUnder = shade(roofCol, 0.5);
    const roofEdge = shade(roofCol, 0.7);
    for (const s of [-1, 1]) {
      R.quad(wp(-A, 0, ridgeY), wp(A, 0, ridgeY), wp(A, s * P, outerY), wp(-A, s * P, outerY), roofCol, below, [-A * 1.1, 0, A * 1.1, 0, A * 1.1, vL, -A * 1.1, vL]);
      R.quad(wp(-A, 0, ridgeY - t), wp(A, 0, ridgeY - t), wp(A, s * P, outerY - t), wp(-A, s * P, outerY - t), roofUnder, above);
      R.quad(wp(-A, s * P, outerY), wp(A, s * P, outerY), wp(A, s * P, outerY - t), wp(-A, s * P, outerY - t), roofEdge, mid);
      for (const e of [-1, 1]) {
        R.quad(wp(e * A, 0, ridgeY), wp(e * A, s * P, outerY), wp(e * A, s * P, outerY - t), wp(e * A, 0, ridgeY - t), roofEdge, mid);
        const plane = e * (alongX ? w : d) / 2;
        const gable = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
        if (s === 1) {
          if (alongX) B.tri(gable(cx + plane, wallH - 0.1, z0 + 0.02), gable(cx + plane, wallH - 0.1, zf - 0.02), gable(cx + plane, ridgeY - 0.08, cz), plaster, new THREE.Vector3(cx, 1, cz));
          else B.tri(gable(x0 + 0.02, wallH - 0.1, cz + plane), gable(x1 - 0.02, wallH - 0.1, cz + plane), gable(cx, ridgeY - 0.08, cz + plane), plaster, new THREE.Vector3(cx, 1, cz));
        }
      }
    }
    R.box(cx, ridgeY + 0.03, cz, alongX ? 2 * A + 0.04 : 0.24, 0.13, alongX ? 0.24 : 2 * A + 0.04, shade(roofCol, 0.72));
    if ((kind === 'R' || kind === 'V') && w >= 2) {
      const pa = A * 0.5;
      const pp = -S * 0.45;
      const wpos = wp(pa, pp, 0);
      const surf = ridgeY - slope * Math.abs(pp);
      const top = ridgeY + 0.5;
      R.box(wpos.x, (surf - 0.25 + top) / 2, wpos.z, 0.36, top - (surf - 0.25), 0.36, 0x9b5b4a);
      R.box(wpos.x, top + 0.04, wpos.z, 0.46, 0.09, 0.46, 0x7a4a3c);
      smoke.push({ x: wpos.x, y: top + 0.1, z: wpos.z, seed: smoke.length * 0.37 });
    }
    const bodyM = mat({ vertexColors: true, map: grain, roughness: 0.88 });
    const glowMesh = mat({ vertexColors: true, roughness: 0.25, emissive: 0xffc56a, emissiveIntensity: 0.55 });
    const roofM = mat({ vertexColors: true, map: tex(shingleTexture()), roughness: 0.6 });
    const meshes: THREE.Mesh[] = [];
    for (const [mesher, material, cast] of [[B, bodyM, true], [G, glowMesh, false], [R, roofM, true]] as const) {
      if (mesher.empty) continue;
      const mesh = new THREE.Mesh(keep(mesher.build()), material);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      root.add(mesh);
      meshes.push(mesh);
    }
    buildings.push({
      meshes,
      parts: [{ material: bodyM, min: 0.4 }, { material: glowMesh, min: 0.4 }, { material: roofM, min: 0.1 }],
      fade: 0,
    });
  };
  if (!indoor) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const start = ch(x, y);
        if (!roofs.has(start) || seen.has(x + ',' + y)) continue;
        const stack = [x, y];
        seen.add(x + ',' + y);
        let minX = x, maxX = x, minY = y, maxY = y, kind = start;
        while (stack.length) {
          const cy = stack.pop();
          const cx = stack.pop();
          if (cx === undefined || cy === undefined) break;
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
          const tc = ch(cx, cy);
          if (tc === 'H' || tc === 'S' || tc === 'V') kind = tc;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + ox, ny = cy + oy, k = nx + ',' + ny;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || !roofs.has(ch(nx, ny))) continue;
            seen.add(k); stack.push(nx, ny);
          }
        }
        let doorX = -1, doorY = maxY;
        for (let yy = maxY + 1; yy < H && doorX < 0; yy++) for (let xx = minX; xx <= maxX; xx++) if (ch(xx, yy) === 'D') { doorX = xx; doorY = yy; }
        const y1 = doorX >= 0 ? doorY : maxY;
        for (let yy = minY; yy <= y1; yy++) for (let xx = minX; xx <= maxX; xx++) seen.add(xx + ',' + yy);
        buildBuilding(minX, maxX, minY, y1, kind, doorX, doorY);
      }
    }
  }

  /* --------------------------------------------------------------- props */
  const LEAVES = [0x4cae4a, 0x3f9d45, 0x58b84f, 0x359040];
  const LEAVES_DARK = [0x2f8a3d, 0x2a7d3a, 0x358f3f];
  const PINES = [0x1f6e49, 0x25784f, 0x1a6342];
  const pick = <T,>(list: T[], r: number) => list[Math.floor(r * list.length) % list.length];
  const wallBlock = (x: number, y: number, h: number, cap: number) => {
    const cx = x + 0.5, cz = y + 0.5;
    const r = hash2(x, y, 5);
    put(box, plasterM, cx, h / 2, cz, 1, h, 1, shade(0xffffff, 0.94 + r * 0.06));
    put(box, woodM, cx, 0.22, cz, 1.03, 0.44, 1.03);
    put(box, woodM, cx, h + 0.04, cz, 1.06, 0.09, 1.06, cap);
  };
  const prop = (n: string, x: number, y: number) => {
    const cx = x + 0.5, cz = y + 0.5;
    const r1 = hash2(x, y, 11), r2 = hash2(x, y, 12), r3 = hash2(x, y, 13);
    if (n === 'tree' || n === 'cut-tree') {
      const small = n === 'cut-tree';
      const k = small ? 0.78 : 1;
      put(trunkG, trunkM, cx, 0.5 * k + 0.05, cz, k, 1.15 * k, k, 0xffffff, r1 * 6);
      put(blobG, leafM, cx, 1.18 * k + 0.1, cz, 1.35 * k, 1.05 * k, 1.35 * k, small ? 0x8bd05a : pick(LEAVES_DARK, r1), r2 * 6);
      put(blobG, leafM, cx + (r2 - 0.5) * 0.12, 1.65 * k + 0.1, cz + (r3 - 0.5) * 0.1, 1.05 * k, 0.9 * k, 1.05 * k, small ? 0x9fdc66 : pick(LEAVES, r2), r3 * 6);
      put(blobG, leafM, cx - (r1 - 0.5) * 0.1, 2.05 * k + 0.1, cz, 0.68 * k, 0.62 * k, 0.68 * k, small ? 0xb2e87a : shade(pick(LEAVES, r3), 1.12), r1 * 6);
    } else if (n === 'pine') {
      put(trunkG, trunkM, cx, 0.35, cz, 0.8, 0.7, 0.8);
      const tone = pick(PINES, r1);
      put(pineG, pineM, cx, 0.95, cz, 1.12, 0.85, 1.12, tone, r2 * 6);
      put(pineG, pineM, cx, 1.5, cz, 0.88, 0.85, 0.88, shade(tone, 1.1), r3 * 6);
      put(pineG, pineM, cx, 2.0, cz, 0.6, 0.8, 0.6, shade(tone, 1.2), r1 * 6);
      if (snowy) {
        put(pineG, capM, cx, 2.22, cz, 0.36, 0.42, 0.36);
        put(pineG, capM, cx, 1.62, cz, 0.7, 0.3, 0.7);
      }
    } else if (n === 'tallgrass') {
      for (let i = 0; i < 6; i++) {
        const a = hash2(x * 7 + i, y, 21), b = hash2(x, y * 7 + i, 22);
        put(tuftG, bladeM, x + 0.12 + a * 0.76, 0, y + 0.12 + b * 0.76, 1.1, 1.45 + b * 0.5, 1.1, pick([0x2f9a44, 0x3aa84c, 0x278a3a], a), a * 6);
      }
    } else if (n === 'flowers') {
      for (let i = 0; i < 5; i++) {
        const a = hash2(x * 5 + i, y, 31), b = hash2(x, y * 5 + i, 32);
        const fx = x + 0.15 + a * 0.7, fz = y + 0.15 + b * 0.7;
        put(box, stemM, fx, 0.1, fz, 0.025, 0.2, 0.025);
        put(headG, flowerM, fx, 0.22, fz, 1.1, 0.9, 1.1, pick(flowerColors, b), a * 6);
      }
      put(tuftG, bladeM, cx, 0, cz, 0.8, 0.8, 0.8, 0x4aa64a, r1 * 6);
    } else if (n === 'bush') {
      put(blobG, bushM, cx - 0.1, 0.27, cz + 0.04, 0.78, 0.6, 0.72, pick([0x2f8a3d, 0x3a9a44], r1), r2 * 6);
      put(blobG, bushM, cx + 0.16, 0.22, cz - 0.06, 0.58, 0.46, 0.55, pick([0x3a9a44, 0x2d7a38], r2), r3 * 6);
      if (r3 > 0.55) put(headG, flowerM, cx + 0.04, 0.5, cz + 0.2, 0.8, 0.8, 0.8, pick(flowerColors, r1));
    } else if (n === 'rock-small') {
      put(rockG, rockM, cx, 0.17, cz, 1.25, 0.9, 1.1, shade(0xa39e96, 0.9 + r1 * 0.2), r2 * 6);
      put(rockG, rockM, cx + 0.22, 0.08, cz + 0.16, 0.6, 0.5, 0.6, 0x8d8880, r3 * 6);
      if (snowy) put(rockG, capM, cx, 0.3, cz, 0.7, 0.3, 0.7);
    } else if (n === 'ledge') {
      put(box, stoneM, cx, 0.2, cz - 0.12, 1.0, 0.4, 0.7, shade(0xffffff, 0.9 + r1 * 0.1));
      put(box, grassCapM, cx, 0.42, cz - 0.12, 1.02, 0.06, 0.74);
      put(rockG, rockM, cx - 0.3, 0.1, cz + 0.28, 0.5, 0.4, 0.5, 0x8d8880, r2 * 6);
    } else if (n === 'cave-wall') {
      const hh = 1.55 + r1 * 0.55;
      put(box, caveBaseM, cx, 0.45, cz, 1, 0.9, 1);
      put(rockG, caveM, cx, hh * 0.45, cz, 2.5, hh * 1.9, 2.5, shade(0x6a6676, 0.85 + r2 * 0.3), r3 * 6);
      put(rockG, caveM, cx + (r2 - 0.5) * 0.3, hh * 0.9, cz + (r3 - 0.5) * 0.3, 1.6, 1.6, 1.6, shade(0x7c7888, 0.9 + r1 * 0.2), r1 * 6);
    } else if (n === 'crystal-wall') {
      put(box, caveBaseM, cx, 0.3, cz, 1, 0.6, 1);
      put(crystalG, cryM, cx, 0.85, cz, 1.05, 1.9, 1.05, 0xffffff, r1 * 6);
      put(crystalG, cryM, cx + 0.22, 0.5, cz - 0.15, 0.55, 1.1, 0.55, 0xd7ccff, r2 * 6, 0.3);
      put(crystalG, cryM, cx - 0.2, 0.45, cz + 0.2, 0.5, 0.9, 0.5, 0xb6a8ff, r3 * 6, -0.3);
    } else if (n === 'crystal-smashable') {
      put(crystalG, cryM, cx, 0.4, cz, 0.6, 0.95, 0.6, 0xffffff, r1 * 6);
      put(rockG, rockM, cx + 0.25, 0.09, cz + 0.2, 0.6, 0.5, 0.6, 0x6a6676, r2 * 6);
    } else if (n === 'ruin-wall') {
      const hh = 1.1 + r1 * 0.5;
      put(box, ruinM, cx, hh / 2, cz, 0.96, hh, 0.96, pick([0xb0a794, 0x9a917f, 0xa59d8b], r2));
      put(box, ruinM, cx, hh + 0.05, cz, 1.0, 0.1, 1.0, 0xc2baa6);
      if (r3 > 0.5) put(box, bushM, cx + (r2 - 0.5) * 0.3, hh + 0.12, cz, 0.45, 0.14, 0.4, 0x4f8a45);
      put(rockG, ruinM, cx + 0.38, 0.1, cz + 0.4, 0.7, 0.5, 0.7, 0x9a917f, r3 * 6);
    } else if (n === 'fence') {
      const left = nameAt(x - 1, y) === 'fence';
      const right = nameAt(x + 1, y) === 'fence';
      put(box, fenceM, x + 0.14, 0.3, cz, 0.12, 0.6, 0.12);
      put(box, fenceM, x + 0.86, 0.3, cz, 0.12, 0.6, 0.12);
      const rw = left || right ? 1.0 : 0.66;
      const rc = left && !right ? cx - 0.0 : cx;
      put(box, fenceM, rc, 0.46, cz, rw, 0.07, 0.06);
      put(box, fenceM, rc, 0.24, cz, rw, 0.07, 0.06);
    } else if (n === 'bridge') {
      const horiz = nameAt(x - 1, y) === 'bridge' || nameAt(x + 1, y) === 'bridge' || (nameAt(x, y - 1) !== 'bridge' && nameAt(x, y + 1) !== 'bridge' && kindAt(x, y - 1) === K.Water);
      for (let i = 0; i < 4; i++) {
        const o = -0.375 + i * 0.25;
        const tone = shade(0xb8894e, 0.9 + hash2(x * 4 + i, y, 3) * 0.2);
        if (horiz) put(box, plankM, cx + o, 0.0, cz, 0.23, 0.1, 1.0, tone);
        else put(box, plankM, cx, 0.0, cz + o, 1.0, 0.1, 0.23, tone);
      }
      for (const s of [-1, 1]) {
        if (horiz) {
          put(box, woodM, cx, 0.42, cz + s * 0.46, 1.0, 0.06, 0.06);
          put(box, woodM, cx - 0.45, 0.22, cz + s * 0.46, 0.1, 0.5, 0.1);
        } else {
          put(box, woodM, cx + s * 0.46, 0.42, cz, 0.06, 0.06, 1.0);
          put(box, woodM, cx + s * 0.46, 0.22, cz - 0.45, 0.1, 0.5, 0.1);
        }
      }
    } else if (n === 'magnet-plate') {
      put(box, stoneM, cx, 0.02, cz, 0.94, 0.04, 0.94);
      put(box, magM, cx, 0.05, cz, 0.78, 0.04, 0.78);
    } else if (n === 'sign') {
      put(box, woodM, cx, 0.3, cz, 0.09, 0.6, 0.09);
      put(box, woodM, cx, 0.72, cz, 0.6, 0.38, 0.07);
      put(box, signM, cx, 0.72, cz + 0.04, 0.52, 0.3, 0.03);
      put(box, woodM, cx, 0.77, cz + 0.06, 0.34, 0.035, 0.02);
      put(box, woodM, cx, 0.68, cz + 0.06, 0.28, 0.035, 0.02);
    } else if (n === 'wall' && (indoor || !seen.has(x + ',' + y))) wallBlock(x, y, indoor ? 1.45 : 1.3, 0x7a5638);
    else if (n === 'window' && (indoor || !seen.has(x + ',' + y))) {
      wallBlock(x, y, indoor ? 1.45 : 1.3, 0x7a5638);
      put(box, woodM, cx, 0.95, y + 1.0, 0.5, 0.5, 0.05);
      put(box, glassM, cx, 0.95, y + 1.03, 0.38, 0.38, 0.03);
    } else if (n === 'door' && (indoor || !seen.has(x + ',' + y))) {
      put(box, woodM, cx, 0.5, y + 0.51, 0.62, 1.04, 0.08);
      put(box, doorM, cx, 0.46, y + 0.55, 0.48, 0.94, 0.05);
      put(box, goldM, cx + 0.14, 0.46, y + 0.6, 0.05, 0.05, 0.03);
    }
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const name = nameAt(x, y);
      const dch = map.decor?.[y]?.[x];
      const decorN = dch && dch !== '.' && dch !== ' ' ? tileNameFor(dch, map.biome) : '';
      prop(name, x, y);
      if (decorN && decorN !== name) prop(decorN, x, y);
      if (!indoor && name === 'grass' && !decorN) {
        const r = hash2(x, y, 41);
        const count = r < 0.3 ? 0 : r < 0.7 ? 1 : 2;
        for (let i = 0; i < count; i++) {
          const a = hash2(x * 3 + i, y, 42), b = hash2(x, y * 3 + i, 43);
          put(tuftG, bladeM, x + 0.1 + a * 0.8, 0, y + 0.1 + b * 0.8, 0.8, 0.7 + b * 0.5, 0.8, pick([0x5fbf55, 0x4aa64a, 0x6ccb5e], a), a * 6);
        }
        if (hash2(x, y, 44) > 0.92) {
          const fx = x + 0.2 + hash2(x, y, 45) * 0.6, fz = y + 0.2 + hash2(x, y, 46) * 0.6;
          put(box, stemM, fx, 0.07, fz, 0.02, 0.14, 0.02);
          put(headG, flowerM, fx, 0.15, fz, 0.9, 0.7, 0.9, pick(flowerColors, hash2(x, y, 47)));
        }
      }
    }
  }
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const dynamicInst: THREE.InstancedMesh[] = [];
  for (const b of bags) {
    const n = b.p.length / 3;
    if (!n) continue;
    const mesh = new THREE.InstancedMesh(b.g, b.m, n);
    const lowDetail = b.g === tuftG || b.g === headG;
    mesh.castShadow = !lowDetail;
    mesh.receiveShadow = !lowDetail;
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
    root.add(mesh);
  }

  /* --------------------------------------------------------------- smoke */
  let smokeMesh: THREE.InstancedMesh | null = null;
  if (smoke.length && !reducedEffects) {
    smokeMesh = new THREE.InstancedMesh(puffG, puffM, smoke.length * 3);
    smokeMesh.frustumCulled = false;
    root.add(smokeMesh);
    dynamicInst.push(smokeMesh);
  }
  const animateSmoke = (seconds: number) => {
    if (!smokeMesh) return;
    let n = 0;
    for (const s of smoke) {
      for (let j = 0; j < 3; j++) {
        const ph = (seconds * 0.22 + j / 3 + s.seed) % 1;
        dummy.position.set(s.x + ph * 0.55 + Math.sin(seconds + j) * 0.04, s.y + ph * 1.5, s.z + Math.cos(seconds * 0.7 + j) * 0.04);
        const sc = (0.1 + ph * 0.3) * (1 - ph * ph * ph);
        dummy.scale.set(sc, sc, sc);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        smokeMesh.setMatrixAt(n++, dummy.matrix);
      }
    }
    smokeMesh.instanceMatrix.needsUpdate = true;
  };
  animateSmoke(0);

  let dead = false;
  return {
    root,
    buildings,
    update(seconds: number) {
      if (reducedEffects || dead) return;
      ripple.offset.set(seconds * 0.02, seconds * 0.013);
      rippleB.offset.set(-seconds * 0.015, seconds * 0.017);
      waterM.emissiveIntensity = 0.42 + Math.sin(seconds * 1.4) * 0.1;
      lavaM.emissiveIntensity = 0.9 + Math.sin(seconds * 2.1) * 0.2;
      cryM.emissiveIntensity = 0.4 + Math.sin(seconds * 1.7) * 0.15;
      magM.emissiveIntensity = 0.7 + Math.sin(seconds * 3) * 0.25;
      animateSmoke(seconds);
    },
    dispose() {
      if (dead) return;
      dead = true;
      root.traverse((o) => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh) m.dispose(); });
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
      root.clear();
    },
  };
}
