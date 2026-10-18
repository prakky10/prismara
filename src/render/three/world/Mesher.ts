import * as THREE from 'three';

/** Accumulates transformed primitives (vertex-coloured) into one BufferGeometry. */
export class Mesher {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly uv: number[] = [];
  private readonly idx: number[] = [];
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpN = new THREE.Vector3();
  private readonly nm = new THREE.Matrix3();
  private readonly color = new THREE.Color();
  private readonly mat = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);

  get empty(): boolean {
    return this.pos.length === 0;
  }

  /** Append a geometry; UVs are projected from the dominant normal axis when `uvScale` > 0. */
  addGeo(g: THREE.BufferGeometry, matrix: THREE.Matrix4, color: number, uvScale = 0.5): void {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const base = this.pos.length / 3;
    this.nm.getNormalMatrix(matrix);
    this.color.setHex(color);
    for (let i = 0; i < p.count; i++) {
      this.tmpV.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.tmpN.fromBufferAttribute(n, i).applyMatrix3(this.nm).normalize();
      this.pos.push(this.tmpV.x, this.tmpV.y, this.tmpV.z);
      this.nor.push(this.tmpN.x, this.tmpN.y, this.tmpN.z);
      this.col.push(this.color.r, this.color.g, this.color.b);
      const ax = Math.abs(this.tmpN.x);
      const ay = Math.abs(this.tmpN.y);
      const az = Math.abs(this.tmpN.z);
      if (ay >= ax && ay >= az) this.uv.push(this.tmpV.x * uvScale, this.tmpV.z * uvScale);
      else if (ax >= az) this.uv.push(this.tmpV.z * uvScale, this.tmpV.y * uvScale);
      else this.uv.push(this.tmpV.x * uvScale, this.tmpV.y * uvScale);
    }
    const index = g.index;
    if (index) for (let i = 0; i < index.count; i++) this.idx.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }

  box(
    cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: number,
    rx = 0, ry = 0, rz = 0,
  ): void {
    this.euler.set(rx, ry, rz);
    this.quat.setFromEuler(this.euler);
    this.mat.compose(this.tmpV.set(cx, cy, cz), this.quat, this.tmpN.set(sx, sy, sz));
    this.addGeo(this.unitBox, this.mat, color);
  }

  /** A flat quad; winding is flipped so the face points away from `ref` when given. */
  quad(
    a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: number,
    ref?: THREE.Vector3, uvs?: number[],
  ): void {
    let pts = [a, b, c, d];
    let tex = uvs ?? [0, 0, 1, 0, 1, 1, 0, 1];
    const e1 = new THREE.Vector3().subVectors(b, a);
    const e2 = new THREE.Vector3().subVectors(c, a);
    const nrm = e1.cross(e2);
    if (ref) {
      const mid = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25).sub(ref);
      if (nrm.dot(mid) < 0) {
        pts = [d, c, b, a];
        tex = [tex[6], tex[7], tex[4], tex[5], tex[2], tex[3], tex[0], tex[1]];
      }
    }
    const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
    this.color.setHex(color);
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(pts[i].x, pts[i].y, pts[i].z);
      this.nor.push(n.x, n.y, n.z);
      this.col.push(this.color.r, this.color.g, this.color.b);
      this.uv.push(tex[i * 2], tex[i * 2 + 1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: number, ref?: THREE.Vector3): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    let p = [a, b, c];
    if (ref) {
      const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(ref);
      if (n.dot(mid) < 0) p = [a, c, b];
    }
    const nn = new THREE.Vector3().subVectors(p[1], p[0]).cross(new THREE.Vector3().subVectors(p[2], p[0])).normalize();
    this.color.setHex(color);
    const base = this.pos.length / 3;
    for (const v of p) {
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(nn.x, nn.y, nn.z);
      this.col.push(this.color.r, this.color.g, this.color.b);
      this.uv.push(v.x * 0.5, v.y * 0.5);
    }
    this.idx.push(base, base + 1, base + 2);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    this.unitBox.dispose();
    return g;
  }
}
