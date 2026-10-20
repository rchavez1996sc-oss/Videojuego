import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from '../world/heightfield';
import type { Enemy } from '../entities/enemy';

/**
 * Picks a respawn spot 40–90 m from where the player fell, away from living enemies and out of their sight.
 * Returns the feet position and a yaw facing back toward the fight.
 */
export function findRespawn(world: RAPIER.World, hf: Heightfield, enemies: Enemy[], death: THREE.Vector3, fallback: THREE.Vector3): { pos: THREE.Vector3; yaw: number } {
  const alive = enemies.filter((e) => e.alive);
  const centroid = alive.length ? alive.reduce((c, e) => c.add(e.position), new THREE.Vector3()).divideScalar(alive.length) : death.clone();
  const away = death.clone().sub(centroid).setY(0);
  if (away.lengthSq() < 1) away.set(fallback.x - death.x, 0, fallback.z - death.z);
  away.normalize();
  const limit = hf.def.playable / 2 - 15;
  let best: { pos: THREE.Vector3; score: number } | null = null;

  for (const radius of [40, 55, 70, 90]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = death.x + Math.cos(a) * radius, z = death.z + Math.sin(a) * radius;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (1 - hf.normalAt(x, z)[1] > 0.3) continue;
      const ground = hf.heightAt(x, z);
      const down = world.castRay(new RAPIER.Ray({ x, y: ground + 30, z }, { x: 0, y: -1, z: 0 }), 31, true);
      if (down && 30 - down.timeOfImpact > 0.4) continue;
      const pos = new THREE.Vector3(x, ground, z);
      let nearest = Infinity, seen = false;
      for (const e of alive) {
        const d = e.position.distanceTo(pos);
        nearest = Math.min(nearest, d);
        if (d < 120 && !seen) {
          const from = e.position.clone().setY(e.position.y + 1.6), to = pos.clone().setY(pos.y + 1.2);
          const dir = to.clone().sub(from), len = dir.length();
          const hit = world.castRay(new RAPIER.Ray(from, dir.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== e.handle && c.isEnabled());
          seen = !hit || hit.timeOfImpact > len - 0.5;
        }
      }
      if (nearest < 45 || seen) continue;
      const dir = pos.clone().sub(death).setY(0).normalize();
      const score = radius * 0.4 - dir.dot(away) * 30 - Math.min(nearest, 90) * 0.2;
      if (!best || score < best.score) best = { pos, score };
    }
    if (best) break;
  }
  const pos = best?.pos ?? fallback;
  const look = centroid.clone().sub(pos);
  return { pos, yaw: Math.atan2(-look.x, -look.z) };
}
