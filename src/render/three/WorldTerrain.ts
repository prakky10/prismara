import * as THREE from 'three';
import { tileNameFor, type MapDef } from '../../world/maps';

type Bag = { g: THREE.BufferGeometry; m: THREE.Material; p: number[]; s: number[] };

export function createWorldTerrain(map: MapDef): { root: THREE.Group; dispose(): void } {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const bags: Bag[] = [];
  const keep = (g: THREE.BufferGeometry) => (geos.push(g), g);
  const mat = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p);
    mats.push(m);
    return m;
  };
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const trunkG = keep(new THREE.CylinderGeometry(0.09, 0.12, 1.3, 6));
  const canopyG = keep(new THREE.SphereGeometry(0.55, 7, 5));
  const pineG = keep(new THREE.ConeGeometry(0.48, 1.5, 6));
  const clumpG = keep(new THREE.ConeGeometry(0.07, 0.3, 4));
  const headG = keep(new THREE.SphereGeometry(0.065, 5, 4));
  const rockG = keep(new THREE.DodecahedronGeometry(0.22, 0));
  const crystalG = keep(new THREE.OctahedronGeometry(0.42, 0));
  const roofG = keep(new THREE.ConeGeometry(1, 1, 4));
  roofG.rotateY(Math.PI / 4);
  const std = (color: number, rough = 0.86) => mat({ color, roughness: rough });
  const floorMats = new Map<number, THREE.Material>();
  const floorMat = (c: number) => {
    let m = floorMats.get(c);
    if (!m) floorMats.set(c, (m = std(c, 0.92)));
    return m;
  };
  const waterM = mat({ color: 0x2c74c4, roughness: 0.16, metalness: 0.06, transparent: true, opacity: 0.78 });
  const lavaM = mat({ color: 0xff4a18, roughness: 0.45, emissive: 0xff3a10, emissiveIntensity: 0.85 });
  const foamM = mat({ color: 0xf7fbff, roughness: 0.35, transparent: true, opacity: 0.82 });
  const wallM = std(0xf3ecdf, 0.9);
  const doorM = mat({ color: 0xb08d57, roughness: 0.42, metalness: 0.58 });
  const winM = mat({ color: 0xffe6b0, roughness: 0.25, emissive: 0xffc56a, emissiveIntensity: 0.45 });
  const roofR = mat({ color: 0x149e98, roughness: 0.45 });
  const roofH = mat({ color: 0xd24b4b, roughness: 0.42 });
  const roofS = mat({ color: 0x3a6ed6, roughness: 0.42 });
  const roofV = mat({ color: 0x7b49c4, roughness: 0.42 });
  const trunkM = std(0x6b4428, 0.8);
  const leafM = std(0x2f8f3a, 0.75);
  const pineM = std(0x1e6b45, 0.7);
  const grassM = std(0x3fa84a, 0.8);
  const flowerM = [0xf25c8b, 0xffd24a, 0x8b7cf0].map((c) => mat({ color: c, roughness: 0.4 }));
  const bushM = std(0x2d7a38, 0.8);
  const rockM = std(0x7a756e, 0.95);
  const capM = std(0xf7fbff, 0.55);
  const caveM = std(0x2c2b30, 0.95);
  const cryM = mat({ color: 0x9a8cff, roughness: 0.22, emissive: 0x6a5cff, emissiveIntensity: 0.35 });
  const ruinM = std(0x9a9184, 0.92);
  const fenceM = std(0xc9b08a, 0.8);
  const plankM = std(0xa9743e, 0.78);
  const magM = mat({ color: 0x37d6c8, roughness: 0.32, metalness: 0.62, emissive: 0x14ffe0, emissiveIntensity: 0.7 });
  const signM = std(0xefe6c8, 0.7);
  const bag = (g: THREE.BufferGeometry, m: THREE.Material) => {
    let b = bags.find((x) => x.g === g && x.m === m);
    if (!b) bags.push((b = { g, m, p: [], s: [] }));
    return b;
  };
  const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const b = bag(g, m);
    b.p.push(x, y, z);
    b.s.push(sx, sy, sz);
  };
  const solid = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const mesh = new THREE.Mesh(box, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  };
  const W = map.width;
  const H = map.height;
  const snowy = map.biome === 'summit';
  const base = new THREE.Mesh(keep(new THREE.BoxGeometry(W, 0.5, H)), std(0xc4623e, 0.9));
  base.position.set(W / 2, -0.41, H / 2);
  base.castShadow = base.receiveShadow = true;
  root.add(base);
  const ch = (x: number, y: number) => map.tiles[y]?.[x] ?? 'x';
  const seen = new Set<string>();
  const roofs = new Set(['R', 'H', 'S', 'V']);
  const floorOf = (n: string) => {
    if (n === 'path' || n === 'door' || n === 'window' || n === 'wall' || n.startsWith('roof')) return 0xe6d2a4;
    if (n === 'sand') return 0xd4b07a;
    if (n === 'snow') return 0xf5f8fc;
    if (n === 'cave-floor' || map.biome === 'cave') return 0x3a3840;
    if (n === 'crystal-floor') return 0x4e4566;
    if (n === 'ruin-floor' || map.biome === 'ruins') return 0x8a8172;
    if (n === 'bridge') return 0xb8894e;
    if (snowy) return 0xf5f8fc;
    return 0x3c9a48;
  };
  if (!map.indoor) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
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
        const t = ch(cx, cy);
        if (t === 'H' || t === 'S' || t === 'V') kind = t;
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
      const x0 = minX, x1 = maxX + 1, z0 = minY, z1 = y1 + 1;
      const rearTo = doorX >= 0 ? doorY : z1;
      solid(wallM, (x0 + x1) / 2, 1.15, (z0 + rearTo) / 2, x1 - x0, 2.3, Math.max(0.2, rearTo - z0));
      if (doorX >= 0) {
        const dc = doorX + 0.5, gl = Math.max(x0, dc - 0.32), gr = Math.min(x1, dc + 0.32);
        if (gl - x0 > 0.04) solid(wallM, (x0 + gl) / 2, 1.15, doorY + 0.16, gl - x0, 2.3, 0.32);
        if (x1 - gr > 0.04) solid(wallM, (gr + x1) / 2, 1.15, doorY + 0.16, x1 - gr, 2.3, 0.32);
        solid(wallM, (gl + gr) / 2, 2.05, doorY + 0.16, gr - gl, 0.5, 0.32);
        solid(doorM, dc, 0.8, doorY + 0.51, 0.48, 1.6, 0.08);
      }
      const roof = new THREE.Mesh(roofG, kind === 'H' ? roofH : kind === 'S' ? roofS : kind === 'V' ? roofV : roofR);
      roof.scale.set((x1 - x0) * 0.78, 1.4, (z1 - z0) * 0.78);
      roof.position.set((x0 + x1) / 2, 3.0, (z0 + z1) / 2);
      roof.castShadow = roof.receiveShadow = true;
      root.add(roof);
      for (let yy = minY; yy <= y1; yy++) for (let xx = minX; xx <= maxX; xx++) if (ch(xx, yy) === 'w') {
        const front = doorX >= 0 && yy === doorY, west = xx === minX, east = xx === maxX;
        solid(winM, xx + (west && !front ? 0.1 : east && !front ? 0.9 : 0.5), 0.88, yy + (front ? 0.36 : 0.5), west || east ? 0.08 : 0.32, 0.3, front || (!west && !east) ? 0.08 : 0.32);
      }
    }
  }
  const prop = (n: string, x: number, y: number) => {
    const cx = x + 0.5, cz = y + 0.5;
    if (n === 'tree' || n === 'cut-tree') {
      put(trunkG, trunkM, cx, 0.65, cz, 1, 1, 1);
      put(canopyG, leafM, cx - 0.05, 1.78, cz + 0.03, 0.87, 0.87, 0.87);
      put(canopyG, leafM, cx + 0.05, 2.32, cz - 0.03, 0.87, 0.87, 0.87);
    } else if (n === 'pine') {
      put(trunkG, trunkM, cx, 0.5, cz, 0.75, 0.75, 0.75);
      put(pineG, pineM, cx, 1.72, cz, 1, 1, 1);
      if (snowy) put(rockG, capM, cx, 2.42, cz, 0.45, 0.22, 0.45);
    } else if (n === 'tallgrass') for (let i = 0; i < 3; i++) put(clumpG, grassM, cx + (i - 1) * 0.22, 0.15, cz + (i === 1 ? 0.12 : -0.08), 1, 1, 1);
    else if (n === 'flowers') for (let i = 0; i < 3; i++) put(headG, flowerM[i], cx + (i - 1) * 0.18, 0.14, cz + (i === 1 ? 0.1 : -0.05), 1, 1, 1);
    else if (n === 'bush') put(canopyG, bushM, cx, 0.26, cz, 0.48, 0.4, 0.48);
    else if (n === 'rock-small') { put(rockG, rockM, cx, 0.16, cz, 1, 0.75, 1); if (snowy) put(rockG, capM, cx, 0.3, cz, 0.5, 0.22, 0.5); }
    else if (n === 'ledge') put(box, rockM, cx, 0.22, cz - 0.22, 1, 0.44, 0.42);
    else if (n === 'cave-wall') put(box, caveM, cx, 0.9, cz, 1, 1.8, 1);
    else if (n === 'crystal-wall') put(crystalG, cryM, cx, 0.85, cz, 1, 1.9, 1);
    else if (n === 'crystal-smashable') put(crystalG, cryM, cx, 0.38, cz, 0.55, 0.9, 0.55);
    else if (n === 'ruin-wall') put(box, ruinM, cx, 0.75, cz, 0.94, 1.5, 0.94);
    else if (n === 'fence') { put(box, fenceM, x + 0.16, 0.28, cz, 0.1, 0.56, 0.1); put(box, fenceM, x + 0.84, 0.28, cz, 0.1, 0.56, 0.1); put(box, fenceM, cx, 0.32, cz, 0.62, 0.08, 0.08); }
    else if (n === 'bridge') put(box, plankM, cx, 0.05, cz, 0.92, 0.08, 0.92);
    else if (n === 'magnet-plate') put(box, magM, cx, 0.025, cz, 0.86, 0.04, 0.86);
    else if (n === 'sign') { put(trunkG, trunkM, cx, 0.32, cz, 0.32, 0.5, 0.32); put(box, signM, cx, 0.7, cz, 0.46, 0.28, 0.06); }
    else if (n === 'wall' && (map.indoor || !seen.has(x + ',' + y))) put(box, wallM, cx, map.indoor ? 0.9 : 0.75, cz, 1, map.indoor ? 1.8 : 1.5, 1);
    else if (n === 'window' && (map.indoor || !seen.has(x + ',' + y))) { put(box, wallM, cx, map.indoor ? 0.9 : 0.75, cz, 1, map.indoor ? 1.8 : 1.5, 1); put(box, winM, cx, 0.9, y + 0.92, 0.34, 0.32, 0.06); }
    else if (n === 'door' && (map.indoor || !seen.has(x + ',' + y))) put(box, doorM, cx, 0.55, y + 0.51, 0.48, 1.08, 0.08);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const name = tileNameFor(ch(x, y), map.biome);
    const dch = map.decor?.[y]?.[x];
    const decorN = dch && dch !== '.' && dch !== ' ' ? tileNameFor(dch, map.biome) : '';
    if (name === 'water') {
      put(box, waterM, x + 0.5, -0.12, y + 0.5, 1, 0.06, 1);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || tileNameFor(ch(nx, ny), map.biome) === 'water') continue;
        put(box, foamM, x + 0.5 + ox * 0.4, -0.075, y + 0.5 + oy * 0.4, ox ? 0.14 : 0.48, 0.02, oy ? 0.14 : 0.48);
      }
    } else if (name === 'lava') put(box, lavaM, x + 0.5, -0.07, y + 0.5, 1, 0.06, 1);
    else if (name !== 'empty') put(box, floorMat(floorOf(name)), x + 0.5, -0.07, y + 0.5, 1, 0.06, 1);
    prop(name, x, y);
    if (decorN && decorN !== name) prop(decorN, x, y);
  }
  const dummy = new THREE.Object3D();
  for (const b of bags) {
    const n = b.p.length / 3;
    if (!n) continue;
    const mesh = new THREE.InstancedMesh(b.g, b.m, n);
    mesh.castShadow = mesh.receiveShadow = true;
    for (let i = 0; i < n; i++) {
      dummy.position.set(b.p[i * 3], b.p[i * 3 + 1], b.p[i * 3 + 2]);
      dummy.scale.set(b.s[i * 3], b.s[i * 3 + 1], b.s[i * 3 + 2]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }
  let dead = false;
  return {
    root,
    dispose() {
      if (dead) return;
      dead = true;
      root.traverse((o) => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh) m.dispose(); });
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      root.clear();
    },
  };
}
