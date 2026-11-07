import * as THREE from 'three';
import type { Combat } from '../weapons/combat';
import type { Input } from '../core/input';
import type { Driving } from './driving';
import { seatsOf } from '../entities/occupants';
import { SPECS } from './carPhysics';

/**
 * Shooting from the wheel, pistol only (a long gun does not come out of a car window): while seated the pistol is in
 * hand (the weapon held before comes back on getting out), rounds leave from the driver's window towards the aim,
 * the vehicle's own body never stops them. No pistol in this chapter → no shooting from the car.
 */
export class CarGun {
  private before = -1;
  private muzzle = new THREE.Object3D();

  constructor(private combat: Combat, scene: THREE.Object3D, private camera: THREE.Camera) {
    scene.add(this.muzzle);
  }

  /** Returns whether the combat update ran (so the on-foot one must not). */
  update(dt: number, input: Input, driving: Driving): boolean {
    const v = driving.seated, c = this.combat, i = c.pistol;
    if (!v || i < 0) {
      if (this.before >= 0) c.select(this.before);
      [this.before, c.from] = [-1, null];
      return false;
    }
    if (this.before < 0) [this.before] = [c.slot, c.select(i)];
    const seat = seatsOf(v.group, v.kind)[0] ?? [0.4, 0.6, 0.3], side = Math.sign(seat[0] || 1), half = SPECS[v.kind]?.half ?? 0.9;
    const open = v.kind === 'moto' || v.kind === 'delivery';
    this.muzzle.position.copy(v.group.localToWorld(new THREE.Vector3(side * (open ? 0.35 : half + 0.12), seat[1] + 0.5, seat[2] + 0.25)));
    const aim = new THREE.Vector3(0, 0, -60).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    this.muzzle.lookAt(aim);
    this.muzzle.updateMatrixWorld();
    c.from = { muzzle: this.muzzle, skip: v.collider.handle };
    c.update(dt, input, input.aiming, false);
    return true;
  }
}
