import * as THREE from 'three';
import type Phaser from 'phaser';
import { ThreeSurface } from './three/ThreeSurface';
import { createCreatureModel } from './three/CreatureModels';
import { Kit, Motes, fbm, instance, propMat, rng, smoothstep, sway, vnoise, type Inst } from './three/arena/kit';
import { broadleafGeo, flowerGeo, pineGeo, rockGeo, tuftGeo } from './three/arena/props';
import { createLighthouse } from './three/title/lighthouse';

/** Ortho frustum 20 x 11.25, cam (0,7,16) lookAt (0,1.5,0). Trio feet: screen rays onto y=0.08 (960x540). */
const TRIO = [
  ['emberkit', 550, 450, 0.18],
  ['drizzlet', 720, 450, -0.12],
  ['sproutle', 860, 450, 0.08],
] as const;
const VIEW_W = 960;
const VIEW_H = 540;
const PI = Math.PI;

// Island ellipse (world xz) and sea level.
const IC = { x: 3, z: 8, a: 9.2, b: 5.2 };
const SEA_Y = -0.28;
const SCREEN_SCALE = 1.12;
/** Where the sea meets the sky, as a fraction of the (scaled) sky texture height from the top. */
const HORIZON = 0.5 + (0.258 - 0.5) / SCREEN_SCALE;
const SUN_U = 0.5 + 3.2 / (20 * SCREEN_SCALE);
const HAZE = 0xf0a483;

function islandDist(x: number, z: number): number {
  const u = (x - IC.x) / IC.a;
  const v = (z - IC.z) / IC.b;
  return Math.hypot(u, v) + (fbm(x * 0.18, z * 0.18, 3, 3) - 0.5) * 0.3;
}

function islandHeight(x: number, z: number): number {
  const dn = islandDist(x, z);
  const u = (x - IC.x) / IC.a;
  const v = (z - IC.z) / IC.b;
  const top = 0.1 + (fbm(x * 0.3, z * 0.3, 5, 3) - 0.5) * 0.22 * smoothstep(1, 0.55, dn);
  const cliffy = Math.max(smoothstep(0.05, -0.5, v), smoothstep(0.62, 0.95, u) * 0.85);
  const strata = (fbm(x * 0.9, z * 0.9, 8, 3) - 0.5) * 0.35 * smoothstep(0.8, 0.9, dn);
  const cliff = top + (-1.7 - top) * smoothstep(0.8, 0.9, dn) + strata;
  const beach = top + (-0.42 - top) * smoothstep(0.78, 1.04, dn);
  const h = beach + (cliff - beach) * cliffy;
  return dn > 1.06 ? Math.min(h, -1.7) : h;
}

function skyTexture(kit: Kit): THREE.CanvasTexture {
  return kit.tex(1024, 576, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    const stops: Array<[number, string]> = [
      [0, '#161d4a'], [0.08, '#2c3278'], [0.16, '#5a4590'], [HORIZON * 0.62, '#b0609a'],
      [HORIZON * 0.84, '#e8809a'], [HORIZON * 0.95, '#ff9f70'], [HORIZON, '#ffc98a'], [HORIZON + 0.001, '#f4a886'], [1, '#e89478'],
    ];
    for (const [p, col] of stops) g.addColorStop(Math.min(1, p), col);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(255,245,230,${0.2 + r() * 0.5})`;
      c.fillRect(r() * w, r() * h * 0.12, 1.5, 1.5);
    }
    const sx = SUN_U * w;
    const sy = (HORIZON - 0.05) * h;
    const glow = c.createRadialGradient(sx, sy, 0, sx, sy, 330);
    glow.addColorStop(0, 'rgba(255,214,150,0.85)');
    glow.addColorStop(0.3, 'rgba(255,160,110,0.4)');
    glow.addColorStop(1, 'rgba(255,120,100,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    // Cloud streaks lit from below by the sun.
    for (let i = 0; i < 26; i++) {
      const y = h * (0.05 + r() * (HORIZON - 0.1));
      const x = r() * w;
      const rx = 60 + r() * 170;
      const ry = 5 + r() * 12;
      const low = y / h > HORIZON * 0.55;
      c.fillStyle = low ? 'rgba(255,150,120,0.5)' : 'rgba(120,90,160,0.45)';
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, PI * 2);
      c.fill();
      c.fillStyle = low ? 'rgba(255,225,190,0.45)' : 'rgba(210,170,220,0.25)';
      c.beginPath();
      c.ellipse(x, y - ry * 0.45, rx * 0.8, ry * 0.45, 0, 0, PI * 2);
      c.fill();
    }
    const disc = c.createRadialGradient(sx, sy, 0, sx, sy, 30);
    disc.addColorStop(0, '#fffbe0');
    disc.addColorStop(0.8, '#ffe0a0');
    disc.addColorStop(1, 'rgba(255,200,140,0)');
    c.fillStyle = disc;
    c.beginPath();
    c.arc(sx, sy, 30, 0, PI * 2);
    c.fill();
  }, false);
}

export function createScenicVista(scene: Phaser.Scene): void {
  const reduced = scene.registry.get('reducedEffects') === true;
  const kit = new Kit();
  const world = new THREE.Scene();
  world.fog = new THREE.Fog(HAZE, 26, 85);
  const camera = new THREE.OrthographicCamera(-10, 10, 5.625, -5.625, 0.1, 100);
  camera.position.set(0, 7, 16);
  camera.lookAt(0, 1.5, 0);
  camera.updateMatrixWorld();

  // Dusk lighting: warm key from the front-left, rose rim from the sun side.
  const sun = new THREE.DirectionalLight(0xffc890, 2.5);
  sun.position.set(-8, 12, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 50;
  const rim = new THREE.DirectionalLight(0xff9a70, 0.9);
  rim.position.set(6, 5, -10);
  const fill = new THREE.DirectionalLight(0x7a90e0, 0.45);
  fill.position.set(10, 6, 6);
  world.add(sun, rim, fill, new THREE.HemisphereLight(0xc8a8e0, 0x3a5a78, 0.65), new THREE.AmbientLight(0xffe8f0, 0.28));

  // Sky backdrop: a screen-aligned painted plane (orthographic camera, so depth is irrelevant).
  const skyGeo = kit.track(new THREE.PlaneGeometry(20 * SCREEN_SCALE, 11.25 * SCREEN_SCALE));
  const skyMat = kit.track(new THREE.MeshBasicMaterial({ map: skyTexture(kit), fog: false, toneMapped: false, depthWrite: false }));
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  const dir = new THREE.Vector3(0, 1.5, 0).sub(camera.position).normalize();
  skyMesh.position.copy(camera.position).addScaledVector(dir, 85);
  skyMesh.lookAt(camera.position);
  skyMesh.renderOrder = -10;
  world.add(skyMesh);

  /* ---- sea ---- */
  const seaW = 64;
  const seaD = 40;
  const segX = reduced ? 32 : 64;
  const segZ = reduced ? 20 : 40;
  const seaGeo = kit.track(new THREE.PlaneGeometry(seaW, seaD, segX, segZ));
  seaGeo.rotateX(-PI / 2);
  seaGeo.translate(0, 0, -13.5 + seaD / 2);
  const sp = seaGeo.getAttribute('position');
  const seaCol = new Float32Array(sp.count * 3);
  const shallow = new THREE.Color(0x35d6c4);
  const mid = new THREE.Color(0x1f90b8);
  const deep = new THREE.Color(0x365c9a);
  const haze = new THREE.Color(0xd890a4);
  const tmp = new THREE.Color();
  const baseXZ = new Float32Array(sp.count * 2);
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i);
    const z = sp.getZ(i);
    baseXZ[i * 2] = x;
    baseXZ[i * 2 + 1] = z;
    const near = 1 - smoothstep(0.9, 1.5, islandDist(x, z));
    const crag = 1 - smoothstep(1.5, 4.8, Math.hypot(x - 7.15, z + 1.15));
    tmp.copy(deep).lerp(mid, smoothstep(-12, 6, z)).lerp(shallow, Math.max(near, crag * 0.8));
    tmp.lerp(haze, smoothstep(-5, -13.4, z) * 0.75);
    seaCol[i * 3] = tmp.r;
    seaCol[i * 3 + 1] = tmp.g;
    seaCol[i * 3 + 2] = tmp.b;
  }
  seaGeo.setAttribute('color', new THREE.BufferAttribute(seaCol, 3));
  const ripple = kit.noiseTex(256, 0xdce8f0, 0xffffff, 8, 91, (c, s, r) => {
    for (let i = 0; i < 240; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.4})`;
      c.fillRect(r() * s, r() * s, 3 + r() * 9, 1);
    }
  });
  ripple.repeat.set(7, 5);
  const seaMat = kit.track(new THREE.MeshStandardMaterial({ map: ripple, vertexColors: true, roughness: 0.16, metalness: 0.2, transparent: true, opacity: 0.94 }));
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = SEA_Y;
  sea.receiveShadow = true;
  world.add(sea);

  /* ---- island ---- */
  const isW = 28;
  const isD = 18;
  const isoGeo = kit.track(new THREE.PlaneGeometry(isW, isD, reduced ? 70 : 120, reduced ? 44 : 78));
  isoGeo.rotateX(-PI / 2);
  isoGeo.translate(3.5, 0, 8);
  const ip = isoGeo.getAttribute('position');
  const iuv = isoGeo.getAttribute('uv');
  const ic = new Float32Array(ip.count * 3);
  const grassA = new THREE.Color(0x3a9a4c);
  const grassB = new THREE.Color(0x78c862);
  const sand = new THREE.Color(0xecd2a2);
  const wet = new THREE.Color(0xb89c78);
  const rockA = new THREE.Color(0xbc6a42);
  const rockB = new THREE.Color(0x8e4a30);
  const rockC = new THREE.Color(0xd09462);
  const under = new THREE.Color(0x6a5a52);
  for (let i = 0; i < ip.count; i++) {
    const x = ip.getX(i);
    const z = ip.getZ(i);
    const h = islandHeight(x, z);
    ip.setY(i, h);
    iuv.setXY(i, x / 5, z / 5);
  }
  for (let i = 0; i < ip.count; i++) {
    const x = ip.getX(i);
    const z = ip.getZ(i);
    const h = ip.getY(i);
    const sl = Math.hypot(islandHeight(x + 0.14, z) - h, islandHeight(x, z + 0.14) - h) / 0.14;
    const n = fbm(x * 0.5, z * 0.5, 12, 3);
    const strata = Math.floor((h + 3) * 3.2 + n * 1.5) % 3;
    tmp.copy(grassA).lerp(grassB, n);
    if (h < 0.05) tmp.lerp(sand, smoothstep(0.05, -0.12, h));
    if (h < -0.2) tmp.lerp(wet, smoothstep(-0.2, -0.4, h));
    if (h < -0.45) tmp.lerp(under, smoothstep(-0.45, -1, h));
    const rock = smoothstep(0.5, 1.2, sl);
    if (rock > 0) tmp.lerp(strata === 0 ? rockA : strata === 1 ? rockB : rockC, rock);
    tmp.multiplyScalar(0.9 + vnoise(x * 3, z * 3, 6) * 0.2);
    ic[i * 3] = tmp.r;
    ic[i * 3 + 1] = tmp.g;
    ic[i * 3 + 2] = tmp.b;
  }
  isoGeo.setAttribute('color', new THREE.BufferAttribute(ic, 3));
  isoGeo.computeVertexNormals();
  const grain = kit.noiseTex(128, 0xe6e6e6, 0xffffff, 6, 93);
  const isoMat = kit.track(new THREE.MeshStandardMaterial({ map: grain, vertexColors: true, roughness: 0.95 }));
  const island = new THREE.Mesh(isoGeo, isoMat);
  island.receiveShadow = true;
  island.castShadow = true;
  world.add(island);

  // Shore foam rings follow the island outline.
  const foamMat = kit.track(new THREE.MeshBasicMaterial({ color: 0xfff6ee, transparent: true, opacity: 0.5, depthWrite: false }));
  const foamRings: THREE.Mesh[] = [];
  const foamGeo = kit.track(new THREE.RingGeometry(0.98, 1.035, 96));
  foamGeo.rotateX(-PI / 2);
  for (const k of [1.12, 1.2]) {
    const f = new THREE.Mesh(foamGeo, foamMat);
    f.scale.set(IC.a * k, 1, IC.b * k);
    f.position.set(IC.x, SEA_Y + 0.02, IC.z);
    world.add(f);
    foamRings.push(f);
  }

  /* ---- lighthouse crag ---- */
  const place = (geo: THREE.BufferGeometry, x: number, z: number, topY: number, s: number, ry: number, mat: THREE.Material): THREE.Mesh => {
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(s);
    mesh.rotation.y = ry;
    mesh.position.set(x, topY - (geo.boundingBox?.max.y ?? 0) * s, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
    return mesh;
  };
  const rockMat = propMat(kit);
  place(kit.track(rockGeo(0x8e6a58, 0x4e9a52, 1.15)), 7.15, -1.15, 1.35, 5.6, 0.3, rockMat);
  place(kit.track(rockGeo(0x7c5c4c, 0x4a8a4c, 0.9)), 4.9, -0.4, 0.55, 3.2, 1.2, rockMat);
  place(kit.track(rockGeo(0x7c5c4c, 0x4a8a4c, 1.0)), 9.4, -1.6, 0.4, 3.0, 2.4, rockMat);
  const boulderList: Inst[] = [];
  const br = rng(17);
  for (let i = 0; i < 10; i++) {
    const a = br() * PI * 2;
    const rad = 3 + br() * 1.4;
    boulderList.push({ x: 7.15 + Math.cos(a) * rad * 1.2, y: -0.45, z: -1.15 + Math.sin(a) * rad * 0.8, s: 0.6 + br() * 0.9, ry: br() * 6 });
  }
  world.add(instance(kit, rockGeo(0x6a5448, 0x7a8a60), rockMat, boulderList, { cast: true, receive: true }));
  const cragFoam = new THREE.Mesh(foamGeo, foamMat);
  cragFoam.scale.set(4.4, 1, 3.1);
  cragFoam.position.set(7.15, SEA_Y + 0.02, -1.15);
  world.add(cragFoam);

  const lighthouse = createLighthouse(kit, reduced);
  lighthouse.group.position.set(7.15, 1.4, -1.15);
  world.add(lighthouse.group);

  // Rope bridge from the island's back edge to the crag.
  const plankGeo = kit.track(new THREE.BoxGeometry(0.72, 0.04, 0.2));
  const woodMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x8a5e38, roughness: 0.9 }));
  const ropeMat = kit.track(new THREE.LineBasicMaterial({ color: 0xcaa878 }));
  const bridgeA = new THREE.Vector3(7.2, islandHeight(7.2, 3.6) + 0.22, 3.5);
  const bridgeB = new THREE.Vector3(7.15, 1.35, 0.5);
  const planks = 10;
  const ropeL: THREE.Vector3[] = [];
  const ropeR: THREE.Vector3[] = [];
  for (let i = 0; i <= planks; i++) {
    const t = i / planks;
    const p = bridgeA.clone().lerp(bridgeB, t);
    p.y -= Math.sin(t * PI) * 0.22;
    if (i < planks) {
      const plank = new THREE.Mesh(plankGeo, woodMat);
      plank.position.copy(p);
      plank.rotation.x = Math.atan2(bridgeB.y - bridgeA.y, bridgeA.z - bridgeB.z) * 0.9;
      plank.castShadow = true;
      world.add(plank);
    }
    ropeL.push(new THREE.Vector3(p.x - 0.36, p.y + 0.34, p.z));
    ropeR.push(new THREE.Vector3(p.x + 0.36, p.y + 0.34, p.z));
  }
  for (const pts of [ropeL, ropeR]) {
    const lg = kit.track(new THREE.BufferGeometry().setFromPoints(pts));
    world.add(new THREE.Line(lg, ropeMat));
  }
  const postGeo = kit.track(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5));
  for (const pts of [ropeL, ropeR]) {
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(p.x, p.y - 0.12, p.z);
      world.add(post);
    }
  }

  /* ---- trio placement (needed to keep dressing off their feet) ---- */
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
  const hit = new THREE.Vector3();
  const trioSpots = TRIO.map(([, sx, sy]) => {
    raycaster.setFromCamera(new THREE.Vector2((sx / VIEW_W) * 2 - 1, 1 - (sy / VIEW_H) * 2), camera);
    const p = raycaster.ray.intersectPlane(groundPlane, hit);
    return p ? p.clone() : new THREE.Vector3(sx, 0.08, sy);
  });
  const nearFeet = (x: number, z: number, r: number): boolean => trioSpots.some((p) => Math.hypot(p.x - x, p.z - z) < r);

  /* ---- island dressing ---- */
  const dress = (n: number, seed: number, ok: (x: number, z: number, dn: number) => boolean, make: (x: number, y: number, z: number, r: () => number) => Inst): Inst[] => {
    const r = rng(seed);
    const out: Inst[] = [];
    const count = reduced ? Math.ceil(n * 0.55) : n;
    for (let t = 0; out.length < count && t < count * 25; t++) {
      const x = IC.x + (r() * 2 - 1) * IC.a;
      const z = IC.z + (r() * 2 - 1) * IC.b;
      const dn = islandDist(x, z);
      if (dn > 0.84 || !ok(x, z, dn)) continue;
      out.push(make(x, islandHeight(x, z), z, r));
    }
    return out;
  };
  const treeM = sway(kit, propMat(kit), 0.05, 1.1);
  const backTrees = dress(15, 5, (x, z) => z < 6.1 && !nearFeet(x, z, 2.2), (x, y, z, r) => ({ x, y: y - 0.05, z, s: 0.34 + r() * 0.22, ry: r() * 6, color: r() > 0.5 ? 0xffffff : 0xe6f2c8 }));
  world.add(instance(kit, broadleafGeo(0x2f8a44, 0x58b05a), treeM, backTrees, { cast: true, receive: true }));
  world.add(instance(kit, pineGeo(0x2a7a4a, 0x3f9a58), treeM, dress(8, 6, (x, z) => z < 5.8 && x > -3, (x, y, z, r) => ({ x, y: y - 0.05, z, s: 0.2 + r() * 0.12, ry: r() * 6 })), { cast: true }));
  const tuftM = sway(kit, propMat(kit), 0.3, 1.7);
  world.add(instance(kit, tuftGeo(0x58b85a), tuftM, dress(150, 7, (x, z) => !nearFeet(x, z, 1.1), (x, y, z, r) => ({ x, y: y - 0.02, z, s: 0.5 + r() * 0.6, ry: r() * 6 })), { receive: true }));
  const flowerM = sway(kit, propMat(kit, { roughness: 0.7 }), 0.25, 2);
  const fcols = [0xffe066, 0xff8ab8, 0xffffff, 0xb090ff];
  const flowers = dress(70, 8, (x, z) => !nearFeet(x, z, 0.9), (x, y, z, r) => ({ x, y, z, s: 0.7 + r() * 0.5, ry: r() * 6, color: fcols[Math.floor(r() * fcols.length)] }));
  world.add(instance(kit, flowerGeo(), flowerM, flowers, { tint: 0.04 }));
  world.add(instance(kit, rockGeo(0xa89888, 0x5ea060), propMat(kit), dress(22, 9, (x, z, dn) => dn > 0.66 && !nearFeet(x, z, 1.3), (x, y, z, r) => ({ x, y, z, s: 0.25 + r() * 0.5, ry: r() * 6 })), { cast: true, receive: true }));
  const bushes = dress(14, 10, (x, z) => z < 6.4 && !nearFeet(x, z, 1.8), (x, y, z, r) => ({ x, y: y + 0.12, z, s: 0.3 + r() * 0.25, sy: 0.7, ry: r() * 6, color: r() > 0.5 ? 0x3f9a4c : 0x2f8a46 }));
  world.add(instance(kit, new THREE.IcosahedronGeometry(1, 1), sway(kit, kit.track(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })), 0.1, 1.2), bushes, { cast: true, tint: 0.08 }));
  // Stepping stones toward the bridge.
  const stoneMat = kit.track(new THREE.MeshStandardMaterial({ color: 0xcdbfae, roughness: 0.85 }));
  const stoneGeo = kit.track(new THREE.BoxGeometry(0.7, 0.06, 0.45));
  [[2.4, 6.4], [3.3, 6.9], [4.3, 7.35], [5.2, 6.7], [6.1, 6.0], [6.8, 5.0], [7.1, 4.2]].forEach(([x, z], i) => {
    const s = new THREE.Mesh(stoneGeo, stoneMat);
    s.position.set(x, islandHeight(x, z) + 0.05, z);
    s.rotation.y = i * 0.35;
    s.receiveShadow = true;
    world.add(s);
  });

  /* ---- distant islands and a sailboat ---- */
  const farMat = kit.track(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const farList: Inst[] = [];
  const fr = rng(41);
  for (let i = 0; i < 9; i++) {
    const far = i % 3 === 0;
    farList.push({
      x: -17 + i * 4.2 + fr() * 2,
      y: far ? -0.75 : -0.6,
      z: far ? -12.8 : -9.5 - fr() * 2,
      sx: far ? 4.5 + fr() * 2.5 : 2 + fr() * 1.5,
      sy: far ? 1.4 + fr() * 1 : 0.7 + fr() * 0.6,
      sz: 2.2,
      ry: fr() * 6,
      color: far ? 0x8c6a94 : i % 2 ? 0x5e5488 : 0x4c6e80,
    });
  }
  world.add(instance(kit, rockGeo(0xffffff, 0xffffff, 0.9), farMat, farList, { tint: 0.04 }));
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(kit.track(new THREE.BoxGeometry(0.7, 0.12, 0.2)), kit.track(new THREE.MeshBasicMaterial({ color: 0x3a2c40 })));
  const sailGeo = kit.track(new THREE.ConeGeometry(0.28, 0.8, 3));
  const sail = new THREE.Mesh(sailGeo, kit.track(new THREE.MeshBasicMaterial({ color: 0xfff0e0, side: THREE.DoubleSide })));
  sail.scale.z = 0.12;
  sail.position.set(0, 0.5, 0);
  boat.add(hull, sail);
  boat.position.set(-3, SEA_Y + 0.08, -7);
  world.add(boat);

  /* ---- drifting clouds ---- */
  const puff = kit.tex(128, 64, (c, w, h) => {
    const r = rng(23);
    for (let i = 0; i < 10; i++) {
      const x = w * (0.18 + r() * 0.64);
      const y = h * (0.4 + r() * 0.3);
      const rad = h * (0.26 + r() * 0.3);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,225,205,0.95)');
      g.addColorStop(0.6, 'rgba(255,170,150,0.5)');
      g.addColorStop(1, 'rgba(240,120,150,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
  }, false);
  const cloudSprites: Array<{ s: THREE.Sprite; x: number; sp: number }> = [];
  const cr = rng(29);
  for (let i = 0; i < (reduced ? 4 : 8); i++) {
    const mat = kit.track(new THREE.SpriteMaterial({ map: puff, transparent: true, opacity: 0.55 + cr() * 0.3, depthWrite: false, fog: false, toneMapped: false }));
    const s = new THREE.Sprite(mat);
    const sc2 = 4 + cr() * 4;
    s.scale.set(sc2 * 2, sc2, 1);
    const x = -14 + cr() * 28;
    s.position.set(x, 0.3 + cr() * 1.8, -15);
    world.add(s);
    cloudSprites.push({ s, x, sp: 0.08 + cr() * 0.12 });
  }

  /* ---- sun glitter on the water ---- */
  const glitterGeo = kit.track(new THREE.PlaneGeometry(1, 0.07));
  glitterGeo.rotateX(-PI / 2);
  const glitterMat = kit.track(new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  const glitterN = reduced ? 30 : 70;
  const glitter = new THREE.InstancedMesh(glitterGeo, glitterMat, glitterN);
  glitter.frustumCulled = false;
  world.add(glitter);
  const gr = rng(53);
  const glit = Array.from({ length: glitterN }, () => ({ z: -12.5 + gr() * 15, dx: gr() * 2 - 1, ph: gr() * 6.28, w: 0.3 + gr() * 0.9 }));
  const gm = new THREE.Matrix4();
  const gq = new THREE.Quaternion();
  const updateGlitter = (t: number): void => {
    glit.forEach((g, i) => {
      const spread = 0.35 + (g.z + 13) * 0.16;
      const on = Math.max(0, Math.sin(t * 1.7 + g.ph));
      gm.compose(new THREE.Vector3(3.2 + g.dx * spread, SEA_Y + 0.05, g.z), gq, new THREE.Vector3(g.w * on * (0.5 + (g.z + 13) * 0.06), 1, 1));
      glitter.setMatrixAt(i, gm);
    });
    glitter.instanceMatrix.needsUpdate = true;
  };
  updateGlitter(0.4);

  const kitMotes: Motes[] = [];
  if (!reduced) {
    const dot = kit.softDot();
    const fire = new Motes(kit, dot, { count: 34, center: [3, 2, 6], extent: [18, 3.5, 6], color: 0xffd9a0, size: 0.14, velocity: [0.08, 0.05, 0.02], wobble: 0.5, opacity: 0.7, seed: 61 });
    world.add(fire.points);
    kitMotes.push(fire);
  }

  /* ---- starters (unchanged staging) ---- */
  const movers: { update: (seconds: number, mood?: 'idle') => void; dispose?: () => void }[] = [];
  if (scene.scene.key !== 'Intro') {
    TRIO.forEach(([id, , , rot], i) => {
      const model = createCreatureModel(id);
      model.root.position.copy(trioSpots[i]);
      model.root.scale.setScalar(1.6);
      model.root.rotation.y = rot + 0.2;
      model.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      world.add(model.root);
      model.update(0, 'idle');
      movers.push(model);
    });
  }

  const veil = scene.add.graphics().setScrollFactor(0).setDepth(-6);
  for (let x = 0; x <= 520; x++) {
    veil.fillStyle(0x071422, 0.88 * Math.pow(1 - x / 520, 1.5));
    veil.fillRect(x, 0, 1, VIEW_H);
  }

  const seen = new Set<THREE.BufferGeometry | THREE.Material>();
  new ThreeSurface(scene, world, camera, (seconds) => {
    if (reduced) return;
    kit.wind.value = seconds;
    for (const m of movers) m.update(seconds, 'idle');
    lighthouse.update(seconds, true);
    for (const m of kitMotes) m.update(seconds);
    for (const c of cloudSprites) c.s.position.x = ((((c.x + seconds * c.sp + 17) % 34) + 34) % 34) - 17;
    ripple.offset.set(seconds * 0.01, seconds * 0.015);
    for (let i = 0; i < sp.count; i++) {
      const x = baseXZ[i * 2];
      const z = baseXZ[i * 2 + 1];
      sp.setY(i, Math.sin(x * 0.5 + seconds * 0.9) * 0.04 + Math.sin(z * 0.4 + seconds * 0.7) * 0.04);
    }
    sp.needsUpdate = true;
    seaGeo.computeVertexNormals();
    foamRings.forEach((f, i) => {
      const k = 1 + Math.sin(seconds * 0.6 + i * 1.8) * 0.012;
      f.scale.set(IC.a * (1.12 + i * 0.08) * k, 1, IC.b * (1.12 + i * 0.08) * k);
    });
    foamMat.opacity = 0.4 + Math.sin(seconds * 0.8) * 0.12;
    boat.position.x = -3 + Math.sin(seconds * 0.05) * 3;
    boat.rotation.z = Math.sin(seconds * 0.9) * 0.04;
    updateGlitter(seconds);
  }, () => {
    world.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !seen.has(mesh.geometry)) { seen.add(mesh.geometry); mesh.geometry.dispose(); }
      const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of list) if (!seen.has(m)) { seen.add(m); m.dispose(); }
    });
    kit.dispose();
    sun.shadow.dispose();
    movers.length = 0;
    kitMotes.length = 0;
    world.clear();
  });
}
