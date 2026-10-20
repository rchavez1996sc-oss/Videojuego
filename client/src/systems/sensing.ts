import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Threat } from '../ui/threatGrid';
import type { Enemies } from './enemies';
import type { Civilians } from './civilians';
import type { Player } from '../entities/player';
import type { Heightfield } from '../world/heightfield';
import { surfaceOf } from '../world/surfaces';

/** Directions/distances of nearby enemies (and bystanders, as neutral marks) relative to the camera heading. */
export function gatherThreats(enemies: Enemies, civilians: Civilians | null, supplies: THREE.Vector3[], player: THREE.Vector3, camera: THREE.Camera): Threat[] {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const out: Threat[] = [];
  const push = (p: THREE.Vector3, aware: boolean, neutral: boolean, supply = false) => {
    const d = p.clone().sub(player).setY(0), dist = d.length();
    if (dist < 130) out.push({ angle: Math.atan2(d.dot(right), d.dot(fwd)), dist, aware, neutral, supply });
  };
  for (const e of enemies.list) if (e.alive) push(e.position, e.state !== 'patrol', false);
  for (const p of civilians?.present ?? []) push(p, false, true);
  for (const p of supplies) push(p, false, false, true);
  return out;
}

/** Footstep surface under the player: grass/dirt from the terrain mask, otherwise the collider's material. */
export function surfaceUnder(world: RAPIER.World, hf: Heightfield, player: Player): 'grass' | 'dirt' | 'rock' | 'wood' {
  const p = player.position;
  const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }), 0.8, true, undefined, undefined, undefined, undefined, (c) => c.handle !== player.collisionHandle);
  const surf = hit ? surfaceOf(hit.collider.handle) : 'dirt';
  if (surf === 'dirt') return hf.maskAt(p.x, p.z, 1) > 0.3 ? 'grass' : 'dirt';
  if (surf === 'wood') return 'wood';
  return surf === 'rock' || surf === 'metal' || surf === 'tile' ? 'rock' : 'dirt';
}
