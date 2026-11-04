import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { chatGroup } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import { FLOOR, wing, type NameSign, type Skin } from './pavilion';

const SKIN: Skin = { kind: 'frame', wall: 'derCream', spandrel: 'derCream', base: 'derCream', plain: true, frame: 'derCream' };

/**
 * Facultad de Derecho y Ciencia Política (from the user's photos): a cream entrance block — white lattice grille over
 * the ground floor, the name in relief on the cornice band above it, a broad stair with steel railings — beside a
 * three-storey gallery wing: open corridors on cantilevered slabs (terrazzo floor, dark-panel railings with a steel top
 * rail) in front of a pinkish wall with wooden doors, crowned by a black fascia of white panels painted with pre-Columbian figures. The Auditorio José León
 * Barandiarán (Salón de Actos, brass plaque by its doors) is on the gallery's second floor; a brown stair tower closes the far end. Front = local +z.
 */
export function derecho(b: Builder, def: CampusBuilding, plants: Plants, rand: () => number): NameSign[] {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, D = def.d / 2, F = 3, H = F * FLOOR;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, c = false) => b.box(mat, size, at(x, y, z), q, c);
  const EW = 20, ex = -W + EW / 2, P = 1.4;
  wing(b, at, q, ex, -1.5, EW, def.d - 3, F, SKIN, rand);
  box('derCream', [EW, FLOOR + P, 4], ex, (FLOOR + P) / 2, D - 2.5, true);
  box('derCream', [EW + 0.4, 0.9, 1.2], ex, FLOOR + P + 0.2, D - 0.3, true);
  const gw = EW - 4, gy = P + 0.1, gh = FLOOR - 0.6;
  box('darkGlass', [gw, gh, 0.06], ex, gy + gh / 2, D - 0.5);
  for (let k = 0; k <= 20; k++) box('uniWhite', [0.07, gh, 0.08], ex - gw / 2 + k * (gw / 20), gy + gh / 2, D - 0.4);
  for (let y = gy + 0.4; y < gy + gh; y += 0.55) box('uniWhite', [gw, 0.06, 0.08], ex, y, D - 0.4);
  box('uniWhite', [0.5, FLOOR - 0.3, 0.5], ex, P + (FLOOR - 0.3) / 2, D - 0.1, true);
  box('concrete', [EW - 2, P, 2.4], ex, P / 2, D + 0.6, true);
  for (let k = 0; k < 8; k++) box('concrete', [EW - 2, (P * (8 - k)) / 8, 0.32], ex, (P * (8 - k)) / 16, D + 1.95 + k * 0.32, true);
  for (const x of [-EW / 2 + 1.4, -2.5, 2.5, EW / 2 - 1.4]) {
    box('alu', [0.05, 0.05, 3.2], ex + x, P * 0.5 + 0.95, D + 3.1);
    box('none', [0.1, 1, 3], ex + x, P * 0.5 + 0.4, D + 3.1, true);
  }

  const gx0 = -W + EW, gL = W - gx0 - 6, gxc = gx0 + gL / 2, back = D - 5;
  box('derBrown', [gL, H, def.d - 5], gxc, H / 2, back - (def.d - 5) / 2, true);
  for (let f = 1; f <= F; f++) {
    const y = f * FLOOR;
    box(f < F ? 'terrazzo' : 'derCream', [gL, 0.3, 5.2], gxc, y - 0.15, back + 2.4, f < F);
    box('derCream', [gL, 0.4, 5.2], gxc, y - 0.5, back + 2.4);
    if (f < F) {
      box('derCream', [gL, 0.35, 0.2], gxc, y + 0.05, D - 0.1);
      box('mullion', [gL, 0.45, 0.04], gxc, y + 0.6, D - 0.15);
      box('alu', [gL, 0.06, 0.08], gxc, y + 1.05, D - 0.15);
      for (let k = 0; k <= Math.round(gL / 1.6); k++) box('alu', [0.04, 1.05, 0.04], gx0 + k * 1.6, y + 0.55, D - 0.15);
      box('none', [gL, 1.1, 0.1], gxc, y + 0.55, D - 0.15, true);
    }
  }
  for (let f = 0; f < F; f++) for (let k = 0; k < 5; k++) box('woodRed', [1.3, 2.2, 0.06], gx0 + 3 + k * (gL - 6) / 4, f * FLOOR + (f ? 0.15 : 0) + 1.1, back + 0.03);
  box('frieze', [gL, 1.7, 0.3], gxc, H + 0.85, D + 0.05);
  box('graniteBlack', [gL + 0.3, 0.25, 5.6], gxc, H + 1.8, back + 2.4);
  box('graniteBlack', [EW + 0.3, 0.25, def.d - 2.6], ex, H + 0.15, -1.2);
  box('frieze', [EW, 1.4, 0.3], ex, H + 0.75, D - 2.9);
  for (let k = 0; k < 20; k++) box('uniWhite', [0.06, 2.4, 0.06], gx0 + 1 + k * (gL - 2) / 20, 1.2, D - 0.2);
  const tx = W - 3;
  box('derBrown', [6, H + 2.5, 8], tx, (H + 2.5) / 2, D - 6, true);
  box('darkGlass', [0.06, H - 2, 4], tx - 3.03, FLOOR + (H - 2) / 2, D - 6);
  plants.palms.push(at(gxc - 6, 0, D + 4), at(gxc + 8, 0, D + 4));
  for (let i = 0; i < 2; i++) chatGroup(plants.standing, at(ex + (rand() - 0.5) * 10, 0.05, D + 6 + rand() * 3), rand);
  return [
    { pos: at(ex, FLOOR + P + 0.2, D + 0.31), q, w: EW * 0.8, text: 'FACULTAD DE DERECHO Y CIENCIA POLÍTICA', ink: '#8c7d63' },
    { pos: at(gx0 + 3 + (gL - 6) / 4, FLOOR + 2.85, back + 0.08), q, w: 2.2, text: 'SALÓN DE ACTOS\n"JOSÉ LEÓN BARANDIARÁN"', ink: '#3a2a12', plate: '#c9a85a' },
  ];
}
