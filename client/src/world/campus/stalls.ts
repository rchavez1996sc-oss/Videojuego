import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { framer, yawQ, type CampusDef } from './layout';
import type { NameSign } from './pavilion';

type Stall = NonNullable<CampusDef['stalls']>[number];
const SNACKS = ['uniRed', 'uniYellow', 'paneBlue', 'kioskGreen', 'uniOrange', 'uniWhite'];

/**
 * Campus small trade and services (local +z = front): a sheet-metal `kiosk` with a counter, snack racks and a striped
 * awning; a `copies` module with a raised roll-up shutter, counter and photocopiers inside; an `office` module (Admisión,
 * Bienestar, Tópico…) with door, barred windows and a notice board. Each gets a sign and a few students outside.
 */
export function stall(b: Builder, s: Stall, plants: Plants, rand: () => number): NameSign {
  const at = framer(s), q = yawQ(s.yaw), box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const queue = (n: number, z: number) => {
    for (let i = 0; i < n; i++) plants.standing.push({ pos: at((rand() - 0.5) * 2.4, 0.02, z + 0.9 + i * 0.85), yaw: (-s.yaw * Math.PI) / 180 + Math.PI + (rand() - 0.5) * 0.6, key: rand() < 0.5 ? 'texting' : 'civ_idle' });
  };
  if (s.kind === 'kiosk') {
    box('kioskGreen', [2.4, 2.3, 1.8], 0, 1.15, -0.2, true);
    box('alu', [2.2, 0.1, 0.5], 0, 1.05, 0.8, true);
    box('darkGlass', [2, 1.05, 0.04], 0, 1.65, 0.71);
    for (let r = 0; r < 3; r++) {
      box('alu', [2, 0.03, 0.12], 0, 1.18 + r * 0.33, 0.8);
      for (let k = 0; k < 7; k++) box(SNACKS[Math.floor(rand() * SNACKS.length)], [0.2, 0.24, 0.07], -0.75 + k * 0.25, 1.32 + r * 0.33, 0.8);
    }
    for (let k = 0; k < 6; k++) box(k % 2 ? 'uniWhite' : 'uniRed', [0.5, 0.06, 1.2], -1.25 + k * 0.5, 2.45, 1.1);
    box('kioskGreen', [2.6, 0.12, 2.1], 0, 2.36, -0.2);
    box('lampPole', [0.5, 0.45, 0.5], 1.6, 0.22, 0.9, true);
    queue(2 + Math.floor(rand() * 2), 1.4);
    return { pos: at(0, 2.75, 0.75), q, w: 2.3, text: s.text, ink: '#ffffff', font: 'sans', plate: '#c42a22' };
  }
  if (s.kind === 'copies') {
    box('uniCream', [5, 3, 0.25], 0, 1.5, -2);
    for (const x of [-2.4, 2.4]) box('uniCream', [0.25, 3, 4], x, 1.5, 0, true);
    box('uniCream', [5.2, 0.3, 4.4], 0, 3.15, 0, true);
    box('none', [5, 3, 0.3], 0, 1.5, -2, true);
    box('shutter', [4.4, 0.5, 0.15], 0, 2.7, 1.9);
    box('alu', [4.2, 1, 0.5], 0, 0.5, 1.4, true);
    for (const x of [-1.4, 0.2]) {
      box('uniWhite', [1, 1, 0.7], x, 0.5, -1.2, true);
      box('darkGlass', [0.9, 0.04, 0.5], x, 1.02, -1.2);
    }
    for (let k = 0; k < 8; k++) box('paper', [0.21, 0.02 + rand() * 0.06, 0.3], -1.6 + k * 0.45, 1.03, 1.4);
    queue(3, 1.7);
    return { pos: at(0, 3.55, 2.24), q, w: 4.6, text: s.text, ink: '#1c3f8f', font: 'sans', plate: '#f4f1e8' };
  }
  box('uniWhite', [8, 3.4, 6], 0, 1.7, 0, true);
  box('uniBlue', [8.04, 0.5, 6.04], 0, 0.25, 0);
  box('darkGlass', [1.2, 2.3, 0.06], -2.2, 1.15, 3.02);
  for (const x of [-0.1, 1.8]) {
    box('winGlass', [1.4, 1.1, 0.06], x, 1.8, 3.02);
    for (let k = 0; k < 5; k++) box('fenceIron', [0.03, 1.1, 0.04], x - 0.6 + k * 0.3, 1.8, 3.07);
  }
  box('cork', [1.1, 0.9, 0.05], 3.3, 1.4, 3.03);
  for (let k = 0; k < 4; k++) box('paper', [0.28, 0.38, 0.02], 3.05 + (k % 2) * 0.5, 1.2 + Math.floor(k / 2) * 0.42, 3.06);
  box('uniFrame', [2.4, 0.15, 1.4], -2.2, 2.55, 3.6);
  box('concrete', [2.2, 0.15, 1], -2.2, 0.07, 3.5, true);
  queue(Math.floor(rand() * 3), 3.4);
  return { pos: at(0, 3.0, 3.06), q, w: Math.min(7, s.text.length * 0.26 + 1), text: s.text, ink: '#1c1c1c', font: 'sans', plate: '#ebe8e0' };
}
