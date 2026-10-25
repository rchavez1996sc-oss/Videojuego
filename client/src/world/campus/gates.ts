import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ, type Rect } from './layout';
import type { LeafDef } from './swingGates';
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

/** Everything Puerta 1 hands back: lettering, crest, push-gate leaves, plaza palms and the footprints the lawn must avoid. */
export interface Gate1 { name: NameSign; plate: NameSign; crest: { pos: THREE.Vector3; q: THREE.Quaternion; size: number }; leaves: LeafDef[]; palms: THREE.Vector3[]; hard: Rect[] }

/**
 * Puerta 1 (from the user's photos): it faces Av. Venezuela, with the Huaca behind it to the west across a side road. Left to right: a low
 * portico on grey pillars with chevron iron leaves and a red guard booth; the red pier carrying a long red lintel with
 * the university's name; the vehicle gate (two chevron leaves); a tall cream block with a red stripe that drops
 * diagonally and the "PUERTA 1" plate; a pedestrian passage and a bar gate; the square pylon in pale laja with the red
 * stepped key and the crest. East of it a flagstone plaza backed by a red wall with white steps, with lawn beds,
 * palms, benches, lamps and bins; in front a paved forecourt edged with yellow bollards down to the avenue. All leaves
 * swing when pushed. Local +z faces the avenue; `fenceWest` metres of railing run west from the portico.
 */
export function puerta1(b: Builder, g: { x: number; z: number; yaw: number }, fenceWest: number): Gate1 {
  const at = framer(g), q = yawQ(g.yaw), box: Box = (mat, size, x, y, z, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  const dirX = at(1, 0, 0).sub(at(0, 0, 0)), leaves: LeafDef[] = [], palms: THREE.Vector3[] = [];
  const leaf = (x: number, sgn: number, w: number, look: LeafDef['look'], h = 2.6) => leaves.push({ hinge: at(x, 0, -0.3), dir: dirX.clone().multiplyScalar(sgn), w, h, look });
  const P0 = 13, P1 = 28, PH = 15, PD = 3.2;
  box('laja', [P1 - P0, PH, PD], (P0 + P1) / 2, PH / 2, 0);
  for (const s of [1, -1]) pylonFace(box, P0, P1, PH, PD, s);
  box('uniRed', [30.4, 2.6, 1.5], -2, 9.5, 0);
  box('uniRed', [2, 8.2, 1.8], -16, 4.1, 0);
  box('uniRed', [2.4, 2.5, 2.2], -18.6, 1.25, 0.4);
  box('darkGlass', [1.2, 0.8, 0.05], -18.6, 1.6, 1.53, false);
  const H = 8.2, F = 1.6, Bk = -3;
  box('uniCream', [12, H, F - Bk], -2, H / 2, (F + Bk) / 2);
  box('uniCream', [3, H - 3.2, F - Bk], 5.5, 3.2 + (H - 3.2) / 2, (F + Bk) / 2);
  box('uniCream', [0.5, 3.2, F - Bk], 6.75, 1.6, (F + Bk) / 2);
  for (const s of [1, -1]) {
    const z = s > 0 ? F + 0.02 : Bk - 0.02;
    box('uniRed', [4.6, 0.6, 0.06], -5.7, 6.6, z, false);
    const a = new THREE.Vector2(-3.4, 6.6), c = new THREE.Vector2(1.2, 0.3), len = a.distanceTo(c), mid = a.clone().lerp(c, 0.5);
    b.box('uniRed', [0.65, len + 0.6, 0.06], at(mid.x, mid.y, z), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(c.x - a.x, a.y - c.y))), false);
    if (s > 0) {
      for (let k = 0; k < 4; k++) box('darkGlass', [0.55, 0.55, 0.05], -7 + k * 1.2, 2.3, z + 0.01, false);
      for (const x of [0.4, 1.7]) box('darkGlass', [1.1, 0.35, 0.05], x, 3.6, z + 0.01, false);
      box('darkGlass', [2.2, 0.8, 0.05], 3.3, 1.9, z + 0.01, false);
    }
  }
  box('uniCream', [11.4, 0.7, 4.2], -22.6, 5.75, 0);
  for (const x of [-27.8, -24]) box('uniGrey', [0.8, 5.4, 0.8], x, 2.7, 0);
  leaf(-27.4, 1, 3.4, 'chevron');
  leaf(-23.6, 1, 3.6, 'chevron');
  leaf(-15, 1, 3.5, 'chevron', 2.8);
  leaf(-8, -1, 3.5, 'chevron', 2.8);
  leaf(7, 1, 3, 'bars');
  leaf(13, -1, 3, 'bars');

  const fence = Math.max(0.5, fenceWest), fx = -28.2 - fence / 2;
  box('kerbYellow', [fence, 0.42, 0.36], fx, 0.21, 0, false);
  box('fenceBars', [fence, 1.9, 0.02], fx, 1.4, 0, false);
  for (const y of [0.55, 2.3]) box('fenceIron', [fence, 0.06, 0.05], fx, y, 0, false);
  for (let x = -28.2; x > -28.2 - fence; x -= 2.6) box('fenceIron', [0.08, 2.05, 0.08], x, 1.42, 0, false);
  box('grate', [fence, 2.4, 0.4], fx, 1.2, 0);
  const PX0 = 28, PX1 = 59.5, PZ0 = -14, PZ1 = 1.6;
  box('plazaStone', [PX1 - PX0, 0.2, PZ1 - PZ0], (PX0 + PX1) / 2, 0.09, (PZ0 + PZ1) / 2, true);
  box('kerbYellow', [PX1 - PX0 - 1, 0.45, 1.6], (PX0 + PX1) / 2 + 0.5, 0.22, 0.6, true);
  box('lawnBed', [PX1 - PX0 - 1.3, 0.05, 1.3], (PX0 + PX1) / 2 + 0.5, 0.46, 0.6, false);
  for (let x = PX0 + 3; x < PX1 - 1; x += 4.5) palms.push(at(x, 0, 0.6));
  for (const [x, z, w, d] of [[46, -9.5, 14, 2.2], [55.5, -4.6, 2.2, 8]] as const) {
    box('uniRed', [w + 0.4, 0.4, d + 0.4], x, 0.2, z, true);
    box('lawnBed', [w, 0.05, d], x, 0.41, z, false);
  }
  for (let x = PX0 + 0.6; x < PX1; x += 1.6) {
    const tall = Math.round((x - PX0) / 1.6) % 2 === 0;
    box('uniRed', [1.6, 1.3, 0.35], x + 0.2, 0.65, PZ0 + 0.2, true);
    box(tall ? 'uniWhite' : 'uniRed', [0.8, tall ? 0.9 : 0.5, 0.36], x, 1.3 + (tall ? 0.45 : 0.25), PZ0 + 0.2, false);
  }
  for (const x of [33, 38, 43, 50]) campusBench(b, at, q, x, PZ0 + 1.6);
  for (const [x, z] of [[31, -3], [40, -3], [50, -3], [58, -10], [36, -12], [-4, 3.2], [-20, 3.2]]) campusLamp(b, at(x, 0.19, z), (-g.yaw * Math.PI) / 180);
  for (const [x, z] of [[34, -2], [52, -11]]) bin(b, at(x, 0.19, z));
  box('plazaStone', [PX1 + 32, 0.2, 10], (PX1 - 32) / 2, 0.09, 6.6, true);
  for (let x = -30; x <= 58; x += 1.6) if (x < -16.5 || x > -6.5) b.geometry('kerbYellow', new THREE.CylinderGeometry(0.07, 0.08, 0.9, 10).translate(0, 0.45, 0), new THREE.Matrix4().makeTranslation(...at(x, 0.19, 9.5).toArray()));
  const mast = new THREE.Matrix4().compose(at(-32, 0, -8), q, new THREE.Vector3(1, 1, 1));
  b.geometry('lampPole', new THREE.CylinderGeometry(0.12, 0.22, 14, 8).translate(0, 7, 0), mast);
  for (let k = 0; k < 4; k++) b.geometry('globe', new THREE.BoxGeometry(0.7, 0.5, 0.25).translate(-0.6 + (k % 2) * 1.2, 14 + Math.floor(k / 2) * 0.6, 0.2), mast);
  const rect = (x: number, z: number, w: number, d: number): Rect => ({ ...((p) => ({ x: p.x, z: p.z }))(at(x, 0, z)), w, d, yaw: g.yaw });
  return {
    name: { pos: at(-2, 9.5, 0.78), q, w: 21, text: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#e8c46a' },
    plate: { pos: at(-6.3, 3.4, F + 0.05), q, w: 1.3, text: 'PUERTA\n1', ink: '#ffffff', plate: '#1d2b5a', font: 'sans' },
    crest: { pos: at((P0 + P1) / 2 + 1.9, 6.9, PD / 2 + 0.14), q, size: 4.2 },
    leaves, palms,
    hard: [rect((PX0 + PX1) / 2, (PZ0 + PZ1) / 2, PX1 - PX0, PZ1 - PZ0), rect(0, -0.7, 60, 5), rect((PX1 - 32) / 2, 6.6, PX1 + 32, 10), rect(fx, 0, fence, 1.2)],
  };
}

/** Red portal into the Minas garden with the white "ING. DE MINAS" band. Local +z faces out. */
export function minasPortal(b: Builder, p: { x: number; z: number; yaw: number }): NameSign {
  const at = framer(p), q = yawQ(p.yaw), box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  for (const s of [-1, 1]) {
    box('brickRed', [3.6, 3.6, 6], s * 5.4, 1.8, -2);
    box('uniRed', [3.8, 0.2, 6.2], s * 5.4, 3.7, -2, false);
  }
  box('darkGlass', [0.06, 1.3, 2.2], -3.57, 1.7, -1.6, false);
  box('uniWhite', [7.6, 1.3, 0.5], 0, 3.05, 0.4);
  for (let x = -20; x <= 20; x += 2.4) {
    if (Math.abs(x) < 8) continue;
    box('uniRed', [2.4, 1.4, 0.3], x, 0.7, -4.5);
    box(Math.round(x / 2.4) % 2 ? 'uniRed' : 'uniWhite', [0.9, 0.5, 0.32], x, 1.65, -4.5, false);
  }
  return { pos: at(0, 3.05, 0.66), q, w: 6.8, text: 'ING. DE MINAS', ink: '#8c8a80', font: 'sans' };
}

export { bin };

/**
 * Puerta 2 (Av. Venezuela y Universitaria; from the user's photos), local +z towards the avenue, the vehicle gate
 * centred on local x −10: on the left a grey pillar, a cream booth with black gate panels under a red cantilever
 * canopy topped by a dark box; a slate pier with the silver crest and "UNMSM"; a long red fascia with the name in
 * white over two black grid gates (the left one slid open) split by a cream pier; a cream wall with notice cases.
 */
export function puerta2(b: Builder, g: { x: number; z: number; yaw: number }): { name: NameSign; label: NameSign; crest: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } } {
  const at = framer(g), q = yawQ(g.yaw), box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  const gridGate = (x0: number, x1: number, z: number) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box('darkGlass', [w, 1.6, 0.04], cx, 2.6, z, false);
    for (let x = x0; x <= x1 + 0.01; x += 0.55) box('fenceIron', [0.07, 3.5, 0.09], x, 1.75, z + 0.04, false);
    for (const y of [0.15, 1.75, 3.45]) box('fenceIron', [w, 0.12, 0.1], cx, y, z + 0.04, false);
  };
  box('uniGrey', [0.9, 4.6, 0.9], -34.6, 2.3, 0.6);
  box('uniCream', [3, 3.2, 3], -30.2, 1.6, 0);
  box('darkGlass', [1.4, 1.2, 0.05], -30.2, 1.8, 1.53, false);
  for (const [x0, x1] of [[-33.8, -31.7], [-28.7, -25.6]]) { gridGate(x0, x1, 0.2); box('grate', [x1 - x0, 3.5, 0.3], (x0 + x1) / 2, 1.75, 0.2); }
  box('uniRed', [15.5, 1, 4.6], -28.5, 5.1, 0.5);
  box('uniWhite', [15.3, 0.08, 4.4], -28.5, 4.56, 0.5, false);
  box('slate', [6.5, 1.8, 3.6], -24, 6.5, 0.2, false);
  for (const x of [-35.5, -23]) box('uniGrey', [0.5, 0.4, 0.5], x, 5.8, 2.2, false);
  box('slate', [5.4, 5.4, 2.4], -18, 2.7, 0);
  box('uniRed', [36.6, 1.5, 0.9], 0.3, 5, 0.25);
  box('uniFrame', [36.6, 0.25, 2.2], 0.3, 4.2, -0.5, false);
  box('uniCream', [3, 4.2, 2.4], -3.2, 2.1, -0.4);
  box('darkGlass', [1.2, 1.4, 0.05], -3.2, 2, 0.82, false);
  gridGate(-1.7, 8.7, -0.6);
  gridGate(-1.2, 9.2, -1.4);
  box('grate', [10.4, 3.6, 0.4], 3.5, 1.8, -0.6);
  box('uniCream', [9.9, 4.3, 0.5], 13.7, 2.15, -0.3);
  for (const [x, w] of [[11, 2.2], [14, 1.4], [16.5, 1.8]]) {
    box('fenceIron', [w + 0.12, 1.4, 0.06], x, 2.3, -0.02, false);
    box('paper', [w, 1.25, 0.04], x, 2.3, 0.0, false);
  }
  for (const x of [-30, -13, 5, 14]) box('alu', [0.6, 0.4, 0.3], x, 5.75, 0.2, false);
  for (const [x, z] of [[-11.5, 2.6], [-8.5, 2.8]]) {
    for (const s of [-1, 1]) b.box('kerbYellow', [0.05, 1.1, 0.05], at(x + s * 1, 0.55, z), q, false);
    b.box('kerbYellow', [2.1, 0.05, 0.05], at(x, 1.05, z), q, false);
  }
  return {
    name: { pos: at(1, 4.9, 0.62), q, w: 22, text: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#f4f4f0', font: 'sans' },
    label: { pos: at(-18, 1.2, 1.22), q, w: 2.4, text: 'UNMSM', ink: '#d9dcdc', font: 'sans' },
    crest: { pos: at(-18, 3.4, 1.22), q, size: 2.6 },
  };
}
