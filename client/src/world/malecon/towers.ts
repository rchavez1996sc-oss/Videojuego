import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { MaleconDef } from './layout';
import { EXTENT, SIDEWALK, northZ, streetHalf } from './layout';
import { house } from './houses';

export const FACADES = ['aptWhite', 'aptCream', 'aptSand', 'aptGray', 'aptBlue', 'aptWhite', 'aptTerracotta', 'aptSalmon'];
const FLOOR = 3, snap = (v: number) => Math.round(v / 6) * 6;
const Q = new THREE.Quaternion();

/** Lots between the street grid: [x0, x1, z0, z1, onAvenue]. */
export function cityBlocks(def: MaleconDef): [number, number, number, number, boolean][] {
  const sx = [-EXTENT - 20, ...def.streets.x, EXTENT + 20], half = def.streets.half + SIDEWALK;
  const zs = [northZ(def), ...def.streets.z].sort((a, b) => a - b);
  const out: [number, number, number, number, boolean][] = [];
  for (let i = 0; i + 1 < sx.length; i++) {
    const x0 = sx[i] + (i ? half : 0), x1 = sx[i + 1] - (i + 2 < sx.length ? half : 0);
    for (let k = 0; k < zs.length; k++) {
      const z0 = zs[k] + (k ? streetHalf(def, zs[k]) + SIDEWALK : 0), avenue = k === zs.length - 1;
      const z1 = avenue ? def.avenue.z - def.avenue.half - SIDEWALK : zs[k + 1] - streetHalf(def, zs[k + 1]) - SIDEWALK;
      if (z1 - z0 > 14) out.push([x0, x1, z0, z1, avenue]);
    }
  }
  return out;
}

/** Iron railing along the tower's front garden with a gate, and often a glazed guard booth by the gate; returns the guard's spot. */
function frontage(b: Builder, x0: number, w: number, zFace: number, s: 1 | -1, rand: () => number): { pos: THREE.Vector3; yaw: number } | null {
  const fz = zFace + s * 1.85, gate = x0 + w * (0.3 + rand() * 0.4);
  for (let x = x0 + 0.1; x < x0 + w; x += 0.28) if (Math.abs(x - gate) > 1.6) b.box('fenceIron', [0.04, 1.6, 0.04], new THREE.Vector3(x, 0.95, fz), Q, false);
  for (const [a, e] of [[x0, gate - 1.6], [gate + 1.6, x0 + w]]) {
    b.box('slab', [e - a, 0.3, 0.3], new THREE.Vector3((a + e) / 2, 0.15, fz), Q, true);
    for (const y of [0.4, 1.7]) b.box('fenceIron', [e - a, 0.05, 0.05], new THREE.Vector3((a + e) / 2, y, fz), Q, false);
    b.box('none', [e - a, 1.8, 0.2], new THREE.Vector3((a + e) / 2, 0.9, fz), Q, true);
  }
  if (rand() < 0.4) return null;
  const bx = gate + 2.6 * (rand() < 0.5 ? -1 : 1), bz = zFace + s * 0.95;
  b.box('slab', [1.6, 0.2, 1.4], new THREE.Vector3(bx, 0.1, bz), Q, true);
  b.box('lobby', [1.4, 2.0, 1.2], new THREE.Vector3(bx, 1.2, bz), Q, true);
  b.box('slab', [1.9, 0.18, 1.7], new THREE.Vector3(bx, 2.3, bz), Q, false);
  return { pos: new THREE.Vector3(gate - 2.2 * Math.sign(bx - gate), 0, zFace + s * 1.3), yaw: s > 0 ? 0 : Math.PI };
}

export type ShopSign = (pos: THREE.Vector3, q: THREE.Quaternion, w: number) => void;

/** Ground-floor shops along a commercial street: glazed fronts, lit interiors, a sign over each and the odd awning. */
function storefronts(b: Builder, x0: number, w: number, zFace: number, s: 1 | -1, sign: ShopSign, rand: () => number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s > 0 ? 0 : Math.PI), n = Math.max(1, Math.floor(w / 6)), uw = w / n;
  for (let k = 0; k < n; k++) {
    const ux = x0 + uw * (k + 0.5);
    b.box('shopLit', [uw - 0.8, 3, 0.05], new THREE.Vector3(ux, 1.6, zFace - s * 0.1), Q, false);
    b.box('shopGlass', [uw - 0.6, 3.1, 0.06], new THREE.Vector3(ux, 1.65, zFace + s * 0.05), Q, false);
    b.box('slab', [0.4, 3.4, 0.3], new THREE.Vector3(x0 + uw * k + 0.2, 1.7, zFace + s * 0.1), Q, false);
    sign(new THREE.Vector3(ux, 3.75, zFace + s * 0.12), q, Math.min(4.6, uw - 0.8));
    if (rand() < 0.35) b.box(rand() < 0.5 ? 'awningRed' : 'stripe', [uw - 0.8, 0.06, 1.6], new THREE.Vector3(ux, 3.2, zFace + s * 0.8), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), s * 0.3), false);
  }
}

/** Residential tower: facade box (one collider), sea-facing balconies with glass rails, lobby (or shops), roof plant. */
function tower(t: Builder, b: Builder, x0: number, w: number, zFace: number, d: number, s: 1 | -1, floors: number, style: string, rand: () => number, shop?: ShopSign): { pos: THREE.Vector3; yaw: number } | null {
  const H = floors * FLOOR, cx = x0 + w / 2, cz = zFace - s * d / 2;
  t.box(style, [w, H + 0.6, d], new THREE.Vector3(cx, H / 2 - 0.3, cz), Q);
  const glass = style === 'glassWall';
  if (!glass) {
    const rail = rand() < 0.35 ? 'railBlue' : 'railGlass';
    const deep = 1.1 + rand() * 0.5, bw = w * (rand() < 0.4 ? 0.62 : 1) + 0.4, bx = cx + (bw < w ? (rand() - 0.5) * (w - bw) : 0);
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR;
      b.box('slab', [bw, 0.22, deep], new THREE.Vector3(bx, y, zFace + s * deep / 2), Q, false);
      b.box(rail, [bw, 1.0, 0.05], new THREE.Vector3(bx, y + 0.6, zFace + s * (deep - 0.04)), Q, false);
      b.box('alu', [bw, 0.06, 0.08], new THREE.Vector3(bx, y + 1.12, zFace + s * (deep - 0.04)), Q, false);
    }
  } else {
    for (let k = 0; k <= w / 3; k++) b.box('alu', [0.18, H, 0.35], new THREE.Vector3(x0 + k * 3, H / 2, zFace + s * 0.17), Q, false);
  }
  if (shop) storefronts(b, x0, w, zFace, s, shop, rand);
  else b.box('lobby', [w - 2, 2.7, 0.12], new THREE.Vector3(cx, 1.35, zFace + s * 0.07), Q, false);
  b.box('slab', [Math.min(6, w - 2), 0.25, 2.4], new THREE.Vector3(cx + (rand() - 0.5) * (w - 8), 3.1, zFace + s * 1.2), Q, false);
  for (const [px, pz, pw, pd] of [[cx, cz - d / 2 + 0.15, w, 0.3], [cx, cz + d / 2 - 0.15, w, 0.3], [x0 + 0.15, cz, 0.3, d], [x0 + w - 0.15, cz, 0.3, d]]) {
    b.box('slab', [pw, 1.1, pd], new THREE.Vector3(px, H + 0.55, pz), Q, false);
  }
  const mw = Math.min(8, w * 0.4);
  b.box('concrete', [mw, 3, mw * 0.8], new THREE.Vector3(cx + (rand() - 0.5) * (w - mw - 2), H + 1.5, cz), Q, false);
  if (rand() < 0.5) b.box('bars', [0.12, 6, 0.12], new THREE.Vector3(cx + w * 0.3, H + 3, cz + d * 0.2), Q, false);
  return shop ? null : frontage(b, x0, w, zFace, s, rand);
}

/** Older two/three-storey house with a front wall and gate (the few casonas left between towers). */
function casona(t: Builder, b: Builder, x0: number, w: number, zFace: number, d: number, s: 1 | -1, paint: string, rand: () => number): void {
  const cx = x0 + w / 2, floors = 2 + (rand() < 0.4 ? 1 : 0), H = floors * 3.1;
  t.box(paint, [w - 2, H, d - 4], new THREE.Vector3(cx, H / 2, zFace - s * (d / 2 + 1)), Q);
  b.box(paint, [w, 1.9, 0.25], new THREE.Vector3(cx, 0.95, zFace), Q);
  b.box('bars', [3.2, 1.7, 0.08], new THREE.Vector3(cx + (rand() - 0.5) * (w - 6), 1.05, zFace + s * 0.15), Q, false);
  b.box('roofTile', [w - 1.6, 0.3, d - 3.6], new THREE.Vector3(cx, H + 0.15, zFace - s * (d / 2 + 1)), Q, false);
}

/** Fills every block: tall towers facing the sea along the avenue, mid-rise behind; inland mostly modern houses. */
export function buildTowers(t: Builder, b: Builder, def: MaleconDef, paints: string[], rand: () => number, gardens: THREE.Vector3[], guards: { pos: THREE.Vector3; yaw: number }[], shop?: ShopSign): { x: number; w: number; z: number; h: number }[] {
  const fronts: { x: number; w: number; z: number; h: number }[] = [];
  for (const [bx0, bx1, bz0, bz1, avenue] of cityBlocks(def)) {
    const depth = bz1 - bz0;
    const rows: [number, 1 | -1, number][] = depth > 52 ? [[bz1 - 2, 1, 24], [bz0 + 2, -1, 20]] : [[bz1 - 2, 1, Math.min(24, depth - 6)]];
    for (const [zFace, s, maxD] of rows) {
      const commercial = !!def.boulevard && Math.abs(zFace + s * (2 + SIDEWALK + streetHalf(def, def.boulevard.z)) - def.boulevard.z) < 1.5;
      let x = Math.ceil((bx0 + 2) / 6) * 6;
      while (x + 12 <= bx1 - 2) {
        if (!avenue && !commercial && rand() < 0.65) {
          const w = Math.min(10 + rand() * 4, bx1 - 2 - x);
          const tree = house(b, x, w, zFace, s, rand);
          if (tree) gardens.push(tree);
          x += w + 0.4;
          continue;
        }
        x = Math.ceil(x / 6) * 6;
        if (x + 12 > bx1 - 2) break;
        const w = Math.min(snap(14 + rand() * 14), Math.floor((bx1 - 2 - x) / 6) * 6);
        if (w < 12) break;
        const d = Math.max(12, Math.min(snap(14 + rand() * 10), Math.floor(maxD / 6) * 6));
        const front = avenue && s > 0, r = rand();
        if (!front && !commercial && r < 0.16) casona(t, b, x, w, zFace, d, s, paints[Math.floor(rand() * paints.length)], rand);
        else {
          const floors = front ? 13 + Math.floor(rand() * 13) : 5 + Math.floor(rand() * (avenue ? 12 : 9));
          const style = rand() < (front ? 0.18 : 0.08) ? 'glassWall' : FACADES[Math.floor(rand() * FACADES.length)];
          const guard = tower(t, b, x, w, zFace, d, s, floors, style, rand, commercial ? shop : undefined);
          if (guard) guards.push(guard);
          if (front && style !== 'glassWall') fronts.push({ x: x + w / 2, w, z: zFace, h: floors * FLOOR });
        }
        x += w + 6;
      }
    }
  }
  return fronts;
}
