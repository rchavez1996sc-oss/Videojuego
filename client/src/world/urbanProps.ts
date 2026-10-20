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

/** Parked three-wheeled mototaxi: rough box body, canopy and wheels. Acts as low cover. */
export function mototaxi(b: Builder, pos: THREE.Vector3, yaw: number, paint: string): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(pos);
  b.box(paint, [1.25, 0.55, 1.4], at(0, 0.6, -0.35), q, false);
  b.box(paint, [0.5, 0.6, 0.9], at(0, 0.75, 0.75), q, false);
  b.box('bars', [0.05, 0.9, 0.05], at(0, 1.3, 1.0), q, false);
  b.box('bars', [0.7, 0.05, 0.05], at(0, 1.55, 1.0), q, false);
  b.box('canopy', [1.3, 0.06, 2.1], at(0, 1.85, -0.05), q, false);
  for (const [x, z] of [[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.35], [0.6, 0.35]]) b.box('bars', [0.04, 1.0, 0.04], at(x, 1.35, z), q, false);
  b.box('seat', [1.1, 0.25, 0.5], at(0, 1.0, -0.7), q, false);
  for (const [x, z] of [[-0.62, -0.7], [0.62, -0.7], [0, 1.15]]) {
    b.geometry('tire', new THREE.CylinderGeometry(0.25, 0.25, 0.14, 12).rotateZ(Math.PI / 2), new THREE.Matrix4().compose(at(x, 0.25, z), q, new THREE.Vector3(1, 1, 1)));
  }
  b.box('none', [1.3, 1.2, 2.3], at(0, 0.6, 0), q, true);
}

/** Sandbag wall section used for GNO checkpoints. */
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

/** Parked car built from boxes: body, glazed cabin, bumpers, lights and wheels; full-size box collider for cover. */
export function car(b: Builder, pos: THREE.Vector3, yaw: number, paint: string, kind: CarKind): void {
  const d = CAR_DIMS[kind];
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(pos);
  const y0 = 0.3;
  b.box(paint, [d.w, d.body, d.l], at(0, y0 + d.body / 2, 0), q, false);
  b.box('glass', [d.w - 0.12, d.cabin, d.cabinL], at(0, y0 + d.body + d.cabin / 2, d.cabinZ), q, false);
  b.box(paint, [d.w - 0.08, 0.07, d.cabinL - 0.15], at(0, y0 + d.body + d.cabin, d.cabinZ), q, false);
  for (const s of [1, -1]) b.box(paint, [0.07, d.cabin, 0.12], at(s * (d.w / 2 - 0.08), y0 + d.body + d.cabin / 2, d.cabinZ + d.cabinL / 2 - 0.08), q, false);
  if (kind === 'pickup') for (const s of [1, -1]) b.box(paint, [0.08, 0.4, 2.0], at(s * (d.w / 2 - 0.04), y0 + d.body + 0.2, -1.4), q, false);
  if (kind === 'combi') b.box('stripe', [d.w + 0.01, 0.18, d.l - 0.4], at(0, y0 + d.body * 0.55, 0), q, false);
  if (kind === 'tico') b.box('checker', [0.5, 0.15, 0.25], at(0, y0 + d.body + d.cabin + 0.1, d.cabinZ), q, false);
  for (const s of [1, -1]) {
    b.box('tire', [d.w + 0.02, 0.18, 0.12], at(0, y0 + 0.12, s * (d.l / 2 + 0.02)), q, false);
    for (const x of [-1, 1]) b.box('light', [0.28, 0.12, 0.04], at(x * (d.w / 2 - 0.25), y0 + d.body - 0.15, s * (d.l / 2 + 0.03)), q, false);
  }
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    b.geometry('tire', new THREE.CylinderGeometry(0.31, 0.31, 0.2, 14).rotateZ(Math.PI / 2), new THREE.Matrix4().compose(at(x * (d.w / 2 - 0.12), 0.31, z * (d.l / 2 - 0.75)), q, new THREE.Vector3(1, 1, 1)));
  }
  b.box('none', [d.w, y0 + d.body + d.cabin, d.l], at(0, (y0 + d.body + d.cabin) / 2, 0), q, true);
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
