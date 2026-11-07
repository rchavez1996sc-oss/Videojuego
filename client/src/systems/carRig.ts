import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Vehicle } from './traffic';
import { MASS, makeDynamic } from './vehicleBody';
import type { Spec, Controls } from './carPhysics';

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

  constructor(world: RAPIER.World, private v: Vehicle, private sp: Spec, skip: (c: RAPIER.Collider) => boolean) {
    makeDynamic(v, new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.speed));
    this.mass = MASS[v.kind] ?? 1300;
    const ctrl = (this.ctrl = world.createVehicleController(v.body));
    ctrl.indexUpAxis = 1;
    ctrl.setIndexForwardAxis = 2;
    const h = (v.collider.shape as RAPIER.Cuboid).halfExtents, r = v.kind === 'micro' ? 0.48 : sp.small ? 0.26 : 0.31;
    const zf = h.z - (v.kind === 'micro' ? 1.6 : sp.small ? 0.35 : 0.8), zr = -h.z + (v.kind === 'micro' ? 1.9 : sp.small ? 0.45 : 0.8), x = h.x - 0.12, y = r + REST;
    const add = (wx: number, wz: number, front: boolean) => {
      ctrl.addWheel({ x: wx, y, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, r);
      const i = ctrl.numWheels() - 1;
      (front ? this.front : this.rear).push(i);
      ctrl.setWheelSuspensionStiffness(i, 36);
      ctrl.setWheelSuspensionCompression(i, 3.2);
      ctrl.setWheelSuspensionRelaxation(i, 4.0);
      ctrl.setWheelMaxSuspensionTravel(i, TRAVEL);
      ctrl.setWheelMaxSuspensionForce(i, this.mass * 9.81 * 3);
      ctrl.setWheelFrictionSlip(i, sp.small ? 1.6 : 2.2);
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
    const { ctrl, sp, mass } = this, speed = this.speed, forward = speed > -0.5;
    this.steer = THREE.MathUtils.damp(this.steer, u.steer * 0.6 / (1 + Math.abs(speed) / 9), 6, dt);
    for (const i of this.front) ctrl.setWheelSteering(i, this.steer);
    const drive = this.rear.length ? this.rear : this.front, force = mass * sp.acc * 1.25 / drive.length;
    let engine = 0, brake = 0;
    if (u.throttle && speed < sp.top) engine = force * (speed < -0.5 ? 2 : 1);
    if (u.brake) speed > 0.5 ? (brake = mass * 9 * dt) : speed > -sp.top * 0.3 && (engine = -force * 0.6);
    if (!u.throttle && !u.brake) brake = mass * 0.6 * dt;
    void forward;
    for (const i of [...this.front, ...this.rear]) {
      ctrl.setWheelEngineForce(i, drive.includes(i) ? engine : 0);
      ctrl.setWheelBrake(i, (brake + (u.handbrake && this.rear.includes(i) ? mass * 6 * dt : 0)) / (this.front.length + this.rear.length) * 4);
      ctrl.setWheelFrictionSlip(i, u.handbrake && this.rear.includes(i) ? 0.9 : sp.small ? 1.6 : 2.2);
    }
    ctrl.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => c.handle !== this.v.collider.handle && !this.skip(c));
  }

  /** Wheels touching the ground (0 = airborne or on its roof). */
  get grounded(): number {
    let n = 0;
    for (let i = 0; i < this.ctrl.numWheels(); i++) if (this.ctrl.wheelIsInContact(i)) n++;
    return n;
  }

  free(world: RAPIER.World): void {
    world.removeVehicleController(this.ctrl);
  }
}
