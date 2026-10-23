import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from '../world/heightfield';
import type { Enemy } from '../entities/enemy';
import type { Enemies } from './enemies';
import type { StreetGraph } from '../world/barrio';
import type { Player } from '../entities/player';
import type { ThirdPersonCamera } from '../core/camera';
import type { Squad } from './squad';

/** Respawn candidates along the street network (every ~8 m), so the player never reappears between walls or in a closed yard. */
export function streetPoints(graph: StreetGraph): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (const [i, j] of graph.edges) {
    const a = graph.nodes[i], b = graph.nodes[j], n = Math.max(1, Math.ceil(a.distanceTo(b) / 8));
    for (let k = 0; k <= n; k++) pts.push(a.clone().lerp(b, k / n));
  }
  return pts;
}

const BODY = new RAPIER.Capsule(0.6, 0.5);

/** Room for a standing body: nothing solid (walls, cars, people) within half a metre. */
export function roomy(world: RAPIER.World, pos: THREE.Vector3, ignore: number): boolean {
  let blocked = false;
  world.intersectionsWithShape({ x: pos.x, y: pos.y + 1.15, z: pos.z }, { x: 0, y: 0, z: 0, w: 1 }, BODY, (c) => {
    blocked = c.handle !== ignore && c.isEnabled();
    return !blocked;
  });
  return !blocked;
}

/**
 * Picks a respawn spot near where the player fell (within 50 m when possible), clear of living enemies and out of their sight.
 * Returns the feet position and a yaw facing back toward the fight.
 */
export function findRespawn(world: RAPIER.World, hf: Heightfield, enemies: Enemy[], death: THREE.Vector3, fallback: THREE.Vector3, streets?: THREE.Vector3[], ignore = -1): { pos: THREE.Vector3; yaw: number } {
  const alive = enemies.filter((e) => e.alive);
  const centroid = alive.length ? alive.reduce((c, e) => c.add(e.position), new THREE.Vector3()).divideScalar(alive.length) : death.clone();
  const away = death.clone().sub(centroid).setY(0);
  if (away.lengthSq() < 1) away.set(fallback.x - death.x, 0, fallback.z - death.z);
  away.normalize();
  const limit = hf.def.playable / 2 - 15;
  let best: { pos: THREE.Vector3; score: number } | null = null;

  const rings = streets ? [[8, 50], [50, 90], [90, 160]] : [[40, 40], [55, 55], [70, 70], [90, 90]];
  for (const [r0, r1] of rings) {
    const clear = streets && r1 <= 50 ? 25 : 45;
    const spots = streets
      ? streets.filter((p) => Math.hypot(p.x - death.x, p.z - death.z) >= r0 && Math.hypot(p.x - death.x, p.z - death.z) < r1).map((p) => [p.x, p.z])
      : Array.from({ length: 16 }, (_, i) => [death.x + Math.cos((i / 16) * Math.PI * 2) * r0, death.z + Math.sin((i / 16) * Math.PI * 2) * r0]);
    for (const [x, z] of spots) {
      const radius = Math.hypot(x - death.x, z - death.z);
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (1 - hf.normalAt(x, z)[1] > 0.3) continue;
      const ground = hf.heightAt(x, z);
      const down = world.castRay(new RAPIER.Ray({ x, y: ground + 30, z }, { x: 0, y: -1, z: 0 }), 31, true);
      if (down && 30 - down.timeOfImpact > 0.4) continue;
      const pos = new THREE.Vector3(x, ground, z);
      if (!roomy(world, pos, ignore)) continue;
      let nearest = Infinity, seen = false;
      for (const e of alive) {
        const d = e.position.distanceTo(pos);
        nearest = Math.min(nearest, d);
        if (d < (clear < 45 ? 60 : 120) && !seen) {
          const from = e.position.clone().setY(e.position.y + 1.6), to = pos.clone().setY(pos.y + 1.2);
          const dir = to.clone().sub(from), len = dir.length();
          const hit = world.castRay(new RAPIER.Ray(from, dir.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== e.handle && c.isEnabled());
          seen = !hit || hit.timeOfImpact > len - 0.5;
        }
      }
      if (nearest < clear || seen) continue;
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

/** Survivors who were hunting the player go back to searching where they fell. */
export function resetHunt(enemies: Enemies, deathPos: THREE.Vector3): void {
  enemies.suppressIntel(15);
  for (const e of enemies.list) {
    if (!e.alive || e.state === 'patrol') continue;
    e.state = 'alert';
    e.stateT = 0;
    e.awareness = 0.5;
    e.lastKnown.copy(deathPos);
    e.moveTarget = null;
    e.path = [];
  }
}

/** Brings the player back at a safe street spot facing the fight; hunters lose track and the squad regroups. */
export function respawnPlayer(d: { world: RAPIER.World; hf: Heightfield; enemies: Enemies; player: Player; tpc: ThirdPersonCamera; squad: Squad | null; death: THREE.Vector3; spawn: { x: number; z: number }; streets?: THREE.Vector3[] }): void {
  const fallback = new THREE.Vector3(d.spawn.x, d.hf.heightAt(d.spawn.x, d.spawn.z), d.spawn.z);
  const spot = findRespawn(d.world, d.hf, d.enemies.list, d.death, fallback, d.streets, d.player.collisionHandle);
  d.player.respawn(spot.pos, spot.yaw);
  d.tpc.yaw = spot.yaw;
  d.tpc.pitch = -0.1;
  resetHunt(d.enemies, d.death);
  d.squad?.regroup(spot.pos, spot.yaw);
}
