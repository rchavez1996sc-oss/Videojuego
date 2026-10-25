import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ, type CampusBuilding } from './layout';
import { FLOOR, type NameSign } from './pavilion';

type Box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide?: boolean) => void;
const frame = (b: Builder, def: CampusBuilding) => {
  const at = framer(def), q = yawQ(def.yaw);
  return { at, q, box: ((mat, size, x, y, z, collide = false) => b.box(mat, size, at(x, y, z), q, collide)) as Box };
};

/**
 * Físicas (from the user's photos): at the north end of the long block a three-storey glass drum with brown floor
 * bands and white mullions on a cream base, and a glazed café on the ground floor under a striped awning.
 */
export function fisicasRotunda(b: Builder, def: CampusBuilding): NameSign {
  const { at, q, box } = frame(b, def), R = def.w / 2 + 1, cz = -def.d / 2, H = def.floors * FLOOR + 1;
  const arc = (r: number, h: number, open = true) => new THREE.CylinderGeometry(r, r, h, 48, 1, open, Math.PI / 2, Math.PI);
  const geo = (mat: string, g: THREE.BufferGeometry, y: number) => b.geometry(mat, g.translate(0, y, 0), new THREE.Matrix4().compose(at(0, 0, cz), q, new THREE.Vector3(1, 1, 1)));
  geo('uniCream', arc(R - 3, FLOOR, false), FLOOR / 2);
  geo('winGlass', arc(R - 0.1, H - FLOOR), FLOOR + (H - FLOOR) / 2);
  for (let f = 1; f <= def.floors; f++) geo('uniBrown', arc(R + 0.05, 0.35), f * FLOOR + (f === def.floors ? 1 : 0));
  geo('uniBrown', arc(R + 0.1, 0.5, false), H + 0.25);
  for (let k = 0; k <= 28; k++) {
    const a = Math.PI / 2 + (k / 28) * Math.PI;
    box('uniWhite', [0.08, H - FLOOR, 0.08], Math.sin(a) * R, FLOOR + (H - FLOOR) / 2, cz + Math.cos(a) * R);
  }
  geo('winGlass', arc(R - 3.1, FLOOR - 0.3), FLOOR / 2);
  geo('awningStripe', new THREE.CylinderGeometry(R - 1, R - 1.8, 0.7, 48, 1, true, Math.PI / 2, Math.PI), FLOOR - 0.2);
  b.box('none', [R * 2, H, R], at(0, H / 2, cz - R / 2), q, true);
  return { pos: at(0, FLOOR - 1.4, cz - (R - 3) - 0.05), q: q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)), w: 3.2, text: 'CAFÉ EXPRESS', ink: '#e8eef2', font: 'sans' };
}

/**
 * Matemáticas entrance (from the user's photos): a white volume standing proud of the facade with a box of black bars
 * on the upper floor, the faculty's name in black serif letters, a barred door below, and a wide flight of steps
 * beside it with white parapets.
 */
export function mathEntrance(b: Builder, def: CampusBuilding): NameSign {
  const { at, q, box } = frame(b, def), F = def.d / 2, w = 11, d = 5, H = def.floors * FLOOR + 0.6, x = 4;
  box('uniWhite', [w, H - 3, d], x, 3 + (H - 3) / 2, F + d / 2 - 0.2, true);
  for (const s of [-1, 1]) box('uniWhite', [0.6, 3, d], x + s * (w / 2 - 0.3), 1.5, F + d / 2 - 0.2, true);
  box('darkGlass', [w - 1.4, 2.8, 0.06], x, 1.4, F + 0.2);
  for (let k = 0; k < 14; k++) box('fenceIron', [0.05, 2.8, 0.05], x - (w - 1.4) / 2 + 0.35 + k * 0.7, 1.4, F + 0.3);
  const yb = FLOOR * 2 + 0.3;
  box('darkGlass', [w - 2, FLOOR - 0.6, 0.06], x, yb + (FLOOR - 0.6) / 2, F + d - 0.15);
  for (let k = 0; k < 9; k++) box('fenceIron', [w - 2, 0.07, 0.07], x, yb + 0.2 + k * 0.33, F + d - 0.05);
  for (const s of [-1, 1]) box('fenceIron', [0.07, FLOOR - 0.6, 0.07], x + s * (w / 2 - 1), yb + (FLOOR - 0.6) / 2, F + d - 0.05);
  const sx = x - w / 2 - 6, steps = 12, rise = FLOOR / steps, run = 0.34;
  for (let k = 0; k < steps; k++) box('concrete', [10, rise * (k + 1), run], sx, (rise * (k + 1)) / 2, F + 0.2 + (steps - k) * run, true);
  for (const s of [-1, 1]) box('uniWhite', [0.35, 1.2, steps * run + 0.4], sx + s * 5.2, 0.6 + FLOOR / 2, F + 0.2 + (steps * run) / 2, true);
  box('concrete', [10, 0.2, 2], sx, FLOOR - 0.1, F + 0.2, true);
  return { pos: at(x, FLOOR + 1.8, F + d - 0.17), q, w: 6, text: 'FACULTAD\nDE\nCIENCIAS MATEMATICAS', ink: '#151515' };
}
