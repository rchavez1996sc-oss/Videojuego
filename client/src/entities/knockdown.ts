import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { characters } from '../render/characters';
import type { Rig } from './rig';

/** How far back the Stumble Backwards clip carries the hips (m). */
const TRAVEL = 0.9, STUMBLE_FROM = 0.14;
/** The blow itself carries the body clear of the bumper: speed (m/s) from the push, decaying at this rate. */
const SLIDE_DECAY = 4;

/**
 * Knocked over by a vehicle and still alive: stumbles backwards along the hit and lands sitting (Stumble Backwards),
 * then gets up (Getting Up); no moving or shooting meanwhile. The hit first slides the body out of the vehicle's way.
 * Needs room behind (a ray along the hit); else null.
 */
export class Knockdown {
  private t = 0;
  private up = false;
  readonly yaw: number;
  private dir: THREE.Vector3;

  static start(world: RAPIER.World, rig: Rig, feet: THREE.Vector3, push: THREE.Vector3, self: number): Knockdown | null {
    const dir = push.clone().setY(0);
    if (!characters.clips.has('stumble') || dir.lengthSq() < 1e-4) return null;
    dir.normalize();
    const slide = Math.min(5, push.length() * 0.5);
    const hit = world.castRay(new RAPIER.Ray({ x: feet.x, y: feet.y + 0.9, z: feet.z }, dir), TRAVEL + slide / SLIDE_DECAY + 0.3, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, undefined, undefined, (c) => c.handle !== self && c.isEnabled());
    return hit ? null : new Knockdown(rig, dir, slide);
  }

  private constructor(private rig: Rig, dir: THREE.Vector3, private slide: number) {
    this.dir = dir;
    this.yaw = Math.atan2(dir.x, dir.z);
    rig.release(0);
    rig.hold('stumble', 1.3, true, STUMBLE_FROM);
  }

  /** Advances, keeps body and model in place (moving `feet` when the stumble lands). Returns false once standing again. */
  step(dt: number, feet: THREE.Vector3, body: RAPIER.RigidBody, lift: number): boolean {
    this.t += dt;
    feet.addScaledVector(this.dir, this.slide * dt);
    this.slide *= Math.exp(-SLIDE_DECAY * dt);
    body.setNextKinematicTranslation({ x: feet.x, y: feet.y + lift, z: feet.z });
    this.rig.root.position.copy(feet).setY(feet.y - 0.03);
    this.rig.root.rotation.set(0, this.yaw + Math.PI, 0);
    this.rig.animate(dt, 0, 0, 0);
    if (!this.up && this.t >= this.rig.durationOf('stumble') / 1.3 * (0.92 - STUMBLE_FROM)) {
      feet.addScaledVector(this.dir, TRAVEL);
      this.rig.revive();
      [this.up, this.t] = [true, 0];
    }
    return !this.up || this.t < this.rig.durationOf('getup') * 0.9;
  }
}
