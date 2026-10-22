import * as THREE from 'three';
import type { Builder } from '../buildingKit';

const Q = new THREE.Quaternion();
const PAINT = ['houseWhite', 'houseWhite', 'houseCream', 'houseGray', 'houseWarm'];

/**
 * Modern Miraflores house on a narrow lot: white/cream cubic volumes of 2–4 floors, big dark windows,
 * a set-back top floor with a glass terrace, sometimes a brick or timber-slat panel; on the street a
 * wall with a wooden garage gate or an iron railing, and a small front garden. Returns the garden tree spot.
 */
export function house(b: Builder, x0: number, w: number, zFace: number, s: 1 | -1, rand: () => number): THREE.Vector3 | null {
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x0 + x, y, zFace - s * z);
  const floors = 2 + Math.floor(rand() * 2.6), H = floors * 3, d = 12, yard = 3, paint = PAINT[Math.floor(rand() * PAINT.length)];
  const top = floors > 2 && rand() < 0.7, bodyH = top ? H - 3 : H, inset = 0.4;
  b.box(paint, [w - inset * 2, bodyH, d], at(w / 2, bodyH / 2, yard + d / 2), Q);
  if (top) {
    b.box(paint, [w * 0.6, 3, d - 3], at(w * 0.35, bodyH + 1.5, yard + d / 2 + 1.5), Q);
    for (let x = inset + 0.3; x < w - inset; x += 2.4) b.box('railGlass', [Math.min(2.4, w - inset - x), 1, 0.05], at(x + 1.2, bodyH + 0.55, yard + 0.2), Q, false);
    b.box('alu', [w - inset * 2, 0.06, 0.08], at(w / 2, bodyH + 1.06, yard + 0.2), Q, false);
  }
  b.box('slab', [w - inset * 2 + 0.3, 0.3, 0.4], at(w / 2, bodyH + 0.15, yard - 0.1), Q, false);
  const accent = rand();
  if (accent < 0.25) b.box('houseBrick', [w * 0.35, bodyH - 0.4, 0.1], at(w - inset - w * 0.175, bodyH / 2 + 0.2, yard - 0.04), Q, false);
  else if (accent < 0.45) for (let x = inset + 0.2; x < w * 0.3; x += 0.22) b.box('woodSlat', [0.12, bodyH - 3.2, 0.12], at(x, (bodyH + 3.2) / 2, yard - 0.07), Q, false);
  for (let f = 0; f < floors - (top ? 1 : 0); f++) {
    const y = f * 3 + (f ? 1.0 : 1.2), wide = rand() < 0.5;
    const ww = wide ? w * 0.55 : 1.6, wx = wide ? w * 0.5 : w * 0.3 + rand() * w * 0.4;
    if (f === 0) b.box('woodGate', [1.1, 2.3, 0.08], at(w * 0.78, 1.15, yard - 0.04), Q, false);
    b.box('lobby', [ww, f ? 1.7 : 1.5, 0.08], at(wx, y + 0.8, yard - 0.04), Q, false);
    b.box('alu', [ww + 0.1, 0.06, 0.12], at(wx, y + (f ? 1.68 : 1.58), yard - 0.06), Q, false);
    if (f && rand() < 0.35) {
      b.box('slab', [ww + 0.6, 0.15, 1], at(wx, y - 0.15, yard - 0.5), Q, false);
      b.box('railGlass', [ww + 0.6, 1, 0.05], at(wx, y + 0.4, yard - 0.98), Q, false);
    }
  }
  if (rand() < 0.55) {
    b.box(paint, [w, 2.3, 0.22], at(w / 2, 1.15, 0.11), Q);
    b.box('woodGate', [Math.min(3.2, w * 0.4), 2.1, 0.1], at(w * 0.28, 1.05, -0.02), Q, false);
    b.box('woodGate', [1, 2.1, 0.1], at(w * 0.72, 1.05, -0.02), Q, false);
  } else {
    b.box(paint, [w, 0.5, 0.25], at(w / 2, 0.25, 0.12), Q);
    for (let x = 0.15; x < w; x += 0.2) b.box('fenceIron', [0.04, 1.7, 0.04], at(x, 1.35, 0.12), Q, false);
    for (const y of [0.6, 2.15]) b.box('fenceIron', [w, 0.06, 0.06], at(w / 2, y, 0.12), Q, false);
    b.box('none', [w, 2.2, 0.3], at(w / 2, 1.1, 0.12), Q, true);
  }
  return rand() < 0.4 ? at(w * (0.2 + rand() * 0.6), 0, 1.6) : null;
}
