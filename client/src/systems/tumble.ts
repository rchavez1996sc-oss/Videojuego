import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Traffic, Vehicle } from './traffic';
import { exchange, readBody } from './vehicleBody';
import { vehicleImpact } from './carImpacts';

/**
 * A vehicle that is a rigid body and nobody drives (hit, disabled, left by the player): pose from the physics, damage
 * and dents from jolts (the lighter one in a crash takes the bigger velocity change, so it comes off worse), traffic it
 * touches joins the physics, and once it has been still for 2 s it is parked — or a wreck.
 */
export function tumbleStep(t: Traffic, world: RAPIER.World, v: Vehicle, dt: number): void {
  readBody(v);
  const hits: Vehicle[] = [];
  world.contactPairsWith(v.collider, (o) => {
    const other = t.vehicleOf(o.handle);
    if (other && !other.body.isDynamic() && other.state !== 'off') hits.push(other);
  });
  for (const other of hits) exchange(world, v, other, (o) => t.knock(o));
  const hit = vehicleImpact(world, v, dt);
  if (hit) {
    if (hit.damage > 0) t.damage(v, hit.damage);
    if (hit.event.dv > 4) t.onCrash(hit.at ?? new THREE.Vector3(v.x, v.y ?? 0, v.z), hit.event.dv);
  }
  const w = v.body.angvel(), still = v.speed < 0.4 && Math.hypot(w.x, w.y, w.z) < 0.4;
  v.dyn!.still = still ? v.dyn!.still + dt : 0;
  if (v.state === 'tumble' && v.dyn!.still > 2) v.state = v.hp > 0 ? 'parked' : 'wreck';
}
