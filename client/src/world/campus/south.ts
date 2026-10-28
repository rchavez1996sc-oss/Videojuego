import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { cityHouse } from '../houses';
import type { Sign } from '../shopFront';
import { northAt, type CampusDef } from './layout';

/** The far side of Av. Venezuela: a continuous row of 2–4 storey brick and painted houses with shops, facing the campus. */
export function venezuelaSouth(b: Builder, hf: Heightfield, def: CampusDef, rand: () => number, sign: Sign): void {
  const v = def.venezuela, z = v.z + v.half + v.sidewalk + 0.15, X = def.bounds.x + 30;
  for (let x = -X; x < X; ) {
    const w = 6 + rand() * 4;
    cityHouse(b, { x: x + w / 2, z, y: hf.heightAt(x + w / 2, z), facing: Math.PI, w, d: 11, floors: 2 + Math.floor(rand() * 2.6) }, rand, sign);
    x += w;
  }
  b.box('none', [2 * X, 8, 0.5], new THREE.Vector3(0, 4, z + 0.6), new THREE.Quaternion(), true);
}

/** Av. Universitaria past the east fence (out of reach): carriageways, median, far sidewalk, lamp posts. */
export function universitaria(b: Builder, def: CampusDef): void {
  const u = def.universitaria;
  if (!u) return;
  const Q = new THREE.Quaternion(), z0 = northAt(def.bounds, def.bounds.x - 0.1) - 120, z1 = def.venezuela.z - def.venezuela.half, len = z1 - z0, zc = (z0 + z1) / 2;
  b.box('asphalt', [u.half * 2, 0.25, len], new THREE.Vector3(u.x, -0.07, zc), Q, false);
  b.box('kerbYellow', [1.4, 0.3, len], new THREE.Vector3(u.x, 0.15, zc), Q, false);
  for (const s of [-1, 1]) for (let z = z0; z < z1; z += 9) b.box('roadWhite', [0.13, 0.012, 4.5], new THREE.Vector3(u.x + s * u.half * 0.5, 0.062, z), Q, false);
  b.box('concrete', [4, 0.37, len], new THREE.Vector3(u.x + u.half + 2, 0.08, zc), Q, false);
  for (let z = z0 + 10; z < z1; z += 30) b.box('lampPole', [0.2, 9, 0.2], new THREE.Vector3(u.x + u.half + 1, 4.5, z), Q, false);
}
