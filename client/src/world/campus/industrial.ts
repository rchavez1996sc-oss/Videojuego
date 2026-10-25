import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ, type CampusBuilding } from './layout';
import { FLOOR, pavilion, type NameSign } from './pavilion';

/**
 * Facultad de Ingeniería Industrial, new block (from the user's photos): a taupe volume with punched windows to the
 * north; a cream, horizontally grooved volume to the south whose corner carries curved balcony slabs with glass rails;
 * a three-storey curved curtain of dark reflective glass on the east face over a grey plinth; lattice copper lettering.
 * Local +z faces the avenue, +x the entrance plaza.
 */
export function industrial(b: Builder, def: CampusBuilding, rand: () => number): NameSign {
  const at = framer(def), q = yawQ(def.yaw), W = def.w, D = def.d, H = def.floors * FLOOR;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const geo = (mat: string, g: THREE.BufferGeometry, x: number, y: number, z: number) => b.geometry(mat, g, new THREE.Matrix4().compose(at(x, y, z), q, new THREE.Vector3(1, 1, 1)));
  const north = framer(def)(0, 0, -D / 4);
  pavilion(b, { x: north.x, z: north.z, w: W, d: D / 2, yaw: def.yaw, floors: def.floors, style: 'single', skin: 'punched', color: 'taupe' }, rand);
  const z0 = 0, z1 = D / 2, zc = (z0 + z1) / 2;
  box('uniCream', [W - 0.2, H + 0.6, z1 - z0], 0, (H + 0.6) / 2, zc, true);
  for (let y = 1.2; y < H; y += 1.2) {
    box('uniFrame', [W, 0.05, 0.04], 0, y, z1 + 0.01);
    box('uniFrame', [0.04, 0.05, z1 - z0], W / 2 + 0.01, y, zc);
    box('uniFrame', [0.04, 0.05, z1 - z0], -W / 2 - 0.01, y, zc);
  }
  for (let f = 1; f < def.floors; f++) for (const x of [-W / 2 + 4, -W / 2 + 9]) box('darkGlass', [3.4, 1.6, 0.06], x, f * FLOOR + 1.6, z1 + 0.04);
  for (let f = 0; f < def.floors; f++) for (let z = z0 + 3; z < z1 - 3; z += 5.5) box('darkGlass', [0.06, 1.6, 3.6], -W / 2 - 0.03, f * FLOOR + 1.7, z);
  box('glassClear', [W, 1.1, 0.05], 0, H + 1.15, z1 - 0.1);
  box('glassClear', [0.05, 1.1, z1 - z0], W / 2 - 0.1, H + 1.15, zc);

  const R = 8, cx = W / 2 - R, cz = z1 - R;
  for (let f = 1; f < def.floors; f++) {
    geo('uniCream', new THREE.CylinderGeometry(R + 1.6, R + 1.6, 0.3, 28, 1, false, 0, Math.PI / 2), cx, f * FLOOR, cz);
    geo('glassClear', new THREE.CylinderGeometry(R + 1.5, R + 1.5, 1, 28, 1, true, 0, Math.PI / 2).translate(0, 0.65, 0), cx, f * FLOOR, cz);
    b.box('none', [2, 1.2, 2], at(cx + (R + 0.8) * Math.SQRT1_2, f * FLOOR + 0.6, cz + (R + 0.8) * Math.SQRT1_2), q, true);
  }
  for (let f = 0; f < def.floors; f++) box('darkGlass', [0.06, 1.8, 2.2], W / 2 + 0.03, f * FLOOR + 1.8, z1 - 3);

  const r = 13, ccx = W / 2 - r / 2, ccz = -6, glassH = 3 * FLOOR - 1.6;
  geo('uniFrame', new THREE.CylinderGeometry(r, r, 1.6, 40, 1, false, Math.PI / 6, (2 * Math.PI) / 3).translate(0, 0.8, 0), ccx, 0, ccz);
  geo('darkGlass', new THREE.CylinderGeometry(r - 0.1, r - 0.1, glassH, 40, 1, true, Math.PI / 6, (2 * Math.PI) / 3).translate(0, glassH / 2, 0), ccx, 1.6, ccz);
  geo('uniFrame', new THREE.CylinderGeometry(r + 0.2, r + 0.2, 0.7, 40, 1, false, Math.PI / 6, (2 * Math.PI) / 3).translate(0, 0.35, 0), ccx, 1.6 + glassH, ccz);
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI / 6 + (k / 16) * (2 * Math.PI) / 3;
    box('mullion', [0.08, glassH, 0.08], ccx + Math.sin(a) * r, 1.6 + glassH / 2, ccz + Math.cos(a) * r);
  }
  for (let y = 1.6 + 1.8; y < 1.6 + glassH; y += 1.8) geo('mullion', new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.07, 40, 1, true, Math.PI / 6, (2 * Math.PI) / 3), ccx, y, ccz);
  box('none', [r / 2, 1.6 + glassH, r * 1.5], W / 2 + r / 4, (1.6 + glassH) / 2, ccz, true);

  box('darkGlass', [4.4, 2.6, 0.08], -W / 2 + 7, 1.3, z1 + 0.05);
  box('uniFrame', [6, 0.3, 2.4], -W / 2 + 7, 3.1, z1 + 1.2);
  for (let k = 0; k < 3; k++) box('concrete', [6.4 - k * 0.4, 0.15 * (k + 1), 2 - k * 0.5], -W / 2 + 7, 0.075 * (k + 1), z1 + 1 - k * 0.25, true);
  return { pos: at(W / 2 - 9, H - 2.2, z1 + 0.06), q, w: 8, text: 'INGENIERÍA\nINDUSTRIAL', ink: '#b0613c', font: 'sans' };
}
