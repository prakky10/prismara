/**
 * The 3D battle arena.
 *
 * Owns a real Three.js scene rendered behind the transparent Phaser battle
 * scene: a lit, dressed arena per biome plus the two combatants, driven from
 * the logical Phaser rigs' transforms. All battle rules stay in the scene.
 */

import * as THREE from 'three';
import type Phaser from 'phaser';
import { ThreeSurface } from './ThreeSurface';
import { createCreatureModel } from './CreatureModels';

type Side = 'player' | 'enemy';
type Mood = 'idle' | 'attack' | 'hurt' | 'faint' | 'celebrate';

export interface BattlePose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  visible: boolean;
  angle: number;
}

interface ModelHandle {
  root: THREE.Group;
  update(seconds: number, mood?: Mood): void;
  dispose(): void;
}

interface ModelSlot {
  handle: ModelHandle;
  id: string;
  shiny: boolean;
  materials: THREE.Material[];
  baseOpacity: number[];
}

interface BiomeLook {
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  ground: number;
  groundEdge: number;
  water: number | null;
  foliage: number;
  rock: number;
  distant: number;
  mountain: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
}

const LOOKS: Record<string, BiomeLook> = {
  meadow: { sky: 0x8fc7ff, fog: 0xbfe0ff, fogNear: 20, fogFar: 48, ground: 0x3f8f4a, groundEdge: 0x6fbf6a, water: null, foliage: 0x2f7d3a, rock: 0x8d8f96, distant: 0x2b6336, mountain: 0x7d8aa3, hemiSky: 0xfff0c0, hemiGround: 0x2e4a2e, sun: 0xffe6b0 },
  forest: { sky: 0x6ea8d8, fog: 0x9fc2d8, fogNear: 16, fogFar: 42, ground: 0x2f6b38, groundEdge: 0x4f9247, water: null, foliage: 0x1f5a2b, rock: 0x7a7d84, distant: 0x1d4a26, mountain: 0x6b7890, hemiSky: 0xdff0c8, hemiGround: 0x223a24, sun: 0xffe0a0 },
  city: { sky: 0xa9b6c9, fog: 0xc6cfda, fogNear: 22, fogFar: 52, ground: 0x6b7079, groundEdge: 0x8a9099, water: null, foliage: 0x4a7a4a, rock: 0x8a8f96, distant: 0x5c6470, mountain: 0x8a93a3, hemiSky: 0xf0f2f6, hemiGround: 0x3a3f46, sun: 0xfff4dc },
  beach: { sky: 0x9fd8ff, fog: 0xd6ecff, fogNear: 20, fogFar: 54, ground: 0xe0c98a, groundEdge: 0xf0dca0, water: 0x2f8fd0, foliage: 0x3f8a55, rock: 0xb9a887, distant: 0x2f6f7a, mountain: 0x8fa6b8, hemiSky: 0xfff6d8, hemiGround: 0x6b5a3a, sun: 0xfff0c8 },
  volcano: { sky: 0x5a2a26, fog: 0x7a3a2a, fogNear: 12, fogFar: 38, ground: 0x3a2a24, groundEdge: 0x6a3a28, water: 0xff5a1e, foliage: 0x4a2a1e, rock: 0x2e2622, distant: 0x3a1f18, mountain: 0x4a2a26, hemiSky: 0xff8a40, hemiGround: 0x1a0f0c, sun: 0xff7a30 },
  ruins: { sky: 0x8a97ad, fog: 0xb0b9c6, fogNear: 16, fogFar: 46, ground: 0x5a6a56, groundEdge: 0x7a8a72, water: null, foliage: 0x3f6a44, rock: 0x8a8f8a, distant: 0x4a5a4a, mountain: 0x7a8698, hemiSky: 0xe6e8ee, hemiGround: 0x30382e, sun: 0xf6f0e0 },
  cave: { sky: 0x0e1424, fog: 0x16203a, fogNear: 10, fogFar: 34, ground: 0x2a3040, groundEdge: 0x3f4a60, water: 0x1f5f8f, foliage: 0x2a3a5a, rock: 0x3a4256, distant: 0x1a2236, mountain: 0x2a3346, hemiSky: 0x6f8fc0, hemiGround: 0x10141f, sun: 0x9fc0ff },
  crystal: { sky: 0x2a1f4a, fog: 0x3a2f66, fogNear: 12, fogFar: 40, ground: 0x3a3560, groundEdge: 0x5f55a0, water: 0x40d0ff, foliage: 0x5a4fb0, rock: 0x4a4478, distant: 0x2f2a55, mountain: 0x4a4570, hemiSky: 0xcfc0ff, hemiGround: 0x1a1630, sun: 0xc0b0ff },
  summit: { sky: 0xbcd8ff, fog: 0xdceaff, fogNear: 22, fogFar: 58, ground: 0xdfe9f5, groundEdge: 0xffffff, water: null, foliage: 0x8aa0b8, rock: 0x9fb0c4, distant: 0x7f93aa, mountain: 0xa8bcd4, hemiSky: 0xffffff, hemiGround: 0x8090a0, sun: 0xfff8e8 },
};

function hashUnit(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export class Battle3D {
  private readonly world: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly surface: ThreeSurface;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();
  private readonly disposables: Array<{ dispose(): void }> = [];
  private player: ModelSlot | null = null;
  private enemy: ModelSlot | null = null;
  private cleaned = false;

  constructor(owner: Phaser.Scene, biome: string) {
    const look = LOOKS[biome] ?? LOOKS.meadow;

    this.world = new THREE.Scene();
    this.world.background = new THREE.Color(look.sky);
    this.world.fog = new THREE.Fog(look.fog, look.fogNear, look.fogFar);

    this.camera = new THREE.PerspectiveCamera(42, 960 / 540, 0.1, 200);
    this.camera.position.set(0, 6, 16);
    this.camera.lookAt(0, 1, 0);
    this.camera.updateMatrixWorld();

    this.buildGround(look);
    this.buildFoliage(look, biome);
    this.buildRocks(look);
    this.buildDistant(look);
    this.buildMountains(look);
    this.buildLights(look);

    this.surface = new ThreeSurface(
      owner,
      this.world,
      this.camera,
      (seconds) => this.animate(seconds),
      () => this.cleanup(),
    );
  }

  sync(side: Side, id: string, shiny: boolean, pose: BattlePose): void {
    if (this.cleaned) return;

    const current = side === 'player' ? this.player : this.enemy;
    if (!current || current.id !== id || current.shiny !== shiny) {
      this.rebuild(side, id, shiny);
    }
    const slot = side === 'player' ? this.player : this.enemy;
    if (!slot) return;

    const root = slot.handle.root;

    this.pointer.set((pose.x / 960) * 2 - 1, 1 - (pose.y / 540) * 2);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = this.raycaster.ray.intersectPlane(this.groundPlane, this.hit);
    if (point) root.position.set(point.x, 0, point.z);

    const reference = side === 'player' ? 1.5 : 1.3;
    const base = side === 'player' ? 1.7 : 1.6;
    root.scale.setScalar((Math.abs(pose.scaleY) / reference) * base);

    root.rotation.y = side === 'player' ? 0.9 : -0.9;
    root.rotation.z = (pose.angle * Math.PI) / 180;

    const alpha = THREE.MathUtils.clamp(pose.alpha, 0, 1);
    root.visible = pose.visible && alpha > 0.01;

    for (let i = 0; i < slot.materials.length; i++) {
      const material = slot.materials[i];
      material.opacity = slot.baseOpacity[i] * alpha;
      if (alpha < 1) material.transparent = true;
    }
  }

  dispose(): void {
    this.cleanup();
    this.surface.dispose();
  }

  private animate(seconds: number): void {
    if (this.player) this.player.handle.update(seconds, 'idle');
    if (this.enemy) this.enemy.handle.update(seconds, 'idle');
  }

  private rebuild(side: Side, id: string, shiny: boolean): void {
    const existing = side === 'player' ? this.player : this.enemy;
    if (existing) {
      this.world.remove(existing.handle.root);
      existing.handle.dispose();
    }
    const slot = this.makeSlot(id, shiny);
    if (side === 'player') this.player = slot;
    else this.enemy = slot;
  }

  private makeSlot(id: string, shiny: boolean): ModelSlot {
    const handle = createCreatureModel(id, shiny);
    const materials: THREE.Material[] = [];
    handle.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const entry of material) materials.push(entry);
      } else if (material) {
        materials.push(material);
      }
    });
    const baseOpacity = materials.map((material) => material.opacity);
    this.world.add(handle.root);
    return { handle, id, shiny, materials, baseOpacity };
  }

  private buildGround(look: BiomeLook): void {
    const groundGeo = new THREE.CircleGeometry(look.water !== null ? 9.4 : 16, 56);
    const groundMat = new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.world.add(ground);
    this.disposables.push(groundGeo, groundMat);

    const ringGeo = new THREE.RingGeometry(8.2, 9, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: look.groundEdge, roughness: 1, metalness: 0 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.receiveShadow = true;
    this.world.add(ring);
    this.disposables.push(ringGeo, ringMat);

    if (look.water !== null) {
      const waterGeo = new THREE.RingGeometry(9.4, 16, 64);
      const waterMat = new THREE.MeshStandardMaterial({ color: look.water, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.06;
      this.world.add(water);
      this.disposables.push(waterGeo, waterMat);
    }
  }

  private buildFoliage(look: BiomeLook, biome: string): void {
    // Volcano and cave keep rocky spires instead of lush leaf canopies.
    const rocky = biome === 'volcano' || biome === 'cave';
    const matrix = new THREE.Matrix4();

    // Near foliage: real trunks plus rounded canopies (crystal cones when rocky).
    const treeCount = 40;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: rocky ? look.rock : 0x6b4a2a, roughness: 1, metalness: 0 });
    const canopyGeo = rocky
      ? new THREE.ConeGeometry(0.85, 1.9, 5)
      : new THREE.IcosahedronGeometry(0.9, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: rocky ? look.rock : look.foliage, roughness: 1, metalness: 0 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    for (const tree of [trunks, canopies]) {
      tree.castShadow = true;
      tree.receiveShadow = true;
      tree.frustumCulled = false;
    }
    for (let i = 0; i < treeCount; i++) {
      const angle = Math.PI + (i / treeCount) * Math.PI + hashUnit(i + 1) * 0.08;
      const radius = 10.2 + hashUnit(i + 11) * 3.8;
      const scale = 0.7 + hashUnit(i + 21) * 0.7;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const trunkH = 1.5 * scale;
      matrix.makeScale(scale, trunkH, scale);
      matrix.setPosition(x, trunkH / 2, z);
      trunks.setMatrixAt(i, matrix);
      const canopyScale = scale * (rocky ? 0.9 : 1.15);
      matrix.makeScale(canopyScale, canopyScale * (rocky ? 1.35 : 1), canopyScale);
      matrix.setPosition(x, trunkH + canopyScale * (rocky ? 0.4 : 0.55), z);
      canopies.setMatrixAt(i, matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.world.add(trunks, canopies);
    this.disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);

    // Grass clumps ring the arena edge (radius 7.5..10), leaving the center and
    // the fighters at x\u00b15, z\u00b14 clear for legibility.
    const grassCount = 120;
    const grassGeo = new THREE.ConeGeometry(0.28, 0.6, 4);
    const grassMat = new THREE.MeshStandardMaterial({ color: look.foliage, roughness: 1, metalness: 0 });
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    grass.castShadow = true;
    grass.frustumCulled = false;
    for (let i = 0; i < grassCount; i++) {
      const angle = hashUnit(i + 401) * Math.PI * 2;
      const radius = 7.5 + hashUnit(i + 411) * 2.5;
      const scale = 0.6 + hashUnit(i + 421) * 0.9;
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(Math.cos(angle) * radius, scale * 0.3, Math.sin(angle) * radius);
      grass.setMatrixAt(i, matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    this.world.add(grass);
    this.disposables.push(grassGeo, grassMat);

    // Wildflowers only where the biome is lush, not on lava or cave floor.
    if (!rocky) {
      const flowerCount = 30;
      const flowerGeo = new THREE.IcosahedronGeometry(0.16, 0);
      const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffd47a, roughness: 1, metalness: 0 });
      const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
      flowers.frustumCulled = false;
      for (let i = 0; i < flowerCount; i++) {
        const angle = hashUnit(i + 501) * Math.PI * 2;
        const radius = 7.5 + hashUnit(i + 511) * 2.5;
        const scale = 0.7 + hashUnit(i + 521) * 0.6;
        matrix.makeScale(scale, scale, scale);
        matrix.setPosition(Math.cos(angle) * radius, 0.28, Math.sin(angle) * radius);
        flowers.setMatrixAt(i, matrix);
      }
      flowers.instanceMatrix.needsUpdate = true;
      this.world.add(flowers);
      this.disposables.push(flowerGeo, flowerMat);
    }
  }

  private buildRocks(look: BiomeLook): void {
    const count = 26;
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: look.rock, roughness: 1, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + hashUnit(i + 101) * 0.3;
      const radius = 9.2 + hashUnit(i + 111) * 4.6;
      const scale = 0.4 + hashUnit(i + 121) * 0.8;
      matrix.makeScale(scale, scale * 0.8, scale);
      matrix.setPosition(Math.cos(angle) * radius, scale * 0.35, Math.sin(angle) * radius);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.world.add(mesh);
    this.disposables.push(geo, mat);
  }

  private buildDistant(look: BiomeLook): void {
    const count = 72;
    const geo = new THREE.ConeGeometry(0.9, 3.2, 5);
    const mat = new THREE.MeshStandardMaterial({ color: look.distant, roughness: 1, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (i / count) * Math.PI + hashUnit(i + 201) * 0.08;
      const radius = 15.5 + hashUnit(i + 211) * 3.2;
      const scale = 0.8 + hashUnit(i + 221) * 0.8;
      matrix.makeScale(scale, scale * (0.9 + hashUnit(i + 231) * 0.6), scale);
      matrix.setPosition(Math.cos(angle) * radius, scale * 1.6, Math.sin(angle) * radius);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.world.add(mesh);
    this.disposables.push(geo, mat);
  }

  private buildMountains(look: BiomeLook): void {
    const count = 12;
    const geo = new THREE.ConeGeometry(2.6, 6.5, 6);
    const mat = new THREE.MeshStandardMaterial({ color: look.mountain, roughness: 1, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (i / count) * Math.PI + hashUnit(i + 331) * 0.08;
      const radius = 23 + hashUnit(i + 301) * 7;
      const scale = 0.9 + hashUnit(i + 311) * 0.9;
      matrix.makeScale(scale, scale * (1 + hashUnit(i + 321) * 0.7), scale);
      matrix.setPosition(Math.cos(angle) * radius, scale * 3.2, Math.sin(angle) * radius);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.world.add(mesh);
    this.disposables.push(geo, mat);
  }

  private buildLights(look: BiomeLook): void {
    const hemi = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, 0.85);
    this.world.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.22);
    this.world.add(ambient);

    const sun = new THREE.DirectionalLight(look.sun, 2.4);
    sun.position.set(-6, 13, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006;
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -13;
    shadowCamera.right = 13;
    shadowCamera.top = 13;
    shadowCamera.bottom = -13;
    shadowCamera.near = 1;
    shadowCamera.far = 42;
    shadowCamera.updateProjectionMatrix();
    sun.target.position.set(0, 0, 0);
    this.world.add(sun);
    this.world.add(sun.target);
    this.disposables.push(sun.shadow);
  }

  private cleanup(): void {
    if (this.cleaned) return;
    this.cleaned = true;

    for (const slot of [this.player, this.enemy]) {
      if (!slot) continue;
      this.world.remove(slot.handle.root);
      slot.handle.dispose();
    }
    this.player = null;
    this.enemy = null;

    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
    this.world.clear();
  }
}
