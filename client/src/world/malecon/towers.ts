import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { MaleconDef } from './layout';
import { EXTENT, SIDEWALK } from './layout';

export const FACADES = ['aptWhite', 'aptCream', 'aptSand', 'aptGray', 'aptBlue', 'aptWhite'];
const FLOOR = 3, snap = (v: number) => Math.round(v / 6) * 6;
const Q = new THREE.Quaternion();

/** Lots between the street grid: [x0, x1, z0, z1, onAvenue]. */
export function cityBlocks(def: MaleconDef): [number, number, number, number, boolean][] {
  const sx = [-EXTENT - 20, ...def.streets.x, EXTENT + 20], half = def.streets.half + SIDEWALK;
  const zs = [-EXTENT - 20, ...def.streets.z].sort((a, b) => a - b);
  const out: [number, number, number, number, boolean][] = [];
  for (let i = 0; i + 1 < sx.length; i++) {
    const x0 = sx[i] + (i ? half : 0), x1 = sx[i + 1] - (i + 2 < sx.length ? half : 0);
    for (let k = 0; k < zs.length; k++) {
      const z0 = zs[k] + (k ? half : 0), avenue = k === zs.length - 1;
      const z1 = avenue ? def.avenue.z - def.avenue.half - SIDEWALK : zs[k + 1] - half;
      out.push([x0, x1, z0, z1, avenue]);
    }
  }
  return out;
}

/** Residential tower: facade box (one collider), sea-facing balconies with glass rails, lobby, roof plant. */
function tower(t: Builder, b: Builder, x0: number, w: number, zFace: number, d: number, s: 1 | -1, floors: number, style: string, rand: () => number): void {
  const H = floors * FLOOR, cx = x0 + w / 2, cz = zFace - s * d / 2;
  t.box(style, [w, H + 0.6, d], new THREE.Vector3(cx, H / 2 - 0.3, cz), Q);
  const glass = style === 'glassWall';
  if (!glass) {
    const deep = 1.1 + rand() * 0.5, bw = w * (rand() < 0.4 ? 0.62 : 1) + 0.4, bx = cx + (bw < w ? (rand() - 0.5) * (w - bw) : 0);
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR;
      b.box('slab', [bw, 0.22, deep], new THREE.Vector3(bx, y, zFace + s * deep / 2), Q, false);
      b.box('railGlass', [bw, 1.0, 0.05], new THREE.Vector3(bx, y + 0.6, zFace + s * (deep - 0.04)), Q, false);
      b.box('alu', [bw, 0.06, 0.08], new THREE.Vector3(bx, y + 1.12, zFace + s * (deep - 0.04)), Q, false);
    }
  } else {
    for (let k = 0; k <= w / 3; k++) b.box('alu', [0.18, H, 0.35], new THREE.Vector3(x0 + k * 3, H / 2, zFace + s * 0.17), Q, false);
  }
  b.box('lobby', [w - 2, 2.7, 0.12], new THREE.Vector3(cx, 1.35, zFace + s * 0.07), Q, false);
  b.box('slab', [Math.min(6, w - 2), 0.25, 2.4], new THREE.Vector3(cx + (rand() - 0.5) * (w - 8), 3.1, zFace + s * 1.2), Q, false);
  for (const [px, pz, pw, pd] of [[cx, cz - d / 2 + 0.15, w, 0.3], [cx, cz + d / 2 - 0.15, w, 0.3], [x0 + 0.15, cz, 0.3, d], [x0 + w - 0.15, cz, 0.3, d]]) {
    b.box('slab', [pw, 1.1, pd], new THREE.Vector3(px, H + 0.55, pz), Q, false);
  }
  const mw = Math.min(8, w * 0.4);
  b.box('concrete', [mw, 3, mw * 0.8], new THREE.Vector3(cx + (rand() - 0.5) * (w - mw - 2), H + 1.5, cz), Q, false);
  if (rand() < 0.5) b.box('bars', [0.12, 6, 0.12], new THREE.Vector3(cx + w * 0.3, H + 3, cz + d * 0.2), Q, false);
}

/** Older two/three-storey house with a front wall and gate (the few casonas left between towers). */
function casona(t: Builder, b: Builder, x0: number, w: number, zFace: number, d: number, s: 1 | -1, paint: string, rand: () => number): void {
  const cx = x0 + w / 2, floors = 2 + (rand() < 0.4 ? 1 : 0), H = floors * 3.1;
  t.box(paint, [w - 2, H, d - 4], new THREE.Vector3(cx, H / 2, zFace - s * (d / 2 + 1)), Q);
  b.box(paint, [w, 1.9, 0.25], new THREE.Vector3(cx, 0.95, zFace), Q);
  b.box('bars', [3.2, 1.7, 0.08], new THREE.Vector3(cx + (rand() - 0.5) * (w - 6), 1.05, zFace + s * 0.15), Q, false);
  b.box('roofTile', [w - 1.6, 0.3, d - 3.6], new THREE.Vector3(cx, H + 0.15, zFace - s * (d / 2 + 1)), Q, false);
}

/** Fills every block: tall towers facing the sea along the avenue, mid-rise behind, a few houses. */
export function buildTowers(t: Builder, b: Builder, def: MaleconDef, paints: string[], rand: () => number): { x: number; z: number; r: number }[] {
  const foot: { x: number; z: number; r: number }[] = [];
  for (const [bx0, bx1, bz0, bz1, avenue] of cityBlocks(def)) {
    const depth = bz1 - bz0;
    const rows: [number, 1 | -1, number][] = depth > 52 ? [[bz1 - 2, 1, 24], [bz0 + 2, -1, 20]] : [[bz1 - 2, 1, Math.min(24, depth - 6)]];
    for (const [zFace, s, maxD] of rows) {
      let x = Math.ceil((bx0 + 2) / 6) * 6;
      while (x + 12 <= bx1 - 2) {
        const w = Math.min(snap(14 + rand() * 14), Math.floor((bx1 - 2 - x) / 6) * 6);
        if (w < 12) break;
        const d = Math.max(12, Math.min(snap(14 + rand() * 10), Math.floor(maxD / 6) * 6));
        const front = avenue && s > 0, r = rand();
        if (!front && r < 0.16) casona(t, b, x, w, zFace, d, s, paints[Math.floor(rand() * paints.length)], rand);
        else {
          const floors = front ? 13 + Math.floor(rand() * 13) : 5 + Math.floor(rand() * (avenue ? 12 : 9));
          const style = rand() < (front ? 0.18 : 0.08) ? 'glassWall' : FACADES[Math.floor(rand() * FACADES.length)];
          tower(t, b, x, w, zFace, d, s, floors, style, rand);
        }
        foot.push({ x: x + w / 2, z: zFace - s * d / 2, r: Math.hypot(w, d) / 2 });
        x += w + 6;
      }
    }
  }
  return foot;
}
