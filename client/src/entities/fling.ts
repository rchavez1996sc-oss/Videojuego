import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * A body knocked down by a vehicle: thrown along the hit with a small hop, then it slides on the ground with friction
 * until it stops; walls stop it (sphere cast at waist height). Moves the feet position it is given.
 */
export class Fling {
  private vy: number;
  private y: number;
  private air = true;

  constructor(private vel: THREE.Vector3, feetY: number) {
    this.vy = Math.min(4, vel.length() * 0.25);
    this.y = feetY;
  }

  /** Returns false once the body has come to rest. */
  step(world: RAPIER.World, pos: THREE.Vector3, dt: number, self: number): boolean {
    const move = this.vel.clone().multiplyScalar(dt), len = move.length();
    if (len > 1e-4) {
      const hit = world.castShape({ x: pos.x, y: pos.y + 0.5, z: pos.z }, { x: 0, y: 0, z: 0, w: 1 }, { x: move.x / dt, y: 0, z: move.z / dt }, new RAPIER.Ball(0.25), 0, dt, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, undefined, undefined, (c) => c.handle !== self && c.shapeType() !== RAPIER.ShapeType.HeightField);
      if (hit) {
        move.multiplyScalar(Math.max(0, hit.time_of_impact / dt - 0.1));
        this.vel.multiplyScalar(0.15);
      }
      pos.add(move);
    }
    const down = world.castRay(new RAPIER.Ray({ x: pos.x, y: Math.max(pos.y, this.y) + 1, z: pos.z }, { x: 0, y: -1, z: 0 }), 5, true, RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const floor = down ? Math.max(pos.y, this.y) + 1 - down.timeOfImpact : this.y;
    if (this.air) {
      this.vy -= 9.8 * dt;
      this.y += this.vy * dt;
      if (this.y <= floor) [this.y, this.air] = [floor, false];
    } else if (floor < this.y - 0.3) [this.air, this.vy] = [true, 0];
    else this.y = floor;
    pos.y = this.y;
    if (!this.air) this.vel.multiplyScalar(Math.exp(-3.2 * dt));
    return this.air || this.vel.lengthSq() > 0.04;
  }
}
