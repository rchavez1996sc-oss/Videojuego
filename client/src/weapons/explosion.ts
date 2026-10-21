import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Combat } from './combat';
import type { Sfx } from '../audio/sfx';
import type { ThirdPersonCamera } from '../core/camera';
import type { Enemies } from '../systems/enemies';
import type { Player } from '../entities/player';

export const BLAST_RADIUS = 8;

/** Grenade detonation: effects, sound, camera shake, enemy alert/damage and self-damage behind no cover. */
export function detonate(at: THREE.Vector3, d: { combat: Combat; sfx: Sfx; tpc: ThirdPersonCamera; enemies: Enemies; player: Player; world: RAPIER.World; playerAlive: boolean }): void {
  const cam = d.tpc.camera.position, right = new THREE.Vector3(1, 0, 0).applyQuaternion(d.tpc.camera.quaternion);
  const dist = at.distanceTo(cam);
  d.combat.explosionFx(at);
  d.sfx.explosion(dist, at.clone().sub(cam).normalize().dot(right));
  d.tpc.kick(0.01 * Math.max(0, 1 - dist / 40), 0, Math.max(0, 0.5 - dist / 60));
  d.enemies.hearShot(at);
  d.enemies.explosion(at, BLAST_RADIUS, 230);
  const chest = d.player.position.clone().setY(d.player.position.y + 1.0);
  const r = chest.distanceTo(at);
  if (r >= BLAST_RADIUS || !d.playerAlive) return;
  const dir = chest.clone().sub(at), len = dir.length();
  const block = d.world.castRay(new RAPIER.Ray(at.clone().setY(at.y + 0.3), dir.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== d.player.collisionHandle && c.isEnabled());
  if (!block || block.timeOfImpact > len - 0.5) d.enemies.onPlayerHit(130 * Math.pow(1 - r / BLAST_RADIUS, 1.2), at);
}
