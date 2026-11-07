import * as THREE from 'three';
import { characters } from '../render/characters';
import type { Rig } from '../entities/rig';

interface Pose { hips: THREE.Vector3; yaw: number }

const UP = new THREE.Vector3(0, 1, 0), RATE = 2.2;

/** Hips (root space) and facing (radians, from the knees) of `key` at `frac` of its length, root at the origin. */
function poseOf(rig: Rig, key: string, frac: number): Pose {
  const root = rig.root, pos = root.position.clone(), rot = root.rotation.y;
  root.position.set(0, 0, 0);
  root.rotation.y = 0;
  rig.release(0);
  rig.hold(key, 0, true, frac);
  rig.tick(0);
  root.updateMatrixWorld(true);
  const hips = rig.hips(), knees = ['Left', 'Right'].map((s) => root.getObjectByName(`mixamorig${s}Leg`)!.getWorldPosition(new THREE.Vector3()));
  const ahead = knees[0].add(knees[1]).multiplyScalar(0.5).sub(hips);
  root.position.copy(pos);
  root.rotation.y = rot;
  return { hips, yaw: Math.atan2(ahead.x, ahead.z) };
}

const smooth = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);

/**
 * Getting into / out of a car with the Mixamo clips, anchored to the driver's seat: entering ends with the hips on the
 * seat facing the car's heading (the clip's own walk-in brings the body from outside the door), exiting starts seated
 * there and ends standing beside the door. The body is lowered/raised to the game's seat height along the way.
 */
export class SeatAnim {
  /** Where the body ends (feet) and its facing, once finished. */
  readonly end: { pos: THREE.Vector3; yaw: number };
  private t = 0;
  private dur: number;
  private rootPos: THREE.Vector3;
  private rootYaw: number;
  private y0: number;
  private y1: number;

  static possible(): boolean {
    return characters.clips.has('car_in') && characters.clips.has('car_out');
  }

  /** `seat`: world hips point on the seat; `heading`: car yaw; `ground`: feet height outside (enter) or at the end (exit). */
  constructor(private rig: Rig, readonly out: boolean, seat: THREE.Vector3, heading: number, ground: number) {
    const key = out ? 'car_out' : 'car_in', seated = poseOf(rig, key, out ? 0 : 1), standing = poseOf(rig, key, out ? 1 : 0);
    this.rootYaw = heading - seated.yaw;
    const off = seated.hips.clone().setY(0).applyAxisAngle(UP, this.rootYaw);
    this.rootPos = seat.clone().sub(off);
    const seatRoot = seat.y - seated.hips.y;
    [this.y0, this.y1] = out ? [seatRoot, ground] : [ground, seatRoot];
    const feet = this.rootPos.clone().add(standing.hips.clone().setY(0).applyAxisAngle(UP, this.rootYaw)).setY(ground);
    this.end = { pos: out ? feet : seat.clone(), yaw: this.rootYaw + standing.yaw };
    this.dur = rig.durationOf(key) / RATE;
  }

  /** Starts the clip (after any respawn of the body, which clears its actions). */
  begin(): this {
    this.rig.release(0);
    this.rig.hold(this.out ? 'car_out' : 'car_in', RATE, true, 0);
    this.place();
    return this;
  }

  /** How far through the clip (0..1). */
  get progress(): number {
    return Math.min(1, this.t / this.dur);
  }

  /** Standing point of the exit (before it starts), to check there is room by the door. */
  get start(): THREE.Vector3 {
    return this.rootPos.clone().setY(this.y0);
  }

  update(dt: number): boolean {
    this.t += dt;
    this.place();
    this.rig.animate(dt, 0, 0, 0);
    return this.t < this.dur;
  }

  private place(): void {
    const k = this.t / this.dur, w = this.out ? smooth(0.15, 0.6, k) : smooth(0.35, 0.85, k);
    this.rig.root.position.copy(this.rootPos).setY(THREE.MathUtils.lerp(this.y0, this.y1, w) - 0.03);
    this.rig.root.rotation.set(0, this.rootYaw, 0);
  }
}
