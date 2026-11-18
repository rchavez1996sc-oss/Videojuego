import type * as THREE from 'three';
import type { Enemy } from '../entities/enemy';

/** Most units hunting the player at once; the rest hold their ground and join as the hunters fall. */
const HUNTERS = 7;

/** Units beyond the nearest `HUNTERS` that are not looking at the player: disengaged so they stay in their sector. */
export function holdReserve(list: Enemy[], player: THREE.Vector3, last: boolean): Set<Enemy> {
  const near = list.filter((e) => e.alive && !e.isStatic && (e.engaged || last)).sort((a, b) => a.position.distanceToSquared(player) - b.position.distanceToSquared(player));
  const reserve = new Set(near.slice(HUNTERS).filter((e) => !e.canSee));
  for (const e of reserve) [e.engaged, e.awareness] = [false, Math.min(e.awareness, 0.3)];
  return reserve;
}
