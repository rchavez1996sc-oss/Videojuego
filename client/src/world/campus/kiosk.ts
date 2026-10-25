import type { Builder } from '../buildingKit';
import { framer, yawQ } from './layout';
import type { NameSign } from './pavilion';

/** Banco de la Nación "multiRed" ATM booth (from the user's photo): red frame and roof fascia, glass sides with a frosted band, ATM at the back, open front. Local +z faces the sidewalk. */
export function multired(b: Builder, k: { x: number; z: number; yaw: number }): NameSign {
  const at = framer(k), q = yawQ(k.yaw), box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const W = 1.1, D = 1.0, H = 2.55;
  box('concrete', [W * 2 + 0.2, 0.1, D * 2 + 0.2], 0, 0.05, 0, true);
  for (const [x, z] of [[-W, -D], [W, -D], [-W, D], [W, D], [0.15, D]]) box('uniRed', [0.1, H, 0.1], x, H / 2, z);
  box('uniRed', [W * 2 + 0.5, 0.55, D * 2 + 0.5], 0, H + 0.27, 0.05);
  box('uniWhite', [W * 2 + 0.3, 0.06, D * 2 + 0.3], 0, H, 0.05);
  for (const s of [-1, 1]) {
    box('glassClear', [0.03, H - 0.2, D * 2], s * W, H / 2, 0);
    box('uniWhite', [0.035, 0.18, D * 2], s * W, 1.45, 0);
    box('none', [0.1, H, D * 2], s * W, H / 2, 0, true);
  }
  box('uniWhite', [W * 2, H, 0.08], 0, H / 2, -D + 0.05, true);
  box('glassClear', [1.15, H - 0.2, 0.03], 0.15 + 0.58, H / 2, D);
  box('uniWhite', [1.15, 0.18, 0.035], 0.73, 1.45, D);
  box('alu', [0.62, 1.5, 0.55], -0.45, 0.75, -D + 0.4, true);
  box('darkGlass', [0.36, 0.28, 0.04], -0.45, 1.28, -D + 0.69);
  box('uniRed', [0.08, 0.9, 0.08], W + 0.12, 0.45, D - 0.3);
  return { pos: at(0.05, H + 0.27, D + 0.31), q, w: 1.7, text: 'multiRed', ink: '#f2e2c8', font: 'sans' };
}
