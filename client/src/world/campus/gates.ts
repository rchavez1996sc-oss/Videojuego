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

/** Stone pylon face with the red stepped key ("greca") and the crest square; `s` = which face (+1 avenue, −1 campus). */
function pylonFace(box: Box, x0: number, x1: number, H: number, D: number, s: number): void {
  const z = s * (D / 2 + 0.05), w = x1 - x0, cx = (x0 + x1) / 2;
  box('uniRed', [2.2, H - 0.8, 0.1], x0 + 1.1, (H - 0.8) / 2, z, false);
  box('uniRed', [w - 2.9, 1.7, 0.1], x0 + 2.2 + (w - 2.9) / 2, H - 1.65, z, false);
  box('uniRed', [1.6, H - 5.2, 0.1], x1 - 1.5, 2.2 + (H - 5.2) / 2 + 0.6, z, false);
  box('uniRed', [w - 1.4, 1.5, 0.1], cx + 0.7, 2.2, z, false);
  box('uniRed', [1.3, 5.2, 0.1], x0 + 3.9, 6.9, z, false);
  box('uniRed', [3.6, 1.3, 0.1], x0 + 5.1, 9.9, z, false);
  box('uniRed', [5.2, 5.2, 0.14], cx + 1.9, 6.9, z, false);
}
type Box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide?: boolean) => void;

/**
 * Puerta 1 (Av. Venezuela, by the Huaca; from the user's photos): a square pylon clad in pale flagstone with a red
 * stepped key and the crest; a long red lintel with the university's name resting on a red pier; under it a tall cream
 * block with a red stripe that drops diagonally, a pedestrian passage at its right end, and a low cream portico with
 * Andean-pattern iron gates on the left; the vehicle gate (open black bars) between the block and the pylon. In front a
 * flagstone plaza with red-kerbed lawn beds, concrete-and-timber benches, double lamps, bins and a floodlight mast.
 * Local +z faces the avenue; the vehicle gate is centred on local x = 10.
 */
export function puerta1(b: Builder, g: { x: number; z: number; yaw: number }, plazaDepth: number): { name: NameSign; crest: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } } {
  const at = framer(g), q = yawQ(g.yaw), box: Box = (mat, size, x, y, z, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  const P0 = 13, P1 = 28, PH = 15, PD = 3.2;
  box('laja', [P1 - P0, PH, PD], (P0 + P1) / 2, PH / 2, 0);
  for (const s of [1, -1]) pylonFace(box, P0, P1, PH, PD, s);
  box('uniRed', [27.4, 2.6, 1.5], -0.3, 9.5, 0);
  box('uniRed', [2, 8.2, 1.8], -13, 4.1, 0);
  const H = 8.2, F = 1.6, Bk = -3;
  box('uniCream', [14, H, F - Bk], -3, H / 2, (F + Bk) / 2);
  box('uniCream', [3, H - 3.2, F - Bk], 5.5, 3.2 + (H - 3.2) / 2, (F + Bk) / 2);
  box('uniCream', [0.5, 3.2, F - Bk], 6.75, 1.6, (F + Bk) / 2);
  for (let k = 0; k < 7; k++) box('fenceIron', [0.05, 1.1, 0.05], 4.3 + k * 0.38, 0.55, 0, false);
  for (const s of [1, -1]) {
    const z = s > 0 ? F + 0.02 : Bk - 0.02;
    box('uniRed', [7.2, 0.6, 0.06], -6.4, 6.6, z, false);
    const a = new THREE.Vector2(-2.9, 6.6), c = new THREE.Vector2(1.6, 0.3), len = a.distanceTo(c), mid = a.clone().lerp(c, 0.5);
    b.box('uniRed', [0.65, len + 0.6, 0.06], at(mid.x, mid.y, z), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(c.x - a.x, a.y - c.y))), false);
    if (s > 0) {
      for (let k = 0; k < 5; k++) box('darkGlass', [0.55, 0.55, 0.05], -8 + k * 1.3, 2.3, z + 0.01, false);
      for (const x of [0.4, 1.7]) box('darkGlass', [1.1, 0.35, 0.05], x, 3.6, z + 0.01, false);
      box('darkGlass', [2.2, 0.8, 0.05], 3.3, 1.9, z + 0.01, false);
    }
  }
  box('uniCream', [13.5, 0.7, 4.2], -17.2, 5.75, 0);
  for (const [x, mat] of [[-23.4, 'uniCream'], [-19.6, 'uniCream'], [-16, 'uniRed']] as const) box(mat, [0.9, 5.4, 0.9], x, 2.7, 0);
  for (const [x0, x1] of [[-23, -20], [-19.2, -16.4], [-15.6, -14]]) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box('fenceBars', [w, 2.4, 0.02], cx, 1.3, 0, false);
    for (const d of [-1, 1]) b.box('fenceIron', [0.05, Math.hypot(w, 2.4) - 0.1, 0.05], at(cx, 1.3, 0), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), d * Math.atan2(w, 2.4))), false);
    box('fenceIron', [w, 0.08, 0.06], cx, 2.5, 0, false);
    box('grate', [w, 2.6, 0.3], cx, 1.3, 0);
  }
  for (const s of [-1, 1]) {
    const hinge = s < 0 ? 7 : 13, open = s * 1.25;
    const gq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), open));
    const dir = new THREE.Vector3(-s, 0, 0).applyQuaternion(gq);
    for (let k = 0; k < 12; k++) b.box('fenceIron', [0.04, 2.4, 0.04], at(hinge, 1.2, -0.6).add(dir.clone().multiplyScalar(0.15 + k * 0.25)), gq, false);
    b.box('fenceIron', [3, 0.08, 0.06], at(hinge, 2.35, -0.6).add(dir.clone().multiplyScalar(1.5)), gq, false);
  }
  const mast = new THREE.Matrix4().compose(at(-26, 0, plazaDepth - 3), q, new THREE.Vector3(1, 1, 1));
  b.geometry('lampPole', new THREE.CylinderGeometry(0.12, 0.22, 14, 8).translate(0, 7, 0), mast);
  for (let k = 0; k < 4; k++) b.geometry('globe', new THREE.BoxGeometry(0.7, 0.5, 0.25).translate(-0.6 + (k % 2) * 1.2, 14 + Math.floor(k / 2) * 0.6, 0.2), mast);

  box('plazaStone', [54, 0.2, plazaDepth], 1, 0.07, plazaDepth / 2 + 1.7, true);
  for (const [x, z, w, d] of [[-19, 7, 9, 3.4], [21, 6, 9, 3.4], [-15, plazaDepth - 3.5, 12, 2.6], [17, plazaDepth - 3.5, 14, 2.6]] as const) {
    box('uniRed', [w + 0.4, 0.42, d + 0.4], x, 0.21, z + 1.7, true);
    box('lawnBed', [w, 0.06, d], x, 0.43, z + 1.7, false);
  }
  const back = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  for (const [x, z] of [[-19, 4.4], [-11, 10.7], [21, 3.4], [13, 10.7]]) campusBench(b, at, back, x, z + 1.7);
  for (const [x, z] of [[-24, 4], [-8, 5], [4, 5], [29, 4], [-24, plazaDepth - 1], [27, plazaDepth - 1]]) campusLamp(b, at(x, 0.17, z + 1.7), (-g.yaw * Math.PI) / 180);
  for (const [x, z] of [[-14, 3.4], [16, 2.6]]) bin(b, at(x, 0.17, z + 1.7));
  return {
    name: { pos: at(-1.5, 9.5, 0.78), q, w: 21, text: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#e8c46a' },
    crest: { pos: at((P0 + P1) / 2 + 1.9, 6.9, PD / 2 + 0.14), q, size: 4.2 },
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

/**
 * Puerta 2 (Av. Venezuela at Universitaria; from the user's photo): a block of dark stacked slate carrying the silver
 * crest, a grey rendered box, a thick red cantilevered canopy with the university's name in white over a black-framed
 * glazed gatehouse, and the vehicle lane (local x −14…−6) with its sliding bar gate parked open. Local +z faces the avenue.
 */
export function puerta2(b: Builder, g: { x: number; z: number; yaw: number }): { name: NameSign; crest: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } } {
  const at = framer(g), q = yawQ(g.yaw), box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  box('slate', [6, 6.6, 3], 0, 3.3, 0);
  box('uniGrey', [3, 5.6, 3.2], -4.5, 2.8, -0.1);
  box('uniRed', [23, 1.7, 7], 5.5, 7.05, 0.4);
  box('uniWhite', [22.6, 0.12, 6.6], 5.5, 6.14, 0.4, false);
  box('fenceIron', [23.1, 0.18, 0.3], 5.5, 7.95, 3.8, false);
  for (const z of [-2.2, 2.2]) {
    box('glassClear', [11.6, 3.6, 0.05], 9.2, 1.8, z, false);
    for (let x = 3.4; x <= 15.01; x += 1.45) box('fenceIron', [0.1, 3.6, 0.12], x, 1.8, z, false);
    box('fenceIron', [11.8, 0.12, 0.14], 9.2, 3.6, z, false);
  }
  box('fenceIron', [0.12, 3.6, 4.4], 15, 1.8, 0, false);
  box('none', [12, 3.8, 4.6], 9.2, 1.9, 0);
  box('uniCream', [1.5, 3.6, 1.6], 11.5, 1.8, 0.6, false);
  for (const x of [3.6, 14.8]) box('uniGrey', [0.4, 6.2, 0.4], x, 3.1, 3.4);
  box('uniFrame', [12, 0.25, 4.6], 9.2, 3.75, 0, false);
  for (let k = 0; k < 30; k++) b.box('fenceIron', [0.05, 3, 0.05], at(-23.5 + k * 0.32, 1.5, -1.8), q, false);
  for (const y of [0.2, 2.95]) box('fenceIron', [9.8, 0.08, 0.08], -18.8, y, -1.8, false);
  box('grate', [9.8, 3, 0.3], -18.8, 1.5, -1.8);
  for (const [x, z] of [[-11, 2.4], [-8.5, 2.6]]) {
    for (const s of [-1, 1]) b.box('kerbYellow', [0.05, 1.1, 0.05], at(x + s * 1, 0.55, z), q, false);
    b.box('kerbYellow', [2.1, 0.05, 0.05], at(x, 1.05, z), q, false);
    for (let k = 1; k < 7; k++) b.box('kerbYellow', [0.03, 0.9, 0.03], at(x - 1 + k * 0.29, 0.55, z), q, false);
  }
  return {
    name: { pos: at(5.5, 7.05, 3.92), q, w: 18, text: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#ffffff' },
    crest: { pos: at(0, 3.6, 1.53), q, size: 3.6 },
  };
}
