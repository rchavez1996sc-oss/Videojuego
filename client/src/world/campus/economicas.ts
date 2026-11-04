import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { chatGroup } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import { FLOOR, wing, type NameSign, type Skin } from './pavilion';

const SKIN: Skin = { kind: 'frame', wall: 'uniWhite', spandrel: 'uniWhite', base: 'uniWhite', plain: true, frame: 'uniWhite' };

/**
 * Facultad de Ciencias Económicas (from the user's photos): a white four-storey slab whose west end is a full-height
 * glass curtain wall on steel mullions; next to it a recessed grey entrance bay with a tall glazed stair strip, a dark
 * fascia with the name over a short canopy, a barred gate and a broad flight of black granite steps with steel
 * railings; the rest is horizontal white bands over window ribbons hung with red and cream curtains, barred on the
 * ground floor; a grey stair tower with vertical fins at the east end; a fruit stall with a pink roof by the steps.
 */
export function economicas(b: Builder, def: CampusBuilding, plants: Plants, rand: () => number): NameSign {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, D = def.d / 2, F = 4, H = F * FLOOR;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, c = false) => b.box(mat, size, at(x, y, z), q, c);
  const GW = 15, BW = 10, TW = 6, x0 = -W + GW + BW, x1 = W - TW;
  wing(b, at, q, (x0 + x1) / 2, 0, x1 - x0, def.d, F, SKIN, rand);
  for (let f = 0; f < F; f++) {
    const y = f * FLOOR;
    box('uniWhite', [x1 - x0 + 0.4, 0.9, 0.9], (x0 + x1) / 2, y + 0.45, D + 0.3, true);
    for (let k = 0; k < 14; k++) if (rand() < 0.7) box(rand() < 0.4 ? 'curtainRed' : 'uniCream', [(x1 - x0) / 14 - 0.4, 1.4, 0.04], x0 + ((k + 0.5) * (x1 - x0)) / 14, y + 1.85, D - 0.1);
    if (f === 0) for (let k = 0; k < 60; k++) box('fenceIron', [0.04, 1.7, 0.04], x0 + 1 + k * ((x1 - x0 - 2) / 60), 1.85, D + 0.02);
  }
  box('uniWhite', [x1 - x0 + 0.6, 0.6, def.d + 0.6], (x0 + x1) / 2, H + 0.3, 0);

  const gx = -W + GW / 2;
  box('darkGlass', [GW - 0.4, H, def.d - 0.4], gx, H / 2, 0, true);
  for (let k = 0; k <= 10; k++) box('steelGrey', [0.12, H, 0.3], -W + 0.2 + k * ((GW - 0.4) / 10), H / 2, D);
  for (let f = 1; f < F; f++) box('steelGrey', [GW, 0.1, 0.25], gx, f * FLOOR, D);
  box('uniWhite', [GW + 0.4, 0.7, def.d + 0.4], gx, H + 0.35, 0);
  box('uniWhite', [0.5, H + 0.7, def.d + 0.4], -W + 0.1, (H + 0.7) / 2, 0);

  const bx = -W + GW + BW / 2, RB = 2.4, P = 1.5, zb = D - RB;
  box('uniGrey', [BW, H, def.d - RB * 2], bx, H / 2, 0, true);
  box('uniGrey', [BW + 0.2, 0.7, def.d], bx, H + 0.35, 0);
  for (const s of [-1, 1]) box('uniGrey', [0.6, H, RB], bx + s * (BW / 2 - 0.3), H / 2, D - RB / 2, true);
  box('winGlass', [3.6, H - P - 4.2, 0.06], bx, P + 4.2 + (H - P - 4.2) / 2, zb + 0.05);
  for (let k = 0; k <= 4; k++) box('steelGrey', [0.06, H - P - 4.2, 0.1], bx - 1.8 + k * 0.9, P + 4.2 + (H - P - 4.2) / 2, zb + 0.1);
  for (let y = P + 5; y < H; y += 1.2) box('steelGrey', [3.6, 0.05, 0.1], bx, y, zb + 0.1);
  box('concrete', [BW - 1.2, P, RB + 1], bx, P / 2, D - RB / 2 + 0.5, true);
  for (let k = 0; k < 10; k++) box('graniteBlack', [BW + 3, (P * (10 - k)) / 10, 0.34], bx, (P * (10 - k)) / 20, D + 1 + k * 0.34, true);
  for (const s of [-1, 1]) {
    box('alu', [0.05, 0.05, 4], bx + s * (BW / 2 + 1.3), P / 2 + 1.0, D + 2.6);
    box('none', [0.1, 1.1, 3.4], bx + s * (BW / 2 + 1.3), P / 2 + 0.5, D + 2.6, true);
  }
  box('uniWhite', [6, 0.25, 3], bx, P + 3.2, zb + 1.6);
  box('graniteBlack', [9, 0.85, 0.3], bx, P + 3.55, zb + 3.1);
  for (let k = 0; k < 12; k++) box('fenceIron', [0.05, 2.6, 0.05], bx - 1.6 + k * 0.29, P + 1.3, zb + 0.08);
  box('darkGlass', [3.4, 2.6, 0.04], bx, P + 1.3, zb + 0.02);

  const tx = W - TW / 2;
  box('uniGrey', [TW, H + 2.5, def.d * 0.6], tx, (H + 2.5) / 2, -def.d * 0.1, true);
  for (let k = 0; k < 10; k++) box('alu', [0.12, H + 1.5, 0.5], tx - TW / 2 + 0.6 + k * 0.52, (H + 1.5) / 2, -def.d * 0.1 + def.d * 0.3 + 0.2);

  const kx = -W + 4, kz = D + 4;
  box('uniWhite', [3.6, 2.4, 2.4], kx, 1.2, kz, true);
  box('roofTileRed', [4.2, 0.25, 3], kx, 2.55, kz);
  box('pavRed', [9, 0.08, 6], kx + 2, 0.04, kz);
  plants.pines.push(at(-W + GW + 1, 0, D + 6));
  for (let i = 0; i < 3; i++) chatGroup(plants.standing, at(bx + (rand() - 0.5) * 16, 0.05, D + 7 + rand() * 4), rand);
  return { pos: at(bx, P + 3.55, zb + 3.27), q, w: 8.4, text: def.name ?? 'FACULTAD DE CIENCIAS ECONÓMICAS', ink: '#f2f0ea', font: 'serif' };
}
