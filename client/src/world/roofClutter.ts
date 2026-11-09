import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Builder } from './buildingKit';

type At = (x: number, y: number, z: number) => THREE.Vector3;
const UP = new THREE.Vector3(0, 1, 0);

/** Roof edges a dog paces along (barking down at the street), and roof spots where a neighbour stands. */
export const roofPerches: [THREE.Vector3, THREE.Vector3][] = [];
export const roofPeople: { pos: THREE.Vector3; yaw: number }[] = [];

/** A bushy potted plant of radius ~`r`: three lumpy, jittered leaf balls (no faceted low-poly blob). */
function shrub(r: number, rand: () => number): THREE.BufferGeometry {
  const parts = [0, 1, 2].map((k) => {
    const g = new THREE.IcosahedronGeometry(r * (0.62 + rand() * 0.3), 2), p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.85 + rand() * 0.3), p.getY(i) * (0.8 + rand() * 0.35), p.getZ(i) * (0.85 + rand() * 0.3));
    g.translate((k - 1) * r * 0.45 + (rand() - 0.5) * r * 0.2, (k === 1 ? 0.35 : 0) * r + rand() * r * 0.2, (rand() - 0.5) * r * 0.5);
    g.computeVertexNormals();
    return g.toNonIndexed();
  });
  return mergeGeometries(parts)!;
}

/**
 * Life on a flat Lima roof at height `H` (local frame of the house, +z to the street, depth `d`): a TV aerial on a
 * guyed mast, a satellite dish, potted plants along the parapet, a stack of spare bricks waiting for the next floor,
 * a bucket and a plastic chair — each only on some roofs.
 */
export function roofClutter(b: Builder, at: At, q: THREE.Quaternion, w: number, d: number, H: number, rand: () => number): void {
  const spot = () => [(rand() - 0.5) * (w - 1.6), -0.8 - rand() * (d - 1.8)] as const;
  if (rand() < 0.08) roofPerches.push([at(-w / 2 + 0.8, H, -0.7), at(w / 2 - 0.8, H, -0.7)]);
  else if (rand() < 0.06) roofPeople.push({ pos: at((rand() - 0.5) * (w - 2), H, -d * (0.3 + rand() * 0.4)), yaw: new THREE.Euler().setFromQuaternion(q, 'YXZ').y + (rand() - 0.5) * 2 });
  if (rand() < 0.45) {
    const [x, z] = spot(), mh = 2.2 + rand() * 1.6;
    b.box('bars', [0.04, mh, 0.04], at(x, H + mh / 2, z), q, false);
    for (let k = 0; k < 4; k++) b.box('bars', [0.9 - k * 0.15, 0.02, 0.02], at(x, H + mh - 0.15 - k * 0.22, z), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, 0.4)), false);
    b.box('bars', [0.02, 0.02, 0.5], at(x, H + mh - 0.1, z + 0.2), q, false);
  }
  if (rand() < 0.3) {
    const [x, z] = spot(), tilt = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.9 - rand() * 0.3));
    b.box('bars', [0.05, 0.8, 0.05], at(x, H + 0.4, z), q, false);
    b.geometry('dishWhite', new THREE.SphereGeometry(0.42, 14, 6, 0, Math.PI * 2, 0, 0.75).scale(1, 0.45, 1), new THREE.Matrix4().compose(at(x, H + 0.85, z + 0.1), tilt, new THREE.Vector3(1, 1, 1)));
  }
  if (rand() < 0.5) for (let x = -w / 2 + 0.6, n = 0; x < w / 2 - 0.5 && n < 6; x += 0.5 + rand() * 0.9, n++) {
    if (rand() < 0.35) continue;
    const s = 0.22 + rand() * 0.14, p = at(x, H + 0.45 + s / 2, -0.35);
    b.box(rand() < 0.6 ? 'potTerracotta' : 'chairBlue', [s, s, s], p, q, false);
    b.geometry('plantGreen', shrub(s * (0.8 + rand() * 0.5), rand), new THREE.Matrix4().makeTranslation(p.x, p.y + s * 0.85, p.z));
  }
  if (rand() < 0.35) {
    const [x, z] = spot();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i % 2); j++) b.box('brick', [0.24, 0.12, 0.13], at(x + (j - 1) * 0.25 + (i % 2) * 0.12, H + 0.06 + i * 0.12, z), q, false);
  }
  if (rand() < 0.3) {
    const [x, z] = spot();
    b.geometry(rand() < 0.5 ? 'chairRed' : 'potTerracotta', new THREE.CylinderGeometry(0.17, 0.14, 0.32, 10), new THREE.Matrix4().makeTranslation(...at(x, H + 0.16, z).toArray()));
  }
}
