/**
 * The title-screen lighthouse: a tapered, banded tower with a gallery railing,
 * a glazed lantern room with an emissive light, a copper roof and a slowly
 * sweeping pair of beams.
 */

import * as THREE from 'three';
import { Kit, rng, vnoise } from '../arena/kit';

export interface Lighthouse {
  group: THREE.Group;
  /** Advance animation; `sweep` is the beam angle in radians. */
  update(seconds: number, animate: boolean): void;
}

function towerTexture(kit: Kit): THREE.CanvasTexture {
  return kit.tex(256, 512, (c, w, h) => {
    const r = rng(7);
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      c.fillStyle = i % 2 === 0 ? '#f6efe6' : '#c8392f';
      c.fillRect(0, (i * h) / bands, w, h / bands + 1);
    }
    // Weathering, grime near the base and brick-ish mortar.
    const g = c.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, 'rgba(40,30,20,0)');
    g.addColorStop(1, 'rgba(40,30,20,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(60,40,30,0.12)';
    for (let y = 0; y < h; y += 14) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let i = 0; i < 700; i++) {
      c.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '40,30,30'},${0.05 + r() * 0.08})`;
      c.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
    }
    // Door and two small windows on the camera-facing side (u = 0.25 after rotation).
    const dx = w * 0.25;
    c.fillStyle = '#4a2c1c';
    c.beginPath();
    c.roundRect(dx - 14, h - 62, 28, 62, [14, 14, 0, 0]);
    c.fill();
    c.fillStyle = '#26303f';
    for (const y of [h * 0.3, h * 0.58]) {
      c.beginPath();
      c.roundRect(dx - 8, y, 16, 28, 8);
      c.fill();
      c.fillStyle = '#ffd68a';
      c.fillRect(dx - 5, y + 8, 10, 14);
      c.fillStyle = '#26303f';
    }
  });
}

export function createLighthouse(kit: Kit, reduced: boolean): Lighthouse {
  const group = new THREE.Group();
  const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => kit.track(new THREE.MeshStandardMaterial(p));
  const geo = <T extends THREE.BufferGeometry>(g: T): T => kit.track(g);

  const stone = std({ color: 0x8c8479, roughness: 0.95, flatShading: true });
  const base = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.98, 1.12, 0.32, 20)), stone);
  base.position.y = 0.16;
  const plinth = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.8, 0.9, 0.2, 20)), stone);
  plinth.position.y = 0.4;

  const towerH = 3.5;
  const tower = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.42, 0.66, towerH, 40, 1, false)),
    std({ map: towerTexture(kit), roughness: 0.78, metalness: 0.02 }),
  );
  tower.position.y = 0.5 + towerH / 2;
  tower.rotation.y = -Math.PI * 0.25;
  const topY = 0.5 + towerH;

  const dark = std({ color: 0x2a2f38, roughness: 0.6, metalness: 0.4 });
  const gallery = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.66, 0.6, 0.12, 32)), dark);
  gallery.position.y = topY + 0.06;
  const corbel = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.58, 0.46, 0.16, 32)), std({ color: 0xc8392f, roughness: 0.8 }));
  corbel.position.y = topY - 0.06;

  // Railing: posts plus two rings.
  const posts = new THREE.InstancedMesh(geo(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 4)), dark, 28);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * 0.63, topY + 0.25, Math.sin(a) * 0.63);
    posts.setMatrixAt(i, m);
  }
  const railTop = new THREE.Mesh(geo(new THREE.TorusGeometry(0.63, 0.016, 5, 40)), dark);
  railTop.rotation.x = Math.PI / 2;
  railTop.position.y = topY + 0.38;
  const railMid = railTop.clone();
  railMid.position.y = topY + 0.22;
  railMid.scale.setScalar(1);

  // Lantern room.
  const lanternY = topY + 0.12;
  const glassMat = std({ color: 0xffe6a8, emissive: 0xffc860, emissiveIntensity: 1.6, transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide });
  const glass = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.33, 0.33, 0.5, 16, 1, true)), glassMat);
  glass.position.y = lanternY + 0.25;
  const mull = new THREE.InstancedMesh(geo(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 4)), dark, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * 0.335, lanternY + 0.26, Math.sin(a) * 0.335);
    mull.setMatrixAt(i, m);
  }
  const core = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 12, 10)), kit.track(new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false })));
  core.position.y = lanternY + 0.26;
  const lensRing = new THREE.Mesh(geo(new THREE.TorusGeometry(0.22, 0.03, 6, 20)), std({ color: 0xfff0b0, emissive: 0xffd070, emissiveIntensity: 1.2 }));
  lensRing.rotation.x = Math.PI / 2;
  lensRing.position.y = lanternY + 0.26;
  const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.4, 0.38, 0.07, 16)), dark);
  cap.position.y = lanternY + 0.53;
  const roof = new THREE.Mesh(geo(new THREE.ConeGeometry(0.42, 0.36, 16)), std({ color: 0xc8704a, metalness: 0.6, roughness: 0.35 }));
  roof.position.y = lanternY + 0.74;
  const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(0.045, 8, 6)), dark);
  ball.position.y = lanternY + 0.96;
  const vane = new THREE.Mesh(geo(new THREE.BoxGeometry(0.3, 0.012, 0.012)), dark);
  vane.position.y = lanternY + 1.04;

  for (const mesh of [base, plinth, tower, gallery, corbel, glass, cap, roof, ball, vane, railTop, railMid]) {
    mesh.castShadow = true;
  }
  group.add(base, plinth, tower, gallery, corbel, posts, railTop, railMid, glass, mull, core, lensRing, cap, roof, ball, vane);

  // Keeper's cottage beside the tower.
  const cottage = new THREE.Group();
  const walls = new THREE.Mesh(geo(new THREE.BoxGeometry(0.95, 0.5, 0.7)), std({ color: 0xf2e8da, roughness: 0.9 }));
  walls.position.y = 0.25;
  const cottageRoof = new THREE.Mesh(geo(new THREE.ConeGeometry(0.72, 0.42, 4)), std({ color: 0xb04a38, roughness: 0.7 }));
  cottageRoof.rotation.y = Math.PI / 4;
  cottageRoof.scale.set(1.05, 1, 0.78);
  cottageRoof.position.y = 0.7;
  const door = new THREE.Mesh(geo(new THREE.BoxGeometry(0.14, 0.26, 0.02)), std({ color: 0x5a3a24 }));
  door.position.set(0, 0.13, 0.36);
  const win = new THREE.Mesh(geo(new THREE.BoxGeometry(0.14, 0.12, 0.02)), kit.track(new THREE.MeshBasicMaterial({ color: 0xffd68a, toneMapped: false })));
  win.position.set(0.28, 0.3, 0.36);
  cottage.add(walls, cottageRoof, door, win);
  cottage.position.set(-1.35, 0.1, 0.55);
  cottage.rotation.y = 0.35;
  for (const o of [walls, cottageRoof]) o.castShadow = true;
  group.add(cottage);

  // Halo and beams.
  const dot = kit.softDot();
  const haloMat = kit.track(new THREE.SpriteMaterial({ map: dot, color: 0xffd890, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(2.6);
  halo.position.y = lanternY + 0.26;
  group.add(halo);

  const beamLen = 7.5;
  const beamGeo = geo(new THREE.ConeGeometry(0.5, beamLen, 24, 1, true));
  beamGeo.rotateZ(Math.PI / 2);
  beamGeo.translate(beamLen / 2, 0, 0);
  // Fade towards the far end: additive blending + darkening vertex colours.
  const bp = beamGeo.getAttribute('position');
  const bc = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i++) {
    const f = 1 - Math.min(1, Math.max(0, bp.getX(i) / beamLen));
    const k = 0.015 + f * f * 0.1;
    bc[i * 3] = k;
    bc[i * 3 + 1] = k * 0.9;
    bc[i * 3 + 2] = k * 0.6;
  }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const beamMat = kit.track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0.55 }));
  const sweep = new THREE.Group();
  const beamA = new THREE.Mesh(beamGeo, beamMat);
  const beamB = new THREE.Mesh(beamGeo, beamMat);
  beamB.rotation.y = Math.PI;
  sweep.add(beamA, beamB);
  sweep.position.y = lanternY + 0.26;
  sweep.rotation.y = 2.2;
  group.add(sweep);

  const light = new THREE.PointLight(0xffc870, 5, 9, 2);
  light.position.y = lanternY + 0.4;
  group.add(light);

  return {
    group,
    update(seconds, animate) {
      if (!animate) return;
      sweep.rotation.y = 2.2 + seconds * 0.42;
      const pulse = 1 + Math.sin(seconds * 2.1) * 0.06 + (vnoise(seconds * 3, 1, 4) - 0.5) * 0.08;
      halo.scale.setScalar(2.6 * pulse);
      glassMat.emissiveIntensity = 1.5 * pulse;
      light.intensity = 5 * pulse;
      vane.rotation.y = Math.sin(seconds * 0.3) * 0.8;
      void reduced;
    },
  };
}
