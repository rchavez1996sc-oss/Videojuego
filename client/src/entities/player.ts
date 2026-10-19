import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Input } from '../core/input';
import type { Lighting } from '../render/lighting';
import { Mannequin } from './mannequin';

const WALK = 3.2, RUN = 6.2, CROUCH = 1.7, AIM = 2.2, JUMP = 5.2, GRAVITY = 22;
const RADIUS = 0.35, HALF = 0.55;

export class Player {
  readonly model: Mannequin;
  readonly position = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  private vel = new THREE.Vector3();
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private ctrl: RAPIER.KinematicCharacterController;
  private grounded = false;
  private crouch = 0;

  constructor(world: RAPIER.World, lighting: Lighting, spawn: THREE.Vector3, yaw: number) {
    this.model = new Mannequin(lighting);
    this.yaw = yaw;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + HALF + RADIUS + 0.2, spawn.z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), this.body);
    this.ctrl = world.createCharacterController(0.05);
    this.ctrl.enableAutostep(0.45, 0.25, true);
    this.ctrl.enableSnapToGround(0.5);
    this.ctrl.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(48));
    this.ctrl.setSlideEnabled(true);
    this.syncPosition();
  }

  get collisionHandle(): number {
    return this.collider.handle;
  }

  update(dt: number, input: Input, camYaw: number, aiming: boolean, aimPitch: number): void {
    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const crouching = input.down('ControlLeft') || input.down('KeyC');
    this.crouch = THREE.MathUtils.damp(this.crouch, crouching ? 1 : 0, 12, dt);
    const sprint = input.down('ShiftLeft') && f > 0 && !aiming && !crouching;
    const target = aiming ? AIM : crouching ? CROUCH : sprint ? RUN : WALK;

    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(target);
    const accel = this.grounded ? 14 : 3;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, wish.x, accel, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, wish.z, accel, dt);
    if (this.grounded && input.hit('Space') && !crouching) this.vel.y = JUMP;
    this.vel.y -= GRAVITY * dt;

    this.ctrl.computeColliderMovement(this.collider, { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt });
    const m = this.ctrl.computedMovement();
    this.grounded = this.ctrl.computedGrounded();
    if (this.grounded && this.vel.y < 0) this.vel.y = -1;
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    const faceYaw = aiming || this.speed < 0.2 ? camYaw : Math.atan2(-this.vel.x, -this.vel.z);
    if (aiming || this.speed > 0.2) {
      const diff = Math.atan2(Math.sin(faceYaw - this.yaw), Math.cos(faceYaw - this.yaw));
      this.yaw += diff * Math.min(1, dt * (aiming ? 20 : 10));
    }
    this.model.animate(dt, this.speed, this.crouch, aiming ? aimPitch : 0);
  }

  syncPosition(): void {
    const p = this.body.translation();
    this.position.set(p.x, p.y - HALF - RADIUS, p.z);
    this.model.root.position.copy(this.position);
    this.model.root.rotation.y = this.yaw + Math.PI;
  }

  get crouchAmount(): number {
    return this.crouch;
  }
}
