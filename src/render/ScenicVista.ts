import * as THREE from 'three';
import type Phaser from 'phaser';
import { ThreeSurface } from './three/ThreeSurface';
import { createCreatureModel } from './three/CreatureModels';

/** Ortho frustum 20 x 11.25, cam (0,7,16) lookAt (0,1.5,0). Trio feet: screen rays onto y=0.08 (960x540). */
const TRIO = [
  ['emberkit', 550, 450, 0.18],
  ['drizzlet', 720, 450, -0.12],
  ['sproutle', 860, 450, 0.08],
] as const;
const VIEW_W = 960;
const VIEW_H = 540;

export function createScenicVista(scene: Phaser.Scene): void {
  const reduced = scene.registry.get('reducedEffects') === true;
  const world = new THREE.Scene();
  world.fog = new THREE.Fog(0xd5e6f4, 24, 52);
  const camera = new THREE.OrthographicCamera(-10, 10, 5.625, -5.625, 0.1, 90);
  camera.position.set(0, 7, 16);
  camera.lookAt(0, 1.5, 0);

  const sun = new THREE.DirectionalLight(0xffe2b0, 2.35);
  sun.position.set(-7, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 48;
  world.add(sun, new THREE.DirectionalLight(0x8eb6ff, 0.5).translateX(10).translateY(6).translateZ(-6), new THREE.HemisphereLight(0xfff3d2, 0x3c7a58, 0.7));
  world.add(new THREE.AmbientLight(0xfff6ea, 0.28));

  const sky = new THREE.Mesh(new THREE.SphereGeometry(48, 14, 10), new THREE.MeshBasicMaterial({ color: 0x8ec8f2, side: THREE.BackSide }));
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  sunDisc.position.set(-5.2, 8.4, -8);
  world.add(sky, sunDisc);

  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(28, 22), std({ color: 0x1ec4c4, roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.9 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.28, 1.2);
  sea.receiveShadow = true;
  world.add(sea);

  const cliffM = std({ color: 0xc56b45, roughness: 0.92 });
  const grassM = std({ color: 0x3eae55, roughness: 0.86 });
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.6, 48), cliffM);
  cliff.scale.set(8.8, 1, 4.8);
  cliff.position.set(3, -0.8, 8);
  cliff.receiveShadow = true;
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 48), grassM);
  grass.scale.set(8.9, 1, 4.9);
  grass.position.set(3, 0.02, 8);
  grass.receiveShadow = true;
  const shore = new THREE.Mesh(new THREE.RingGeometry(1, 1.04, 48), std({ color: 0xf7fffc, transparent: true, opacity: 0.72, roughness: 0.35, side: THREE.DoubleSide }));
  shore.rotation.x = -Math.PI / 2;
  shore.scale.set(8.9, 4.9, 1);
  shore.position.set(3, 0.02, 8);
  world.add(cliff, grass, shore);

  const stone = std({ color: 0xc9bfb0, roughness: 0.8 });
  [ [2.4, 6.4], [3.3, 6.9], [4.3, 7.35], [5.2, 6.7], [6.1, 7.15] ].forEach(([x, z], i) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.45), stone);
    s.position.set(x, 0.1, z);
    s.rotation.y = i * 0.35;
    s.receiveShadow = true;
    world.add(s);
  });

  const farM = std({ color: 0x93b4c8, roughness: 1 });
  const isleM = std({ color: 0x4e9a62, roughness: 0.9 });
  const rockM = std({ color: 0x8d7a6a, roughness: 0.95 });
  const mounts: [number, number, number, number, THREE.Material][] = [
    [-6.2, -6.5, 2.4, 1.1, farM], [-3.4, -7.2, 3.1, 1.6, farM], [0.4, -8.4, 3.6, 2.2, farM],
    [3.6, -7.6, 2.8, 1.8, isleM], [6.4, -6.2, 2.2, 1.3, isleM], [-5.5, -3.2, 1.6, 0.7, isleM],
    [1.2, -3.8, 2.2, 0.9, isleM], [4.4, -3.4, 1.8, 0.75, isleM],
  ];
  const cone = new THREE.ConeGeometry(1, 1, 7);
  const ball = new THREE.SphereGeometry(1, 8, 6);
  mounts.forEach(([x, z, h, r, m], i) => {
    const mesh = new THREE.Mesh(i % 2 ? cone : ball, m);
    mesh.scale.set(r, h, r * 0.85);
    mesh.position.set(x, h * 0.35 - 0.3, z);
    mesh.castShadow = true;
    world.add(mesh);
  });

  const crag = new THREE.Mesh(ball, rockM);
  crag.scale.set(1.15, 1.6, 1.05);
  crag.position.set(7.15, 1.0, -1.15);
  crag.castShadow = true;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 10), std({ color: 0xfffaf6, roughness: 0.42 }));
  tower.position.set(7.15, 3.7, -1.15);
  tower.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 10), std({ color: 0xe08a3c, metalness: 0.55, roughness: 0.32 }));
  roof.position.set(7.15, 5.2, -1.15);
  const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xd8fff6, emissive: 0x9dfff0, emissiveIntensity: 1.4, roughness: 0.2 }));
  prism.position.set(7.15, 5.65, -1.15);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.06, 2.8, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, 1.4, 0);
  beam.position.set(7.15, 5.65, -1.15);
  beam.rotation.set(-0.7, 0.15, 0.85);
  world.add(crag, tower, roof, prism, beam);

  const trunkG = new THREE.CylinderGeometry(0.07, 0.11, 0.85, 5);
  const leafG = new THREE.SphereGeometry(0.48, 6, 5);
  const trees = [ [0.2, 5.8, 1], [1.6, 5.2, 1.25], [3.1, 6.0, 0.9], [4.6, 5.4, 1.15], [6.2, 5.9, 1.05], [8.1, 5.6, 0.95], [-0.8, 6.7, 0.55], [2.2, 6.9, 0.5], [5.4, 7.0, 0.48], [7.4, 4.7, 1.05] ];
  const trunks = new THREE.InstancedMesh(trunkG, std({ color: 0x6a4324, roughness: 0.9 }), trees.length);
  const crowns = new THREE.InstancedMesh(leafG, std({ color: 0x2f9a48, roughness: 0.72 }), trees.length);
  const crowns2 = new THREE.InstancedMesh(leafG, std({ color: 0x57c06a, roughness: 0.7 }), trees.length);
  const dummy = new THREE.Object3D();
  trees.forEach(([x, z, s], i) => {
    dummy.rotation.set(0, i, 0); dummy.scale.setScalar(s);
    dummy.position.set(x, 0.425 * s, z); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.92 * s, z); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x + 0.18 * s, 1.08 * s, z + 0.05); dummy.scale.setScalar(s * 0.72); dummy.updateMatrix(); crowns2.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = crowns.castShadow = crowns2.castShadow = true;
  world.add(trunks, crowns, crowns2);

  const tuft = new THREE.ConeGeometry(0.08, 0.28, 4);
  const grassN = 36;
  const tufts = new THREE.InstancedMesh(tuft, std({ color: 0x2f8d3e, roughness: 0.9 }), grassN);
  const blooms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 5, 4), std({ color: 0xf2d15a, roughness: 0.6 }), 18);
  const petals = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 5, 4), std({ color: 0xf08ab0, roughness: 0.55 }), 12);
  for (let i = 0; i < grassN; i++) {
    const x = -1 + (i % 9) * 1.05;
    const z = 5.3 + Math.floor(i / 9) * 0.85;
    dummy.position.set(x, 0.14, z); dummy.scale.setScalar(0.7 + (i % 4) * 0.18); dummy.rotation.set(0, i, 0); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 18; i++) {
    dummy.position.set(0.4 + (i % 6) * 1.35, 0.16, 5.6 + Math.floor(i / 6) * 0.9); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); blooms.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 12; i++) {
    dummy.position.set(1.1 + (i % 4) * 1.7, 0.15, 6.15 + Math.floor(i / 4) * 0.7); dummy.scale.setScalar(1); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
  }
  world.add(tufts, blooms, petals);

  const cloudG = new THREE.SphereGeometry(1, 7, 5);
  const cloudM = new THREE.MeshBasicMaterial({ color: 0xfffaf4 });
  const cloudP = [ [-4, 6.2, -4, 1.1], [-1.5, 6.8, -6, 1.4], [2.2, 6.4, -5, 1], [5.5, 7.1, -7, 1.3], [8, 6.3, -3.5, 0.9] ];
  const clouds = new THREE.InstancedMesh(cloudG, cloudM, cloudP.length);
  const parkClouds = () => cloudP.forEach(([x, y, z, s], i) => { dummy.position.set(x, y, z); dummy.scale.set(s * 1.6, s * 0.7, s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix); });
  parkClouds();
  world.add(clouds);

  const movers: { update: (seconds: number, mood?: 'idle') => void }[] = [];
  if (scene.scene.key !== 'Intro') {
    camera.updateMatrixWorld();
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
    const hit = new THREE.Vector3();
    for (const [id, screenX, screenY, rot] of TRIO) {
      raycaster.setFromCamera(new THREE.Vector2((screenX / VIEW_W) * 2 - 1, 1 - (screenY / VIEW_H) * 2), camera);
      const model = createCreatureModel(id);
      const placed = raycaster.ray.intersectPlane(ground, hit);
      model.root.position.copy(placed ?? hit.set(screenX, 0.08, screenY));
      model.root.scale.setScalar(1.6);
      model.root.rotation.y = rot + 0.2;
      world.add(model.root);
      model.update(0, 'idle');
      movers.push(model);
    }
  }

  const veil = scene.add.graphics().setScrollFactor(0).setDepth(-6);
  for (let x = 0; x <= 520; x++) {
    veil.fillStyle(0x071422, 0.88 * Math.pow(1 - x / 520, 1.5));
    veil.fillRect(x, 0, 1, VIEW_H);
  }

  const seen = new Set<THREE.BufferGeometry | THREE.Material>();
  new ThreeSurface(scene, world, camera, (seconds) => {
    if (reduced) return;
    for (const m of movers) m.update(seconds, 'idle');
    prism.rotation.y = seconds * 0.8;
    beam.rotation.z = 0.85 + Math.sin(seconds * 0.35) * 0.06;
    cloudP.forEach((p, i) => { dummy.position.set(p[0] + Math.sin(seconds * 0.15 + i) * 0.25, p[1], p[2]); dummy.scale.set(p[3] * 1.6, p[3] * 0.7, p[3]); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix); });
    clouds.instanceMatrix.needsUpdate = true;
  }, () => {
    world.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !seen.has(mesh.geometry)) { seen.add(mesh.geometry); mesh.geometry.dispose(); }
      const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of list) if (!seen.has(m)) { seen.add(m); m.dispose(); }
    });
    sun.shadow.dispose();
    movers.length = 0;
    world.clear();
  });
}
