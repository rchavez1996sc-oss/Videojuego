import type RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';
import type { Traffic, Vehicle } from './traffic';
import { parkedCars } from '../world/parkedCars';
import { exchange } from './vehicleBody';

/** Traffic and parked cars the driven car touches become rigid bodies too, so momentum is exchanged by mass. */
export function joinPhysics(world: RAPIER.World, traffic: Traffic, v: Vehicle, player: THREE.Vector3): void {
  const hits: Vehicle[] = [];
  world.contactPairsWith(v.collider, (o) => {
    const other = traffic.vehicleOf(o.handle), spot = other ? null : parkedCars.byCollider(o.handle);
    if (other && !other.body.isDynamic()) hits.push(other);
    else if (spot) {
      parkedCars.take(spot, player);
      hits.push(traffic.adopt(spot));
    }
  });
  for (const other of hits) exchange(world, v, other, (o) => traffic.knock(o));
}
