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
import { Kit } from './arena/kit';
import { buildArena, type ArenaBuild } from './arena/biomes';

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

export class Battle3D {
  private readonly world: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  /** Fixed twin of the camera: creature placement never follows the idle drift. */
  private readonly rayCamera: THREE.PerspectiveCamera;
  private readonly kit = new Kit();
  private readonly arena: ArenaBuild;
  private readonly reduced: boolean;
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

    this.reduced = owner.registry.get('reducedEffects') === true;
    this.world = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, 960 / 540, 0.1, 200);
    this.camera.position.set(0, 6, 16);
    this.camera.lookAt(0, 1, 0);
    this.camera.updateMatrixWorld();
    this.rayCamera = this.camera.clone();
    this.rayCamera.updateMatrixWorld();

    // Worn battle pads sit exactly under the two creature stage points.
    const pad = (px: number, py: number, r: number) => {
      this.pointer.set((px / 960) * 2 - 1, 1 - (py / 540) * 2);
      this.raycaster.setFromCamera(this.pointer, this.rayCamera);
      const p = this.raycaster.ray.intersectPlane(this.groundPlane, this.hit);
      return { x: p ? p.x : 0, z: p ? p.z : 0, r };
    };
    this.arena = buildArena(biome, this.world, this.kit, [pad(200, 400, 2.5), pad(720, 250, 2.1)], this.reduced);
    this.world.background = new THREE.Color(this.arena.fog.color);
    this.world.fog = new THREE.Fog(this.arena.fog.color, this.arena.fog.near, this.arena.fog.far);
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
    this.raycaster.setFromCamera(this.pointer, this.rayCamera);
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
    if (!this.reduced) {
      this.arena.tick(seconds);
      // Subtle idle drift; the look-at target stays fixed so the stage reads the same.
      this.camera.position.set(Math.sin(seconds * 0.13) * 0.22, 6 + Math.sin(seconds * 0.17) * 0.07, 16 + Math.sin(seconds * 0.09) * 0.12);
      this.camera.lookAt(0, 1, 0);
    }
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
    this.kit.dispose();
    this.world.clear();
  }
}
