import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { chatGroup, type Plants } from '../malecon/park';
import type { CampusDef } from './layout';
import type { NameSign } from './pavilion';

const UP = new THREE.Vector3(0, 1, 0);
const N = 64, ROWS = 9;

/**
 * Estadio de San Marcos (from the user's photo), walkable: a bowl of grey terraces striped in yellow and red seats
 * round a red track and green pitch, solid stands you can climb row by row, four diagonal vomitories (`gates` gaps
 * through every row) with red portals, a press box on the campus side, floodlight masts and a ring of trees.
 */
export function stadium(b: Builder, s: CampusDef['stadium'], plants: Plants): NameSign[] {
  const Q = new THREE.Quaternion(), at = (x: number, y: number, z: number) => new THREE.Vector3(s.x + x, y, s.z + z);
  b.box('trackRed', [s.rx * 1.38, 0.1, s.rz * 1.3], at(0, 0.05, 0), Q, true);
  b.box('lawnBed', [s.rx * 0.9, 0.14, s.rz * 0.8], at(0, 0.07, 0), Q, true);
  for (const x of [-1, 1]) {
    const gx = x * s.rx * 0.43;
    for (const z of [-3.7, 3.7]) b.box('uniWhite', [0.12, 2.44, 0.12], at(gx, 1.36, z), Q, true);
    b.box('uniWhite', [0.12, 0.12, 7.52], at(gx, 2.6, 0), Q, false);
    b.box('fenceBars', [0.02, 2.4, 7.4], at(gx + x * 1.8, 1.34, 0), Q, false);
    b.box('fenceBars', [1.8, 0.02, 7.4], at(gx + x * 0.9, 2.55, 0), Q, false);
  }
  const signs: NameSign[] = [];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
    const yaw = Math.atan2(Math.cos(am) * s.rz, -Math.sin(am) * s.rx), q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    if (i % 16 === 8) {
      const out = 0.75 + ROWS * 0.045 + 0.04, gate = at(Math.cos(am) * s.rx * out, 0, Math.sin(am) * s.rz * out);
      for (const side of [-1, 1]) b.box('uniRed', [0.9, 5.2, 0.9], gate.clone().add(new THREE.Vector3(-Math.sin(yaw) * 0, 2.6, 0)).add(new THREE.Vector3(Math.cos(yaw) * side * 4.2, 0, -Math.sin(yaw) * side * 4.2)), q, true);
      b.box('uniRed', [9.3, 1.1, 1], gate.clone().setY(5.7), q, false);
      signs.push({ pos: gate.clone().setY(5.7).add(new THREE.Vector3(Math.sin(yaw) * 0.52, 0, Math.cos(yaw) * 0.52)), q, w: 7.5, text: `PUERTA ${(i - 8) / 16 + 1}`, ink: '#ffffff', font: 'sans' });
      continue;
    }
    const kw = 0.75 + ROWS * 0.045, lw = Math.hypot(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)) * s.rx * kw + 0.5;
    const w = at(Math.cos(am) * s.rx * kw, 0, Math.sin(am) * s.rz * kw);
    b.box('uniGrey', [lw, 11.4, 0.5], w.clone().setY(5.7), q, true);
    b.box('uniRed', [lw + 0.05, 0.8, 0.6], w.clone().setY(10.6), q, false);
    if (i % 2) b.box('concrete', [0.9, 11.4, 0.8], w.clone().setY(5.7).add(new THREE.Vector3(Math.cos(am) * 0.4, 0, Math.sin(am) * 0.4)), q, false);
    for (let r = 0; r < ROWS; r++) {
      const k = 0.75 + r * 0.045, len = Math.hypot(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)) * s.rx * k + 0.6;
      const p = at(Math.cos(am) * s.rx * k, 0.8 + r * 1.1, Math.sin(am) * s.rz * k), h = 0.8 + r * 1.1 + 0.4;
      b.box('concrete', [len, h, 4.5], p.clone().setY(h / 2 - 0.2), q, true);
      const band = Math.floor((am / (Math.PI * 2)) * 10 + r * 0.3) % 3;
      b.box(band === 0 ? 'uniYellow' : band === 1 ? 'uniRed' : 'uniGrey', [len - 0.2, 0.25, 1.4], p.clone().setY(p.y + 0.55), q, false);
      if (r > 0 && r < ROWS - 1 && (i * 7 + r * 3) % 11 === 0) plants.seats.push({ pos: p.clone().setY(r * 1.1 + 1.0), yaw: Math.atan2(-Math.cos(am), -Math.sin(am)) });
    }
  }
  b.box('uniGrey', [26, 6, 8], at(0, 3, s.rz * 1.22), Q, true);
  b.box('alu', [27, 0.3, 9], at(0, 6.2, s.rz * 1.22), Q, false);
  b.box('darkGlass', [22, 2, 0.06], at(0, 4, s.rz * 1.22 - 4.03), Q, false);
  signs.push({ pos: at(0, 7.2, s.rz * 1.22 + 4.1), q: Q, w: 18, text: 'ESTADIO SAN MARCOS', ink: '#ffffff', font: 'sans', plate: '#b8322a' });
  for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const p = at(cx * s.rx * 1.25, 0, cz * s.rz * 1.25);
    b.box('lampPole', [0.8, 42, 0.8], p.clone().setY(21), Q, true);
    b.box('globe', [5, 3, 0.6], p.clone().setY(43), new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-cx, -cz)), false);
  }
  for (let k = 0; k < 4; k++) chatGroup(plants.standing, at((k - 1.5) * 14, 0.15, (k % 2 ? 1 : -1) * 12), Math.random);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.93 && Math.sin(a) > 0) continue;
    plants.trees.push(at(Math.cos(a) * s.rx * 1.42, 0, Math.sin(a) * s.rz * 1.48));
  }
  return signs;
}
