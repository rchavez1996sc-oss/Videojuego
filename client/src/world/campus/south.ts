import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { cityHouse } from '../houses';
import type { Sign } from '../shopFront';
import type { CampusDef } from './layout';

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

/** Estadio de San Marcos beyond the sector's north edge: yellow oval stands, a cantilevered roof on one side, floodlight masts. */
export function stadium(b: Builder, s: CampusDef['stadium']): void {
  const N = 56;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = new THREE.Vector2(Math.cos(a0) * s.rx, Math.sin(a0) * s.rz), p1 = new THREE.Vector2(Math.cos(a1) * s.rx, Math.sin(a1) * s.rz);
    const mid = p0.clone().lerp(p1, 0.5), len = p0.distanceTo(p1) + 0.4, yaw = Math.atan2(p1.x - p0.x, p1.y - p0.y) + Math.PI / 2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), tilt = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.5));
    const at = (r: number, y: number) => new THREE.Vector3(s.x + mid.x * r, y, s.z + mid.y * r);
    b.box('uniYellow', [len, 16, 1.2], at(1, 8), q, false);
    b.box('concrete', [len * 0.9, 0.6, 22], at(0.9, 6.5), tilt, false);
    if (Math.sin(am) > 0.55) b.box('roofWhite', [len, 0.5, 18], at(0.95, 22), q, false);
  }
  for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const p = new THREE.Vector3(s.x + cx * s.rx * 0.78, 0, s.z + cz * s.rz * 0.78);
    b.box('lampPole', [1, 42, 1], p.clone().setY(21), new THREE.Quaternion(), false);
    b.box('globe', [6, 3, 0.8], p.clone().setY(43), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-cx, -cz)), false);
  }
}

/** Av. Universitaria past the east fence (out of reach): carriageways, median, far sidewalk, lamp posts. */
export function universitaria(b: Builder, def: CampusDef): void {
  const u = def.universitaria;
  if (!u) return;
  const Q = new THREE.Quaternion(), z0 = def.bounds.north - 120, z1 = def.venezuela.z - def.venezuela.half, len = z1 - z0, zc = (z0 + z1) / 2;
  b.box('asphalt', [u.half * 2, 0.25, len], new THREE.Vector3(u.x, -0.07, zc), Q, false);
  b.box('kerbYellow', [1.4, 0.3, len], new THREE.Vector3(u.x, 0.15, zc), Q, false);
  for (const s of [-1, 1]) for (let z = z0; z < z1; z += 9) b.box('roadWhite', [0.13, 0.012, 4.5], new THREE.Vector3(u.x + s * u.half * 0.5, 0.062, z), Q, false);
  b.box('concrete', [4, 0.37, len], new THREE.Vector3(u.x + u.half + 2, 0.08, zc), Q, false);
  for (let z = z0 + 10; z < z1; z += 30) b.box('lampPole', [0.2, 9, 0.2], new THREE.Vector3(u.x + u.half + 1, 4.5, z), Q, false);
}
