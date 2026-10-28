import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from '../world/heightfield';
import type { SpawnDef } from './enemies';
import type { NearStart } from '../data/types';

const FROM_PLAYER = 90, APART = 22;

/** Garrison posts (leashed) and fixed guards (`y`/`at`) keep their place; everyone else is shuffled each game. */
export const isDefender = (s: SpawnDef): boolean => !!s.leash || s.y !== undefined || s.at !== undefined;

/**
 * Random street-graph spots for the roaming police: on open ground (no roof, not on a pier or bridge), at least
 * 90 m from the player's start and spread apart. Each gets a short two-point beat to walk half of the time.
 */
export function shuffleRoamers(spawns: SpawnDef[], nodes: THREE.Vector3[], world: RAPIER.World, hf: Heightfield, start: THREE.Vector3, near?: NearStart): SpawnDef[] {
  const open = nodes.filter((n) => Math.abs(n.y - hf.heightAt(n.x, n.z)) < 0.8
    && !world.castRay(new RAPIER.Ray({ x: n.x, y: n.y + 0.6, z: n.z }, { x: 0, y: 1, z: 0 }), 40, true));
  const far = open.filter((n) => n.distanceTo(start) > (near?.max ?? FROM_PLAYER));
  const close = near ? open.filter((n) => { const d = n.distanceTo(start); return d > near.min && d < near.max; }) : [];
  let placed = 0;
  const taken = spawns.filter(isDefender).map((s) => new THREE.Vector3(s.x, 0, s.z));
  return spawns.map((s) => {
    if (isDefender(s)) return s;
    const pool = near && placed++ < near.count && close.length ? close : far;
    if (!pool.length) return s;
    for (let tries = 0; tries < 40; tries++) {
      const p = pool[Math.floor(Math.random() * pool.length)];
      if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < (pool === close ? APART / 2 : APART))) continue;
      taken.push(p);
      const mate = pool.find((q) => { const d = q.distanceTo(p); return d > 30 && d < 70 && Math.random() < 0.15; });
      return { ...s, x: p.x, z: p.z, patrol: mate && Math.random() < 0.5 ? [[p.x, p.z], [mate.x, mate.z]] : undefined };
    }
    return s;
  });
}
