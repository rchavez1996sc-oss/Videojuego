import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Input } from './input';

const SENS = 0.0022;

export class ThirdPersonCamera {
  yaw: number;
  pitch = -0.12;
  private shoulder = 1;
  private shoulderX = 0.8;
  private dist = 3.4;
  private aimT = 0;
  private pivot = new THREE.Vector3();
  private recoilP = 0;
  private recoilY = 0;
  private shake = 0;
  bob = 0;
  sway = 0;
  dip = 0;
  fovBoost = 0;

  constructor(readonly camera: THREE.PerspectiveCamera, private world: RAPIER.World, yaw: number) {
    this.yaw = yaw;
  }

  update(dt: number, input: Input, target: THREE.Vector3, crouch: number, excludeCollider: number): void {
    this.yaw -= input.mouseDX * SENS * (input.aiming ? 0.55 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * SENS * (input.aiming ? 0.55 : 1), -1.2, 0.9);
    if (input.hit('KeyQ')) this.shoulder *= -1;
    this.aimT = THREE.MathUtils.damp(this.aimT, input.aiming ? 1 : 0, 14, dt);
    this.shoulderX = THREE.MathUtils.damp(this.shoulderX, this.shoulder * THREE.MathUtils.lerp(0.8, 0.62, this.aimT), 10, dt);
    const wantDist = THREE.MathUtils.lerp(3.3, 1.6, this.aimT);
    this.camera.fov = THREE.MathUtils.lerp(68, 50, this.aimT) + this.fovBoost;
    this.camera.updateProjectionMatrix();

    this.pivot.copy(target).add(new THREE.Vector3(0, 1.78 - crouch * 0.5 + this.bob - this.dip, 0));
    const rot = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    const back = new THREE.Vector3(0, 0, 1).applyEuler(rot);
    const side = new THREE.Vector3(1, 0, 0).applyEuler(rot);
    const origin = this.pivot.clone().addScaledVector(side, this.shoulderX + this.sway);
    const ray = new RAPIER.Ray(origin, back);
    const hit = this.world.castRay(ray, wantDist + 0.3, true, undefined, undefined, undefined, undefined, (c) => c.handle !== excludeCollider);
    const allowed = hit ? Math.max(0.4, hit.timeOfImpact - 0.3) : wantDist;
    this.dist = allowed < this.dist ? allowed : THREE.MathUtils.damp(this.dist, allowed, 6, dt);
    this.camera.position.copy(origin).addScaledVector(back, this.dist);
    this.camera.quaternion.setFromEuler(rot);
    if (this.shake > 0.001) {
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0).applyQuaternion(this.camera.quaternion));
      this.shake *= Math.exp(-dt * 18);
    }
  }

  kick(up: number, side: number, shake: number): void {
    this.pitch = Math.min(0.9, this.pitch + up);
    this.yaw += side;
    this.recoilP += up;
    this.recoilY += side;
    this.shake += shake;
  }

  /** Returns part of the accumulated recoil to the crosshair while not firing. */
  recover(dt: number, fraction: number): void {
    const k = Math.min(1, dt * 7);
    const dp = this.recoilP * k, dy = this.recoilY * k;
    this.pitch -= dp * fraction;
    this.yaw -= dy * fraction;
    this.recoilP -= dp;
    this.recoilY -= dy;
  }

  /** Free placement for screenshots/cinematics. */
  place(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
  }
}
