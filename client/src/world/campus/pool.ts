import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import type { NameSign } from './pavilion';

const DECK = 0.35, WALL = 2.4, LANES = 6, LANE = 2.1;

/**
 * Piscina universitaria (open air, from the user's photo): a 25 m basin of light-blue water with yellow, white and
 * green lane ropes and starting blocks, set in a raised concrete deck; blue painted perimeter wall with the entrance
 * on the street side (gate frame, sign), a low changing-room block with a striped awning, trees outside the wall.
 */
export function pool(b: Builder, def: CampusBuilding, plants: Plants, rand: () => number): NameSign {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, D = def.d / 2;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const bw = (LANES * LANE) / 2, bl = 12.5, bz = 1.2;
  box('concrete', [def.w - 0.4, DECK, D - bl + bz - 0.2], 0, DECK / 2, (-D + bz - bl) / 2, true);
  box('concrete', [def.w - 0.4, DECK, D - bl - bz - 0.2], 0, DECK / 2, (D + bz + bl) / 2, true);
  for (const s of [-1, 1]) box('concrete', [W - bw - 0.2, DECK, bl * 2], s * (W + bw) / 2, DECK / 2, bz, true);
  box('poolTile', [bw * 2, 0.04, bl * 2], 0, 0.02, bz);
  for (const s of [-1, 1]) {
    box('poolTile', [0.12, DECK, bl * 2], s * (bw - 0.06), DECK / 2, bz);
    box('poolTile', [bw * 2, DECK, 0.12], 0, DECK / 2, bz + s * (bl - 0.06));
    box('uniWhite', [0.35, 0.06, bl * 2 + 0.7], s * (bw + 0.17), DECK + 0.03, bz);
    box('uniWhite', [bw * 2 + 0.7, 0.06, 0.35], 0, DECK + 0.03, bz + s * (bl + 0.17));
  }
  box('poolWater', [bw * 2, 0.02, bl * 2], 0, DECK - 0.1, bz);
  for (let i = 0; i < LANES; i++) box('paneBlue', [0.25, 0.01, bl * 2 - 3], -bw + LANE * (i + 0.5), 0.05, bz);
  for (let i = 1; i < LANES; i++) for (let k = 0; k < 25; k++) {
    const mat = i % 3 === 0 ? 'paneYellow' : i % 3 === 1 ? 'uniWhite' : 'hedge';
    box(k % 4 === 0 ? 'uniRed' : mat, [0.12, 0.1, 0.95], -bw + LANE * i, DECK - 0.07, bz - bl + 0.5 + k * 1.0);
  }
  for (let i = 0; i < LANES; i++) {
    box('uniWhite', [0.5, 0.55, 0.6], -bw + LANE * (i + 0.5), DECK + 0.27, bz - bl - 0.55, true);
    box('paneBlue', [0.5, 0.04, 0.6], -bw + LANE * (i + 0.5), DECK + 0.56, bz - bl - 0.55);
  }
  for (const s of [-1, 1]) for (const z of [bz - bl + 2, bz + bl - 2]) for (const x of [0, 0.5]) box('alu', [0.05, 1.1, 0.05], s * (bw + 0.15 + x), DECK + 0.4, z);

  const wall = (len: number, x: number, z: number, alongX: boolean) => {
    const s = (h: number, t: number): [number, number, number] => (alongX ? [len, h, t] : [t, h, len]);
    box('poolBlue', s(WALL, 0.25), x, WALL / 2, z, true);
    box('uniWhite', s(0.15, 0.3), x, WALL + 0.07, z);
  };
  for (const s of [-1, 1]) wall(def.d, s * (W - 0.12), 0, false);
  wall(def.w, 0, D - 0.12, true);
  const gate = 3.2, side = (W - gate / 2) / 2;
  for (const s of [-1, 1]) wall(W - gate / 2, s * (gate / 2 + side), -D + 0.12, true);
  for (const s of [-1, 1]) box('uniWhite', [0.45, 3.2, 0.45], s * (gate / 2 + 0.22), 1.6, -D + 0.12, true);
  box('uniWhite', [gate + 0.9, 0.5, 0.45], 0, 3.3, -D + 0.12);
  box('concrete', [gate + 0.4, DECK / 2, 1.2], 0, DECK / 4, -D - 0.5, true);

  box('uniWhite', [def.w - 4, 3, 3.2], 0, 1.5, D - 2.1, true);
  box('poolBlue', [def.w - 3.9, 0.4, 3.25], 0, 0.2, D - 2.1);
  for (let k = 0; k < 4; k++) box('darkGlass', [1, 2.1, 0.06], -6 + k * 4, 1.05, D - 3.73);
  for (let k = 0; k < 8; k++) box(k % 2 ? 'uniWhite' : 'uniRed', [1.2, 0.06, 1.6], -4.2 + k * 1.2, 2.65, D - 4.4);
  for (let i = 0; i < 6; i++) plants.trees.push(at((i % 2 ? 1 : -1) * (W + 3 + rand() * 2), 0, -D + 4 + i * 5));
  return { pos: at(0, 3.3, -D - 0.12), q, w: 4, text: 'PISCINA UNIVERSITARIA', ink: '#1c3f8f', font: 'sans', plate: '#f4f1e8' };
}
