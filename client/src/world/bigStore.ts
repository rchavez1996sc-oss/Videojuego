import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { SignAtlas } from './signs';

/** A chain store taking part of a block front: `at` is the fraction of the block where it starts. */
export interface BigStoreDef { col: number; row: number; front: 0 | 1; at: number; w: number; kind: 'market' | 'bank' | 'food' | 'mall'; brand: string; color: string; tenants?: string[] }

const T = 0.3, UP = new THREE.Vector3(0, 1, 0);

/** Removes [a, b] from the lot spans of a block front. */
export function carve(spans: number[][], a: number, b: number): number[][] {
  return spans.flatMap(([s0, s1]) => (b <= s0 || a >= s1 ? [[s0, s1]] : [[s0, a], [b, s1]].filter(([p, q]) => q - p > 0.5)));
}

/**
 * Big-box frontage for the look-alike brands: a wide, low glazed hall (market/mall), a two-storey glass bank branch
 * or a fast-food unit, with a large logo on the fascia. Front at local z = 0, inward −z, `depth` deep.
 */
export function bigStore(b: Builder, hf: Heightfield, atlas: SignAtlas, def: BigStoreDef, cx: number, frontZ: number, facing: number, depth: number, rand: () => number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, facing), y0 = hf.heightAt(cx, frontZ);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(cx, y0, frontZ));
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const w = def.w, H = def.kind === 'mall' ? 10 : def.kind === 'bank' ? 8 : def.kind === 'food' ? 6 : 7.5;
  const glassTop = def.kind === 'bank' ? 3.6 : def.kind === 'mall' ? 5 : 4.2, gw = w - 4;
  const sink = 0.8;
  b.wall('concrete', w, H + sink, T, at(0, -sink, -T / 2), facing, [{ x: 0, w: gw, y: sink + 0.25, h: glassTop - 0.25 }]);
  b.wall('concrete', w, H + sink, T, at(0, -sink, -depth + T / 2), facing + Math.PI);
  for (const s of [-1, 1]) b.wall(def.color, depth - 2 * T, H + sink, T, at(s * (w / 2 - T / 2), -sink, -depth / 2), facing + s * Math.PI / 2);
  box('glass', [gw, glassTop - 0.25, 0.08], 0, 0.25 + (glassTop - 0.25) / 2, -T / 2, true);
  for (let x = -gw / 2; x <= gw / 2 + 0.01; x += gw / Math.max(2, Math.round(gw / 2.6))) box('bars', [0.09, glassTop - 0.25, 0.14], x, 0.25 + (glassTop - 0.25) / 2, -0.05);
  box('shopLit', [gw - 0.2, glassTop - 0.6, 0.05], 0, 0.25 + (glassTop - 0.4) / 2, -1.6);
  box('concrete', [w + 0.2, 0.35, depth + 0.2], 0, H + 0.17, -depth / 2, true);
  box(def.color, [w + 0.3, H - glassTop - 0.2, 0.35], 0, glassTop + (H - glassTop) / 2, 0.08);
  box('light', [w * 0.9, 0.08, 0.12], 0, glassTop + 0.05, 0.3);
  atlas.add(at(0, glassTop + (H - glassTop) / 2, 0.3), q, Math.min(w * 0.62, (H - glassTop - 0.4) * 4 * 0.95, 16), 'shop', rand, def.brand);
  if (def.kind === 'bank') {
    box('concrete', [w + 0.3, 0.3, 0.6], 0, glassTop, 0.25);
    box('plastic', [1.0, 2.0, 0.6], w / 2 - 1.2, 1.0, 0.35, true);
    box('light', [0.6, 0.4, 0.05], w / 2 - 1.2, 1.45, 0.66);
    box('glass', [gw, H - glassTop - 1.4, 0.06], 0, glassTop + 0.9 + (H - glassTop - 1.6) / 2, 0.27);
  } else {
    const cw = Math.min(10, w * 0.4);
    box('concrete', [cw, 0.3, 3.2], 0, glassTop + 0.15, 1.6, true);
    for (const s of [-1, 1]) box('bars', [0.2, glassTop, 0.2], s * (cw / 2 - 0.3), glassTop / 2, 3.0, true);
    box(def.color, [cw + 0.1, 0.35, 0.08], 0, glassTop + 0.2, 3.22);
  }
  if (def.kind === 'market' || def.kind === 'mall') {
    for (let i = 0; i < 4; i++) box('bars', [1.0, 0.95, 0.6], -w / 2 + 3 + i * 0.25, 0.55, 1.2 + i * 0.05);
    for (let i = 0; i < 3; i++) box('concrete', [2.2, 1.2, 1.6], -w / 3 + i * (w / 3), H + 0.95, -depth / 2 + (rand() - 0.5) * 4, true);
  }
  (def.tenants ?? []).forEach((t, i, all) => {
    const x = -w / 2 + ((i + 0.5) * w) / all.length;
    if (Math.abs(x) > w * 0.3) atlas.add(at(x, glassTop + 0.75, 0.3), q, Math.min(4.2, w / all.length - 0.6), 'shop', rand, t);
  });
}
