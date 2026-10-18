import * as THREE from 'three';
import type { MapDef } from '../../world/maps';
import { createWorldTerrain } from './WorldTerrain';

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

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
}

function drop(rig: Rig): void {
  rig.root.removeFromParent();
  for (const g of rig.geos) g.dispose();
  for (const m of rig.mats) m.dispose();
}

function buildActor(actor: WorldActor): Rig {
  const root = new THREE.Group();
  root.name = actor.id;
  const body = new THREE.Group();
  root.add(body);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const put = (
    geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D,
    x: number, y: number, z: number, rough = 0.74,
  ) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    mats.push(material);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return material;
  };
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  if (actor.kind === 'sign') {
    put(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 8), 0x6b452c, body, 0, 0.36, 0);
    put(new THREE.BoxGeometry(0.5, 0.3, 0.06), 0xf0ddb0, body, 0, 0.82, 0.02, 0.62);
    put(new THREE.BoxGeometry(0.36, 0.05, 0.02), 0x5a3e2b, body, 0, 0.9, 0.06);
    put(new THREE.BoxGeometry(0.36, 0.05, 0.02), 0x5a3e2b, body, 0, 0.74, 0.06);
  } else {
    const { skin, shirt, hair } = actor.style;
    legL.position.set(-0.09, 0.5, 0);
    legR.position.set(0.09, 0.5, 0);
    armL.position.set(-0.25, 0.9, 0);
    armR.position.set(0.25, 0.9, 0);
    body.add(legL, legR, armL, armR);
    put(new THREE.CapsuleGeometry(0.055, 0.24, 4, 8), skin, legL, 0, -0.2, 0);
    put(new THREE.CapsuleGeometry(0.055, 0.24, 4, 8), skin, legR, 0, -0.2, 0);
    put(new THREE.BoxGeometry(0.12, 0.08, 0.18), 0x2a241f, legL, 0, -0.4, 0.03);
    put(new THREE.BoxGeometry(0.12, 0.08, 0.18), 0x2a241f, legR, 0, -0.4, 0.03);
    put(new THREE.CapsuleGeometry(0.15, 0.26, 4, 8), shirt, body, 0, 0.7, 0, 0.68);
    put(new THREE.BoxGeometry(0.22, 0.045, 0.16), 0x2c2c2c, body, 0, 0.5, 0);
    put(new THREE.CapsuleGeometry(0.042, 0.18, 3, 6), shirt, armL, 0, -0.13, 0);
    put(new THREE.CapsuleGeometry(0.042, 0.18, 3, 6), shirt, armR, 0, -0.13, 0);
    put(new THREE.SphereGeometry(0.04, 8, 6), skin, armL, 0, -0.26, 0);
    put(new THREE.SphereGeometry(0.04, 8, 6), skin, armR, 0, -0.26, 0);
    put(new THREE.SphereGeometry(0.18, 12, 10), skin, body, 0, 1.1, 0.02);
    put(new THREE.SphereGeometry(0.182, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, body, 0, 1.13, 0);
    put(new THREE.SphereGeometry(0.025, 6, 5), 0x161616, body, -0.06, 1.11, 0.18);
    put(new THREE.SphereGeometry(0.025, 6, 5), 0x161616, body, 0.06, 1.11, 0.18);
    put(new THREE.SphereGeometry(0.02, 6, 5), skin, body, 0, 1.06, 0.205).color.multiplyScalar(0.82);
    put(new THREE.BoxGeometry(0.16, 0.2, 0.08), 0x4e382c, body, 0, 0.72, -0.16, 0.8);
    const hat = actor.kind === 'heal' ? 0xff4f73 : actor.kind === 'shop' ? 0x2f9e66 : actor.kind === 'trial' ? 0xe6b325 : 0;
    if (hat) {
      put(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10), hat, body, 0, 1.22, 0, 0.55);
      put(new THREE.SphereGeometry(0.07, 8, 6), hat, body, 0, 1.27, 0, 0.55);
    }
  }
  return { root, body, legL, legR, armL, armR, geos, mats };
}

export class World3D {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private readonly reduced: boolean;
  private readonly actors = new Map<string, Rig>();
  private readonly terrain: { root: THREE.Group; dispose(): void };
  private readonly sun: THREE.DirectionalLight;
  private readonly aim = new THREE.Vector3();
  private readonly occMeshes: THREE.Mesh[] = [];
  private readonly occMats: THREE.MeshStandardMaterial[] = [];
  private readonly occRay = new THREE.Raycaster();
  private readonly occTo = new THREE.Vector3();
  private readonly occDir = new THREE.Vector3();
  private snapped = false;
  private disposed = false;

  constructor(map: MapDef, reducedEffects: boolean) {
    this.reduced = reducedEffects;
    const halfH = 5.2;
    const halfW = halfH * (16 / 9);
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 150);
    this.scene.background = new THREE.Color(0xc5e4f8);
    this.scene.fog = new THREE.Fog(0xc5e4f8, 30, 70);
    this.scene.add(new THREE.AmbientLight(0xfff4e4, 0.38));
    this.scene.add(new THREE.HemisphereLight(0xfff0d2, 0x7d8f62, 0.62));
    this.sun = new THREE.DirectionalLight(0xffe6c2, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const shadow = this.sun.shadow.camera as THREE.OrthographicCamera;
    shadow.left = -14;
    shadow.right = 14;
    shadow.top = 14;
    shadow.bottom = -14;
    shadow.near = 0.5;
    shadow.far = 48;
    shadow.updateProjectionMatrix();
    this.scene.add(this.sun, this.sun.target);
    this.terrain = createWorldTerrain(map);
    this.scene.add(this.terrain.root);
    for (const child of this.terrain.root.children) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || child.position.y < 0) continue;
      const mat = (child.material as THREE.MeshStandardMaterial).clone();
      child.material = mat;
      this.occMeshes.push(child);
      this.occMats.push(mat);
    }
  }

  sync(player: WorldActor, npcs: WorldActor[], seconds: number): void {
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
      rig.root.rotation.y = FACING[actor.facing];
      const swing = moving ? Math.sin(seconds * 8) : 0;
      rig.legL.rotation.x = swing * 0.7;
      rig.legR.rotation.x = -swing * 0.7;
      rig.armL.rotation.x = -swing * 0.5;
      rig.armR.rotation.x = swing * 0.5;
      rig.body.position.y = !this.reduced && moving ? Math.abs(swing) * 0.035 : 0;
    }
    for (const [id, rig] of this.actors) {
      if (!alive.has(id)) {
        drop(rig);
        this.actors.delete(id);
      }
    }
    const tx = player.x + 0.5;
    const tz = player.y + 0.5;
    this.aim.set(tx, 9, tz + 14);
    if (!this.snapped) {
      this.camera.position.copy(this.aim);
      this.snapped = true;
    } else this.camera.position.lerp(this.aim, 0.12);
    this.camera.lookAt(tx, 0, tz);
    this.terrain.root.updateMatrixWorld(true);
    for (const mat of this.occMats) {
      mat.opacity = 1;
      mat.transparent = false;
      mat.depthWrite = true;
    }
    for (const py of [0.25, 1.15]) {
      this.occTo.set(tx, py, tz);
      this.occDir.subVectors(this.occTo, this.camera.position);
      const dist = this.occDir.length();
      if (dist <= 0.15) continue;
      this.occRay.set(this.camera.position, this.occDir.multiplyScalar(1 / dist));
      this.occRay.near = 0;
      this.occRay.far = dist - 0.15;
      for (const hit of this.occRay.intersectObjects(this.occMeshes, false)) {
        const mat = (hit.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = 0.22;
        mat.transparent = true;
        mat.depthWrite = false;
      }
    }
    this.sun.position.set(tx - 8, 16, tz + 8);
    this.sun.target.position.set(tx, 0, tz);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const rig of this.actors.values()) drop(rig);
    this.actors.clear();
    for (const mat of this.occMats) mat.dispose();
    this.terrain.dispose();
    this.sun.shadow.dispose();
    this.scene.clear();
  }
}
