import * as THREE from 'three';

/**
 * Sculptor: a tiny procedural modelling kit.
 *
 * Parts are recorded (geometry already baked into the parent's local space) and
 * merged per (parent group, material) in `finalize()`. A creature therefore ends
 * up as a few dozen meshes no matter how many primitives were used to shape it,
 * while animated groups (head, tail, wings, legs, arms) keep their own pivots.
 * Materials marked as outlined also get a merged inverted-hull outline mesh.
 */

export type V3 = [number, number, number];

export interface Gradient {
  from: THREE.ColorRepresentation;
  to: THREE.ColorRepresentation;
  axis?: 0 | 1 | 2;
}

export interface PartOpts {
  rot?: V3;
  order?: THREE.EulerOrder;
  scale?: V3;
  grad?: Gradient;
}

export interface RimSpec {
  color: THREE.ColorRepresentation;
  strength?: number;
  power?: number;
}

export const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ------------------------------------------------------------------ */
/* Geometry factories                                                  */
/* ------------------------------------------------------------------ */

function applyGradient(geo: THREE.BufferGeometry, g: Gradient): void {
  geo.computeBoundingBox();
  const bb = geo.boundingBox as THREE.Box3;
  const axis = g.axis ?? 1;
  const lo = axis === 0 ? bb.min.x : axis === 1 ? bb.min.y : bb.min.z;
  const hi = axis === 0 ? bb.max.x : axis === 1 ? bb.max.y : bb.max.z;
  const span = Math.max(1e-5, hi - lo);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const a = new THREE.Color(g.from);
  const b = new THREE.Color(g.to);
  const c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = axis === 0 ? pos.getX(i) : axis === 1 ? pos.getY(i) : pos.getZ(i);
    c.copy(a).lerp(b, clamp((v - lo) / span, 0, 1));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function sphereGeo(r: number): THREE.BufferGeometry {
  const w = r > 0.24 ? 14 : r > 0.1 ? 10 : r > 0.04 ? 7 : 6;
  return new THREE.SphereGeometry(1, w, Math.max(4, Math.round(w * 0.62)));
}

/** Lathe revolved around Y from (radius, y) samples. */
export function latheGeo(points: Array<[number, number]>, segs = 16): THREE.BufferGeometry {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), segs);
}

/** Egg profile along +Y from -len/2 to len/2. `skew` (0..1) moves the fat part toward the rear (-Y). */
export function eggProfile(len: number, rad: number, skew = 0.35, steps = 10): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = rad * Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, t))), 0.62) * (1 + skew * 0.34 * (1 - t));
    pts.push([r, (t - 0.5) * len]);
  }
  return pts;
}

/** Leaf/petal/feather blade: base at origin, tip at +X, thickness along Y, width along Z. */
export function leafGeo(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 12, 8);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + 1) / 2;
    const taper = 1 - 0.58 * u * u;
    pos.setXYZ(i, u, pos.getZ(i) * 0.5 * taper, pos.getY(i) * 0.5 * taper);
  }
  g.computeVertexNormals();
  return g;
}

/** Faceted hexagonal crystal, base at y=0, point at y=h. Flat shaded. */
export function gemGeo(r: number, h: number, sides = 6): THREE.BufferGeometry {
  const lathe = new THREE.LatheGeometry(
    [new THREE.Vector2(0.0001, 0), new THREE.Vector2(r * 0.72, h * 0.1), new THREE.Vector2(r, h * 0.3), new THREE.Vector2(r, h * 0.7), new THREE.Vector2(0.0001, h)],
    sides,
  );
  const flat = lathe.toNonIndexed();
  lathe.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** Faceted rock / gem lump. */
export function shardGeo(): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, 0);
  ico.computeVertexNormals();
  return ico;
}

/** Lightning bolt pointing +Y, roughly 1 unit tall, 0.7 wide, centered, extruded along Z (depth 1). */
export function boltGeo(): THREE.BufferGeometry {
  const pts: Array<[number, number]> = [
    [0.25, 0.5],
    [-0.35, 0.05],
    [-0.02, 0.05],
    [-0.25, -0.5],
    [0.35, -0.03],
    [0.02, -0.03],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}

/** Flame tongue, base at y=0, tip at y=h, bending toward +X. */
export function flameGeo(h: number, r: number, bend = 0.2): THREE.BufferGeometry {
  const pts: Array<[number, number]> = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const rad = r * Math.pow(1 - t, 0.85) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.1)));
    pts.push([rad, t * h]);
  }
  const g = latheGeo(pts, 8);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h;
    pos.setX(i, pos.getX(i) + bend * t * t * h);
  }
  g.computeVertexNormals();
  return g;
}

export function tubeGeo(
  points: THREE.Vector3[],
  radius: number,
  taper: (t: number) => number,
  colorFn?: (t: number) => THREE.Color,
  seg = 10,
  radial = 6,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  const colors = colorFn ? new Float32Array(pos.count * 3) : null;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, c);
    const k = Math.max(0.02, taper(t));
    const col = colorFn ? colorFn(t) : null;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, p.x, p.y, p.z);
      if (colors && col) {
        colors[idx * 3] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
      }
    }
  }
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Rim glow                                                            */
/* ------------------------------------------------------------------ */

function addRim(mat: THREE.MeshToonMaterial | THREE.MeshStandardMaterial, spec: RimSpec): void {
  const color = new THREE.Color(spec.color);
  const params = new THREE.Vector2(spec.strength ?? 0.4, spec.power ?? 2.6);
  mat.onBeforeCompile = (shader): void => {
    shader.uniforms.uRimColor = { value: color };
    shader.uniforms.uRim = { value: params };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform vec2 uRim;')
      .replace(
        '#include <opaque_fragment>',
        'float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), uRim.y);\noutgoingLight += uRimColor * rimF * uRim.x;\n#include <opaque_fragment>',
      );
  };
  mat.customProgramCacheKey = (): string => 'prismara-rim';
}

/* ------------------------------------------------------------------ */
/* Merge helpers                                                       */
/* ------------------------------------------------------------------ */

function mergeGeometries(geos: THREE.BufferGeometry[], withColor: boolean): THREE.BufferGeometry {
  const items = geos;
  let total = 0;
  let indexTotal = 0;
  for (const g of items) {
    total += g.getAttribute('position').count;
    indexTotal += g.index ? g.index.count : g.getAttribute('position').count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const idx = new Uint32Array(indexTotal);
  const col = withColor ? new Float32Array(total * 3).fill(1) : null;
  let o = 0;
  let ii = 0;
  for (const g of items) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const c = g.getAttribute('color');
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[ii++] = g.index.getX(i) + o;
    else for (let i = 0; i < p.count; i++) idx[ii++] = i + o;
    for (let i = 0; i < p.count; i++, o++) {
      pos[o * 3] = p.getX(i);
      pos[o * 3 + 1] = p.getY(i);
      pos[o * 3 + 2] = p.getZ(i);
      nor[o * 3] = n.getX(i);
      nor[o * 3 + 1] = n.getY(i);
      nor[o * 3 + 2] = n.getZ(i);
      if (col && c) {
        col[o * 3] = c.getX(i);
        col[o * 3 + 1] = c.getY(i);
        col[o * 3 + 2] = c.getZ(i);
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setIndex(new THREE.BufferAttribute(total < 65536 ? new Uint16Array(idx) : idx, 1));
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function hullOf(src: THREE.BufferGeometry, thickness: number): THREE.BufferGeometry {
  const g = src.clone();
  g.deleteAttribute('color');
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * thickness, p.getY(i) + n.getY(i) * thickness, p.getZ(i) + n.getZ(i) * thickness);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Sculptor                                                            */
/* ------------------------------------------------------------------ */

interface Part {
  parent: THREE.Object3D;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const P3 = new THREE.Vector3();
const S3 = new THREE.Vector3();

export class Sculptor {
  readonly root = new THREE.Group();
  readonly sway = new THREE.Group();
  readonly heads: THREE.Object3D[] = [];
  readonly tails: THREE.Object3D[] = [];
  readonly wings: THREE.Object3D[] = [];
  readonly wingSide: number[] = [];
  readonly wingBase: number[] = [];
  readonly legs: THREE.Object3D[] = [];
  readonly arms: THREE.Object3D[] = [];
  /** Uniform scale applied on top of the animation scale (legendaries are bigger). */
  baseScale = 1;
  outlineColor = 0x1b1224;
  outlineWidth = 0.012;
  private readonly parts: Part[] = [];
  private readonly mats: THREE.Material[] = [];
  private readonly outlined = new Set<THREE.Material>();
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly gradient: THREE.DataTexture;
  private disposed = false;

  constructor() {
    this.root.add(this.sway);
    const steps = [0.42, 0.64, 0.86, 1];
    const data = new Uint8Array(steps.map((s) => Math.round(s * 255)));
    this.gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
    this.gradient.minFilter = THREE.NearestFilter;
    this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.generateMipmaps = false;
    this.gradient.needsUpdate = true;
    this.textures.push(this.gradient);
  }

  /* ---------------- materials ---------------- */

  toon(color: number, o: { emissive?: number; intensity?: number; rim?: RimSpec; outline?: boolean } = {}): THREE.MeshToonMaterial {
    const m = new THREE.MeshToonMaterial({
      color,
      gradientMap: this.gradient,
      emissive: o.emissive ?? 0,
      emissiveIntensity: o.intensity ?? 0.4,
    });
    if (o.rim) addRim(m, o.rim);
    if (o.outline) this.outlined.add(m);
    this.mats.push(m);
    return m;
  }

  gloss(
    color: number,
    o: { roughness?: number; metalness?: number; emissive?: number; intensity?: number; rim?: RimSpec; outline?: boolean; flat?: boolean } = {},
  ): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.roughness ?? 0.35,
      metalness: o.metalness ?? 0.1,
      emissive: o.emissive ?? 0,
      emissiveIntensity: o.intensity ?? 0.3,
      flatShading: o.flat ?? false,
    });
    if (o.rim) addRim(m, o.rim);
    if (o.outline) this.outlined.add(m);
    this.mats.push(m);
    return m;
  }

  /** Unlit glowing material, optionally with per-vertex gradient colors and translucency. */
  glow(color: number, o: { vertexColors?: boolean; opacity?: number; additive?: boolean; side?: THREE.Side } = {}): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({
      color,
      vertexColors: o.vertexColors ?? false,
      transparent: (o.opacity ?? 1) < 1 || o.additive === true,
      opacity: o.opacity ?? 1,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !(o.additive ?? false),
      side: o.side ?? THREE.FrontSide,
      toneMapped: false,
    });
    this.mats.push(m);
    return m;
  }

  /* ---------------- low level ---------------- */

  put(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, o?: PartOpts): void {
    if (o?.grad) applyGradient(geo, o.grad);
    const r = o?.rot ?? [0, 0, 0];
    const s = o?.scale ?? [1, 1, 1];
    M4.compose(P3.set(x, y, z), Q.setFromEuler(E.set(r[0], r[1], r[2], o?.order ?? 'XYZ')), S3.set(s[0], s[1], s[2]));
    geo.applyMatrix4(M4);
    this.parts.push({ parent, geo, mat });
  }

  ball(parent: THREE.Object3D, x: number, y: number, z: number, r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1, rot?: V3): void {
    this.put(parent, sphereGeo(r), mat, x, y, z, { scale: [r * sx, r * sy, r * sz], rot });
  }

  limb(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, length: number, mat: THREE.Material, rx = 0, rz = 0): void {
    const seg = radius > 0.08 ? 12 : 8;
    this.put(parent, new THREE.CapsuleGeometry(radius, length, 5, seg), mat, x, y, z, { rot: [rx, 0, rz] });
  }

  cone(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, height: number, mat: THREE.Material, rx = 0, rz = 0, ry = 0, o?: PartOpts): void {
    const seg = radius > 0.1 ? 10 : 6;
    this.put(parent, new THREE.ConeGeometry(radius, height, seg, 1), mat, x, y, z, { rot: [rx, ry, rz], ...o });
  }

  ring(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, tube: number, mat: THREE.Material, rx = 0, rz = 0, ry = 0): void {
    this.put(parent, new THREE.TorusGeometry(radius, tube, 5, 14), mat, x, y, z, { rot: [rx, ry, rz] });
  }

  /** Tapered limb between two points with rounded ends. */
  seg(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material, caps = true): void {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) return;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    this.put(parent, new THREE.CylinderGeometry(r1, r0, len, r0 > 0.06 ? 9 : 6, 1, true), mat, mid.x, mid.y, mid.z, { rot: [e.x, e.y, e.z] });
    if (caps) {
      this.ball(parent, a.x, a.y, a.z, r0, mat);
      this.ball(parent, b.x, b.y, b.z, r1, mat);
    }
  }

  lathe(parent: THREE.Object3D, pts: Array<[number, number]>, mat: THREE.Material, x: number, y: number, z: number, o?: PartOpts, segs = 16): void {
    this.put(parent, latheGeo(pts, segs), mat, x, y, z, o);
  }

  /** Egg-shaped body mass lying along Z (front at +Z). width/height scale the cross-section. */
  egg(parent: THREE.Object3D, x: number, y: number, z: number, len: number, rad: number, mat: THREE.Material, width = 1, height = 1, pitch = 0, skew = 0.35): void {
    this.lathe(parent, eggProfile(len, rad, skew), mat, x, y, z, { rot: [Math.PI / 2 + pitch, 0, 0], scale: [width, 1, height] }, 12);
  }

  tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, mat: THREE.Material, taper: (t: number) => number, colorFn?: (t: number) => THREE.Color): void {
    this.put(parent, tubeGeo(points, radius, taper, colorFn), mat);
  }

  leaf(parent: THREE.Object3D, x: number, y: number, z: number, len: number, thick: number, width: number, mat: THREE.Material, rot?: V3, order?: THREE.EulerOrder): void {
    this.put(parent, leafGeo(), mat, x, y, z, { rot, order, scale: [len, width * 2, thick * 2] });
  }

  gem(parent: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, mat: THREE.Material, rot?: V3): void {
    this.put(parent, gemGeo(r, h), mat, x, y, z, { rot });
  }

  shard(parent: THREE.Object3D, x: number, y: number, z: number, r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1, rot?: V3): void {
    this.put(parent, shardGeo(), mat, x, y, z, { rot, scale: [r * sx, r * sy, r * sz] });
  }

  bolt(parent: THREE.Object3D, x: number, y: number, z: number, len: number, width: number, mat: THREE.Material, rot?: V3, depth = 0.06): void {
    this.put(parent, boltGeo(), mat, x, y, z, { rot, scale: [width, len, depth] });
  }

  flame(parent: THREE.Object3D, x: number, y: number, z: number, h: number, r: number, mat: THREE.Material, from: number, to: number, bend = 0.2, rot?: V3): void {
    this.put(parent, flameGeo(h, r, bend), mat, x, y, z, { rot, grad: { from, to, axis: 1 } });
  }

  /* ---------------- build / teardown ---------------- */

  finalize(minChunks = 18): void {
    interface Entry {
      parent: THREE.Object3D;
      mat: THREE.Material;
      list: THREE.BufferGeometry[];
    }
    const entries: Entry[] = [];
    const index = new Map<THREE.Object3D, Map<THREE.Material, Entry>>();
    for (const p of this.parts) {
      let m = index.get(p.parent);
      if (!m) {
        m = new Map();
        index.set(p.parent, m);
      }
      let e = m.get(p.mat);
      if (!e) {
        e = { parent: p.parent, mat: p.mat, list: [] };
        m.set(p.mat, e);
        entries.push(e);
      }
      e.list.push(p.geo);
    }
    // Keep a sensible number of draw calls/culling chunks even for very simple creatures.
    while (entries.length < minChunks) {
      let best = -1;
      for (let i = 0; i < entries.length; i++) if (entries[i].list.length > 1 && (best < 0 || entries[i].list.length > entries[best].list.length)) best = i;
      if (best < 0) break;
      const e = entries[best];
      const half = e.list.splice(Math.ceil(e.list.length / 2));
      entries.push({ parent: e.parent, mat: e.mat, list: half });
    }
    const hulls = new Map<THREE.Object3D, THREE.BufferGeometry[]>();
    for (const e of entries) {
      const vc = (e.mat as THREE.MeshBasicMaterial).vertexColors === true;
      const merged = mergeGeometries(e.list, vc);
      for (const g of e.list) g.dispose();
      this.geos.push(merged);
      const mesh = new THREE.Mesh(merged, e.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      e.parent.add(mesh);
      if (this.outlined.has(e.mat)) {
        const h = hulls.get(e.parent);
        if (h) h.push(merged);
        else hulls.set(e.parent, [merged]);
      }
    }
    let hullMat: THREE.MeshBasicMaterial | null = null;
    for (const [parent, sources] of hulls) {
      if (!hullMat) {
        hullMat = new THREE.MeshBasicMaterial({ color: this.outlineColor, side: THREE.BackSide });
        this.mats.push(hullMat);
      }
      const temp = sources.map((g) => hullOf(g, this.outlineWidth));
      const hull = mergeGeometries(temp, false);
      for (const g of temp) g.dispose();
      this.geos.push(hull);
      const mesh = new THREE.Mesh(hull, hullMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.parts.length = 0;
  }

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      for (const g of this.geos) g.dispose();
      for (const p of this.parts) p.geo.dispose();
      for (const m of this.mats) m.dispose();
      for (const t of this.textures) t.dispose();
      this.geos.length = 0;
      this.mats.length = 0;
      this.parts.length = 0;
    }
    this.root.clear();
  }
}
