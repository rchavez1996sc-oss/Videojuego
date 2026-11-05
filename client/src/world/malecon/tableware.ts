import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Builder } from '../buildingKit';

const Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
type Seat = { pos: THREE.Vector3; yaw: number; stay?: boolean };

const GLASS = new THREE.LatheGeometry([[0, 0], [0.032, 0.002], [0.034, 0.006], [0.005, 0.012], [0.004, 0.09], [0.03, 0.105], [0.036, 0.14], [0.034, 0.18]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
const BOTTLE = new THREE.LatheGeometry([[0, 0], [0.038, 0], [0.04, 0.02], [0.04, 0.2], [0.03, 0.24], [0.014, 0.27], [0.013, 0.33], [0, 0.33]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
const NAPKIN = new THREE.ConeGeometry(0.045, 0.13, 4).translate(0, 0.065, 0);
const PLATE = new THREE.CylinderGeometry(0.135, 0.11, 0.016, 20);
const LEG = new THREE.CylinderGeometry(0.018, 0.014, 0.38, 6);
const SEAT = new RoundedBoxGeometry(0.46, 0.05, 0.44, 2, 0.015);
const CUSHION = new RoundedBoxGeometry(0.42, 0.07, 0.4, 3, 0.03);

/** Places `geo` (copy) at local (x, y, z) rotated `a` in a frame at (ox, oy, oz) turned `turn`. */
function put(b: Builder, mat: string, geo: THREE.BufferGeometry, o: THREE.Vector3, turn: number, x: number, y: number, z: number, a = 0): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, turn), p = new THREE.Vector3(x, y, z).applyQuaternion(q).add(o);
  b.geometry(mat, geo, new THREE.Matrix4().compose(p, q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, a)), new THREE.Vector3(1, 1, 1)));
}

/** Bistro chair facing the table centre: turned legs, seat with orange cushion, curved top rail over three slats. */
function chair(b: Builder, at: THREE.Vector3, a: number): void {
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) put(b, 'chairGreen', LEG, at, a, x, 0.19, z);
  put(b, 'chairGreen', SEAT, at, a, 0, 0.405, 0);
  put(b, 'cushionOrange', CUSHION, at, a, 0, 0.45, -0.01);
  for (const x of [-0.19, 0.19]) put(b, 'chairGreen', new THREE.BoxGeometry(0.035, 0.5, 0.035).rotateX(-0.1), at, a, x, 0.67, 0.2);
  for (const x of [-0.08, 0, 0.08]) put(b, 'chairGreen', new THREE.BoxGeometry(0.03, 0.3, 0.015).rotateX(-0.1), at, a, x, 0.64, 0.21);
  put(b, 'chairGreen', new THREE.BoxGeometry(0.42, 0.06, 0.03).rotateX(-0.1), at, a, 0, 0.9, 0.23);
}

/**
 * Round restaurant table as in the photos: floor-length white cloth with a draped hem, a cover per chair (charger
 * plate, folded napkin, knife and fork, wine glass), a bottle, a candle and a bud vase; green bistro chairs round it.
 * About 55 % of the chairs go to `diners`, who stay seated through a gunfight (`stay`).
 */
export function diningTable(b: Builder, x: number, y: number, z: number, seats: number, turn: number, diners?: Seat[]): void {
  const o = new THREE.Vector3(x, y, z);
  b.geometry('linen', new THREE.CylinderGeometry(0.62, 0.7, 0.74, 28, 1, true).translate(0, 0.37, 0), new THREE.Matrix4().makeTranslation(x, y, z), { size: [1.2, 0.8, 1.2], pos: new THREE.Vector3(x, y + 0.4, z), quat: Q });
  const top = new THREE.CylinderGeometry(0.63, 0.63, 0.02, 28);
  put(b, 'linen', top, o, 0, 0, 0.745, 0);
  const hem = new THREE.TorusGeometry(0.66, 0.03, 4, 28).rotateX(Math.PI / 2);
  put(b, 'linen', hem, o, 0, 0, 0.03, 0);
  put(b, 'bottleGreen', BOTTLE, o, turn, 0.1, 0.755, 0.05);
  put(b, 'lampGold', new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), o, turn, -0.08, 0.85, -0.04);
  put(b, 'china', new THREE.CylinderGeometry(0.025, 0.035, 0.12, 8), o, turn, -0.02, 0.815, 0.12);
  put(b, 'cushionOrange', new THREE.SphereGeometry(0.035, 8, 6), o, turn, -0.02, 0.9, 0.12);
  for (let i = 0; i < seats; i++) {
    const a = turn + (i / seats) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
    const cx = x + s * 1.05, cz = z + c * 1.05;
    chair(b, new THREE.Vector3(cx, y, cz), a);
    put(b, 'china', PLATE, o, a, 0, 0.762, 0.42);
    put(b, 'china', new THREE.CylinderGeometry(0.09, 0.07, 0.012, 16), o, a, 0, 0.774, 0.42);
    put(b, 'linen', NAPKIN, o, a, 0, 0.78, 0.42);
    for (const sx of [-0.17, 0.17]) put(b, 'silver', new THREE.BoxGeometry(0.018, 0.006, 0.19), o, a, sx, 0.758, 0.42);
    put(b, 'glassClear', GLASS, o, a, 0.15, 0.755, 0.27);
    if (diners && Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5) % 1 < 0.55) diners.push({ pos: new THREE.Vector3(cx - s * 0.05, y, cz - c * 0.05), yaw: a + Math.PI, stay: true });
  }
}
