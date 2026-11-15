import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { bike } from '../campus/quimicaEntry';

const UP = new THREE.Vector3(0, 1, 0), FRAMES = ['barrierRed', 'benchGreen', 'alu', 'lampBlue', 'chairGreen'];

/**
 * A street bike rack as on Av. Larco and the berma (Street View, Miraflores 2025): a row of red-orange steel hoops
 * set in the paving, with a few bicycles locked to it. `at` is the middle of the row, which runs along `yaw`.
 */
export function bikeRack(b: Builder, at: THREE.Vector3, yaw: number, rand: () => number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw), place = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(at);
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.85;
    b.geometry('barrierRed', new THREE.TorusGeometry(0.38, 0.03, 8, 20, Math.PI), new THREE.Matrix4().compose(place(x, 0.32, 0), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
    for (const z of [-0.38, 0.38]) b.box('barrierRed', [0.06, 0.34, 0.06], place(x, 0.17, z), q, false);
    if (rand() < 0.6) bike(b, place, q, x + 0.12, 0, FRAMES[Math.floor(rand() * FRAMES.length)], 'fenceIron');
  }
  b.box('none', [n * 0.85, 1, 1.4], at.clone().setY(at.y + 0.5), q, true);
}
