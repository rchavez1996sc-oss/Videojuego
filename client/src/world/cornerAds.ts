import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { SignAtlas } from './signs';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Tall single-pole billboards at street corners (panel ~8 × 2 m on a 9–12 m mast, catwalk, floodlights),
 * brand ads on both faces. `lines` are pavement z values with the side they face (+1: panel looks towards +z).
 */
export function cornerAds(b: Builder, hf: Heightfield, atlas: SignAtlas, crossX: number[], lines: [number, 1 | -1][], rand: () => number, skip: (x: number, z: number) => boolean, chance = 0.6): void {
  const brands = atlas.brands;
  for (const cx of crossX) for (const [z, face] of lines) for (const off of [-6.6, 6.6]) {
    const x = cx + off;
    if (rand() > chance || skip(x, z)) continue;
    const H = 9 + rand() * 3, y = hf.heightAt(x, z), q = new THREE.Quaternion().setFromAxisAngle(UP, face > 0 ? 0 : Math.PI);
    const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
    b.box('bars', [0.6, H, 0.6], at(0, H / 2, 0), q);
    b.box('bars', [8.6, 2.6, 0.45], at(0, H + 1.2, 0), q);
    b.box('bars', [8.6, 0.08, 0.9], at(0, H - 0.15, 0.6), q, false);
    for (const lx of [-3, 0, 3]) {
      b.box('bars', [0.06, 0.06, 0.8], at(lx, H - 0.05, 0.9), q, false);
      b.box('light', [0.4, 0.15, 0.25], at(lx, H - 0.05, 1.3), q, false);
    }
    const pick = () => brands[Math.floor(rand() * brands.length)];
    atlas.add(at(0, H + 1.2, 0.235), q, 8.2, 'shop', rand, pick());
    atlas.add(at(0, H + 1.2, -0.235), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI)), 8.2, 'shop', rand, pick());
  }
}
