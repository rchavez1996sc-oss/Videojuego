import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { ravineCentre, ravineFloor, type CoastDef } from '../coast';
import type { Plants } from '../malecon/park';
import { casona } from './casona';
import { mulberry32 } from '../../core/rng';
import type { BarrancoDef } from './layout';

type Ravine = NonNullable<CoastDef['ravines']>[number];
export interface HouseSpan { z0: number; z1: number; s: number }

/** Box from a to c, `w` wide and `h` tall, aligned with the line between them. */
export function run(b: Builder, mat: string, a: THREE.Vector3, c: THREE.Vector3, w: number, h: number, collide = true): void {
  const d = c.clone().sub(a), len = d.length();
  b.box(mat, [w, h, len + 0.05], a.clone().lerp(c, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), collide);
}

/**
 * Street View (2013) of the middle stretch: the lane runs between houses built into the banks — painted casonas of one
 * or two storeys whose steps come down onto the pavers, a restaurant terrace here and there. Places them on both sides
 * between the bridge and the knee of the ravine, clear of the stairways and the painted vault; returns their spans.
 */
export function laneHouses(b: Builder, c: CoastDef, r: Ravine, def: BarrancoDef, from: number, to: number, keepOut: number[]): HouseSpan[] {
  const rand = mulberry32(def.seed + 404), half = (r.floorHalf ?? 4) - 0.2, spans: HouseSpan[] = [];
  for (const s of [-1, 1]) {
    let z = from + rand() * 4;
    while (z < to) {
      const w = 7.5 + rand() * 3.5, zc = z + w / 2;
      if (zc + w / 2 > to) break;
      if (keepOut.some((k) => Math.abs(k - zc) < w / 2 + 3) || rand() < 0.18) {
        z += 3 + rand() * 3;
        continue;
      }
      const slope = ravineCentre(r, zc + 1) - ravineCentre(r, zc), fx = ravineCentre(r, zc) + s * (half + 0.45);
      casona(b, { x: fx, z: zc, y: ravineFloor(c, r, zc) + 0.06, facing: Math.atan2(-s, s * slope), w, d: 7, floors: rand() < 0.55 ? 1 : 2 }, rand);
      spans.push({ z0: z - 1, z1: z + w + 1, s });
      z += w + 1 + rand() * 2.5;
    }
  }
  return spans;
}

/**
 * Where no house fronts the lane: a low concrete kerb, a bed of soil with clipped shrubs, red-flowered bushes, an agave
 * and now and then a tree with a whitewashed trunk, backed by a river-stone (canto rodado) retaining wall.
 */
export function laneEdge(b: Builder, c: CoastDef, r: Ravine, z: number, zn: number, s: number, i: number, plants: Plants): void {
  const half = (r.floorHalf ?? 4) - 0.2, f = ravineFloor(c, r, z), fn = ravineFloor(c, r, zn);
  const P = (zz: number, o: number, y: number) => new THREE.Vector3(ravineCentre(r, zz) + s * o, y, zz);
  run(b, 'stairStone', P(z, half - 0.9, f + 0.1), P(zn, half - 0.9, fn + 0.1), 0.16, 0.2);
  run(b, 'soilBed', P(z, half - 0.15, f + 0.07), P(zn, half - 0.15, fn + 0.07), 1.35, 0.16, false);
  run(b, 'pirca', P(z, half + 0.75, f + 0.45), P(zn, half + 0.75, fn + 0.45), 0.7, 1.9);
  const g = mulberry32(i * 31 + (s > 0 ? 7 : 3));
  for (let k = 0; k < 3; k++) {
    const t = (k + 0.3 + g() * 0.4) / 3, zz = z + (zn - z) * t, p = P(zz, half - 0.2 + (g() - 0.5) * 0.4, f + (fn - f) * t + 0.14), r0 = 0.3 + g() * 0.18;
    const mat = (i + k) % 5 === 0 ? 'flowerRed' : k % 2 ? 'shrub' : 'hedge';
    b.geometry(mat, new THREE.IcosahedronGeometry(r0, 1), new THREE.Matrix4().compose(p.setY(p.y + r0 * 0.55), new THREE.Quaternion().setFromEuler(new THREE.Euler(k, i, 0)), new THREE.Vector3(1.25, 0.85, 1.15)));
  }
  if (i % 3 === (s > 0 ? 0 : 2)) agave(b, P(z + 1.4, half - 0.3, f + 0.14));
  if (i % 4 === (s > 0 ? 1 : 3)) {
    const t = P(z + 2.6, half - 0.25, f + (fn - f) * 0.65 + 0.12);
    plants.trees.push(t.clone());
    b.geometry('trimWhite', new THREE.CylinderGeometry(0.27, 0.31, 1.3, 12), new THREE.Matrix4().makeTranslation(t.x, t.y + 0.65, t.z));
  }
}

/** Yellow paint line along the pavers at the lane's edge (every stretch, houses included). */
export function laneLine(b: Builder, c: CoastDef, r: Ravine, z: number, zn: number, s: number, inset: number): void {
  const half = (r.floorHalf ?? 4) - 0.2, f = ravineFloor(c, r, z) + 0.068, fn = ravineFloor(c, r, zn) + 0.068;
  run(b, 'laneYellow', new THREE.Vector3(ravineCentre(r, z) + s * (half - inset), f, z), new THREE.Vector3(ravineCentre(r, zn) + s * (half - inset), fn, zn), 0.09, 0.012, false);
}

/** An agave: a rosette of stiff, pointed grey-green leaves fanning out of the bed. */
function agave(b: Builder, at: THREE.Vector3): void {
  for (let k = 0; k < 11; k++) {
    const yaw = k * 2.4, tilt = 0.35 + (k % 3) * 0.28, len = 0.55 + (k % 4) * 0.12;
    const leaf = new THREE.ConeGeometry(0.07, len, 4).translate(0, len / 2, 0).scale(1, 1, 0.35);
    b.geometry('agave', leaf, new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  }
}
