import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import { FLOOR, wing, type Skin } from './pavilion';
import { helix } from './helix';

const SKIN: Skin = { kind: 'frame', wall: 'uniWhite', spandrel: 'uniYellow', base: 'uniWhite' };
/** Wing depth, gallery depth, storeys, where the helical stair stands (local). */
const T = 11, G = 2.6, LEVELS = 4, HX = 20.5, HZ = -2, HR = 3.4;

/**
 * Facultad de Química, courtyard block (from the user's photos): three white four-storey wings with yellow pilasters
 * round a garden courtyard open towards the front (granite) block; open galleries with steel railings on every floor
 * along the courtyard, yellow columns, and the yellow helical stair that climbs to them. Walkable: courtyard,
 * colonnade, galleries, stair. Returns spots for the students to shelter at.
 */
export function quimica(b: Builder, def: CampusBuilding, plants: Plants, rand: () => number): THREE.Vector3[] {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, D = def.d / 2, H = LEVELS * FLOOR, inU = W - T, inV = -D + T;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const core = T - G;
  wing(b, at, q, 0, -D + core / 2, def.w, core, LEVELS, SKIN, rand);
  for (const s of [-1, 1]) wing(b, at, q, s * (W - core / 2), (inV - G + D) / 2, core, D - (inV - G), LEVELS, SKIN, rand);
  for (let u = -W + 3; u < W - 2; u += 6) box('uniYellow', [0.7, H + 0.3, 0.3], u, H / 2, -D - 0.1);
  for (const s of [-1, 1]) for (let v = -D + 3; v < D - 2; v += 6) box('uniYellow', [0.3, H + 0.3, 0.7], s * (W + 0.1), H / 2, v);
  box('uniYellow', [4.2, 4.5, 4.2], -12, H + 2.2, -D + core / 2);

  const rail = (u0: number, v0: number, u1: number, v1: number, y: number) => {
    const len = Math.hypot(u1 - u0, v1 - v0), alongU = Math.abs(u1 - u0) > Math.abs(v1 - v0), um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
    const sz = (l: number, h: number, t: number): [number, number, number] => (alongU ? [l, h, t] : [t, h, l]);
    box('alu', sz(len, 0.06, 0.06), um, y + 1.02, vm);
    box('alu', sz(len, 0.04, 0.04), um, y + 0.55, vm);
    for (let k = 0; k <= Math.round(len / 1.4); k++) {
      const f = k / Math.max(1, Math.round(len / 1.4));
      box('alu', [0.05, 1.0, 0.05], u0 + (u1 - u0) * f, y + 0.5, v0 + (v1 - v0) * f);
    }
    box('none', sz(len, 1.15, 0.12), um, y + 0.57, vm, true);
  };
  for (let k = 1; k <= LEVELS; k++) {
    const y = k * FLOOR, top = k === LEVELS;
    box(top ? 'uniCream' : 'tileCream', [2 * (W - core), 0.25, G], 0, y - 0.125, inV - G / 2, true);
    for (const s of [-1, 1]) box(top ? 'uniCream' : 'tileCream', [G, 0.25, D - inV + G], s * (inU + G / 2), y - 0.125, (inV - G + D) / 2, true);
    if (top) continue;
    rail(-inU, inV, inU, inV, y);
    rail(-inU, inV, -inU, D, y);
    rail(inU, inV, inU, HZ - 1.3, y);
    rail(inU, HZ + 1.3, inU, D, y);
    for (const s of [-1, 1]) rail(s * inU, D, s * (inU + G), D, y);
    box('tileCream', [inU - HX - HR + 0.4, 0.25, 2.5], (inU + HX + HR) / 2, y - 0.125, HZ, true);
    for (const z of [HZ - 1.25, HZ + 1.25]) rail(HX + HR - 0.1, z, inU, z, y);
  }
  for (let u = -inU; u <= inU + 0.1; u += (2 * inU) / 10) box('uniYellow', [0.55, H, 0.55], u, H / 2, inV, true);
  for (const s of [-1, 1]) for (let v = inV + 5.2; v < D; v += 5.2) if (Math.abs(v - HZ) > 1.6) box('uniYellow', [0.55, H, 0.55], s * inU, H / 2, v, true);
  helix(b, at, q, HX, HZ, HR, FLOOR, LEVELS - 1);

  box('pavers', [2 * (W - core), 0.1, D - inV + G], 0, 0.05, (inV - G + D) / 2);
  box('lawnBed', [2 * inU - 16, 0.12, D - inV - 9], -3, 0.08, (inV + D) / 2 + 1);
  for (let i = 0; i < 7; i++) (i % 3 ? plants.trees : plants.palms).push(at(-inU + 6 + rand() * (2 * inU - 22), 0, inV + 5 + rand() * (D - inV - 12)));
  const spots: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) spots.push(at(-inU + 3 + i * 7, 0.1, inV + 1.5));
  for (let k = 1; k < LEVELS; k++) for (const s of [-1, 1]) for (const v of [4, 14]) spots.push(at(s * (inU + G / 2), k * FLOOR + 0.05, v));
  return spots;
}

/** True on the walkable ground of the courtyard block (garden, colonnade), so the street graph may enter it. */
export function quimicaOpen(def: CampusBuilding, x: number, z: number): boolean {
  const a = (def.yaw * Math.PI) / 180, dx = x - def.x, dz = z - def.z, u = dx * Math.cos(a) + dz * Math.sin(a), v = -dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) < def.w / 2 - T + G && v > -def.d / 2 + T - G;
}
