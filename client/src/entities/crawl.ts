import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { characters } from '../render/characters';
import type { Rig } from './rig';

const SPEED = 0.45, NEAR = 2.2;

/**
 * A downed body crawls on hands and knees towards `target` (the player coming to help), turning to it and stopping
 * close by or at an obstacle; the clip freezes while it rests. Returns the body's new heading.
 */
export function crawlToward(rig: Rig, world: RAPIER.World, feet: THREE.Vector3, yaw: number, target: THREE.Vector3, dt: number, self: number): number {
  if (!characters.clips.has('crawl')) return yaw;
  const to = target.clone().sub(feet).setY(0), d = to.length();
  const dir = to.divideScalar(Math.max(d, 1e-3));
  const blocked = !!world.castRay(new RAPIER.Ray({ x: feet.x, y: feet.y + 0.4, z: feet.z }, dir), 0.9, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => c.handle !== self && c.isEnabled());
  const go = d > NEAR && !blocked;
  const was = rig.dead;
  rig.dead = false;
  rig.hold('crawl', go ? 1 : 0);
  rig.dead = was;
  if (!go) return yaw;
  const want = Math.atan2(dir.x, dir.z), turn = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  yaw += turn * Math.min(1, dt * 3);
  feet.addScaledVector(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), SPEED * dt * Math.max(0, Math.cos(turn)));
  const down = world.castRay(new RAPIER.Ray({ x: feet.x, y: feet.y + 0.8, z: feet.z }, { x: 0, y: -1, z: 0 }), 2, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => c.handle !== self && !c.parent()?.isKinematic());
  if (down) feet.y = feet.y + 0.8 - down.timeOfImpact;
  rig.root.rotation.set(0, yaw, 0);
  return yaw;
}
