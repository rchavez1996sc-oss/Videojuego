import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ } from './layout';
import { campusLamp } from './roads';
import type { NameSign } from './pavilion';

/** Concrete bench with white ends and a slatted wooden seat and back (Puerta 1 plaza). */
export function campusBench(b: Builder, at: (x: number, y: number, z: number) => THREE.Vector3, q: THREE.Quaternion, x: number, z: number): void {
  for (const s of [-1, 1]) b.box('uniWhite', [0.32, 0.85, 0.75], at(x + s * 1.05, 0.42, z), q, true);
  for (let k = 0; k < 3; k++) b.box('benchWood', [1.8, 0.05, 0.14], at(x, 0.47, z - 0.22 + k * 0.17), q, false);
  for (let k = 0; k < 3; k++) b.box('benchWood', [1.8, 0.14, 0.04], at(x, 0.62 + k * 0.17, z - 0.36), q, false);
}

/** Green municipal bin on a post. */
function bin(b: Builder, at: THREE.Vector3): void {
  const m = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z);
  b.geometry('binGreen', new THREE.CylinderGeometry(0.28, 0.24, 0.75, 12).translate(0, 0.65, 0), m);
  b.geometry('binGreen', new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6).translate(0, 0.15, 0), m);
}

/**
 * Puerta 1 (Av. Venezuela, by the Huaca): stone-clad pylon framed in red with the crest panel, red lintel beam
 * carrying the university's name, cream gatehouse, open black gates, floodlight mast; in front a paved plaza with
 * red-kerbed lawn beds, concrete-and-timber benches, double lamps and bins. Local +z faces the avenue.
 */
export function puerta1(b: Builder, g: { x: number; z: number; yaw: number }, plazaDepth: number): { name: NameSign; crest: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } } {
  const at = framer(g), q = yawQ(g.yaw), box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  box('uniRed', [8, 12, 2.6], 10, 6, 0);
  box('laja', [6.4, 10.4, 0.12], 10, 6.2, 1.34, false);
  box('uniRed', [3.4, 3.6, 0.25], 10, 7.4, 1.45, false);
  box('laja', [8.2, 0.5, 2.8], 10, 12.25, 0, false);
  box('uniRed', [16, 2.2, 2.2], -2, 6.4, 0);
  box('uniRed', [1.6, 7.5, 2.2], -10, 3.75, 0);
  box('uniCream', [7.4, 3.3, 5], -5.6, 1.65, -1.5);
  for (const x of [-7.6, -3.6]) box('winGlass', [1.6, 1.2, 0.06], x, 1.9, 1.03, false);
  box('uniFrame', [8.2, 0.25, 5.8], -5.6, 3.4, -1.4, false);
  box('darkGlass', [1, 2.2, 0.06], -5.6, 1.1, 1.03, false);
  for (const s of [-1, 1]) {
    const hinge = s < 0 ? -1.8 : 5.8, open = s * 1.25;
    const gq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), open));
    const dir = new THREE.Vector3(-s, 0, 0).applyQuaternion(gq);
    for (let k = 0; k < 14; k++) {
      const p = at(hinge, 1.2, -0.4).add(dir.clone().multiplyScalar(0.15 + k * 0.25));
      b.box('fenceIron', [0.04, 2.4, 0.04], p, gq, false);
    }
    b.box('fenceIron', [3.6, 0.08, 0.06], at(hinge, 2.35, -0.4).add(dir.clone().multiplyScalar(1.8)), gq, false);
  }
  const mast = new THREE.Matrix4().compose(at(-16, 0, plazaDepth - 3), q, new THREE.Vector3(1, 1, 1));
  b.geometry('lampPole', new THREE.CylinderGeometry(0.12, 0.22, 14, 8).translate(0, 7, 0), mast);
  for (let k = 0; k < 4; k++) b.geometry('globe', new THREE.BoxGeometry(0.7, 0.5, 0.25).translate(-0.6 + (k % 2) * 1.2, 14 + Math.floor(k / 2) * 0.6, 0.2), mast);

  box('pavers', [40, 0.2, plazaDepth], 0, 0.07, plazaDepth / 2 + 1.3, true);
  for (const [x, z, w, d] of [[-13, 7, 9, 3.4], [13, 7, 9, 3.4], [-12, plazaDepth - 3.5, 12, 2.6], [8, plazaDepth - 3.5, 14, 2.6]] as const) {
    box('uniRed', [w + 0.4, 0.42, d + 0.4], x, 0.21, z + 1.3, true);
    box('lawnBed', [w, 0.06, d], x, 0.43, z + 1.3, false);
  }
  for (const [x, z] of [[-13, 4.4], [-8, 10.7], [13, 4.4], [4, 10.7]]) campusBench(b, at, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)), x, z + 1.3);
  for (const [x, z] of [[-18, 4], [-6, 5], [6, 5], [18, 4], [-18, plazaDepth - 1], [18, plazaDepth - 1]]) campusLamp(b, at(x, 0.17, z + 1.3), (-g.yaw * Math.PI) / 180);
  for (const [x, z] of [[-9.5, 3.4], [16.5, 3.4]]) bin(b, at(x, 0.17, z + 1.3));
  return {
    name: { pos: at(-2, 6.4, 1.12), q, w: 14.5, text: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#e8c46a' },
    crest: { pos: at(10, 7.4, 1.6), q, size: 2.8 },
  };
}

/** Red portal into the Minas garden with the white "ING. DE MINAS" band. Local +z faces out. */
export function minasPortal(b: Builder, p: { x: number; z: number; yaw: number }): NameSign {
  const at = framer(p), q = yawQ(p.yaw), box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  for (const s of [-1, 1]) box('uniRed', [1.4, 4.2, 1.2], s * 3.6, 2.1, 0);
  box('uniRed', [8.6, 1.4, 1.2], 0, 4.9, 0);
  box('uniWhite', [7, 0.9, 0.08], 0, 4.9, 0.64, false);
  for (const s of [-1, 1]) box('uniRed', [6, 2.2, 0.4], s * 7.3, 1.1, -0.2);
  return { pos: at(0, 4.9, 0.7), q, w: 6.4, text: 'ING. DE MINAS', ink: '#3a3a3a' };
}

export { bin };
