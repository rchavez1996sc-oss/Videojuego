import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ, type CampusBuilding } from './layout';
import type { NameSign } from './pavilion';

const G = 4.2, U = 3.4, TERRACE = 3.2, MODULE = 6;

/**
 * Comedor Universitario (from the user's photos): yellow ground floor set back behind columns, a red-parapeted
 * terrace running the whole front of the upper floor, folded-plate zigzag roof (white with red edges), two grey
 * stairways up to the terrace. Local +z faces the park.
 */
export function comedor(b: Builder, def: CampusBuilding): NameSign {
  const at = framer(def), q = yawQ(def.yaw), W = def.w, D = def.d, F = D / 2;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false, rot?: THREE.Quaternion) => b.box(mat, size, at(x, y, z), rot ?? q, collide);
  const back = -D / 2, groundFront = F - TERRACE - 2;
  box('uniYellow', [W - 1, G, groundFront - back], 0, G / 2, (groundFront + back) / 2, true);
  for (let x = -W / 2 + 4; x < W / 2 - 3; x += 7) {
    box('winGlass', [4.2, 2.3, 0.08], x + 1.5, 1.6, groundFront + 0.05);
    box('mullion', [0.08, 2.3, 0.12], x + 1.5, 1.6, groundFront + 0.08);
  }
  for (let x = -W / 2 + 1; x <= W / 2 - 1; x += MODULE) box('uniRed', [0.45, G, 0.45], x, G / 2, F - TERRACE + 0.3, true);
  box('uniFrame', [W, 0.45, D], 0, G + 0.22, 0, true);
  const stairs = [-W / 4, W / 4];
  let x0 = -W / 2 - 0.1;
  for (const x1 of [...stairs.map((x) => x - 1.6), W / 2 + 0.1]) {
    box('uniRed', [x1 - x0, 1.15, 0.35], (x0 + x1) / 2, G + 1.0, F - 0.05, true);
    x0 = x1 + 3.2;
  }
  box('uniRed', [W + 0.2, 0.5, 0.5], 0, G + 0.2, F + 0.05, false);
  box('uniYellow', [W - 1, U, D - TERRACE - 0.6], 0, G + 0.45 + U / 2, back + (D - TERRACE - 0.6) / 2 + 0.3, true);
  const upperFront = back + D - TERRACE + 0.3;
  for (let x = -W / 2 + 3; x < W / 2 - 3; x += 4) box('winGlass', [2.8, 1.8, 0.08], x + 0.4, G + 0.45 + 1.6, upperFront + 0.05);
  const top = G + 0.45 + U, rise = 1.6, half = MODULE / 2, slope = Math.atan2(rise, half), len = Math.hypot(rise, half);
  for (let x = -W / 2; x < W / 2 - 0.1; x += MODULE) {
    for (const s of [-1, 1]) {
      const rot = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * -slope));
      box('roofWhite', [len + 0.05, 0.22, D + 1.6], x + half + (s * half) / 2, top + rise / 2, 0.4, false, rot);
      box('uniRed', [len + 0.05, 0.4, 0.12], x + half + (s * half) / 2, top + rise / 2, F + 1.2, false, rot);
    }
    box('roofWhite', [0.3, rise + 0.2, D], x + half, top + (rise + 0.2) / 2, 0, false);
  }
  box('none', [W, 0.4, D], 0, top + 0.6, 0, true);
  for (const sx of stairs) {
    const steps = 14, rise = (G + 0.45) / steps, run = 0.32;
    for (let k = 0; k < steps; k++) box('concrete', [3, rise * (k + 1), run], sx, (rise * (k + 1)) / 2, F + 0.4 + (steps - k) * run, false);
    const L = Math.hypot(G + 0.45, steps * run), ang = Math.atan2(G + 0.45, steps * run);
    box('none', [3, 0.2, L], sx, (G + 0.45) / 2, F + 0.4 + (steps * run) / 2, true, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang)));
    for (const s of [-1, 1]) box('lampPole', [0.05, 0.05, L], sx + s * 1.55, (G + 0.45) / 2 + 0.95, F + 0.4 + (steps * run) / 2, false, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang)));
  }
  return { pos: at(0, G + 1.0, F + 0.14), q, w: 14, text: def.name ?? 'COMEDOR UNIVERSITARIO', ink: '#ffffff' };
}
