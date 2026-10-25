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

/** Estadio de San Marcos past the sector's north edge (from the user's photo): an open bowl of grey terraces striped in
 * yellow and red seats rising from a red running track round a green pitch, a press box on one side, floodlight masts. */
export function stadium(b: Builder, s: CampusDef['stadium']): void {
  const N = 64, rows = 9, Q = new THREE.Quaternion();
  b.box('lawnBed', [s.rx * 1.1, 0.1, s.rz * 1.0], new THREE.Vector3(s.x, 0.05, s.z), Q, false);
  b.box('trackRed', [s.rx * 1.38, 0.08, s.rz * 1.3], new THREE.Vector3(s.x, 0.03, s.z), Q, false);
  b.box('lawnBed', [s.rx * 0.9, 0.12, s.rz * 0.8], new THREE.Vector3(s.x, 0.07, s.z), Q, false);
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
    const yaw = Math.atan2(Math.cos(am) * s.rz, -Math.sin(am) * s.rx), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    for (let r = 0; r < rows; r++) {
      const k = 0.75 + r * 0.045, len = Math.hypot(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)) * s.rx * k + 0.6;
      const at = new THREE.Vector3(s.x + Math.cos(am) * s.rx * k, 0.8 + r * 1.1, s.z + Math.sin(am) * s.rz * k);
      b.box('concrete', [len, 0.8 + r * 1.1 + 0.4, 4.5], at.clone().setY((0.8 + r * 1.1) / 2), q, false);
      const band = Math.floor((am / (Math.PI * 2)) * 10 + r * 0.3) % 3;
      b.box(band === 0 ? 'uniYellow' : band === 1 ? 'uniRed' : 'uniGrey', [len - 0.2, 0.25, 1.4], at.clone().setY(at.y + 0.55), q, false);
    }
  }
  b.box('uniGrey', [26, 6, 8], new THREE.Vector3(s.x, 3, s.z + s.rz * 1.22), Q, false);
  b.box('alu', [27, 0.3, 9], new THREE.Vector3(s.x, 6.2, s.z + s.rz * 1.22), Q, false);
  for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const p = new THREE.Vector3(s.x + cx * s.rx * 1.25, 0, s.z + cz * s.rz * 1.25);
    b.box('lampPole', [0.8, 42, 0.8], p.clone().setY(21), Q, false);
    b.box('globe', [5, 3, 0.6], p.clone().setY(43), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-cx, -cz)), false);
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
