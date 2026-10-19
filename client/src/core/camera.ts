import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Input } from './input';

const SENS = 0.0022;

export class ThirdPersonCamera {
  yaw: number;
  pitch = -0.12;
  private shoulder = 1;
  private shoulderX = 0.55;
  private dist = 3.4;
  private aimT = 0;
  private pivot = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera, private world: RAPIER.World, yaw: number) {
    this.yaw = yaw;
  }

  update(dt: number, input: Input, target: THREE.Vector3, crouch: number, excludeCollider: number): void {
    this.yaw -= input.mouseDX * SENS * (input.aiming ? 0.55 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * SENS * (input.aiming ? 0.55 : 1), -1.2, 0.9);
    if (input.hit('KeyQ')) this.shoulder *= -1;
    this.aimT = THREE.MathUtils.damp(this.aimT, input.aiming ? 1 : 0, 14, dt);
    this.shoulderX = THREE.MathUtils.damp(this.shoulderX, this.shoulder * THREE.MathUtils.lerp(0.55, 0.7, this.aimT), 10, dt);
    const wantDist = THREE.MathUtils.lerp(3.4, 1.5, this.aimT);
    this.camera.fov = THREE.MathUtils.lerp(68, 50, this.aimT);
    this.camera.updateProjectionMatrix();

    this.pivot.copy(target).add(new THREE.Vector3(0, 1.62 - crouch * 0.45, 0));
    const rot = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    const back = new THREE.Vector3(0, 0, 1).applyEuler(rot);
    const side = new THREE.Vector3(1, 0, 0).applyEuler(rot);
    const origin = this.pivot.clone().addScaledVector(side, this.shoulderX);
    const ray = new RAPIER.Ray(origin, back);
    const hit = this.world.castRay(ray, wantDist + 0.3, true, undefined, undefined, undefined, undefined, (c) => c.handle !== excludeCollider);
    const allowed = hit ? Math.max(0.4, hit.timeOfImpact - 0.3) : wantDist;
    this.dist = allowed < this.dist ? allowed : THREE.MathUtils.damp(this.dist, allowed, 6, dt);
    this.camera.position.copy(origin).addScaledVector(back, this.dist);
    this.camera.quaternion.setFromEuler(rot);
  }

  /** Free placement for screenshots/cinematics. */
  place(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
  }
}
