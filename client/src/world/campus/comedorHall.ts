import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import type { NameSign } from './pavilion';

type At = (x: number, y: number, z: number) => THREE.Vector3;
export interface HallFrame { x0: number; L: number; n: number; back: number; zH: number; floor: number; height: number }

/** Orange stacking chair: shell seat and back on a chrome frame. `face` = local direction it looks to (±1 along z). */
function chair(b: Builder, at: At, q: THREE.Quaternion, x: number, z: number, y: number, face: number): void {
  b.box('chairOrange', [0.44, 0.05, 0.42], at(x, y + 0.45, z), q, false);
  b.box('chairOrange', [0.44, 0.36, 0.04], at(x, y + 0.72, z - face * 0.22), q, false);
  for (const s of [-1, 1]) {
    b.box('alu', [0.025, 0.45, 0.025], at(x + s * 0.2, y + 0.22, z + 0.18), q, false);
    b.box('alu', [0.025, 0.45, 0.025], at(x + s * 0.2, y + 0.22, z - 0.18), q, false);
  }
}

/**
 * The dining hall on the ground floor (from the user's photo): dark terrazzo floor, cream walls with an orange band,
 * the back wall in white tile with "COMEDOR ESTUDIANTIL" and the crest, round white columns, long white tables with
 * orange chairs, fluorescent tubes; the front is glazed with doors every third bay. Some chairs are taken.
 */
export function diningHall(b: Builder, at: At, q: THREE.Quaternion, h: HallFrame, plants: Plants): { inner: NameSign; seal: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } } {
  const { x0, L, n, back, zH, floor: y0, height: G } = h, depth = zH - back, zc = (zH + back) / 2;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  box('terrazzo', [L - 0.6, 0.02, depth - 0.6], 0, y0 + 0.01, zc);
  box('uniCream', [L, G, 0.3], 0, y0 + G / 2, back + 0.15, true);
  box('wallTile', [L - 0.8, 2.6, 0.04], 0, y0 + 1.3, back + 0.32);
  box('uniYellow', [L - 0.8, 0.9, 0.04], 0, y0 + G - 0.6, back + 0.32);
  for (const s of [-1, 1]) {
    box('uniCream', [0.3, G, depth], s * (L / 2 - 0.15), y0 + G / 2, zc, true);
    box('uniYellow', [0.04, 0.9, depth - 0.6], s * (L / 2 - 0.32), y0 + G - 0.6, zc);
  }
  box('uniWhite', [L - 0.6, 0.05, depth - 0.6], 0, y0 + G - 0.03, zc);
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * 7.2, door = i % 3 === 0, wall = i % 3 === 1, zf = zH;
    if (wall) {
      box('uniCream', [7.2, G, 0.3], cx, y0 + G / 2, zf - 0.15, true);
      box('winGlass', [2.4, 0.9, 0.06], cx, y0 + G - 1.0, zf + 0.02);
      continue;
    }
    const open = door ? 2.6 : 0, side = (7.2 - open) / 2;
    for (const s of door ? [-1, 1] : [0]) {
      const w = door ? side : 7.2, px = door ? cx + s * (open / 2 + side / 2) : cx;
      box('winGlass', [w - 0.1, G - 0.3, 0.06], px, y0 + (G - 0.3) / 2, zf - 0.1);
      box('none', [w, G, 0.25], px, y0 + G / 2, zf - 0.1, true);
      for (let k = 0; k <= Math.round(w / 1.2); k++) box('mullion', [0.07, G - 0.3, 0.09], px - w / 2 + (k * w) / Math.round(w / 1.2), y0 + (G - 0.3) / 2, zf - 0.06);
    }
    if (door) box('winGlass', [open, G - 3, 0.06], cx, y0 + 3 + (G - 3) / 2, zf - 0.1);
    box('mullion', [7.2, 0.08, 0.1], cx, y0 + 2.4, zf - 0.06);
  }
  for (let i = 1; i < n; i++) {
    const m = new THREE.Matrix4().compose(at(x0 + i * 7.2, y0, zc), q, new THREE.Vector3(1, 1, 1));
    b.geometry('uniWhite', new THREE.CylinderGeometry(0.32, 0.32, G, 16).translate(0, G / 2, 0), m);
    b.geometry('uniGrey', new THREE.CylinderGeometry(0.36, 0.36, 0.5, 16).translate(0, 0.25, 0), m);
    b.box('none', [0.6, G, 0.6], at(x0 + i * 7.2, y0 + G / 2, zc), q, true);
  }
  for (let x = -L / 2 + 4; x < L / 2 - 3; x += 7.2) for (const z of [back + 2.4, zH - 3]) box('tubeLight', [1.3, 0.06, 0.14], x, y0 + G - 0.1, z);
  const rows = [back + 2.6, zc - 1.9, zc + 1.9, zH - 2.4];
  let seq = 0;
  for (const z of rows) for (let x = x0 + 1.4; x + 4.6 < x0 + L - 1; x += 6.4) {
    const tx = x + 2.3;
    box('tableWhite', [4.6, 0.04, 0.9], tx, y0 + 0.75, z, true);
    for (const sx of [-2.1, 2.1]) for (const sz of [-0.35, 0.35]) box('alu', [0.04, 0.73, 0.04], tx + sx, y0 + 0.37, z + sz);
    for (const face of [-1, 1]) for (let k = 0; k < 3; k++) {
      const cx = tx - 1.5 + k * 1.5, cz = z - face * 0.78;
      chair(b, at, q, cx, cz, y0, face);
      if ((seq++ * 7919) % 10 < 4) {
        const pos = at(cx, y0, cz), toward = at(cx, y0, z).sub(pos);
        plants.seats.push({ pos, yaw: Math.atan2(toward.x, toward.z) });
      }
    }
  }
  return {
    inner: { pos: at(0, y0 + 3.1, back + 0.36), q, w: 9, text: 'COMEDOR ESTUDIANTIL', ink: '#1a1a1a', font: 'serif' },
    seal: { pos: at(0, y0 + 1.75, back + 0.36), q, size: 1.4 },
  };
}
