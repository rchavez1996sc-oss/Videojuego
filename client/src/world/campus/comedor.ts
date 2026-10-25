import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import type { NameSign } from './pavilion';
import { diningHall } from './comedorHall';

/** Podium, hall and upper floor heights, roof module along the facade, gable rise. */
export const P = 1.2, G = 4.2, U = 3.4, M = 7.2, RISE = 2.3;

type Box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide?: boolean, rot?: THREE.Quaternion) => void;

/** Upright triangle in the local xy plane (base on y 0, apex at y `h`), facing +z (or −z when `back`). */
function gable(w: number, h: number, back = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), v = back ? [w / 2, 0, 0, -w / 2, 0, 0, 0, h, 0] : [-w / 2, 0, 0, w / 2, 0, 0, 0, h, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  g.computeVertexNormals();
  return g;
}

/** Straight outdoor flight along +x from the podium to the balcony: treads, yellow soffit, railing, ramp collider. */
function flight(box: Box, q: THREE.Quaternion, xs: number, z: number, width: number): number {
  const rise = G + 0.45, steps = 27, h = rise / steps, run = 0.27, len = steps * run;
  for (let k = 0; k < steps; k++) box('concrete', [run + 0.02, h, width], xs + (k + 0.5) * run, P + (k + 0.5) * h, z);
  const ang = Math.atan2(rise, len), along = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang)), slope = Math.hypot(rise, len);
  box('uniYellow', [slope, 0.25, width], xs + len / 2, P + rise / 2 - 0.3, z, false, along);
  box('none', [slope, 0.2, width], xs + len / 2, P + rise / 2 + 0.05, z, true, along);
  for (const s of [-1, 1]) box('lampPole', [slope, 0.05, 0.05], xs + len / 2, P + rise / 2 + 1.0, z + s * (width / 2 - 0.05), false, along);
  return len;
}

/**
 * Comedor Universitario (from the user's photos): long cream block on a grey podium reached by a full-length flight of
 * wide steps; a covered walkway under the balcony whose slab edge is a deep red band carried on red square columns;
 * open balcony with steel railing in front of the upper floor (glazed bays with black frames and louvres); a roof of
 * repeated gables (white soffits, red edge trim) with glazed gable ends; two straight outdoor stairs with yellow
 * soffits up to the balcony; the dining hall inside (see comedorHall). Local +z faces the patio.
 */
export function comedor(b: Builder, def: CampusBuilding, plants: Plants): { sign: NameSign; inner: NameSign; seal: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } } {
  const at = framer(def), q = yawQ(def.yaw), D = def.d, F = D / 2, back = -F;
  const box: Box = (mat, size, x, y, z, collide = false, rot) => b.box(mat, size, at(x, y, z), rot ?? q, collide);
  const n = Math.max(4, Math.round((def.w - 2) / M)), L = n * M, x0 = -L / 2;
  const zS = F - 3, zC = F - 3.4, zH = F - 7.6, T = P + G + 0.45 + U;

  box('concrete', [L + 2, P, zS - back], 0, P / 2, (zS + back) / 2, true);
  const steps = 7, run = (F - zS) / steps;
  for (let k = 0; k < steps; k++) box('concrete', [L + 2, (P * (steps - k)) / steps, run], 0, (P * (steps - k)) / steps / 2, zS + (k + 0.5) * run, true);

  const flights = [...Array(n).keys()].filter((i) => i % 3 === 1);
  const fl = [flights[0], flights[flights.length - 1]].map((i) => x0 + i * M + 0.4), fz = zH + 1.2, fw = 1.8;
  const lens = fl.map((xs) => flight(box, q, xs, fz, fw));

  const yS = P + G + 0.22, cuts = fl.map((xs, k) => [xs - 0.2, xs + lens[k] - 0.2] as const);
  box('uniFrame', [L, 0.45, zH - back], 0, yS, (zH + back) / 2, true);
  box('uniRed', [L + 0.4, 0.45, zC + 0.3 - (fz + fw / 2)], 0, yS, (zC + 0.3 + fz + fw / 2) / 2, true);
  box('uniRed', [L + 0.4, 0.45, fz - fw / 2 - zH], 0, yS, (fz - fw / 2 + zH) / 2, true);
  let xa = -L / 2 - 0.2;
  for (const [c0, c1] of [...cuts, [L / 2 + 0.2, L / 2 + 0.2] as const]) {
    if (c0 > xa) box('uniRed', [c0 - xa, 0.45, fw], (xa + c0) / 2, yS, fz, true);
    xa = c1;
  }
  box('uniRed', [L + 0.4, 1.5, 0.35], 0, P + G + 0.2, zC + 0.47, true);
  const rail = P + G + 0.45 + 1.05;
  for (let x = -L / 2; x <= L / 2 + 0.01; x += 1.8) box('lampPole', [0.05, 0.6, 0.05], x, rail - 0.3, zC + 0.47);
  for (const y of [rail, rail - 0.3]) box('lampPole', [L, 0.05, 0.05], 0, y, zC + 0.47);
  box('none', [L, 1.1, 0.3], 0, rail - 0.4, zC + 0.47, true);
  for (let i = 0; i <= n; i++) box('uniRed', [0.55, G, 0.55], x0 + i * M, P + G / 2, zC, true);

  box('uniCream', [L, U, zH - 0.3 - back], 0, P + G + 0.45 + U / 2, (zH - 0.3 + back) / 2, true);
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * M, y = P + G + 0.45, glazed = i % 2 === 0;
    if (glazed) {
      box('winGlass', [M - 1.4, U - 0.5, 0.06], cx, y + U / 2, zH - 0.26);
      for (let k = 1; k < 5; k++) box('mullion', [0.06, U - 0.5, 0.1], cx - (M - 1.4) / 2 + (k * (M - 1.4)) / 5, y + U / 2, zH - 0.22);
      for (let k = 0; k < 6; k++) box('mullion', [M - 1.4, 0.05, 0.12], cx, y + 0.4 + k * 0.22, zH - 0.2);
    } else box('winGlass', [1.4, 2.2, 0.06], cx + 1.5, y + 1.1, zH - 0.26);
    box('uniRed', [0.45, U, 0.45], x0 + i * M, y + U / 2, zH - 0.1, true);
    b.geometry(glazed ? 'winGlass' : 'uniCream', gable(M, RISE), new THREE.Matrix4().compose(at(cx, T, zH - 0.28), q, new THREE.Vector3(1, 1, 1)));
    b.geometry('uniCream', gable(M, RISE, true), new THREE.Matrix4().compose(at(cx, T, back + 0.02), q, new THREE.Vector3(1, 1, 1)));
    if (glazed) for (const s of [-1, 1]) box('mullion', [0.07, RISE * 0.55, 0.1], cx + s * M * 0.18, T + RISE * 0.27, zH - 0.24);
  }
  box('uniCream', [L, 0.6, zH - 0.3 - back], 0, T + 0.3, (zH - 0.3 + back) / 2, true);
  const slope = Math.atan2(RISE, M / 2), len = Math.hypot(RISE, M / 2) + 0.06, z0 = back - 1, z1 = zC + 1.4;
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const rot = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * -slope)), cx = x0 + (i + 0.5) * M + (s * M) / 4;
    box('roofWhite', [len, 0.24, z1 - z0], cx, T + RISE / 2, (z0 + z1) / 2, false, rot);
    for (const z of [z1 + 0.06, z0 - 0.06]) box('uniRed', [len, 0.42, 0.12], cx, T + RISE / 2 - 0.05, z, false, rot);
  }
  box('none', [L, 0.5, z1 - z0], 0, T + RISE + 0.3, (z0 + z1) / 2, true);

  const hall = diningHall(b, at, q, { x0, L, n, back, zH, floor: P, height: G }, plants);
  for (let k = 0; k < 26; k++) plants.standing.push({ pos: at(-L / 2 + 6 + k * 0.72, P + 0.02, zC - 1.4 + (k % 2) * 0.2), yaw: Math.atan2(-Math.cos((def.yaw * Math.PI) / 180), -Math.sin((def.yaw * Math.PI) / 180)), key: k % 3 ? 'civ_idle' : 'texting' });
  return { sign: { pos: at(L / 2 - 12, P + G + 0.2, zC + 0.66), q, w: 9, text: def.name ?? 'COMEDOR UNIVERSITARIO', ink: '#ffffff', font: 'sans' }, ...hall };
}
