import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { CoastDef } from '../coast';
import { northZ, type MaleconDef } from './layout';

const yaw = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);

/** One concrete blast wall section (T-wall) 1.5 m wide at `p` along `q`: footing, 3.2 m panel, red and white band. */
function tWall(b: Builder, p: THREE.Vector3, q: THREE.Quaternion, red: boolean): void {
  b.box('concrete', [1.46, 0.45, 1.1], p.clone().setY(p.y + 0.22), q, false);
  b.box('concrete', [1.46, 3.2, 0.24], p.clone().setY(p.y + 1.6), q, false);
  b.box(red ? 'barrierRed' : 'barrierWhite', [1.47, 0.5, 0.26], p.clone().setY(p.y + 0.75), q, false);
  b.box('none', [1.5, 3.4, 0.5], p.clone().setY(p.y + 1.7), q, true);
}

/**
 * Military cordon along the edge of the playable district (west, east and inland): a line of 3.2 m concrete blast
 * walls across every street and pavement, so the edge reads as a closed checkpoint rather than an invisible wall.
 * Stretches down the cliff face are skipped.
 */
export function buildBorder(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, half: number): void {
  const nz = northZ(def), lines: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-half, 0, nz), new THREE.Vector3(half, 0, nz)],
    [new THREE.Vector3(-half, 0, nz), new THREE.Vector3(-half, 0, c.shore)],
    [new THREE.Vector3(half, 0, nz), new THREE.Vector3(half, 0, c.shore)],
  ];
  for (const [a, e] of lines) {
    const dir = e.clone().sub(a), len = dir.length(), n = Math.floor(len / 1.5);
    dir.normalize();
    const q = yaw(Math.atan2(-dir.z, dir.x)), inward = new THREE.Vector3(-dir.z, 0, dir.x);
    if (inward.dot(a.clone().negate().setY(0)) < 0) inward.negate();
    for (let i = 0; i < n; i++) {
      const p = a.clone().addScaledVector(dir, i * 1.5 + 0.75).addScaledVector(inward, 0.8), g0 = hf.heightAt(p.x - dir.x * 0.75, p.z - dir.z * 0.75), g1 = hf.heightAt(p.x + dir.x * 0.75, p.z + dir.z * 0.75);
      if (Math.abs(g1 - g0) > 0.8) continue;
      p.y = Math.min(g0, g1);
      tWall(b, p, q, i % 2 === 0);
    }
  }
}
