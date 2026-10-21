import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';

const UP = new THREE.Vector3(0, 1, 0);

/** Wooden/concrete poles with sagging cables between consecutive poles (catenary-ish curves). */
export function powerLine(b: Builder, hf: Heightfield, points: THREE.Vector3[], rand: () => number): void {
  const tops: THREE.Vector3[] = [];
  for (const p of points) {
    const y = hf.heightAt(p.x, p.z);
    const h = 7.5 + rand() * 1.2;
    b.geometry('pole', new THREE.CylinderGeometry(0.11, 0.15, h, 8), new THREE.Matrix4().makeTranslation(p.x, y + h / 2 - 0.2, p.z),
      { size: [0.28, h, 0.28], pos: new THREE.Vector3(p.x, y + h / 2, p.z), quat: new THREE.Quaternion() });
    b.box('pole', [1.4, 0.1, 0.1], new THREE.Vector3(p.x, y + h - 0.6, p.z), new THREE.Quaternion().setFromAxisAngle(UP, rand() * 0.2 + Math.PI / 2), false);
    const arm = -Math.sign(p.z || 1);
    b.box('bars', [0.06, 0.06, 1.6], new THREE.Vector3(p.x, y + h - 1.6, p.z + arm * 0.8), new THREE.Quaternion(), false);
    b.box('lampHead', [0.3, 0.12, 0.55], new THREE.Vector3(p.x, y + h - 1.68, p.z + arm * 1.55), new THREE.Quaternion(), false);
    tops.push(new THREE.Vector3(p.x, y + h - 0.55, p.z));
  }
  for (let i = 0; i < tops.length - 1; i++) {
    for (const off of [-0.6, -0.2, 0.25, 0.6]) {
      const a = tops[i].clone().add(new THREE.Vector3(0, 0, off)), c = tops[i + 1].clone().add(new THREE.Vector3(0, 0, off));
      cable(b, a, c, 0.6 + rand() * 0.9);
    }
  }
}

export function cable(b: Builder, a: THREE.Vector3, c: THREE.Vector3, sag: number): void {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    pts.push(a.clone().lerp(c, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
  }
  b.geometry('cable', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.012, 4), new THREE.Matrix4());
}

/** Side profile (length along x, height along y) extruded across the vehicle width and laid along local z. */
function profile(points: [number, number][], width: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y))), { depth: width, bevelEnabled: false });
  return g.translate(0, 0, -width / 2).rotateY(-Math.PI / 2);
}

function wheel(b: Builder, at: (x: number, y: number, z: number) => THREE.Vector3, q: THREE.Quaternion, x: number, z: number, r: number, w: number): void {
  const m = new THREE.Matrix4().compose(at(x, r, z), q, new THREE.Vector3(1, 1, 1));
  b.geometry('tire', new THREE.CylinderGeometry(r, r, w, 16).rotateZ(Math.PI / 2), m);
  b.geometry('rim', new THREE.CylinderGeometry(r * 0.58, r * 0.58, w + 0.02, 10).rotateZ(Math.PI / 2), m);
}

/** Parked three-wheeled mototaxi: motorcycle front (fork, tank, bars, lamp) and a covered passenger cab. Acts as low cover. */
export function mototaxi(b: Builder, pos: THREE.Vector3, yaw: number, paint: string): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(pos);
  const g = (mat: string, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0) => b.geometry(mat, geo, new THREE.Matrix4().compose(at(x, y, z), q, new THREE.Vector3(1, 1, 1)));
  g(paint, profile([[-1.0, 0.32], [0.15, 0.32], [0.25, 0.55], [0.25, 1.0], [-1.0, 1.0]], 1.24));
  g('plastic', profile([[-1.08, 0.3], [0.25, 0.3], [0.25, 0.42], [-1.08, 0.42]], 1.28));
  g(paint, profile([[-1.12, 1.95], [0.55, 1.95], [0.95, 1.8], [1.0, 1.87], [0.58, 2.05], [-1.12, 2.05]], 1.3));
  for (const [x, z] of [[-0.6, -0.95], [0.6, -0.95], [-0.6, 0.2], [0.6, 0.2]]) b.box('bars', [0.04, 0.96, 0.04], at(x, 1.47, z), q, false);
  b.box('glass', [0.9, 0.6, 0.03], at(0, 1.5, 0.9), q, false);
  b.box('bars', [0.04, 0.85, 0.04], at(-0.44, 1.5, 0.9), q, false);
  b.box('bars', [0.04, 0.85, 0.04], at(0.44, 1.5, 0.9), q, false);
  b.box('seat', [1.05, 0.18, 0.5], at(0, 0.9, -0.6), q, false);
  b.box('seat', [1.05, 0.55, 0.12], at(0, 1.2, -0.88), q, false);
  b.box('plate', [0.32, 0.16, 0.02], at(0, 0.55, -1.02), q, false);
  for (const s of [-1, 1]) b.box('tail', [0.12, 0.08, 0.03], at(s * 0.5, 0.78, -1.02), q, false);
  g(paint, new THREE.CylinderGeometry(0.17, 0.21, 0.5, 10).rotateX(Math.PI / 2), 0, 0.82, 0.62);
  b.box('seat', [0.26, 0.1, 0.45], at(0, 0.98, 0.3), q, false);
  b.box('bars', [0.05, 0.75, 0.05], at(0, 0.62, 1.12), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.35).premultiply(q), false);
  b.box('bars', [0.7, 0.04, 0.04], at(0, 1.08, 1.0), q, false);
  b.box('light', [0.16, 0.14, 0.06], at(0, 0.95, 1.16), q, false);
  b.box(paint, [0.22, 0.05, 0.4], at(0, 0.56, 1.2), q, false);
  for (const s of [-1, 1]) {
    b.box('canopy', [0.02, 0.7, 0.95], at(s * 0.64, 1.45, -0.45), q, false);
    b.box('stripe', [0.015, 0.08, 1.15], at(s * 0.625, 0.75, -0.42), q, false);
    b.box(paint, [0.2, 0.04, 0.5], at(s * 0.62, 0.55, -0.62), q, false);
  }
  b.geometry('rim', new THREE.CylinderGeometry(0.035, 0.04, 0.55, 8).rotateX(Math.PI / 2), new THREE.Matrix4().compose(at(0.22, 0.32, 0.2), q, new THREE.Vector3(1, 1, 1)));
  wheel(b, at, q, -0.62, -0.62, 0.25, 0.13);
  wheel(b, at, q, 0.62, -0.62, 0.25, 0.13);
  wheel(b, at, q, 0, 1.2, 0.25, 0.11);
  b.box('none', [1.3, 1.2, 2.3], at(0, 0.6, 0), q, true);
}

/** Sandbag wall section used for PNP checkpoints. */
export function sandbags(b: Builder, hf: Heightfield, x: number, z: number, yaw: number, len: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const y = hf.heightAt(x, z);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < Math.round(len / 0.55); i++) {
      const lx = -len / 2 + (i + 0.5 + (row % 2) * 0.5) * 0.55;
      if (lx > len / 2) continue;
      const p = new THREE.Vector3(lx, y + 0.13 + row * 0.24, 0).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
      b.geometry('sandbag', new THREE.CapsuleGeometry(0.13, 0.32, 3, 8).rotateZ(Math.PI / 2).scale(1, 0.85, 1.3), new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
    }
  }
  b.box('none', [len, 0.75, 0.45], new THREE.Vector3(x, y + 0.37, z), q, true);
}

/** Concrete stairway climbing the hill with painted step edges and a pipe handrail. */
export function stairway(b: Builder, hf: Heightfield, x: number, z0: number, z1: number): void {
  const dir = Math.sign(z1 - z0), q = new THREE.Quaternion();
  let prevTop = hf.heightAt(x, z0);
  for (let z = z0; dir * (z1 - z) > 0; z += dir * 0.32) {
    const ground = hf.heightAt(x, z);
    const top = Math.max(ground + 0.05, Math.min(prevTop + 0.38, ground + 0.6));
    const base = Math.min(ground, prevTop) - 0.6;
    b.box('concrete', [1.8, top - base, 0.34], new THREE.Vector3(x, (top + base) / 2, z), q);
    b.box('paintYellow', [1.8, 0.03, 0.06], new THREE.Vector3(x, top + 0.005, z - dir * 0.14), q, false);
    if (Math.round(z * 3) % 6 === 0) b.box('bars', [0.05, 0.95, 0.05], new THREE.Vector3(x + 1.0, top + 0.47, z), q, false);
    prevTop = top;
  }
}

export type CarKind = 'sedan' | 'tico' | 'wagon' | 'pickup' | 'combi';

const CAR_DIMS: Record<CarKind, { l: number; w: number; body: number; cabin: number; cabinL: number; cabinZ: number }> = {
  sedan: { l: 4.3, w: 1.7, body: 0.65, cabin: 0.55, cabinL: 2.2, cabinZ: -0.15 },
  tico: { l: 3.3, w: 1.5, body: 0.6, cabin: 0.6, cabinL: 1.9, cabinZ: -0.2 },
  wagon: { l: 4.5, w: 1.72, body: 0.68, cabin: 0.58, cabinL: 3.0, cabinZ: -0.55 },
  pickup: { l: 5.0, w: 1.78, body: 0.75, cabin: 0.65, cabinL: 1.6, cabinZ: 0.6 },
  combi: { l: 4.8, w: 1.8, body: 1.0, cabin: 0.85, cabinL: 4.4, cabinZ: -0.15 },
};

/** Side silhouettes: [length, height] pairs from the rear bumper forward (y measured from the ground). */
const SHAPES: Record<CarKind, [number, number][]> = {
  sedan: [[-2.15, 0.38], [2.15, 0.38], [2.17, 0.72], [1.15, 0.86], [0.55, 1.36], [-0.75, 1.38], [-1.45, 0.92], [-2.15, 0.88]],
  tico: [[-1.65, 0.36], [1.65, 0.36], [1.67, 0.72], [1.0, 0.86], [0.55, 1.4], [-1.45, 1.42], [-1.65, 0.9]],
  wagon: [[-2.25, 0.38], [2.25, 0.38], [2.27, 0.74], [1.25, 0.9], [0.65, 1.42], [-2.15, 1.44], [-2.25, 0.92]],
  pickup: [[-2.5, 0.42], [2.5, 0.42], [2.52, 0.86], [1.55, 1.0], [1.05, 1.58], [-0.25, 1.6], [-0.3, 1.0], [-2.5, 1.0]],
  combi: [[-2.4, 0.4], [2.4, 0.4], [2.42, 1.0], [2.2, 1.95], [-2.35, 2.0], [-2.4, 1.2]],
};

/** Glass band per silhouette: belt line up to just proud of the roof and pillars, so windscreens read over the paint. */
const GLASS: Record<CarKind, [number, number][]> = {
  sedan: [[-1.48, 0.9], [1.19, 0.9], [0.57, 1.39], [-0.78, 1.41]],
  tico: [[-1.68, 0.9], [1.04, 0.9], [0.57, 1.43], [-1.48, 1.45]],
  wagon: [[-2.28, 0.93], [1.29, 0.93], [0.67, 1.45], [-2.18, 1.47]],
  pickup: [[-0.33, 1.03], [1.59, 1.03], [1.07, 1.61], [-0.28, 1.63]],
  combi: [[-2.35, 1.25], [2.24, 1.25], [2.22, 1.88], [-2.35, 1.9]],
};

/** Parked car: extruded body silhouette with glass band, wheels with rims, bumpers, lamps and plates; box collider for cover. */
export function car(b: Builder, pos: THREE.Vector3, yaw: number, paint: string, kind: CarKind): void {
  const d = CAR_DIMS[kind], shape = SHAPES[kind];
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(pos);
  const g = (mat: string, geo: THREE.BufferGeometry) => b.geometry(mat, geo, new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
  const belt = kind === 'combi' ? 1.2 : kind === 'pickup' ? 1.02 : 0.88;
  g(paint, profile(shape.map(([z, y]) => [z, Math.min(y, belt)] as [number, number]), d.w));
  const glass = GLASS[kind];
  g('glass', profile(glass, d.w + 0.02));
  const roofZ = [glass[2][0], glass[3][0]], midZ = (roofZ[0] + roofZ[1]) / 2, topY = Math.max(...shape.map(([, y]) => y));
  b.box(paint, [d.w - 0.06, 0.06, Math.abs(roofZ[0] - roofZ[1]) + 0.04], at(0, Math.max(glass[2][1], glass[3][1]) + 0.02, midZ), q, false);
  if (kind !== 'combi') b.box(paint, [d.w + 0.03, topY - belt - 0.05, 0.1], at(0, (topY + belt) / 2, midZ), q, false);
  if (kind === 'pickup') for (const s of [1, -1]) b.box(paint, [0.07, 0.35, 2.15], at(s * (d.w / 2 - 0.035), 1.17, -1.4), q, false);
  if (kind === 'combi') b.box('stripe', [d.w + 0.02, 0.16, d.l - 0.5], at(0, 0.8, 0), q, false);
  if (kind === 'tico') b.box('checker', [0.5, 0.15, 0.25], at(0, topY + 0.08, midZ), q, false);
  const zf = d.l / 2, wheelZ = d.l / 2 - (kind === 'tico' ? 0.6 : 0.8);
  for (const s of [1, -1]) {
    b.box('plastic', [d.w + 0.04, 0.2, 0.16], at(0, 0.45, s * (zf + 0.02)), q, false);
    b.box('plate', [0.42, 0.13, 0.02], at(0, 0.46, s * (zf + 0.11)), q, false);
    for (const x of [-1, 1]) b.box(s > 0 ? 'light' : 'tail', [0.3, 0.13, 0.05], at(x * (d.w / 2 - 0.24), s > 0 ? 0.68 : 0.78, s * (zf + 0.01)), q, false);
    b.box('plastic', [0.07, 0.1, 0.16], at(s * (d.w / 2 + 0.05), belt + 0.08, glass[1][0] - 0.15), q, false);
  }
  b.box('plastic', [d.w * 0.5, 0.16, 0.03], at(0, 0.62, zf + 0.01), q, false);
  const door = glass[1][0] - 0.35, rear = (glass[0][0] + midZ) / 2;
  for (const s of [-1, 1]) {
    for (const z of kind === 'combi' ? [door] : [door, midZ - 0.05]) b.box('plastic', [0.012, belt - 0.42, 0.02], at(s * (d.w / 2 + 0.002), (belt + 0.42) / 2, z), q, false);
    for (const z of kind === 'combi' || kind === 'pickup' ? [door - 0.25] : [door - 0.25, rear]) b.box('rim', [0.02, 0.035, 0.14], at(s * (d.w / 2 + 0.01), belt - 0.1, z), q, false);
    b.box('plastic', [0.04, 0.28, 0.02], at(s * (d.w / 2 - 0.12), 0.32, -wheelZ - 0.42), q, false);
  }
  b.box('bars', [0.012, 0.7, 0.012], at(d.w / 2 - 0.2, topY + 0.35, glass[3][0] + 0.15), q, false);
  if (kind === 'combi') for (const x of [-0.6, 0.6]) b.box('bars', [0.04, 0.04, d.l - 1.2], at(x, topY + 0.12, -0.2), q, false);
  if (kind === 'combi') for (const z of [-1.6, -0.4, 0.8]) b.box('bars', [1.24, 0.04, 0.04], at(0, topY + 0.14, z), q, false);
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    b.box('plastic', [0.06, 0.12, 0.8], at(x * (d.w / 2 + 0.005), 0.66, z * wheelZ), q, false);
    wheel(b, at, q, x * (d.w / 2 - 0.13), z * wheelZ, 0.31, 0.21);
  }
  b.box('none', [d.w, topY - 0.1, d.l], at(0, (topY + 0.1) / 2, 0), q, true);
}

/** Two-post billboard; returns the panel centre and orientation so the caller can paint a poster on it. */
export function billboard(b: Builder, hf: Heightfield, x: number, z: number, yaw: number): { pos: THREE.Vector3; q: THREE.Quaternion } {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const y = hf.heightAt(x, z);
  const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
  for (const s of [-1, 1]) {
    b.geometry('bars', new THREE.CylinderGeometry(0.1, 0.12, 6, 8), new THREE.Matrix4().compose(at(s * 2.6, 3, -0.15), q, new THREE.Vector3(1, 1, 1)),
      { size: [0.25, 6, 0.25], pos: at(s * 2.6, 3, -0.15), quat: q });
  }
  b.box('bars', [8.3, 2.3, 0.12], at(0, 5.1, -0.1), q);
  b.box('bars', [8.3, 0.08, 0.6], at(0, 3.9, 0.15), q, false);
  return { pos: at(0, 5.1, -0.02), q };
}
