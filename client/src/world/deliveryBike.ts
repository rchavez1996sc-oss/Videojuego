import * as THREE from 'three';
import type { Builder } from './buildingKit';
import { wheel } from './urbanProps';

/** Food-delivery motorcycle (+z forward): frame, tank, seat, bars, lamp and the courier's thermal box. Rider seat at y 0.88. */
export function deliveryBike(b: Builder, brand: number): void {
  const q = new THREE.Quaternion();
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, tilt = 0) =>
    b.box(mat, size, at(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt), false);
  for (const z of [0.66, -0.64]) wheel(b, at, q, 0, z, 0.3, 0.11);
  box('car1', [0.24, 0.3, 0.95], 0, 0.55, 0);
  box(`deliv${brand}`, [0.3, 0.2, 0.42], 0, 0.82, 0.28);
  box('seat', [0.28, 0.1, 0.62], 0, 0.84, -0.18);
  box('rim', [0.05, 0.75, 0.05], 0, 0.62, 0.6, -0.35);
  box('rim', [0.66, 0.035, 0.035], 0, 1.0, 0.48);
  box('light', [0.16, 0.12, 0.08], 0, 0.92, 0.66);
  box('tail', [0.12, 0.05, 0.04], 0, 0.78, -0.72);
  box('rim', [0.07, 0.07, 0.5], 0.17, 0.42, -0.35);
  box(`deliv${brand}`, [0.5, 0.42, 0.46], 0, 1.18, -0.58);
  box('plastic', [0.52, 0.06, 0.48], 0, 1.41, -0.58);
  box('plastic', [0.06, 0.3, 0.06], 0, 0.95, -0.4);
}
