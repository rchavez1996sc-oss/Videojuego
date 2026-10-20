import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Input } from '../core/input';
import type { Lighting } from '../render/lighting';
import { Mannequin } from './mannequin';
import { findLedge, mantlePath, type Ledge } from './mantle';
import { difficulty } from '../core/difficulty';
import { ladderAt, type Ladder } from '../world/ladders';

const WALK = 3.2, RUN = 6.2, CROUCH = 1.7, AIM = 2.2, JUMP = 6.0, GRAVITY = 22, SLIDE = 8.5;
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
  private slideT = 0;
  private slideDir = new THREE.Vector3();
  private exhausted = false;
  private lastVy = 0;
  stamina = 100;
  hp = 100;
  /** Regeneration ceiling: drops to 50 once health falls below half, restored by medkits. */
  regenCap = 100;
  private sinceHit = 99;
  sprinting = false;
  landImpact = 0;
  stepPhase = 0;
  onMantle: (vault: boolean) => void = () => {};
  private mantle: { ledge: Ledge; start: THREE.Vector3; t: number; dur: number } | null = null;
  private ladder: Ladder | null = null;

  constructor(private world: RAPIER.World, lighting: Lighting, spawn: THREE.Vector3, yaw: number) {
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

  get airborne(): boolean {
    return !this.grounded;
  }

  hurt(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.sinceHit = 0;
    if (this.hp < 50) this.regenCap = 50;
  }

  heal(): void {
    this.hp = 100;
    this.regenCap = 100;
  }

  /** Regenerates after the difficulty's delay without damage, up to `regenCap`. */
  regen(dt: number): void {
    this.sinceHit += dt;
    if (this.hp > 0 && this.sinceHit > difficulty.value.regenDelay && this.hp < this.regenCap) this.hp = Math.min(this.regenCap, this.hp + 9 * dt);
  }

  respawn(feet: THREE.Vector3, yaw: number): void {
    this.body.setTranslation({ x: feet.x, y: feet.y + HALF + RADIUS + 0.2, z: feet.z }, true);
    this.vel.set(0, 0, 0);
    this.hp = 100;
    this.regenCap = 100;
    this.stamina = 100;
    this.yaw = yaw;
    this.mantle = null;
    this.syncPosition();
  }

  get mantling(): boolean {
    return this.mantle !== null;
  }

  private updateMantle(dt: number): void {
    const m = this.mantle!;
    m.t = Math.min(1, m.t + dt / m.dur);
    const feet = mantlePath(m.start, m.ledge, m.t);
    this.body.setNextKinematicTranslation({ x: feet.x, y: feet.y + HALF + RADIUS, z: feet.z });
    this.crouch = THREE.MathUtils.damp(this.crouch, m.t < 0.7 ? 0.6 : 0, 10, dt);
    this.speed = 0;
    this.model.animate(dt, 2, this.crouch, 0);
    if (m.t >= 1) {
      this.mantle = null;
      this.vel.set(0, -1, 0);
      this.onMantle(m.ledge.vault);
    }
  }

  get climbing(): boolean {
    return this.ladder !== null;
  }

  /** On a ladder: W/S move up/down, Space lets go; reaching the top steps onto the roof. */
  private updateLadder(dt: number, input: Input): void {
    const l = this.ladder!;
    const dir = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    let y = this.position.y + dir * 2.4 * dt;
    let x = l.base.x + l.normal.x * 0.45, z = l.base.z + l.normal.z * 0.45;
    this.vel.set(0, 0, 0);
    this.speed = Math.abs(dir) * 1.2;
    this.stepPhase += dt * Math.abs(dir) * 1.6;
    if (y >= l.top + 0.05) {
      x = l.base.x - l.normal.x * 0.9;
      z = l.base.z - l.normal.z * 0.9;
      y = l.top + 0.08;
      this.ladder = null;
      this.onMantle(false);
    } else if (input.hit('Space') || (dir < 0 && y <= l.base.y)) {
      this.ladder = null;
      x += l.normal.x * 0.4;
      z += l.normal.z * 0.4;
      y = Math.max(y, l.base.y);
    }
    this.yaw = Math.atan2(l.normal.x, l.normal.z);
    this.body.setNextKinematicTranslation({ x, y: y + HALF + RADIUS, z });
    this.model.animate(dt, this.speed, 0, 0);
  }

  update(dt: number, input: Input, camYaw: number, aiming: boolean, aimPitch: number, firing: boolean): void {
    if (this.mantle) return this.updateMantle(dt);
    if (this.ladder) return this.updateLadder(dt, input);
    if (input.down('KeyW')) {
      const l = ladderAt(this.position);
      const facing = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      if (l && facing.dot(l.normal) < -0.3) {
        this.ladder = l;
        return this.updateLadder(dt, input);
      }
    }
    if (input.hit('Space')) {
      const moveYaw = this.speed > 0.5 ? Math.atan2(-this.vel.x, -this.vel.z) : camYaw;
      const ledge = findLedge(this.world, this.position, moveYaw, this.collider.handle);
      if (ledge && (this.grounded || ledge.height < 1.6)) {
        this.yaw = moveYaw;
        this.mantle = { ledge, start: this.position.clone(), t: 0, dur: ledge.vault ? 0.55 : 0.35 + ledge.height * 0.22 };
        this.onMantle(ledge.vault);
        return this.updateMantle(dt);
      }
    }
    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const crouchKey = input.down('ControlLeft') || input.down('KeyC');
    if (this.stamina > 25) this.exhausted = false;
    const canSprint = input.down('ShiftLeft') && f > 0 && !aiming && !firing && !this.exhausted;
    if (this.sprinting && this.grounded && (input.hit('ControlLeft') || input.hit('KeyC')) && this.slideT <= 0) {
      this.slideT = 0.75;
      this.slideDir.set(this.vel.x, 0, this.vel.z).normalize();
    }
    this.slideT -= dt;
    const sliding = this.slideT > 0;
    const crouching = crouchKey || sliding;
    this.sprinting = canSprint && !crouching && this.speed > 0.5;
    this.stamina = THREE.MathUtils.clamp(this.stamina + (this.sprinting ? -8.5 : 14) * dt, 0, 100);
    if (this.stamina <= 0) this.exhausted = true;
    this.crouch = THREE.MathUtils.damp(this.crouch, crouching ? 1 : 0, 12, dt);
    const target = aiming ? AIM : crouching ? CROUCH : canSprint ? RUN : WALK;

    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(target);
    if (sliding) wish.copy(this.slideDir).multiplyScalar(THREE.MathUtils.lerp(CROUCH, SLIDE, this.slideT / 0.75));
    const accel = sliding ? 30 : this.grounded ? (wish.lengthSq() > 0 ? 10 : 14) : 2.5;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, wish.x, accel, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, wish.z, accel, dt);
    if (this.grounded && input.hit('Space') && !crouching && this.stamina > 8) {
      this.vel.y = JUMP;
      this.stamina -= 8;
    }
    this.vel.y -= GRAVITY * dt;

    this.ctrl.computeColliderMovement(this.collider, { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt });
    const m = this.ctrl.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.ctrl.computedGrounded();
    if (this.grounded && !wasGrounded && this.lastVy < -4) this.landImpact = Math.min(1, (-this.lastVy - 4) / 8 + 0.25);
    this.landImpact = Math.max(0, this.landImpact - dt * 2.5);
    this.lastVy = this.vel.y;
    if (this.grounded && this.vel.y < 0) this.vel.y = -1;
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded) this.stepPhase += (dt * this.speed) / (0.7 + this.speed * 0.22);
    const facing = aiming || firing;
    const faceYaw = facing || this.speed < 0.2 ? camYaw : Math.atan2(-this.vel.x, -this.vel.z);
    if (facing || this.speed > 0.2) {
      const diff = Math.atan2(Math.sin(faceYaw - this.yaw), Math.cos(faceYaw - this.yaw));
      this.yaw += diff * Math.min(1, dt * (facing ? 22 : 10));
    }
    this.model.animate(dt, this.speed, this.crouch, facing ? aimPitch : 0);
  }

  syncPosition(): void {
    const p = this.body.translation();
    this.position.set(p.x, p.y - HALF - RADIUS, p.z);
    this.model.root.position.copy(this.position);
    this.model.root.position.y -= 0.03 + Math.min(this.speed / 6, 1) * 0.03;
    this.model.root.rotation.y = this.yaw + Math.PI;
  }

  get crouchAmount(): number {
    return this.crouch;
  }
}
