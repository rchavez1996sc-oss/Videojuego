import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Lot } from './houses';

/** Width ÷ height of each photographed front in the `oldfronts` atlas (3 × 2 cells, row 0 on top). */
const ASPECT = [0.84, 0.949, 1.06, 1.072, 0.787];
const FLOOR = 2.7, UP = new THREE.Vector3(0, 1, 0);

/**
 * Old brick shop-house whose street front is one of the photographed façades (shutters, graffiti, hand-painted
 * signs): a solid brick block 2–3 floors high, the photo on the front a hair proud of it, stretched a little to a
 * whole number of floors so the roof lines up with the neighbours. Not enterable. Returns the floors.
 */
export function oldFront(b: Builder, lot: Lot, rand: () => number): number {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, lot.facing), w = lot.w - 0.06, d = lot.d, sink = 0.8;
  const k = Math.floor(rand() * ASPECT.length), floors = Math.min(3, Math.max(2, Math.round(w / ASPECT[k] / FLOOR))), H = floors * FLOOR;
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(lot.x, lot.y, lot.z));
  b.box('brick', [w, H + sink, d], at(0, (H - sink) / 2, -d / 2), q, true);
  b.box('concrete', [w - 0.05, 0.4, 0.15], at(0, H + 0.2, -0.1), q);
  const g = new THREE.PlaneGeometry(w, H), uv = g.attributes.uv as THREE.BufferAttribute, col = k % 3, row = Math.floor(k / 3);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 3, 1 - (row + 1 - uv.getY(i)) / 2);
  b.geometry('oldfronts', g, new THREE.Matrix4().compose(at(0, H / 2, 0.02), q, new THREE.Vector3(1, 1, 1)));
  if (rand() < 0.5) b.geometry(rand() < 0.5 ? 'tankBlack' : 'tankBlue', new THREE.CylinderGeometry(0.55, 0.6, 1.2, 14), new THREE.Matrix4().compose(at((rand() - 0.5) * (w - 1.5), H + 0.6, -d * 0.5), q, new THREE.Vector3(1, 1, 1)));
  return floors;
}

/** Lots this narrow-to-medium suit the photographed fronts. */
export const fitsOldFront = (lot: Lot) => lot.w > 5.4 && lot.w < 9.6;
