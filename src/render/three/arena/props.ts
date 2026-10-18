/**
 * Prop geometry library for the arenas. Every builder returns a merged,
 * vertex-coloured geometry with its base at y = 0 so it can be instanced and
 * swayed by height.
 */

import * as THREE from 'three';
import { compose, vnoise, type Part } from './kit';

const lift = (geo: THREE.BufferGeometry, y: number): THREE.BufferGeometry => geo.translate(0, y, 0);

export function pineGeo(dark = 0x1f5a2b, light = 0x2f7a3a): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6), 0.6), color: 0x5a3c22 },
    { geo: lift(new THREE.ConeGeometry(1.15, 1.8, 7), 1.1), color: dark },
    { geo: lift(new THREE.ConeGeometry(0.9, 1.6, 7), 2.0), color: light },
    { geo: lift(new THREE.ConeGeometry(0.62, 1.4, 7), 2.9), color: dark },
    { geo: lift(new THREE.ConeGeometry(0.36, 1.1, 7), 3.7), color: light },
  ], 3);
}

export function broadleafGeo(a = 0x2f7d3a, b = 0x4a9a48): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.CylinderGeometry(0.14, 0.26, 1.7, 6), 0.85), color: 0x654427 },
    { geo: new THREE.IcosahedronGeometry(1.1, 1), at: [0, 2.2, 0], scale: [1, 0.85, 1], color: a },
    { geo: new THREE.IcosahedronGeometry(0.8, 1), at: [0.75, 1.85, 0.25], color: b },
    { geo: new THREE.IcosahedronGeometry(0.75, 1), at: [-0.7, 2.0, -0.3], color: b },
    { geo: new THREE.IcosahedronGeometry(0.7, 1), at: [0.05, 2.95, 0.05], color: a },
  ], 5);
}

export function rockGeo(color: number, cap?: number, squash = 0.75): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 0.72 + vnoise(x * 4 + 9, z * 4 + y * 3, 7) * 0.6;
    p.setXYZ(i, x * k, Math.max(y * k * squash, -0.12), z * k);
  }
  g.translate(0, 0.14, 0);
  return compose([{ geo: g, color, cap, jitter: 0.14 }], 9);
}

export function mushroomGeo(cap = 0xd8442e, spots = true): THREE.BufferGeometry {
  const parts: Part[] = [
    { geo: lift(new THREE.CylinderGeometry(0.05, 0.08, 0.34, 6), 0.17), color: 0xf0e4cc },
    { geo: new THREE.SphereGeometry(0.24, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), at: [0, 0.32, 0] as [number, number, number], scale: [1, 0.7, 1] as [number, number, number], color: cap },
  ];
  if (spots) {
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      parts.push({ geo: new THREE.SphereGeometry(0.035, 4, 3), at: [Math.cos(a) * 0.12, 0.45 - (i % 2) * 0.03, Math.sin(a) * 0.12] as [number, number, number], color: 0xfff2e0 });
    }
  }
  return compose(parts, 11);
}

export function fernGeo(color = 0x2f8a3e): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let k = 0; k < 7; k++) {
    parts.push({
      geo: lift(new THREE.ConeGeometry(0.11, 0.95, 3), 0.47),
      rot: [0.95 + (k % 2) * 0.25, (k / 7) * Math.PI * 2, 0] as [number, number, number],
      scale: [1, 1, 0.18] as [number, number, number],
      color: k % 2 ? color : 0x3f9f4c,
    });
  }
  return compose(parts, 13);
}

export function tuftGeo(color = 0x3f9f4c): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let k = 0; k < 5; k++) {
    parts.push({
      geo: lift(new THREE.ConeGeometry(0.05, 0.5, 3), 0.25),
      rot: [0.25, (k / 5) * Math.PI * 2, 0.05] as [number, number, number],
      at: [Math.cos(k) * 0.05, 0, Math.sin(k) * 0.05] as [number, number, number],
      color: k % 2 ? color : 0x2f7d3a,
      jitter: 0.2,
    });
  }
  return compose(parts, 15);
}

export function flowerGeo(): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 3), 0.16), color: 0x3a8a3a },
    { geo: new THREE.IcosahedronGeometry(0.075, 0), at: [0, 0.34, 0], scale: [1, 0.6, 1], color: 0xffffff },
    { geo: new THREE.IcosahedronGeometry(0.03, 0), at: [0, 0.37, 0], color: 0xffd84a },
  ], 17);
}

export function palmGeo(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push({
      geo: lift(new THREE.CylinderGeometry(0.14 - i * 0.008, 0.17 - i * 0.008, 0.7, 6), 0.35),
      at: [i * i * 0.045, i * 0.62, 0] as [number, number, number],
      rot: [0, 0, -i * 0.065] as [number, number, number],
      color: i % 2 ? 0x8a6a42 : 0x9a7a4e,
    });
  }
  const top: [number, number, number] = [1.3, 3.65, 0];
  for (let f = 0; f < 8; f++) {
    parts.push({
      geo: lift(new THREE.ConeGeometry(0.2, 1.9, 4), 0.95),
      at: top,
      rot: [1.25 + (f % 2) * 0.25, (f / 8) * Math.PI * 2, 0] as [number, number, number],
      scale: [1, 1, 0.14] as [number, number, number],
      color: f % 2 ? 0x2f8a4a : 0x3fa05a,
    });
  }
  parts.push({ geo: new THREE.IcosahedronGeometry(0.16, 0), at: [top[0], top[1] - 0.1, 0.1] as [number, number, number], color: 0x5a3a1a });
  return compose(parts, 19);
}

export function pillarGeo(kind: 'tall' | 'mid' | 'stump'): THREE.BufferGeometry {
  const stone = 0x9a9c94;
  const dark = 0x7e8279;
  const h = kind === 'tall' ? 3.6 : kind === 'mid' ? 2.2 : 0.9;
  const parts: Part[] = [
    { geo: lift(new THREE.BoxGeometry(1.25, 0.28, 1.25), 0.14), color: dark },
    { geo: lift(new THREE.CylinderGeometry(0.42, 0.5, h, 9), 0.28 + h / 2), color: stone, jitter: 0.12 },
  ];
  if (kind === 'tall') {
    parts.push({ geo: lift(new THREE.BoxGeometry(1.1, 0.26, 1.1), 0.28 + h + 0.13), color: dark });
  } else {
    parts.push({ geo: new THREE.IcosahedronGeometry(0.5, 0), at: [0.05, 0.28 + h, 0], scale: [1, 0.45, 1], rot: [0.2, 0.4, 0.15], color: stone });
  }
  return compose(parts, 21);
}

export function archGeo(): THREE.BufferGeometry {
  const stone = 0x9a9c94;
  return compose([
    { geo: lift(new THREE.BoxGeometry(0.9, 3.4, 0.9), 1.7), at: [-1.9, 0, 0], color: stone },
    { geo: lift(new THREE.BoxGeometry(0.9, 2.4, 0.9), 1.2), at: [1.9, 0, 0], color: stone },
    { geo: new THREE.TorusGeometry(1.9, 0.42, 6, 10, Math.PI * 0.62), at: [0, 3.0, 0], rot: [0, 0, Math.PI * 0.19], color: 0x8a8d84 },
    { geo: new THREE.IcosahedronGeometry(0.5, 0), at: [1.9, 2.55, 0], scale: [1, 0.5, 1], color: stone },
  ], 23);
}

export function stalagmiteGeo(color = 0x3a4256, tip = 0x5a6684): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.ConeGeometry(0.55, 2.4, 6), 1.2), color, cap: tip },
    { geo: lift(new THREE.ConeGeometry(0.38, 1.5, 5), 0.75), at: [0.6, 0, 0.25], color, cap: tip },
    { geo: lift(new THREE.ConeGeometry(0.3, 1.0, 5), 0.5), at: [-0.5, 0, -0.2], color, cap: tip },
  ], 25);
}

export function crystalGeo(): THREE.BufferGeometry {
  const parts: Part[] = [];
  const lean = [0, 0.35, -0.3, 0.55, -0.5];
  for (let i = 0; i < 5; i++) {
    const h = 0.9 - i * 0.1;
    parts.push({
      geo: lift(new THREE.CylinderGeometry(0.1, 0.14, h, 6), h / 2),
      at: [(i - 2) * 0.17, 0, (i % 2) * 0.15] as [number, number, number],
      rot: [lean[i] * 0.5, i, lean[i]] as [number, number, number],
      color: 0xffffff,
      jitter: 0.08,
    });
    parts.push({
      geo: lift(new THREE.ConeGeometry(0.1, 0.34, 6), h + 0.17),
      at: [(i - 2) * 0.17, 0, (i % 2) * 0.15] as [number, number, number],
      rot: [lean[i] * 0.5, i, lean[i]] as [number, number, number],
      color: 0xffffff,
      jitter: 0.08,
    });
  }
  return compose(parts, 27);
}

export function spireGeo(color: number, cap: number): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.ConeGeometry(1.0, 5.0, 5), 2.5), color, cap, jitter: 0.16 },
    { geo: lift(new THREE.ConeGeometry(0.6, 3.2, 5), 1.6), at: [1.0, 0, 0.3], rot: [0, 0.4, -0.08], color, cap },
    { geo: lift(new THREE.ConeGeometry(0.5, 2.4, 5), 1.2), at: [-0.8, 0, -0.4], rot: [0, 1, 0.1], color, cap },
  ], 29);
}

export function logGeo(): THREE.BufferGeometry {
  return compose([
    { geo: new THREE.CylinderGeometry(0.22, 0.25, 2.2, 7), at: [0, 0.22, 0], rot: [0, 0, Math.PI / 2], color: 0x5e4126 },
    { geo: new THREE.CylinderGeometry(0.18, 0.18, 0.05, 7), at: [1.1, 0.22, 0], rot: [0, 0, Math.PI / 2], color: 0xc9a06a },
  ], 31);
}

export function lampGeo(): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.CylinderGeometry(0.05, 0.09, 2.8, 6), 1.4), color: 0x2a2f38 },
    { geo: new THREE.BoxGeometry(0.7, 0.05, 0.05), at: [0.3, 2.78, 0], color: 0x2a2f38 },
    { geo: new THREE.BoxGeometry(0.28, 0.08, 0.2), at: [0.62, 2.72, 0], color: 0x3a404a },
  ], 33);
}

export function pylonGeo(): THREE.BufferGeometry {
  const steel = 0x6a7480;
  const parts: Part[] = [
    { geo: lift(new THREE.CylinderGeometry(0.07, 0.15, 6.2, 5), 3.1), color: steel },
    { geo: new THREE.BoxGeometry(2.2, 0.08, 0.08), at: [0, 5.4, 0], color: steel },
    { geo: new THREE.BoxGeometry(1.7, 0.08, 0.08), at: [0, 4.6, 0], color: steel },
    { geo: new THREE.BoxGeometry(1.2, 0.07, 0.07), at: [0, 3.8, 0], color: steel },
  ];
  for (const [x, y] of [[-1.05, 5.4], [1.05, 5.4], [-0.8, 4.6], [0.8, 4.6]]) {
    parts.push({ geo: lift(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), -0.15), at: [x, y, 0], color: 0xd8dde4 });
  }
  return compose(parts, 35);
}

export function buildingGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w * 0.9)), uv.getY(i) * Math.max(1, Math.round(h * 0.55)));
  return g;
}

export function iceGeo(): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.ConeGeometry(0.4, 2.2, 5), 1.1), color: 0xbfe6ff, jitter: 0.1 },
    { geo: lift(new THREE.ConeGeometry(0.28, 1.4, 5), 0.7), at: [0.5, 0, 0.1], rot: [0, 0.3, -0.25], color: 0xa5d8f5 },
    { geo: lift(new THREE.ConeGeometry(0.24, 1.1, 5), 0.55), at: [-0.4, 0, -0.2], rot: [0, 0.8, 0.3], color: 0xd2f0ff },
  ], 37);
}

export function umbrellaGeo(): THREE.BufferGeometry {
  return compose([
    { geo: lift(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 4), 1.05), color: 0xe8e0d0 },
    { geo: new THREE.ConeGeometry(1.1, 0.5, 8), at: [0, 2.2, 0], color: 0xe04a4a, jitter: 0.02 },
    { geo: new THREE.ConeGeometry(0.8, 0.35, 8), at: [0, 2.28, 0], rot: [0, 0.4, 0], color: 0xf6f0e6, jitter: 0.02 },
  ], 39);
}
