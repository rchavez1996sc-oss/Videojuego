import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { SignAtlas } from './signs';
import { sandbags, car } from './urbanProps';
import { furnishStation, stationArt } from './stationDecor';
import type { Lighting } from '../render/lighting';

export interface StationDef { x: number; z: number; w: number; d: number; facing: number }

/** Where the objective lives: the entrance (radar/marker), the lobby floor area and the arms cache. */
export interface StationInfo { entrance: THREE.Vector3; hall: { x0: number; x1: number; z0: number; z1: number; y: number }; cache: THREE.Vector3; art?: (lighting: Lighting) => THREE.Object3D }

const UP = new THREE.Vector3(0, 1, 0);
const T = 0.3, W = 32, FRONT = -6, H1 = 3.4, H2 = 3.0;

/**
 * Police station compound filling a half block: walled yard with a gate and sandbags, a two-storey station
 * with an open entrance and a walkable lobby holding the arms cache. Local +z faces the street.
 */
export function buildStation(b: Builder, hf: Heightfield, atlas: SignAtlas, def: StationDef, rand: () => number): StationInfo {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, def.facing);
  const y0 = hf.heightAt(def.x, def.z + Math.cos(def.facing) * -10);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(def.x, y0, def.z));
  const back = -def.d + 0.4, depth = FRONT - back, mid = (FRONT + back) / 2;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  const wall = (mat: string, len: number, h: number, x: number, y: number, z: number, rot: number, openings: { x: number; w: number; y: number; h: number }[] = []) =>
    b.wall(mat, len, h, T, at(x, y, z), def.facing + rot, openings);

  const half = def.w / 2 - 0.3;
  wall('concrete', half - 3.5, 1.5, -(half + 3.5) / 2, 0, -0.2, 0);
  wall('concrete', half - 3.5, 1.5, (half + 3.5) / 2, 0, -0.2, 0);
  for (const s of [-1, 1]) wall('concrete', def.d - 0.6, 1.5, s * half, 0, -def.d / 2, Math.PI / 2);
  for (const s of [-1, 1]) {
    sandbags(b, hf, at(s * 4.6, 0, -2.2).x, at(s * 4.6, 0, -2.2).z, def.facing, 3.2);
    sandbags(b, hf, at(s * 9, 0, -4.2).x, at(s * 9, 0, -4.2).z, def.facing + s * 0.4, 2.4);
  }

  box('concrete', [W, 0.2, depth], 0, 0.1, mid);
  const door = { x: 0, w: 2.8, y: 0, h: 2.8 }, wins = [-11, -6, 6, 11];
  const win = (x: number) => ({ x, w: 1.8, y: 1.1, h: 1.2 });
  wall('policeGreen', W, H1, 0, 0, FRONT - T / 2, 0, [door, ...wins.map(win)]);
  wall('policeGreen', W, H1, 0, 0, back + T / 2, Math.PI);
  for (const s of [-1, 1]) wall('policeGreen', depth - 2 * T, H1, s * (W / 2 - T / 2), 0, mid, s * Math.PI / 2, [{ x: 0, w: 1.6, y: 1.8, h: 0.8 }]);
  for (const x of wins) {
    box('glass', [1.8, 1.2, 0.05], x, 1.7, FRONT - T / 2, false);
    for (let i = 1; i < 12; i++) box('bars', [0.03, 1.2, 0.03], x - 0.9 + i * 0.15, 1.7, FRONT + 0.02, false);
  }
  box('concrete', [W + 0.2, 0.3, depth + 0.2], 0, H1 + 0.15, mid);
  for (const s of [-1, 1]) wall('paint-crema', depth - 2 * T, H2, s * (W / 2 - T / 2), H1 + 0.3, mid, s * Math.PI / 2);
  wall('paint-crema', W, H2, 0, H1 + 0.3, FRONT - T / 2, 0, [-11, -5.5, 5.5, 11].map((x) => ({ ...win(x), y: 0.9 })));
  wall('paint-crema', W, H2, 0, H1 + 0.3, back + T / 2, Math.PI);
  for (const x of [-11, -5.5, 5.5, 11]) box('glass', [1.8, 1.2, 0.05], x, H1 + 1.8, FRONT - T / 2, false);
  box('concrete', [W + 0.4, 0.3, depth + 0.4], 0, H1 + H2 + 0.45, mid);
  box('concrete', [W + 0.4, 0.6, 0.2], 0, H1 + H2 + 0.9, FRONT + 0.1);
  box('concrete', [3.6, 0.2, 1.6], 0, 2.95, FRONT + 0.8, false);
  atlas.add(at(0, H1 + 0.42, FRONT + 0.16), q, 5.6, 'station', rand);

  box('wood', [7, 1.1, 0.7], 0, 0.75, FRONT - 3.2);
  for (const x of [-12, -6, 0, 6, 12]) box('light', [1.4, 0.06, 0.3], x, H1 - 0.05, mid, false);
  for (let i = 0; i < 9; i++) {
    const x = -9 + (i % 5) * 4.2 + (rand() - 0.5) * 0.4, z = back + 1.3 + Math.floor(i / 5) * 1.4;
    box('armsCrate', [1.3, 0.62, 0.85], x, 0.51, z);
    if (rand() < 0.7) box('armsCrate', [1.3, 0.62, 0.85], x + (rand() - 0.5) * 0.2, 1.13, z);
  }
  for (let i = 0; i < 14; i++) {
    const x = -10 + i * 1.5;
    box('bars', [0.07, 1.05, 0.05], x, 0.85, back + 0.25, false);
    box('bars', [0.05, 0.08, 0.32], x, 0.95, back + 0.4, false);
  }

  furnishStation(b, at, q, back + T, rand);
  car(b, at(-18.7, 0, -9), def.facing + Math.PI / 2, 'car1', 'pickup');
  car(b, at(18.7, 0, -10), def.facing - Math.PI / 2, 'car5', 'sedan');
  box('bars', [0.12, 9, 0.12], -10.5, 4.5, -2.5);
  for (const [i, mat] of ['stripe', 'car5', 'stripe'].entries()) box(mat, [0.6, 1.2, 0.03], -10.1 + i * 0.6, 8.2, -2.5, false);

  const corners = [at(-W / 2 + T, 0, FRONT - T), at(W / 2 - T, 0, back + T)];
  return {
    entrance: at(0, 0, FRONT + 1),
    hall: { x0: Math.min(corners[0].x, corners[1].x), x1: Math.max(corners[0].x, corners[1].x), z0: Math.min(corners[0].z, corners[1].z), z1: Math.max(corners[0].z, corners[1].z), y: y0 },
    cache: at(0, 0, back + 2),
    art: (lighting) => stationArt(lighting, at, q, back + T),
  };
}
