import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { SignAtlas } from './signs';
import type { Lot } from './houses';
import { buildLadder } from './ladders';

const UP = new THREE.Vector3(0, 1, 0), FLOOR = 2.7;

/**
 * FLS presence on a built lot: red flag on "friendly" houses, stencilled hammer and sickle on fronts and
 * exposed side walls, and roof ladders on some block-end houses. `worldSide` is the exposed side (-1/1) or 0.
 */
export function flsMarks(b: Builder, hf: Heightfield, atlas: SignAtlas, lot: Lot, floors: number, red: boolean, worldSide: number, rand: () => number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, lot.facing);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(lot.x, lot.y, lot.z));
  if (red) atlas.add(at(0, floors * FLOOR - (floors > 1 ? 1.1 : 0.55), 0.06), q, floors > 1 ? 4.6 : 3.2, 'flag', rand);
  else if (floors > 1 && rand() < 0.14) atlas.add(at(0, FLOOR + 1.45, 0.04), q, 4.4, 'stencil', rand);
  if (!worldSide) return;
  const zMid = lot.z - Math.cos(lot.facing) * lot.d / 2, wallX = lot.x + worldSide * lot.w / 2;
  const sideQ = new THREE.Quaternion().setFromAxisAngle(UP, worldSide * Math.PI / 2);
  if (rand() < 0.4) {
    const z = zMid + (rand() < 0.5 ? -2 : 2);
    atlas.add(new THREE.Vector3(wallX + worldSide * 0.04, hf.heightAt(wallX, z) + 1.7, z), sideQ, 6, rand() < 0.75 ? 'stencil' : 'flag', rand);
  }
  if (rand() < 0.35) {
    const x = wallX + worldSide * 0.3;
    buildLadder(b, new THREE.Vector3(x, hf.heightAt(x, zMid), zMid), lot.y + floors * FLOOR, new THREE.Vector3(worldSide, 0, 0));
  }
}

/** Small FLS plates nailed to some power poles, facing the street. */
export function poleMarks(atlas: SignAtlas, hf: Heightfield, poles: THREE.Vector3[], side: number, rand: () => number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, side > 0 ? Math.PI : 0);
  for (const p of poles) {
    if (rand() > 0.3) continue;
    atlas.add(new THREE.Vector3(p.x, hf.heightAt(p.x, p.z) + 2.6 + rand() * 0.6, p.z - side * 0.17), q, 2, rand() < 0.5 ? 'stencil' : 'flag', rand);
  }
}
