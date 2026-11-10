import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Vehicle } from './traffic';
import { MASS, makeDynamic } from './vehicleBody';
import type { Spec, Controls } from './carPhysics';

/** Spring rest length and travel (m). The mount sits higher by the static sag g / (wheels × stiffness) — Rapier scales the
 * spring force by the chassis mass — so at rest the body's origin, and the model, stay on the ground instead of 6–11 cm into it. */
const REST = 0.28, TRAVEL = 0.22;

/**
 * The driven vehicle as a real car: a dynamic rigid body on ray-cast wheels with springs (Rapier's ray-cast vehicle).
 * Engine force on the driven wheels, brakes, speed-sensitive steering, handbrake that locks the rear and loosens its
 * grip; gravity, weight transfer, bumps, jumps, spins and rollovers come from the physics. Mototaxis ride on 3 wheels.
 */
export class CarRig {
  private ctrl: RAPIER.DynamicRayCastVehicleController;
  private steer = 0;
  private front: number[] = [];
  private rear: number[] = [];
  readonly mass: number;
  /** Wheel mount points in the body's frame (the vehicle group's frame), and the spring length at rest. */
  readonly mounts: THREE.Vector3[] = [];
  private sag = 0;

  constructor(world: RAPIER.World, private v: Vehicle, private sp: Spec, skip: (c: RAPIER.Collider) => boolean) {
    makeDynamic(v, new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.speed));
    this.mass = MASS[v.kind] ?? 1300;
    v.body.setLinearDamping(0); // drag is `coast`'s while driven
    const ctrl = (this.ctrl = world.createVehicleController(v.body));
    ctrl.indexUpAxis = 1;
    ctrl.setIndexForwardAxis = 2;
    const h = (v.collider.shape as RAPIER.Cuboid).halfExtents, r = v.kind === 'micro' ? 0.48 : sp.small ? 0.26 : 0.31;
    const zf = h.z - (v.kind === 'micro' ? 1.6 : sp.small ? 0.35 : 0.8), zr = -h.z + (v.kind === 'micro' ? 1.9 : sp.small ? 0.45 : 0.8), x = h.x - 0.12, n = v.kind === 'moto' ? 3 : v.kind === 'delivery' ? 2 : 4, y = r + REST - (this.sag = 9.81 / (n * sp.spring));
    const add = (wx: number, wz: number, front: boolean) => {
      ctrl.addWheel({ x: wx, y, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, r);
      this.mounts.push(new THREE.Vector3(wx, y, wz));
      const i = ctrl.numWheels() - 1;
      (front ? this.front : this.rear).push(i);
      ctrl.setWheelSuspensionStiffness(i, sp.spring);
      ctrl.setWheelSuspensionCompression(i, 3.2);
      ctrl.setWheelSuspensionRelaxation(i, 4.0);
      ctrl.setWheelMaxSuspensionTravel(i, TRAVEL);
      ctrl.setWheelMaxSuspensionForce(i, this.mass * 9.81 * 3);
      ctrl.setWheelFrictionSlip(i, sp.grip);
      ctrl.setWheelSideFrictionStiffness(i, 1.0);
    };
    if (v.kind === 'moto') add(0, zf, true);
    else if (v.kind !== 'delivery') [x, -x].forEach((wx) => add(wx, zf, true));
    else add(0, zf, true);
    (v.kind === 'delivery' ? [0] : [x, -x]).forEach((wx) => add(wx, zr, false));
    this.skip = skip;
  }

  private skip: (c: RAPIER.Collider) => boolean;

  /** Signed speed along the heading (m/s). */
  get speed(): number {
    return this.ctrl.currentVehicleSpeed();
  }

  update(u: Controls, dt: number): void {
    const { ctrl, sp, mass } = this, speed = this.speed;
    this.steer = THREE.MathUtils.damp(this.steer, u.steer * sp.lock / (1 + Math.abs(speed) / 9), sp.steerRate, dt);
    for (const i of this.front) ctrl.setWheelSteering(i, this.steer);
    const drive = this.rear.length ? this.rear : this.front, force = this.tractive(Math.abs(speed)) / drive.length;
    let engine = 0, brake = 0;
    if (u.throttle) engine = speed < -0.5 ? mass * sp.acc * 2 / drive.length : force;
    if (u.brake) speed > 0.5 ? (brake = mass * 9 * dt) : speed > -sp.top * 0.3 && (engine = -mass * sp.acc * 0.7 / drive.length);
    for (const i of [...this.front, ...this.rear]) {
      ctrl.setWheelEngineForce(i, drive.includes(i) ? engine : 0);
      ctrl.setWheelBrake(i, (brake + (u.handbrake && this.rear.includes(i) ? mass * 6 * dt : 0)) / (this.front.length + this.rear.length) * 4);
      ctrl.setWheelFrictionSlip(i, u.handbrake && this.rear.includes(i) ? sp.grip * 0.4 : sp.grip);
    }
    this.coast(dt);
    ctrl.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => c.handle !== this.v.collider.handle && !this.skip(c));
  }

  /**
   * Net push of the engine at `v` m/s: full launch force up to the point where the engine's power runs out (a third of
   * top speed), then power / speed, against the drag of `coast`, sized so they meet near top speed — a car keeps
   * gaining ever more slowly instead of hitting a wall.
   */
  private tractive(v: number): number {
    const { sp, mass } = this, power = mass * sp.acc * sp.top * 0.33;
    return Math.min(mass * sp.acc, power / Math.max(v, 0.1)) * 1.12;
  }

  /** Air and rolling drag (N) at `v`, applied when coasting too. */
  coast(dt: number): void {
    const { sp, mass } = this, b = this.v.body, l = b.linvel(), v = Math.hypot(l.x, l.z);
    if (v < 0.3) return;
    const drag = (mass * sp.acc * sp.top * 0.33) / sp.top ** 3, f = (drag * v * v + mass * 0.12) * dt / mass;
    const k = Math.max(0, 1 - f / v);
    b.setLinvel({ x: l.x * k, y: l.y, z: l.z * k }, true);
  }

  /** How far each wheel hangs below its resting place (m, + = lower; spring extended), mount by mount. */
  drops(): number[] {
    return this.mounts.map((_, i) => THREE.MathUtils.clamp((this.ctrl.wheelSuspensionLength(i) ?? REST) - (REST - this.sag), -0.18, 0.18));
  }

  /** Wheels touching the ground (0 = airborne or on its roof). */
  get grounded(): number {
    let n = 0;
    for (let i = 0; i < this.ctrl.numWheels(); i++) if (this.ctrl.wheelIsInContact(i)) n++;
    return n;
  }

  /** Ground contact of each wheel touching the ground (world space), with whether it is a rear wheel. */
  contacts(): { at: THREE.Vector3; rear: boolean; i: number }[] {
    const out: { at: THREE.Vector3; rear: boolean; i: number }[] = [];
    for (let i = 0; i < this.ctrl.numWheels(); i++) {
      const p = this.ctrl.wheelIsInContact(i) ? this.ctrl.wheelContactPoint(i) : null;
      if (p) out.push({ at: new THREE.Vector3(p.x, p.y, p.z), rear: this.rear.includes(i), i });
    }
    return out;
  }

  free(world: RAPIER.World): void {
    world.removeVehicleController(this.ctrl);
    this.v.body.setLinearDamping(0.05);
  }
}
