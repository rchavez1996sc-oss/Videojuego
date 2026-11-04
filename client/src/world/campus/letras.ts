import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { chatGroup } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import { FLOOR, wing, type NameSign, type Skin } from './pavilion';

const SKIN: Skin = { kind: 'frame', wall: 'letBlue', spandrel: 'letBlue', base: 'letBlue', plain: true, glass: 'paneGrid', frame: 'letNavy' };

/**
 * Facultad de Letras y Ciencias Humanas (from the user's photos): three-storey light-blue wings round a courtyard,
 * steel-framed window walls with frosted and tilted panes between navy posts and trims. The front wing has a deep
 * portico: a cantilevered slab whose navy fascia carries the name in gold letters, square blue pillars, a polished
 * terrazzo floor with dark inset squares, glass doors, black granite steps the full width, black planters of pink
 * geraniums and a bust on a white pedestal; a straight walk with a garden strip leads to it.
 */
export function letras(b: Builder, def: CampusBuilding, plants: Plants, rand: () => number): NameSign {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, D = def.d / 2, t = Math.min(13, def.d / 3.2);
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, c = false) => b.box(mat, size, at(x, y, z), q, c);
  wing(b, at, q, 0, -D + t / 2, def.w, t, 3, SKIN, rand);
  for (const s of [-1, 1]) wing(b, at, q, s * (W - t / 2), 0, t, def.d - 2 * t, 3, SKIN, rand);
  wing(b, at, q, 0, D - t / 2, def.w, t, 3, SKIN, rand);

  const PW = 24, PD = 4.6, Y = 0.45, zf = D;
  box('terrazzo', [PW, Y, PD], 0, Y / 2, zf + PD / 2, true);
  for (let i = 0; i < 9; i++) box('graniteBlack', [0.6, 0.01, 0.6], -PW / 2 + 2 + i * 2.5, Y + 0.005, zf + 1.4 + (i % 2) * 1.6);
  for (let k = 0; k < 3; k++) box('graniteBlack', [PW, Y - k * 0.15, 0.35], 0, (Y - k * 0.15) / 2, zf + PD + 0.17 + k * 0.35, true);
  box('uniWhite', [PW + 1, 0.35, PD + 0.6], 0, FLOOR - 0.15, zf + PD / 2 + 0.3);
  box('letNavy', [PW + 1.1, 1.6, 0.3], 0, FLOOR + 0.6, zf + PD + 0.55, true);
  box('letBlue', [PW + 1.2, 0.3, 0.4], 0, FLOOR + 1.55, zf + PD + 0.55);
  for (const x of [-PW / 2 + 0.6, -PW / 6, PW / 6, PW / 2 - 0.6]) box('letBlue', [0.8, FLOOR - 0.1, 0.8], x, (FLOOR - 0.1) / 2, zf + PD - 0.1, true);
  box('tubeLight', [1.4, 0.05, 0.3], -5, FLOOR - 0.34, zf + 2.3);
  box('tubeLight', [1.4, 0.05, 0.3], 5, FLOOR - 0.34, zf + 2.3);
  box('glassClear', [PW - 4, FLOOR - 0.6, 0.05], 0, Y + (FLOOR - 0.6) / 2, zf + 0.12);
  for (let k = 0; k <= 8; k++) box('alu', [0.07, FLOOR - 0.6, 0.1], -(PW - 4) / 2 + k * (PW - 4) / 8, Y + (FLOOR - 0.6) / 2, zf + 0.14);
  box('alu', [PW - 4, 0.07, 0.1], 0, Y + 2.4, zf + 0.14);
  box('darkGlass', [3.2, 2.3, 0.04], 0, Y + 1.15, zf + 0.08);
  box('none', [PW - 4, FLOOR, 0.3], 0, FLOOR / 2, zf + 0.15, true);

  box('graniteBlack', [3.8, 0.75, 1.6], PW / 2 - 2.2, Y + 0.37, zf + PD - 1.2, true);
  box('lawnBed', [3.6, 0.1, 1.4], PW / 2 - 2.2, Y + 0.76, zf + PD - 1.2);
  for (let i = 0; i < 9; i++) box(i % 3 ? 'flowerRed' : 'hedge', [0.35, 0.3, 0.35], PW / 2 - 3.6 + (i % 5) * 0.65, Y + 0.95, zf + PD - 1.6 + Math.floor(i / 5) * 0.7);
  const bp = at(-PW / 2 + 2.2, Y, zf + PD - 1.4);
  b.box('uniWhite', [0.8, 1.5, 0.8], bp.clone().setY(Y + 0.75), q, true);
  const head = new THREE.Matrix4().compose(bp.clone().setY(Y + 1.85), q, new THREE.Vector3(1, 1.15, 1));
  b.geometry('bronze', new THREE.SphereGeometry(0.2, 12, 10), head);
  b.geometry('bronze', new THREE.CylinderGeometry(0.3, 0.38, 0.32, 10), new THREE.Matrix4().compose(bp.clone().setY(Y + 1.62), q, new THREE.Vector3(1, 1, 0.6)));

  const walk = 4, len = 26;
  box('concrete', [walk, 0.12, len], 0, 0.06, zf + PD + 1.2 + len / 2);
  for (const s of [-1, 1]) {
    box('lawnBed', [3, 0.1, len], s * (walk / 2 + 1.6), 0.05, zf + PD + 1.2 + len / 2);
    for (let i = 0; i < 5; i++) plants.trees.push(at(s * (walk / 2 + 1.6), 0, zf + PD + 4 + i * 5.5));
  }
  for (let i = 0; i < 3; i++) chatGroup(plants.standing, at((rand() - 0.5) * PW * 0.8, Y, zf + PD + 3 + rand() * 4), rand);
  return { pos: at(0, FLOOR + 0.6, zf + PD + 0.72), q, w: PW * 0.8, text: def.name ?? 'FACULTAD DE LETRAS Y CIENCIAS HUMANAS', ink: '#d9b04a', font: 'sans' };
}
