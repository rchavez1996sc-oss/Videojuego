import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/** How far ahead of the feet a thrown body checks for walls (its own length, roughly). */
const REACH = 1.0;

/**
 * A body knocked down by a vehicle: thrown along the hit with a small hop, then it slides on the ground with friction
 * until it stops; a wall in its way is a slam: it stops short of it by its own length and bounces back a little. Moves the feet position it is given.
 */
export class Fling {
  private vy: number;
  private y: number;
  private air = true;

  constructor(private vel: THREE.Vector3, feetY: number) {
    this.vy = Math.min(4, vel.length() * 0.25);
    this.y = feetY;
  }

  /** Moves `feet` back from a wall closer than the body's length along `dir`, so the fall starting there fits. */
  static backOff(world: RAPIER.World, feet: THREE.Vector3, dir: THREE.Vector3, self: number): void {
    const d = dir.clone().setY(0).normalize(), need = REACH + 0.3;
    const hit = world.castRay(new RAPIER.Ray({ x: feet.x, y: feet.y + 0.6, z: feet.z }, { x: d.x, y: 0, z: d.z }), need, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, undefined, undefined, (c) => c.handle !== self && c.shapeType() !== RAPIER.ShapeType.HeightField);
    if (hit) feet.addScaledVector(d, hit.timeOfImpact - need);
  }

  /** A slam into a wall at `speed` m/s (thud, shake): set once by whoever owns the sounds. */
  static onSlam: (at: THREE.Vector3, speed: number) => void = () => {};

  /** Returns false once the body has come to rest. */
  step(world: RAPIER.World, pos: THREE.Vector3, dt: number, self: number): boolean {
    const flat = Math.hypot(this.vel.x, this.vel.z), len = flat * dt;
    if (len > 1e-4) {
      // Looks `REACH` past the feet: the falling body (and the hit-by-car clip, which carries the hips ~0.8 m along the
      // throw) lies ahead of them, so a wall caught only at the feet ends with the body through it.
      const dir = { x: this.vel.x / flat, y: 0, z: this.vel.z / flat };
      const hit = world.castShape({ x: pos.x, y: pos.y + 0.6, z: pos.z }, { x: 0, y: 0, z: 0, w: 1 }, dir, new RAPIER.Ball(0.3), 0, len + REACH, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, undefined, undefined, (c) => c.handle !== self && c.shapeType() !== RAPIER.ShapeType.HeightField);
      const room = hit ? Math.max(0, hit.time_of_impact - REACH) : len;
      pos.x += dir.x * Math.min(len, room);
      pos.z += dir.z * Math.min(len, room);
      if (hit && room < len) {
        if (flat > 3) Fling.onSlam(new THREE.Vector3(pos.x + dir.x * hit.time_of_impact, pos.y + 0.9, pos.z + dir.z * hit.time_of_impact), flat);
        this.vel.set(-dir.x * flat * 0.18, 0, -dir.z * flat * 0.18);
        this.vy = Math.min(this.vy, 0);
      }
    }
    const down = world.castRay(new RAPIER.Ray({ x: pos.x, y: Math.max(pos.y, this.y) + 1, z: pos.z }, { x: 0, y: -1, z: 0 }), 40, true, RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
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
