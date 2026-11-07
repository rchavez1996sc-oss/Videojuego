import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Traffic, Vehicle } from './traffic';
import { contactOf, exchange, jolt, readBody } from './vehicleBody';
import { dent } from '../fx/dents';

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
  const dv = jolt(v, dt);
  if (dv > 2.5) {
    t.damage(v, (dv - 2.5) * 16);
    const c = contactOf(world, v.collider);
    if (c && dv > 3) dent(v.group, c.at, Math.min(0.38, (dv - 2.5) * 0.055));
    if (dv > 4) t.onCrash(c?.at ?? new THREE.Vector3(v.x, v.y ?? 0, v.z), dv);
  }
  const w = v.body.angvel(), still = v.speed < 0.4 && Math.hypot(w.x, w.y, w.z) < 0.4;
  v.dyn!.still = still ? v.dyn!.still + dt : 0;
  if (v.state === 'tumble' && v.dyn!.still > 2) v.state = v.hp > 0 ? 'parked' : 'wreck';
}
