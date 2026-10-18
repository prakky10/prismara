import * as THREE from 'three';
import { hash2 } from './Noise';

export interface ActorSpec {
  id: string;
  facing: 'up' | 'down' | 'left' | 'right';
  style: { shirt: number; hair: number; skin: number };
  kind?: string;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  torso: THREE.Group;
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
  walk: number;
  phase: number;
  seed: number;
  initialised: boolean;
}

export function disposeRig(rig: Rig): void {
  rig.root.removeFromParent();
  for (const g of rig.geos) g.dispose();
  for (const m of rig.mats) m.dispose();
}

/** Draw order: actors after the rest of the opaque world, silhouettes after the actors. */
const ACTOR_ORDER = 2;
const SILHOUETTE_ORDER = 3;

/**
 * Give every body part a ghost twin that only draws where something else hides it, so a
 * character standing behind a house or a tree still reads as a soft silhouette.
 *
 * The body writes 1 into the stencil wherever it is actually visible; the ghost passes the
 * depth test only when hidden (GreaterDepth) and skips stencilled pixels, so a character's own
 * limbs never ghost through its torso.
 */
function addSilhouette(body: THREE.Group, color: number, mats: THREE.Material[]): void {
  const ghost = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.KeepStencilOp,
  });
  mats.push(ghost);
  const parts: THREE.Mesh[] = [];
  body.traverse((obj) => {
    if (obj instanceof THREE.Mesh) parts.push(obj);
  });
  for (const part of parts) {
    const mat = part.material as THREE.Material;
    mat.stencilWrite = true;
    mat.stencilRef = 1;
    mat.stencilFunc = THREE.AlwaysStencilFunc;
    mat.stencilZPass = THREE.ReplaceStencilOp;
    part.renderOrder = ACTOR_ORDER;
    const twin = new THREE.Mesh(part.geometry, ghost);
    twin.position.copy(part.position);
    twin.quaternion.copy(part.quaternion);
    twin.scale.copy(part.scale);
    twin.renderOrder = SILHOUETTE_ORDER;
    part.parent?.add(twin);
  }
}

function idSeed(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

export function buildActor(actor: ActorSpec): Rig {
  const root = new THREE.Group();
  root.name = actor.id;
  const body = new THREE.Group();
  const head = new THREE.Group();
  const torso = new THREE.Group();
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  root.add(body);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const seed = idSeed(actor.id);
  const mk = (color: number, rough = 0.72, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
    mats.push(m);
    return m;
  };
  const put = (
    geo: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D,
    x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, cast = true,
  ) => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  // Soft contact shadow so characters sit on the ground even where the sun shadow is faint.
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false });
  mats.push(blobMat);
  const blob = put(new THREE.CircleGeometry(0.3, 16), blobMat, root, 0, 0.025, 0, 1, 1, 1, false);
  blob.rotation.x = -Math.PI / 2;
  blob.receiveShadow = false;
  blob.renderOrder = 1;

  if (actor.kind === 'sign') {
    const wood = mk(0x7a5232, 0.85);
    const board = mk(0xf0ddb0, 0.62);
    const ink = mk(0x5a3e2b, 0.8);
    put(new THREE.BoxGeometry(0.09, 0.78, 0.09), wood, body, 0, 0.39, 0);
    put(new THREE.BoxGeometry(0.58, 0.36, 0.06), wood, body, 0, 0.86, 0.02);
    put(new THREE.BoxGeometry(0.5, 0.28, 0.03), board, body, 0, 0.86, 0.055);
    put(new THREE.BoxGeometry(0.34, 0.035, 0.02), ink, body, 0, 0.92, 0.078, 1, 1, 1, false);
    put(new THREE.BoxGeometry(0.28, 0.035, 0.02), ink, body, 0, 0.84, 0.078, 1, 1, 1, false);
    return { root, body, head, legL, legR, armL, armR, torso, geos, mats, walk: 0, phase: 0, seed, initialised: false };
  }

  const { skin, shirt, hair } = actor.style;
  const skinM = mk(skin, 0.62);
  const shirtM = mk(shirt, 0.66);
  const pantsM = mk(0x39466a, 0.8);
  const shoeM = mk(0x2f2622, 0.6);
  const hairM = mk(hair, 0.55);
  const darkM = mk(0x181414, 0.35);
  const eyeLight = mk(0xffffff, 0.2, { emissive: 0xffffff, emissiveIntensity: 0.4 });
  const blushM = mk(0xf2807c, 0.7);
  const beltM = mk(0x3a2c25, 0.6);

  // Legs pivot at the hips, arms at the shoulders, so rotation.x swings them cleanly.
  legL.position.set(-0.085, 0.36, 0);
  legR.position.set(0.085, 0.36, 0);
  armL.position.set(-0.225, 0.72, 0);
  armR.position.set(0.225, 0.72, 0);
  head.position.set(0, 0.9, 0);
  body.add(legL, legR, torso, armL, armR, head);
  for (const leg of [legL, legR]) {
    put(new THREE.CapsuleGeometry(0.068, 0.17, 3, 8), pantsM, leg, 0, -0.16, 0);
    put(new THREE.BoxGeometry(0.15, 0.085, 0.22), shoeM, leg, 0, -0.325, 0.03);
  }
  put(new THREE.CapsuleGeometry(0.175, 0.13, 4, 10), shirtM, torso, 0, 0.56, 0, 1, 1, 0.82);
  put(new THREE.BoxGeometry(0.36, 0.05, 0.3), beltM, torso, 0, 0.4, 0, 1, 1, 1, false);
  for (const arm of [armL, armR]) {
    put(new THREE.CapsuleGeometry(0.052, 0.13, 3, 8), shirtM, arm, 0, -0.12, 0);
    put(new THREE.SphereGeometry(0.056, 8, 6), skinM, arm, 0, -0.27, 0);
  }
  // Head: skin sphere, ears, face, hair.
  put(new THREE.SphereGeometry(0.215, 16, 12), skinM, head, 0, 0.11, 0, 1, 0.96, 0.96);
  put(new THREE.SphereGeometry(0.042, 8, 6), skinM, head, -0.205, 0.1, 0, 0.7, 1, 1, false);
  put(new THREE.SphereGeometry(0.042, 8, 6), skinM, head, 0.205, 0.1, 0, 0.7, 1, 1, false);
  for (const sx of [-1, 1]) {
    put(new THREE.SphereGeometry(0.034, 8, 6), darkM, head, sx * 0.075, 0.1, 0.188, 1, 1.35, 0.5, false);
    put(new THREE.SphereGeometry(0.012, 6, 4), eyeLight, head, sx * 0.075 + 0.009, 0.115, 0.205, 1, 1, 0.6, false);
    put(new THREE.SphereGeometry(0.03, 8, 6), blushM, head, sx * 0.125, 0.04, 0.165, 1, 0.65, 0.35, false);
    put(new THREE.BoxGeometry(0.06, 0.012, 0.01), hairM, head, sx * 0.075, 0.165, 0.2, 1, 1, 1, false).rotation.z = sx * -0.14;
  }
  put(new THREE.BoxGeometry(0.052, 0.012, 0.012), darkM, head, 0, 0.012, 0.205, 1, 1, 1, false);
  const nose = put(new THREE.SphereGeometry(0.018, 6, 5), skinM, head, 0, 0.06, 0.212, 1, 0.9, 0.8, false);
  nose.material = skinM;
  // Hair: tilted cap, bangs and an optional ponytail/bun for variety.
  const cap = put(new THREE.SphereGeometry(0.232, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM, head, 0, 0.125, -0.012, 1, 1, 1);
  cap.rotation.x = -0.5;
  const bang = put(new THREE.BoxGeometry(0.3, 0.07, 0.1), hairM, head, 0, 0.215, 0.145, 1, 1, 1);
  bang.rotation.x = 0.55;
  put(new THREE.BoxGeometry(0.08, 0.1, 0.07), hairM, head, -0.15, 0.17, 0.12).rotation.z = 0.3;
  put(new THREE.BoxGeometry(0.08, 0.1, 0.07), hairM, head, 0.15, 0.17, 0.12).rotation.z = -0.3;
  const style = hash2(seed, 1, 4);
  if (style > 0.66) put(new THREE.SphereGeometry(0.085, 8, 6), hairM, head, 0, 0.12, -0.235);
  else if (style > 0.33) put(new THREE.SphereGeometry(0.075, 8, 6), hairM, head, 0, 0.27, -0.06);
  if (actor.id === 'player') {
    const pack = mk(0xb4552d, 0.8);
    const flap = mk(0xe6b43a, 0.7);
    put(new THREE.BoxGeometry(0.27, 0.32, 0.12), pack, torso, 0, 0.58, -0.19);
    put(new THREE.BoxGeometry(0.27, 0.1, 0.13), flap, torso, 0, 0.7, -0.19, 1, 1, 1, false);
  }
  if (actor.kind === 'heal') {
    const pink = mk(0xff6f95, 0.5);
    put(new THREE.CylinderGeometry(0.15, 0.17, 0.09, 12), mk(0xffffff, 0.5), head, 0, 0.35, 0.0);
    put(new THREE.BoxGeometry(0.06, 0.02, 0.012), pink, head, 0, 0.36, 0.17, 1, 1, 1, false);
    put(new THREE.BoxGeometry(0.02, 0.06, 0.012), pink, head, 0, 0.36, 0.17, 1, 1, 1, false);
    put(new THREE.BoxGeometry(0.34, 0.34, 0.015), pink, torso, 0, 0.55, 0.15, 0.6, 0.7, 1, false);
  } else if (actor.kind === 'shop') {
    const green = mk(0x2f9e66, 0.55);
    put(new THREE.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), green, head, 0, 0.17, 0);
    put(new THREE.BoxGeometry(0.26, 0.025, 0.14), green, head, 0, 0.19, 0.22);
    put(new THREE.BoxGeometry(0.34, 0.32, 0.015), mk(0xf4efe2, 0.7), torso, 0, 0.5, 0.15, 0.7, 0.9, 1, false);
  } else if (actor.kind === 'trial') {
    const gold = mk(0xe6b325, 0.35, { metalness: 0.5 });
    const ring = put(new THREE.TorusGeometry(0.21, 0.022, 6, 16), gold, head, 0, 0.23, 0);
    ring.rotation.x = Math.PI / 2;
    put(new THREE.OctahedronGeometry(0.05, 0), mk(0xff4f73, 0.25, { emissive: 0xff2f5a, emissiveIntensity: 0.5 }), head, 0, 0.25, 0.21);
  } else if (actor.kind === 'trainer') {
    const capM = mk(0xd24b4b, 0.55);
    put(new THREE.SphereGeometry(0.236, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), capM, head, 0, 0.15, -0.005);
    put(new THREE.BoxGeometry(0.26, 0.022, 0.15), capM, head, 0, 0.17, 0.22);
  }
  addSilhouette(body, actor.id === 'player' ? 0xffb35c : 0x9fd4ff, mats);
  return { root, body, head, legL, legR, armL, armR, torso, geos, mats, walk: 0, phase: 0, seed, initialised: false };
}

/** Walk-cycle and idle animation. `moving` is whether the actor moved since the last frame. */
export function animateRig(rig: Rig, moving: boolean, dt: number, seconds: number, reduced: boolean): void {
  rig.walk += ((moving ? 1 : 0) - rig.walk) * Math.min(1, dt * 14);
  if (moving) rig.phase += dt * 11;
  const w = rig.walk;
  const swing = Math.sin(rig.phase) * w;
  rig.legL.rotation.x = swing * 0.85;
  rig.legR.rotation.x = -swing * 0.85;
  rig.armL.rotation.x = -swing * 0.7;
  rig.armR.rotation.x = swing * 0.7;
  if (reduced) return;
  const idle = 1 - w;
  const breathe = Math.sin(seconds * 2.2 + rig.seed) * idle;
  rig.armL.rotation.z = -0.05 - breathe * 0.03;
  rig.armR.rotation.z = 0.05 + breathe * 0.03;
  rig.torso.scale.y = 1 + breathe * 0.012;
  rig.head.position.y = 0.9 + Math.abs(Math.sin(rig.phase)) * 0.03 * w + breathe * 0.004;
  rig.head.rotation.x = w * 0.06;
  rig.body.position.y = Math.abs(Math.sin(rig.phase)) * 0.045 * w;
  rig.body.rotation.z = Math.sin(rig.phase) * 0.035 * w;
}
