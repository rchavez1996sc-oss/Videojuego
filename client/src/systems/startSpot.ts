import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from '../world/heightfield';
import { roomy } from './respawn';

const NEAR = 400, FAR = Infinity, FOE_GAP = 60;

/**
 * Where a level starts: a random open street (or hillside) spot at least 400 m from the objective, well clear of enemy posts,
 * with no roof overhead and no car or wall around, facing the objective. Null if nothing qualifies.
 */
export function startSpot(world: RAPIER.World, hf: Heightfield, streets: THREE.Vector3[], goal: { x: number; z: number }, foes: { x: number; z: number }[], inside: (x: number, z: number) => boolean = () => true): { pos: THREE.Vector3; yaw: number } | null {
  const limit = hf.def.playable / 2 - 20;
  const open = Array.from({ length: 600 }, () => new THREE.Vector3((Math.random() * 2 - 1) * limit, 0, (Math.random() * 2 - 1) * limit));
  const pool = [...streets, ...open].filter((p) => {
    const d = Math.hypot(p.x - goal.x, p.z - goal.z);
    return d >= NEAR && d <= FAR && inside(p.x, p.z) && Math.abs(p.x) < limit && Math.abs(p.z) < limit && foes.every((f) => Math.hypot(p.x - f.x, p.z - f.z) >= FOE_GAP);
  });
  for (let tries = 0; tries < 160 && pool.length; tries++) {
    const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (1 - hf.normalAt(p.x, p.z)[1] > 0.25) continue;
    const pos = new THREE.Vector3(p.x, hf.heightAt(p.x, p.z), p.z);
    if (world.castRay(new RAPIER.Ray({ x: pos.x, y: pos.y + 0.4, z: pos.z }, { x: 0, y: 1, z: 0 }), 40, true)) continue;
    if (!roomy(world, pos, -1)) continue;
    const ring = [0, 1, 2, 3].every((i) => roomy(world, pos.clone().add(new THREE.Vector3(Math.cos(i * 1.57) * 2.2, 0, Math.sin(i * 1.57) * 2.2)).setY(hf.heightAt(pos.x + Math.cos(i * 1.57) * 2.2, pos.z + Math.sin(i * 1.57) * 2.2)), -1));
    if (!ring) continue;
    return { pos, yaw: Math.atan2(-(goal.x - pos.x), -(goal.z - pos.z)) };
  }
  return null;
}
