import * as THREE from 'three';
import type { Builder, Opening } from '../buildingKit';
import { CASONA_PAINTS, TRIMS } from './materials';
import { lampSpots } from '../../render/nightLights';

export interface CasonaLot { x: number; z: number; y: number; facing: number; w: number; d: number; floors?: number; paint?: string; style?: Style; open?: boolean }
type Style = 'cajon' | 'gallery' | 'plain' | 'villa';
type At = (x: number, y: number, z: number) => THREE.Vector3;

const UP = new THREE.Vector3(0, 1, 0), FLOOR = 3.9, T = 0.3, PLINTH = 0.7;
const pick = <T>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];

/** Tall window with a moulded frame, sill, two wooden shutter leaves folded back and glass; iron bars on the ground floor. */
function tallWindow(b: Builder, at: At, q: THREE.Quaternion, x: number, y: number, w: number, h: number, trim: string, barred: boolean): void {
  b.box('glass', [w, h, 0.05], at(x, y + h / 2, -0.12), q, false);
  b.box('trimWhite', [w + 0.3, 0.12, 0.12], at(x, y + h + 0.06, 0.04), q, false);
  b.box('creamCornice', [w + 0.4, 0.1, 0.22], at(x, y - 0.05, 0.08), q, false);
  for (const s of [-1, 1]) {
    b.box('trimWhite', [0.12, h, 0.1], at(x + s * (w / 2 + 0.06), y + h / 2, 0.03), q, false);
    b.box(trim, [w / 2, h * 0.96, 0.05], at(x + s * (w * 0.75 + 0.13), y + h / 2, 0.06), q, false);
  }
  b.box(trim, [w, 0.05, 0.06], at(x, y + h * 0.5, -0.08), q, false);
  if (barred) for (let i = 1; i < Math.round(w / 0.13); i++) b.box('fenceIron', [0.025, h, 0.025], at(x - w / 2 + i * 0.13, y + h / 2, 0.1), q, false);
}

/** Closed wooden box balcony (balcón de cajón) with panelled base, glazed upper part and a little tiled hood. */
function cajon(b: Builder, at: At, q: THREE.Quaternion, x: number, y: number, w: number, trim: string): void {
  const d = 0.7;
  b.box(trim, [w, 0.12, d + 0.1], at(x, y - 0.06, d / 2), q);
  b.box(trim, [w, 1.0, 0.06], at(x, y + 0.5, d), q, false);
  for (const s of [-1, 1]) b.box(trim, [0.06, 2.4, d], at(x + s * w / 2, y + 1.2, d / 2), q, false);
  b.box('glass', [w - 0.1, 1.2, 0.04], at(x, y + 1.6, d - 0.02), q, false);
  for (let i = 0; i <= 4; i++) b.box(trim, [0.05, 1.3, 0.07], at(x - w / 2 + (i * w) / 4, y + 1.65, d), q, false);
  b.box('roofTile', [w + 0.3, 0.08, d + 0.35], at(x, y + 2.42, d / 2 + 0.1), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.25)), false);
  for (let i = 0; i < 3; i++) b.box(trim, [0.08, 0.08, 0.6], at(x - w / 3 + (i * w) / 3, y - 0.25, d / 2), q, false);
}

/** Open wooden gallery along the whole upper front: deck, turned posts, balustrade with X bracing and a lean-to roof. */
function gallery(b: Builder, at: At, q: THREE.Quaternion, w: number, y: number, trim: string): void {
  const d = 1.5;
  b.box(trim, [w, 0.16, d], at(0, y - 0.08, d / 2), q);
  b.box(trim, [w + 0.2, 0.1, d + 0.3], at(0, y + FLOOR - 0.35, d / 2), q, false);
  const posts = Math.max(3, Math.round(w / 2.4));
  for (let i = 0; i <= posts; i++) {
    const px = -w / 2 + 0.1 + (i * (w - 0.2)) / posts;
    b.box(trim, [0.14, FLOOR - 0.35, 0.14], at(px, y + (FLOOR - 0.35) / 2, d - 0.1), q, i === 0 || i === posts);
    if (i < posts) {
      const mid = px + (w - 0.2) / posts / 2, span = (w - 0.2) / posts;
      b.box(trim, [span, 0.07, 0.07], at(mid, y + 1.0, d - 0.1), q, false);
      for (const s of [-1, 1]) b.box(trim, [Math.hypot(span, 0.9), 0.05, 0.05], at(mid, y + 0.55, d - 0.1), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * Math.atan2(0.9, span))), false);
    }
  }
  b.box('none', [w, 1.0, 0.12], at(0, y + 0.5, d - 0.1), q, true);
}

/**
 * Republican-era casona of Barranco (from the chapter's photos): one or two tall storeys on a plinth, painted
 * plaster in oxblood, cobalt, ochre, rose…, pilasters and moulded cornices, tall windows with folding wooden
 * shutters, a double wooden door, and on the upper floor box balconies, an open wooden gallery or a plain front;
 * a parapet with a balustrade on top (villas get a hipped tile roof and a corner turret). With `open`, the door is a
 * walk-in entrance to a ground-floor hall. Local +z faces the street; returns the doorstep and the hall's corners.
 */
export function casona(b: Builder, lot: CasonaLot, rand: () => number): { door: THREE.Vector3; hall: [THREE.Vector3, THREE.Vector3] } {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, lot.facing);
  const at: At = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(lot.x, lot.y, lot.z));
  const floors = lot.floors ?? (rand() < 0.45 ? 1 : 2), w = lot.w, d = lot.d, H = PLINTH + floors * FLOOR;
  const style: Style = lot.style ?? (floors === 1 ? (rand() < 0.2 ? 'villa' : 'plain') : pick(['cajon', 'gallery', 'plain', 'cajon'] as Style[], rand));
  const paint = lot.paint ?? pick(CASONA_PAINTS, rand)[0], trim = pick(TRIMS, rand), sink = 1.2;
  const bays = Math.max(2, Math.floor(w / 2.7)), bay = w / bays, doorBay = Math.floor(bays / 2);
  b.box('stairStone', [w + 0.1, PLINTH + sink, 0.2], at(0, (PLINTH - sink) / 2, 0.05), q, false);
  b.box(paint, [w, PLINTH + sink, d], at(0, (PLINTH - sink) / 2, -d / 2), q);
  for (let f = 0; f < floors; f++) {
    const y0 = PLINTH + f * FLOOR, open: Opening[] = [];
    for (let i = 0; i < bays; i++) {
      const x = -w / 2 + bay * (i + 0.5);
      if (f === 0 && i === doorBay) open.push({ x, w: 1.6, y: 0, h: 3.0 });
      else open.push({ x, w: 1.15, y: f === 0 ? 0.6 : 0.35, h: f === 0 ? 2.3 : 2.55 });
    }
    b.wall(paint, w, FLOOR, T, at(0, y0, -T / 2), lot.facing, open);
    b.wall(paint, w, FLOOR, T, at(0, y0, -d + T / 2), lot.facing + Math.PI);
    for (const s of [1, -1]) b.wall(paint, d - 2 * T, FLOOR, T, at(s * (w / 2 - T / 2), y0, -d / 2), lot.facing + s * Math.PI / 2);
    for (const o of open) {
      if (f === 0 && o.y === 0) {
        if (lot.open) b.box('trimBrown', [0.1, o.h, 0.9], at(o.x - o.w / 2 - 0.05, y0 + o.h / 2, -0.5), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, -1.2)), false);
        else for (const s of [-1, 1]) b.box('trimBrown', [o.w / 2 - 0.02, o.h, 0.08], at(o.x + s * o.w / 4, y0 + o.h / 2, -0.15), q);
        b.box('creamCornice', [o.w + 0.5, 0.3, 0.2], at(o.x, y0 + o.h + 0.25, 0.06), q, false);
        for (let k = 1; k <= 3; k++) b.box('stairStone', [o.w + 0.8, 0.18, 0.35 * k], at(o.x, PLINTH - 0.18 * k + 0.09, 0.17 * k + 0.05), q);
      } else tallWindow(b, at, q, o.x, y0 + o.y, o.w, o.h, trim, f === 0);
      if (f === 1 && style === 'cajon' && rand() < 0.75) cajon(b, at, q, o.x, y0, Math.min(bay - 0.3, 2.0), trim);
    }
    if (f === 1 && style === 'gallery') gallery(b, at, q, w, y0, trim);
    b.box('creamCornice', [w + 0.25, 0.32, 0.4], at(0, y0 + FLOOR - 0.16, 0.12), q, false);
    b.box(f === floors - 1 ? 'roofSlab' : 'concrete', [w - 0.1, 0.24, d - 0.1], at(0, y0 + FLOOR - 0.12, -d / 2), q);
    for (const s of [-1, 1]) b.box('creamCornice', [0.45, FLOOR, 0.16], at(s * (w / 2 - 0.22), y0 + FLOOR / 2, 0.06), q, false);
  }
  if (style === 'villa') {
    const roofQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.42));
    b.box('roofTile', [w + 0.6, 0.12, d * 0.58], at(0, H + 1.15, -d * 0.25), roofQ, false);
    b.box('roofTile', [w + 0.6, 0.12, d * 0.58], at(0, H + 1.15, -d * 0.75), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.42)), false);
    b.box(paint, [3, 4.2, 3], at(w / 2 - 1.5, H + 2.1, -1.5), q);
    b.geometry('roofTile', new THREE.ConeGeometry(2.4, 2.2, 4).rotateY(Math.PI / 4), new THREE.Matrix4().compose(at(w / 2 - 1.5, H + 5.3, -1.5), q, new THREE.Vector3(1, 1, 1)));
    tallWindow(b, (x, y, z) => at(w / 2 - 1.5 + x, y, z), q, 0, H + 1.4, 1.0, 1.9, trim, false);
  } else {
    b.box(paint, [w, 0.9, 0.22], at(0, H + 0.45, -0.1), q);
    for (let i = 0; i < Math.round(w / 0.45); i++) b.box('trimWhite', [0.12, 0.5, 0.12], at(-w / 2 + 0.3 + i * 0.45, H + 0.55, 0.06), q, false);
    b.box('creamCornice', [w + 0.2, 0.14, 0.32], at(0, H + 0.95, 0), q, false);
    for (const s of [-1, 1]) b.geometry('creamCornice', new THREE.SphereGeometry(0.22, 10, 8), new THREE.Matrix4().compose(at(s * (w / 2 - 0.22), H + 1.25, 0), q, new THREE.Vector3(1, 1, 1)));
  }
  const doorX = -w / 2 + bay * (doorBay + 0.5);
  facadeLife(b, at, q, w, H, doorX, trim, rand);
  return { door: at(doorX, PLINTH, 1.2), hall: [at(-w / 2 + 0.6, PLINTH, -0.8), at(w / 2 - 0.6, PLINTH, -d + 0.8)] };
}

/**
 * Lived-in layers on the front: a downpipe at a corner, a lantern beside the door (lit at night), the electricity
 * meter box, a brass number, and on some houses bougainvillea spilling over the parapet and down a corner.
 */
function facadeLife(b: Builder, at: At, q: THREE.Quaternion, w: number, H: number, doorX: number, trim: string, rand: () => number): void {
  const side = rand() < 0.5 ? -1 : 1, px = side * (w / 2 - 0.12);
  b.geometry('steelDark', new THREE.CylinderGeometry(0.055, 0.055, H + 0.6, 8), new THREE.Matrix4().compose(at(px, (H + 0.6) / 2 - 0.3, 0.14), q, new THREE.Vector3(1, 1, 1)));
  b.box('steelDark', [0.16, 0.08, 0.3], at(px, H + 0.25, 0.05), q, false);
  if (rand() < 0.7) {
    const lx = doorX + (rand() < 0.5 ? -1 : 1) * 1.25, ly = PLINTH + 2.75;
    b.box('lhBlack', [0.06, 0.06, 0.32], at(lx, ly - 0.05, 0.18), q, false);
    b.box('lhBlack', [0.26, 0.04, 0.26], at(lx, ly + 0.42, 0.34), q, false);
    b.geometry('globe', new THREE.CylinderGeometry(0.1, 0.13, 0.36, 6), new THREE.Matrix4().compose(at(lx, ly + 0.2, 0.34), q, new THREE.Vector3(1, 1, 1)));
    lampSpots.push(at(lx, ly + 0.2, 0.6));
  }
  b.box('concrete', [0.42, 0.55, 0.16], at(doorX + 1.9 * -side, PLINTH + 1.2, 0.08), q, false);
  b.box('brass', [0.28, 0.16, 0.02], at(doorX, PLINTH + 3.3, 0.06), q, false);
  if (rand() < 0.35) {
    const cx = (rand() < 0.5 ? -1 : 1) * (w / 2 - 0.9);
    const drop = 1.5 + rand() * (H - 2);
    for (let k = 0; k < 16; k++) {
      const t = k / 15, y = H + 0.7 - t * drop + (rand() - 0.5) * 0.4, x = cx + (rand() - 0.5) * (2.8 - t * 1.8);
      b.geometry(k % 4 ? 'bougainvillea' : 'hedge', new THREE.IcosahedronGeometry(0.28 + rand() * 0.3, 1), new THREE.Matrix4().compose(at(x, y, 0.18 + rand() * 0.12), q, new THREE.Vector3(1.4, 0.75, 0.5)));
    }
  }
  if (rand() < 0.3) b.box(trim, [0.9, 0.05, 0.35], at(doorX, PLINTH + 3.2, 0.25), q, false);
}
