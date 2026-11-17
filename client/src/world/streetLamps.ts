import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import { lampSpots } from '../render/nightLights';

const Q = new THREE.Quaternion();

/** Concrete street-lamp pole with a curved steel arm reaching over the road and a sodium head (Lima side streets). */
export function streetLamp(b: Builder, hf: Heightfield, x: number, z: number, toward: THREE.Vector3, h = 7): void {
  const y = hf.heightAt(x, z), d = toward.clone().setY(0).normalize();
  b.geometry('pole', new THREE.CylinderGeometry(0.1, 0.14, h, 8), new THREE.Matrix4().makeTranslation(x, y + h / 2 - 0.2, z),
    { size: [0.26, h, 0.26], pos: new THREE.Vector3(x, y + h / 2, z), quat: Q });
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  const tilt = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.25));
  b.box('bars', [0.06, 0.06, 1.6], new THREE.Vector3(x, y + h - 0.35, z).addScaledVector(d, 0.75), tilt, false);
  const head = new THREE.Vector3(x, y + h - 0.2, z).addScaledVector(d, 1.55);
  b.box('lampHead', [0.3, 0.12, 0.6], head, q, false);
  lampSpots.push(head.clone().setY(head.y - 0.1));
}

/**
 * Lighting for the barrio's side streets: lamps every ~22 m along each cross street (alternating sides), along the
 * streets between block rows and up the hill stairways, so the neighbourhood is not dark beyond the avenue.
 */
export function barrioLamps(b: Builder, hf: Heightfield, crossX: number[], rowStreets: number[], stairs: [number, number, number][], span: [number, number], streetHalf: number): void {
  crossX.forEach((cx, i) => {
    for (let z = -88, k = 0; z <= 88; z += 22, k++) {
      if (Math.abs(z) < 12 || rowStreets.some((r) => Math.abs(Math.abs(z) - Math.abs(r)) < 6)) continue;
      const s = (k + i) % 2 ? 1 : -1;
      streetLamp(b, hf, cx + s * (streetHalf + 0.3), z, new THREE.Vector3(-s, 0, 0));
    }
  });
  for (const rz of rowStreets) for (let x = span[0] + 6, k = 0; x < span[1]; x += 26, k++) {
    if (crossX.some((cx) => Math.abs(cx - x) < 6)) continue;
    const s = k % 2 ? 1 : -1;
    streetLamp(b, hf, x, rz + s * (streetHalf + 0.3), new THREE.Vector3(0, 0, -s));
  }
  for (const [x, z0, z1] of stairs) {
    const dir = Math.sign(z1 - z0);
    for (let z = z0 + dir * 8; dir * (z1 - z) > 4; z += dir * 18) streetLamp(b, hf, x + 2.4, z, new THREE.Vector3(-1, 0, 0), 5.5);
  }
}
