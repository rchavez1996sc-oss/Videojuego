import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { CoastDef } from '../coast';
import { northZ, type MaleconDef } from './layout';

const yaw = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);

/** One jersey barrier (wide foot, narrow top) of length 2.9 at `p` along `q`, painted red or white. */
function jersey(b: Builder, p: THREE.Vector3, q: THREE.Quaternion, red: boolean): void {
  const mat = red ? 'barrierRed' : 'barrierWhite';
  b.box(mat, [2.9, 0.3, 0.6], p.clone().setY(p.y + 0.15), q, false);
  b.box(mat, [2.9, 0.55, 0.26], p.clone().setY(p.y + 0.57), q, false);
}

/**
 * Military cordon along the edge of the playable district (west, east and inland): a low line of jersey barriers
 * across every street and pavement, so the invisible wall reads as a closed checkpoint without hiding the view.
 * Stretches down the cliff face are skipped.
 */
export function buildBorder(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, half: number): void {
  const nz = northZ(def), lines: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-half, 0, nz), new THREE.Vector3(half, 0, nz)],
    [new THREE.Vector3(-half, 0, nz), new THREE.Vector3(-half, 0, c.shore)],
    [new THREE.Vector3(half, 0, nz), new THREE.Vector3(half, 0, c.shore)],
  ];
  for (const [a, e] of lines) {
    const dir = e.clone().sub(a), len = dir.length(), n = Math.floor(len / 3);
    dir.normalize();
    const q = yaw(Math.atan2(-dir.z, dir.x)), inward = new THREE.Vector3(-dir.z, 0, dir.x);
    if (inward.dot(a.clone().negate().setY(0)) < 0) inward.negate();
    for (let i = 0; i < n; i++) {
      const p = a.clone().addScaledVector(dir, i * 3 + 1.5).addScaledVector(inward, 0.8), g0 = hf.heightAt(p.x - dir.x * 1.5, p.z - dir.z * 1.5), g1 = hf.heightAt(p.x + dir.x * 1.5, p.z + dir.z * 1.5);
      if (Math.abs(g1 - g0) > 1.2) continue;
      p.y = Math.min(g0, g1);
      jersey(b, p, q, i % 2 === 0);
    }
  }
}
