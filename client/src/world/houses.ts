import * as THREE from 'three';
import type { Builder, Opening } from './buildingKit';

export interface Lot { x: number; z: number; y: number; facing: number; w: number; d: number; floors?: number }

const UP = new THREE.Vector3(0, 1, 0);
export const PAINTS = ['paint-celeste', 'paint-amarillo', 'paint-rosado', 'paint-verde', 'paint-crema', 'paint-naranja'];
const FLOOR = 2.7, T = 0.25;

type At = (x: number, y: number, z: number) => THREE.Vector3;

function frame(lot: Lot): { q: THREE.Quaternion; at: At } {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, lot.facing);
  const at: At = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(lot.x, lot.y, lot.z));
  return { q, at };
}

function windowBars(b: Builder, at: At, q: THREE.Quaternion, x: number, y: number, z: number, w: number, h: number): void {
  b.box('glass', [w, h, 0.05], at(x, y + h / 2, z - 0.08), q, false);
  for (let i = 1; i < Math.round(w / 0.14); i++) b.box('bars', [0.02, h, 0.02], at(x - w / 2 + i * 0.14, y + h / 2, z + 0.02), q, false);
  b.box('bars', [w, 0.03, 0.03], at(x, y + h * 0.5, z + 0.02), q, false);
}

/**
 * Urban lot house: brick shell with concrete frame, 1–3 floors, flat slab roof.
 * Local frame: +z is the street-facing front, origin at the front-centre on the ground.
 */
export function cityHouse(b: Builder, lot: Lot, rand: () => number, sign: (at: THREE.Vector3, q: THREE.Quaternion, w: number) => void, exposedSide = 0): void {
  const { q, at } = frame(lot);
  const floors = lot.floors ?? (rand() < 0.3 ? 1 : rand() < 0.65 ? 2 : 3);
  const w = lot.w - 0.06, d = lot.d, H = floors * FLOOR, sink = 0.8;
  const painted = rand() < 0.55;
  const paint = PAINTS[Math.floor(rand() * PAINTS.length)];
  const front = (f: number) => (painted && (f === 0 || rand() < 0.6) ? paint : 'brick');

  for (let f = 0; f < floors; f++) {
    const y0 = f * FLOOR - (f === 0 ? sink : 0), h = FLOOR + (f === 0 ? sink : 0);
    const openings: Opening[] = [];
    const base = f === 0 ? sink : 0;
    if (f === 0) {
      const shop = rand() < 0.35 && w > 6.5;
      openings.push({ x: -w / 2 + 1.6, w: 1.0, y: base, h: 2.1 });
      if (shop) openings.push({ x: w / 2 - 2.2, w: 2.8, y: base, h: 2.3 });
      else openings.push({ x: w / 4, w: 1.3, y: base + 0.9, h: 1.1 });
    } else {
      openings.push({ x: -w / 4, w: 1.3, y: 0.9, h: 1.1 }, { x: w / 4, w: 1.3, y: 0.9, h: 1.1 });
    }
    b.wall(front(f), w, h, T, at(0, y0, -T / 2), lot.facing, openings);
    b.wall('brick', w, h, T, at(0, y0, -d + T / 2), lot.facing + Math.PI);
    for (const s of [1, -1]) {
      const exposed = s === exposedSide;
      const side: Opening[] = exposed ? [{ x: -d / 4, w: 1.2, y: base + 0.9, h: 1.0 }, { x: d / 4, w: 1.2, y: base + 0.9, h: 1.0 }] : [];
      b.wall(exposed ? front(f) : 'brick', d - 2 * T, h, T, at(s * (w / 2 - T / 2), y0, -d / 2), lot.facing + s * Math.PI / 2, side);
      if (exposed) for (const o of side) windowBars(b, (x, y, z) => at(s * (w / 2) + s * z, y, -d / 2 - s * x), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, s * Math.PI / 2)), o.x, y0 + o.y, 0, o.w, o.h);
    }
    b.box('concrete', [w, 0.22, d], at(0, (f + 1) * FLOOR - 0.11, -d / 2), q);
    b.box('concrete', [w + 0.04, 0.25, 0.3], at(0, (f + 1) * FLOOR - 0.12, 0.02), q, false);
    for (const s of [1, -1]) b.box('concrete', [0.3, FLOOR, 0.3], at(s * (w / 2 - 0.12), f * FLOOR + FLOOR / 2, 0.02), q, false);
    for (const o of openings) {
      if (o.y <= base + 0.01) {
        const metal = o.w > 2 ? 'shutter' : 'door';
        b.box(metal, [o.w, o.h, 0.06], at(o.x, y0 + o.y + o.h / 2, -0.12), q, false);
        if (o.w > 2 && rand() < 0.7) sign(at(o.x, y0 + o.y + o.h + 0.35, 0.03), q, o.w + 0.6);
      } else windowBars(b, at, q, o.x, y0 + o.y, 0, o.w, o.h);
    }
    if (f > 0 && rand() < 0.3) b.box('concrete', [w * 0.6, 0.12, 0.7], at(0, f * FLOOR + 0.06, 0.35), q, false);
  }
  b.box('concrete', [w, 0.45, 0.15], at(0, H + 0.22, -0.08), q);
  if (rand() < 0.65) {
    for (const [x, z] of [[-1, 0], [1, 0], [-1, -1], [1, -1]]) {
      for (let k = 0; k < 3; k++) b.box('rebar', [0.025, 0.7 + rand() * 0.6, 0.025], at(x * (w / 2 - 0.15) + (k - 1) * 0.06, H + 0.4, z * (d - 0.2) - 0.1 + (k % 2) * 0.05), q, false);
    }
  }
  if (rand() < 0.25 && floors < 3) {
    for (const [x, z] of [[-1, 0], [1, 0], [-1, -1], [1, -1]]) b.box('concrete', [0.25, FLOOR * 0.8, 0.25], at(x * (w / 2 - 0.15), H + FLOOR * 0.4, z * (d - 0.3) - 0.15), q, false);
    b.wall('brick', w, 1.1 + rand() * 0.8, T, at(0, H, -d + T / 2), lot.facing + Math.PI);
  }
  if (rand() < 0.55) {
    const tank = new THREE.CylinderGeometry(0.55, 0.6, 1.2, 14);
    const m = new THREE.Matrix4().compose(at((rand() - 0.5) * (w - 1.5), H + 0.6, -d * (0.3 + rand() * 0.4)), q, new THREE.Vector3(1, 1, 1));
    b.geometry(rand() < 0.5 ? 'tankBlack' : 'tankBlue', tank, m);
  }
}

/** Hillside shack: one storey of brick, reed mat or tin on a stone retaining base. */
export function hillHouse(b: Builder, lot: Lot, rand: () => number, baseLow: number): void {
  const { q, at } = frame(lot);
  const w = lot.w, d = lot.d, h = 2.4;
  const mat = rand() < 0.4 ? 'brick' : rand() < 0.6 ? 'estera' : 'calamina';
  const baseH = lot.y - baseLow + 0.3;
  b.box('stone', [w + 0.6, baseH, d + 0.6], at(0, -baseH / 2 + 0.15, -d / 2), q);
  b.wall(mat, w, h, 0.15, at(0, 0.15, -0.08), lot.facing, [{ x: -w / 4, w: 0.9, y: 0, h: 1.95 }, { x: w / 4, w: 0.9, y: 0.9, h: 0.7 }]);
  b.wall(mat, w, h, 0.15, at(0, 0.15, -d + 0.08), lot.facing + Math.PI);
  for (const s of [1, -1]) b.wall(mat, d - 0.3, h, 0.15, at(s * (w / 2 - 0.08), 0.15, -d / 2), lot.facing + s * Math.PI / 2);
  b.box('door', [0.9, 1.95, 0.04], at(-w / 4, 1.1, -0.1), q, false);
  const roofQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.08));
  b.box('calamina', [w + 0.4, 0.05, d + 0.5], at(0, h + 0.3, -d / 2), roofQ);
  for (let i = 0; i < 3; i++) b.box('stone', [0.25, 0.25, 0.25], at((rand() - 0.5) * w, h + 0.4, -rand() * d), q, false);
}
