import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { cover } from '../ai/cover';

/** Gunfire closer than this sends a passer-by to the nearest cover instead of running down the street. */
export const HIDE_RANGE = 40;

/**
 * A spot within 14 m whose obstacle stands between it and the shot, reachable in a straight run (no wall in between);
 * null when there's nothing to duck behind.
 */
export function hideSpot(world: RAPIER.World, from: THREE.Vector3, threat: THREE.Vector3, self: RAPIER.Collider): THREE.Vector3 | null {
  for (const c of cover.candidates(from, threat, 14, 9, -2)) {
    const to = new THREE.Vector3(c.pos.x - from.x, 0, c.pos.z - from.z), d = to.length();
    if (d < 0.5) return c.pos.clone().setY(from.y);
    const hit = world.castRay(new RAPIER.Ray({ x: from.x, y: from.y + 0.6, z: from.z }, to.divideScalar(d)), d, true, RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, self);
    if (!hit) return c.pos.clone();
  }
  return null;
}
