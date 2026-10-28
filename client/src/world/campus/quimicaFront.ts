import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ, type CampusBuilding } from './layout';
import type { NameSign } from './pavilion';

const G = 3.6, SET = 0.7;

/**
 * Facultad de Química, front block on Av. Venezuela (from the user's photos): a long black polished-granite box with
 * the name in metal letters between cream bands, standing on yellow piers over a recessed glazed ground floor. The
 * ground floor is the walkable library (green floor, steel stacks, long wooden counter, reading tables, fluorescent
 * lights), with doors to the courtyard and an east entrance: tiled ramp with railings under a curved canopy,
 * yellow fin walls and a bike rack. Returns the sign and spots for the students.
 */
export function quimicaFront(b: Builder, def: CampusBuilding, rand: () => number): { sign: NameSign; spots: THREE.Vector3[] } {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, D = def.d / 2;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  box('graniteBlack', [def.w, 4, def.d], 0, G + 2, 0, true);
  box('uniCream', [def.w + 0.5, 0.5, def.d + 0.5], 0, G + 4.2, 0);
  box('uniCream', [def.w + 0.3, 0.4, def.d + 0.3], 0, G + 0.05, 0);
  for (let u = -W + 2; u <= W - 2; u += 8) for (const s of [-1, 1]) box('uniYellow', [0.9, G - 0.2, 0.9], u, (G - 0.2) / 2, s * (D - 0.45), true);
  box('libFloor', [def.w - 2 * SET, 0.15, def.d - 2 * SET], 0, 0.075, 0, true);
  box('uniWhite', [def.w - 2 * SET, 0.05, def.d - 2 * SET], 0, G - 0.2, 0);
  for (let u = -W + 4; u < W - 3; u += 4) for (const v of [-4, 0, 4]) box('tubeLight', [1.2, 0.05, 0.14], u, G - 0.25, v);

  const glass = (u0: number, v0: number, u1: number, v1: number, doors: number[] = []) => {
    const alongU = Math.abs(u1 - u0) > 0.1, a = alongU ? u0 : v0, c = alongU ? u1 : v1, fixed = alongU ? v0 : u0;
    const cuts = [a, ...doors.flatMap((d) => [d - 1.2, d + 1.2]), c];
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const len = cuts[i + 1] - cuts[i], m = (cuts[i] + cuts[i + 1]) / 2, size = (h: number, t: number): [number, number, number] => (alongU ? [len, h, t] : [t, h, len]);
      const put = (mat: string, s: [number, number, number], y: number, collide = false) => (alongU ? box(mat, s, m, y, fixed, collide) : box(mat, s, fixed, y, m, collide));
      put('glassClear', size(G - 0.3, 0.04), (G - 0.3) / 2 + 0.15);
      put('glasswall', size(G, 0.2), G / 2, true);
      put('alu', size(0.08, 0.1), 0.2);
      for (let k = 0; k <= Math.round(len / 1.8); k++) {
        const p = cuts[i] + (len * k) / Math.max(1, Math.round(len / 1.8));
        alongU ? box('alu', [0.07, G - 0.3, 0.09], p, (G - 0.3) / 2 + 0.15, fixed) : box('alu', [0.09, G - 0.3, 0.07], fixed, (G - 0.3) / 2 + 0.15, p);
      }
    }
  };
  glass(-W + SET, D - SET, W - SET, D - SET);
  glass(-W + SET, -D + SET, W - SET, -D + SET, [-30, 20, 38]);
  glass(-W + SET, -D + SET, -W + SET, D - SET, [0]);
  glass(W - SET, -D + SET, W - SET, D - SET, [0]);

  for (let i = 0; i < 7; i++) {
    box('books', [0.6, 2.3, 9.2], -44 + i * 4.6, 1.3, -0.5, true);
    box('steelGrey', [0.66, 0.06, 9.3], -44 + i * 4.6, 2.48, -0.5);
  }
  box('desk', [0.9, 1.05, 11], -9, 0.68, -0.5, true);
  box('desk', [1.2, 0.06, 11.2], -9, 1.22, -0.5);
  for (let u = -3; u < W - 6; u += 6) for (const v of [-3.8, 2.6]) {
    box('desk', [1.2, 0.06, 3.2], u, 0.9, v, false);
    box('none', [1.2, 0.8, 3.2], u, 0.55, v, true);
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) box('desk', [0.45, 0.5, 0.45], u + s * 1.0, 0.4, v + k * 1.0);
  }

  box('tileCream', [7, 0.14, 3.2], W + 3.5, 0.07, 0);
  for (const s of [-1, 1]) {
    box('alu', [7, 0.05, 0.05], W + 3.5, 1.05, s * 1.7);
    box('none', [7, 1.1, 0.1], W + 3.5, 0.55, s * 1.7, true);
    for (const x of [W + 1, W + 6]) box('uniCream', [0.35, 3.6, 0.35], x, 1.8, s * 2.1, true);
    box('uniCream', [6, 0.35, 0.35], W + 3.5, 3.5, s * 2.1);
  }
  b.geometry('steelGrey', new THREE.CylinderGeometry(2.6, 2.6, 6.6, 24, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.Matrix4().compose(at(W + 3.5, 3.2, 0), q, new THREE.Vector3(1, 0.45, 1)));
  for (const v of [3.6, 5.6, 7.6]) box('uniYellow', [2.2, 6.5 + rand(), 0.45], W + 1.1, 3.3, v, true);
  for (let k = 0; k < 5; k++) box('alu', [0.04, 0.7, 0.9], W + 1.5 + k * 0.7, 0.35, -3.6);

  const spots: THREE.Vector3[] = [];
  for (let k = 0; k < 5; k++) spots.push(at(-41.7 + k * 4.6, 0.2, 2.8 + rand()));
  for (let k = 0; k < 7; k++) spots.push(at(-3 + k * 6 + rand() * 2, 0.2, -0.6));
  return { sign: { pos: at(0, G + 2.1, D + 0.03), q, w: 34, text: def.name ?? 'FACULTAD DE QUÍMICA E INGENIERÍA QUÍMICA', ink: '#dcdcd8' }, spots };
}
