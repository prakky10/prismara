import * as THREE from 'three';
import type { Biome } from '../tiles/TilePainter';
import type { MapDef } from '../../world/maps';
import { createWorldTerrain, type TerrainBuilding } from './WorldTerrain';
import { animateRig, buildActor, disposeRig, type Rig } from './world/Actors';

export interface WorldActor {
  id: string;
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
  hidden?: boolean;
  style: { shirt: number; hair: number; skin: number };
  kind?: string;
}

const FACING: Record<WorldActor['facing'], number> = {
  down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2,
};

interface Mood {
  sky: number;
  fogNear: number;
  fogFar: number;
  sun: number;
  sunI: number;
  fill: number;
  fillI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  ambient: number;
  torch: boolean;
}

const DAY: Mood = {
  sky: 0xbfe0f5, fogNear: 17, fogFar: 40, sun: 0xffe2b4, sunI: 2.3,
  fill: 0x9bb8ff, fillI: 0.4, hemiSky: 0xd6ebff, hemiGround: 0x6f8452, hemiI: 0.62, ambient: 0.12, torch: false,
};

function moodFor(biome: Biome, indoor: boolean): Mood {
  if (indoor) {
    return { ...DAY, sky: 0x1c1820, fogNear: 22, fogFar: 46, sun: 0xffd9a0, sunI: 1.15, fill: 0xffc99a, fillI: 0.25, hemiSky: 0xfff0d8, hemiGround: 0x8a6a4a, hemiI: 0.8, ambient: 0.22 };
  }
  switch (biome) {
    case 'cave': return { ...DAY, sky: 0x121118, fogNear: 12, fogFar: 30, sun: 0xb8c4ff, sunI: 0.5, fill: 0x7a6cff, fillI: 0.25, hemiSky: 0x9aa0d8, hemiGround: 0x2a2630, hemiI: 0.55, ambient: 0.14, torch: true };
    case 'ruins': return { ...DAY, sky: 0x24212a, fogNear: 13, fogFar: 34, sun: 0xffd9a8, sunI: 0.9, fill: 0x8f8cd8, fillI: 0.3, hemiSky: 0xc4c0d8, hemiGround: 0x4a4638, hemiI: 0.55, ambient: 0.14, torch: true };
    case 'volcano': return { ...DAY, sky: 0x4a2a24, fogNear: 15, fogFar: 36, sun: 0xffb27a, sunI: 1.9, fill: 0xff6a3a, fillI: 0.45, hemiSky: 0xffc9a0, hemiGround: 0x6a3a28, hemiI: 0.55 };
    case 'summit': return { ...DAY, sky: 0xdce8f6, sun: 0xfff0dc, sunI: 2.2, fill: 0xa8c4ff, fillI: 0.5, hemiSky: 0xe8f2ff, hemiGround: 0x9aa8bc, hemiI: 0.7 };
    case 'forest': return { ...DAY, sky: 0xa9d2c0, sun: 0xfff0b8, sunI: 2.0, hemiGround: 0x4e7a40 };
    case 'beach': return { ...DAY, sky: 0xb8e6f8, sun: 0xfff0c8, sunI: 2.4 };
    default: return DAY;
  }
}

export class World3D {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private readonly reduced: boolean;
  private readonly actors = new Map<string, Rig>();
  private readonly terrain: ReturnType<typeof createWorldTerrain>;
  private readonly sun: THREE.DirectionalLight;
  private readonly fill: THREE.DirectionalLight;
  private readonly torch?: THREE.PointLight;
  private readonly aim = new THREE.Vector3();
  private readonly buildings: TerrainBuilding[];
  private readonly occMeshes: THREE.Mesh[] = [];
  private readonly occOwner = new Map<THREE.Object3D, TerrainBuilding>();
  private readonly occRay = new THREE.Raycaster();
  private readonly occTo = new THREE.Vector3();
  private readonly occDir = new THREE.Vector3();
  private lastSeconds = 0;
  private snapped = false;
  private disposed = false;

  constructor(map: MapDef, reducedEffects: boolean) {
    this.reduced = reducedEffects;
    const halfH = 4.9;
    const halfW = halfH * (16 / 9);
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 150);
    const mood = moodFor(map.biome, map.indoor === true);
    this.scene.background = new THREE.Color(mood.sky);
    this.scene.fog = new THREE.Fog(mood.sky, mood.fogNear, mood.fogFar);
    this.scene.add(new THREE.AmbientLight(0xfff4e4, mood.ambient));
    this.scene.add(new THREE.HemisphereLight(mood.hemiSky, mood.hemiGround, mood.hemiI));
    // Warm key light with soft shadows, cool fill from the opposite side without shadows.
    this.sun = new THREE.DirectionalLight(mood.sun, mood.sunI);
    this.sun.castShadow = true;
    const mapSize = reducedEffects ? 1024 : 2048;
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.5;
    const shadow = this.sun.shadow.camera as THREE.OrthographicCamera;
    shadow.left = -17;
    shadow.right = 17;
    shadow.top = 17;
    shadow.bottom = -17;
    shadow.near = 0.5;
    shadow.far = 60;
    shadow.updateProjectionMatrix();
    this.fill = new THREE.DirectionalLight(mood.fill, mood.fillI);
    this.scene.add(this.sun, this.sun.target, this.fill, this.fill.target);
    if (mood.torch) {
      this.torch = new THREE.PointLight(0xffc27a, 7, 11, 1.6);
      this.scene.add(this.torch);
    }
    this.terrain = createWorldTerrain(map, reducedEffects);
    this.scene.add(this.terrain.root);
    this.buildings = this.terrain.buildings;
    for (const b of this.buildings) {
      for (const mesh of b.meshes) {
        this.occMeshes.push(mesh);
        this.occOwner.set(mesh, b);
      }
    }
  }

  sync(player: WorldActor, npcs: WorldActor[], seconds: number): void {
    const dt = Math.min(0.1, Math.max(0, seconds - this.lastSeconds));
    this.lastSeconds = seconds;
    const alive = new Set<string>();
    for (const actor of [player, ...npcs]) {
      alive.add(actor.id);
      let rig = this.actors.get(actor.id);
      const wx = actor.x + 0.5;
      const wz = actor.y + 0.5;
      let moving = false;
      if (!rig) {
        rig = buildActor(actor);
        this.actors.set(actor.id, rig);
        this.scene.add(rig.root);
      } else {
        const dx = wx - rig.root.position.x;
        const dz = wz - rig.root.position.z;
        moving = dx * dx + dz * dz > 1e-8;
      }
      rig.root.position.set(wx, 0, wz);
      rig.root.visible = actor.hidden !== true;
      const target = FACING[actor.facing];
      if (!rig.initialised) {
        rig.root.rotation.y = target;
        rig.initialised = true;
      } else {
        let diff = target - rig.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        rig.root.rotation.y += diff * Math.min(1, dt * 18 + 0.05);
      }
      animateRig(rig, moving, dt, seconds, this.reduced);
    }
    for (const [id, rig] of this.actors) {
      if (!alive.has(id)) {
        disposeRig(rig);
        this.actors.delete(id);
      }
    }
    const tx = player.x + 0.5;
    const tz = player.y + 0.5;
    // Lower three-quarter view: building fronts and faces are readable, map north stays screen-up.
    this.aim.set(tx, 9.4, tz + 10.8);
    if (!this.snapped) {
      this.camera.position.copy(this.aim);
      this.snapped = true;
    } else this.camera.position.lerp(this.aim, 0.12);
    this.camera.lookAt(this.camera.position.x, 0.5, this.camera.position.z - 10.8);
    this.terrain.root.updateMatrixWorld(true);
    this.updateOcclusion(tx, tz);
    this.terrain.update(seconds);
    const sx = Math.round(tx * 2) / 2;
    const sz = Math.round(tz * 2) / 2;
    this.sun.position.set(sx - 7, 15, sz + 9);
    this.sun.target.position.set(sx, 0, sz);
    this.fill.position.set(sx + 9, 8, sz - 8);
    this.fill.target.position.set(sx, 0, sz);
    this.torch?.position.set(tx, 2.2, tz + 0.4);
  }

  /** Fade whole buildings (roof most, walls partly) that stand between the camera and the player. */
  private updateOcclusion(tx: number, tz: number): void {
    if (this.buildings.length === 0) return;
    const blocked = new Set<TerrainBuilding>();
    for (const py of [0.25, 0.7, 1.15]) {
      this.occTo.set(tx, py, tz);
      this.occDir.subVectors(this.occTo, this.camera.position);
      const dist = this.occDir.length();
      if (dist <= 0.15) continue;
      this.occRay.set(this.camera.position, this.occDir.multiplyScalar(1 / dist));
      this.occRay.near = 0;
      this.occRay.far = dist - 0.1;
      for (const hit of this.occRay.intersectObjects(this.occMeshes, false)) {
        const owner = this.occOwner.get(hit.object);
        if (owner) blocked.add(owner);
      }
    }
    for (const b of this.buildings) {
      const goal = blocked.has(b) ? 1 : 0;
      b.fade += (goal - b.fade) * (goal ? 0.3 : 0.14);
      if (Math.abs(goal - b.fade) < 0.01) b.fade = goal;
      for (const part of b.parts) {
        const opacity = 1 - b.fade * (1 - part.min);
        const m = part.material;
        m.opacity = opacity;
        const clear = opacity >= 0.999;
        m.transparent = !clear;
        m.depthWrite = clear;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const rig of this.actors.values()) disposeRig(rig);
    this.actors.clear();
    this.terrain.dispose();
    this.sun.shadow.dispose();
    this.fill.dispose();
    this.scene.clear();
  }
}
