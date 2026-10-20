import * as THREE from 'three';
import type { Builder } from './buildingKit';

export interface Ladder { base: THREE.Vector3; top: number; normal: THREE.Vector3 }

/** Climbable ladders registered by the level builders (player-only for now). */
export const ladders: Ladder[] = [];

/** Steel "escalera de gato" against a wall: two rails and rungs every 30 cm. `normal` points away from the wall. */
export function buildLadder(b: Builder, base: THREE.Vector3, top: number, normal: THREE.Vector3): void {
  const h = top - base.y + 1.0;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().setY(0).normalize());
  const at = (x: number, y: number) => new THREE.Vector3(x, y, 0).applyQuaternion(q).add(base);
  for (const s of [-0.25, 0.25]) b.box('bars', [0.05, h, 0.05], at(s, base.y + h / 2 - base.y), q, false);
  for (let y = 0.3; y < h - 0.2; y += 0.3) b.box('bars', [0.5, 0.035, 0.035], at(0, y), q, false);
  ladders.push({ base: base.clone(), top, normal: normal.clone().setY(0).normalize() });
}

export function ladderAt(feet: THREE.Vector3): Ladder | null {
  for (const l of ladders) {
    const dx = feet.x - l.base.x, dz = feet.z - l.base.z;
    const out = dx * l.normal.x + dz * l.normal.z, side = Math.abs(dx * l.normal.z - dz * l.normal.x);
    if (out > -0.1 && out < 1.0 && side < 0.6 && feet.y > l.base.y - 0.5 && feet.y < l.top + 0.3) return l;
  }
  return null;
}
