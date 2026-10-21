import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import { laundry, trashPile, tire } from './streetLife';
import { cable } from './urbanProps';

type Rand = () => number;

/** Clutter for the narrow passages carved through a block: washing and cables strung wall to wall, rubbish against the walls. */
export function alleyLife(b: Builder, hf: Heightfield, bx0: number, bx1: number, z0: number, z1: number, pass: { at: number; w: number } | null, backW: number, rand: Rand): void {
  const at = (x: number, z: number, up: number) => new THREE.Vector3(x, hf.heightAt(x, z) + up, z);
  if (backW) {
    const zc = (z0 + z1) / 2, half = backW / 2 - 0.05;
    for (let x = bx0 + 3 + rand() * 4; x < bx1 - 3; x += 5 + rand() * 6) {
      const r = rand(), up = 2.6 + rand() * 1.4;
      if (r < 0.35) laundry(b, at(x, zc - half, up), at(x + (rand() - 0.5) * 2, zc + half, up), rand);
      else if (r < 0.6) cable(b, at(x, zc - half, up + 0.8), at(x + (rand() - 0.5) * 3, zc + half, up + 1), 0.2);
      if (rand() < 0.3) trashPile(b, at(x + 1.5, zc + (rand() < 0.5 ? -1 : 1) * (half - 0.45), 0), rand);
      else if (rand() < 0.12) tire(b, at(x + 1, zc + (rand() < 0.5 ? -1 : 1) * (half - 0.35), 0), rand);
    }
  }
  if (pass) {
    const half = pass.w / 2 - 0.05;
    for (let z = z0 + 2 + rand() * 3; z < z1 - 2; z += 4 + rand() * 5) {
      const up = 2.7 + rand() * 1.2;
      if (rand() < 0.45) laundry(b, at(pass.at - half, z, up), at(pass.at + half, z + (rand() - 0.5) * 1.5, up), rand);
    }
  }
}
