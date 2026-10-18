import * as THREE from 'three';

/** Axis-aligned rectangle in normalised device coordinates. */
export interface NdcRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function rectContains(rect: NdcRect, x: number, y: number, margin = 0): boolean {
  return x >= rect.minX - margin && x <= rect.maxX + margin && y >= rect.minY - margin && y <= rect.maxY + margin;
}

/** Fraction (0..1) of the sample points that fall inside the rect. */
export function rectCoverage(rect: NdcRect, points: ReadonlyArray<{ x: number; y: number }>, margin = 0): number {
  if (points.length === 0) return 0;
  let hit = 0;
  for (const p of points) if (rectContains(rect, p.x, p.y, margin)) hit++;
  return hit / points.length;
}

/** True when a rect covers enough of the player's on-screen body (not merely brushing it). */
export function rectCoversPlayer(rect: NdcRect, points: ReadonlyArray<{ x: number; y: number }>, needed = 0.99): boolean {
  return rectCoverage(rect, points) >= needed;
}

const corner = new THREE.Vector3();

/** Project a world-space box to an NDC rect with the given camera. */
export function projectBox(box: THREE.Box3, camera: THREE.Camera, out: NdcRect): NdcRect {
  out.minX = out.minY = Infinity;
  out.maxX = out.maxY = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    out.minX = Math.min(out.minX, corner.x);
    out.maxX = Math.max(out.maxX, corner.x);
    out.minY = Math.min(out.minY, corner.y);
    out.maxY = Math.max(out.maxY, corner.y);
  }
  return out;
}

export interface CutawayUniforms {
  uCutCenter: { value: THREE.Vector2 };
  /** Half-size of the cutaway ellipse in NDC. */
  uCutRadius: { value: THREE.Vector2 };
  /** 0 = nothing cut, 1 = full cutaway; shared per building. */
  uCutAmount: { value: number };
  /** Opacity kept at the centre of the cutaway. */
  uCutKeep: { value: number };
}

/**
 * Screen-space dithered cutaway: inside a soft ellipse around the player the material keeps only
 * `uCutKeep` of its pixels (ordered 4x4 dither). It stays opaque, so there is no tint, sorting or
 * depth-write trouble from real transparency.
 */
export function applyCutaway(material: THREE.Material, uniforms: CutawayUniforms): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCutCenter = uniforms.uCutCenter;
    shader.uniforms.uCutRadius = uniforms.uCutRadius;
    shader.uniforms.uCutAmount = uniforms.uCutAmount;
    shader.uniforms.uCutKeep = uniforms.uCutKeep;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCutNdc;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCutNdc = gl_Position.xy / gl_Position.w;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vCutNdc;
uniform vec2 uCutCenter;
uniform vec2 uCutRadius;
uniform float uCutAmount;
uniform float uCutKeep;
const float cutBayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
if (uCutAmount > 0.001) {
  vec2 cd = (vCutNdc - uCutCenter) / uCutRadius;
  float falloff = 1.0 - smoothstep(0.55, 1.0, length(cd));
  float keepHere = 1.0 - uCutAmount * falloff * (1.0 - uCutKeep);
  int bx = int(mod(gl_FragCoord.x, 4.0));
  int by = int(mod(gl_FragCoord.y, 4.0));
  if ((cutBayer[by * 4 + bx] + 0.5) / 16.0 >= keepHere) discard;
}`,
      );
  };
  material.customProgramCacheKey = () => 'cutaway-v1';
  material.needsUpdate = true;
}
