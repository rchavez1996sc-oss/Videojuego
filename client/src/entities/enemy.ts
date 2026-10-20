import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Mannequin, type Palette } from './mannequin';
import { MuzzleFlash } from '../fx/muzzleFlash';
import type { Lighting } from '../render/lighting';
import type { CoverPoint } from '../ai/cover';

export interface EnemyDef {
  hp: number; damage: number; rpm: number; burst: [number, number]; burstPause: [number, number];
  spread: number; spreadPerMeter: number; reaction: number; sight: number; fov: number; hearing: number;
  walk: number; run: number; preferredRange: number; palette: Palette;
}

export type EnemyState = 'patrol' | 'alert' | 'combat' | 'dead';

const HALF = 0.55, RADIUS = 0.35, GRAVITY = 22;

export class Enemy {
  readonly model: Mannequin;
  readonly flash = new MuzzleFlash();
  readonly position = new THREE.Vector3();
  hp: number;
  state: EnemyState = 'patrol';
  yaw = 0;
  awareness = 0;
  /** Has been in combat with the player at least once: hunts instead of going back to patrol. */
  engaged = false;
  lastKnown = new THREE.Vector3();
  lastSeenT = -99;
  canSee = false;
  cover: CoverPoint | null = null;
  moveTarget: THREE.Vector3 | null = null;
  running = false;
  crouched = false;
  burstLeft = 0;
  fireCooldown = 0;
  pauseT = 0;
  thinkT = Math.random() * 0.2;
  stateT = 0;
  patrolIndex = 0;
  shownT = 0;
  shadowed = true;
  private vel = new THREE.Vector3();
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private ctrl: RAPIER.KinematicCharacterController;
  private crouchK = 0;
  private stuckT = 0;
  private detour: THREE.Vector3 | null = null;
  private lastPos = new THREE.Vector3();
  private fallDir = new THREE.Vector3();
  private fallT = 0;
  private fallSide = 0;
  private colliderCrouched = false;

  constructor(readonly id: number, readonly def: EnemyDef, world: RAPIER.World, lighting: Lighting, spawn: THREE.Vector3, readonly patrol: THREE.Vector3[], readonly isStatic: boolean) {
    this.hp = def.hp;
    this.model = new Mannequin(lighting, def.palette);
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + HALF + RADIUS + 0.05, spawn.z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), this.body);
    this.ctrl = world.createCharacterController(0.05);
    this.ctrl.enableAutostep(0.45, 0.25, true);
    this.ctrl.enableSnapToGround(0.5);
    this.ctrl.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    this.ctrl.setSlideEnabled(true);
    this.yaw = Math.random() * Math.PI * 2;
    this.sync();
    this.lastPos.copy(this.position);
  }

  get handle(): number {
    return this.collider.handle;
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  /** Eye height above feet, lower when crouched. */
  get eyeY(): number {
    return 1.62 - this.crouchK * 0.55;
  }

  get headY(): number {
    return 1.5 - this.crouchK * 0.55;
  }

  update(dt: number, aimPitch: number): void {
    if (this.state === 'dead') return this.syncCorpse(dt);
    this.crouchK = THREE.MathUtils.damp(this.crouchK, this.crouched ? 1 : 0, 8, dt);
    if (this.crouched !== this.colliderCrouched) {
      this.colliderCrouched = this.crouched;
      this.collider.setHalfHeight(this.crouched ? HALF - 0.28 : HALF);
      this.collider.setTranslationWrtParent({ x: 0, y: this.crouched ? -0.28 : 0, z: 0 });
    }
    const target = this.detour ?? this.moveTarget;
    const wish = new THREE.Vector3();
    if (target && !this.isStatic) {
      wish.set(target.x - this.position.x, 0, target.z - this.position.z);
      const d = wish.length();
      if (d < 0.4) {
        if (this.detour) this.detour = null;
        else this.moveTarget = null;
        wish.set(0, 0, 0);
      } else {
        wish.multiplyScalar((this.running ? this.def.run : this.def.walk) * (this.crouched ? 0.5 : 1) / d);
      }
    }
    this.vel.x = THREE.MathUtils.damp(this.vel.x, wish.x, 8, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, wish.z, 8, dt);
    this.vel.y -= GRAVITY * dt;
    this.ctrl.computeColliderMovement(this.collider, { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt });
    const m = this.ctrl.computedMovement();
    if (this.ctrl.computedGrounded() && this.vel.y < 0) this.vel.y = -1;
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });

    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      if (wish.lengthSq() > 0.5 && this.position.distanceTo(this.lastPos) < 0.3) {
        const side = new THREE.Vector3(-wish.z, 0, wish.x).normalize().multiplyScalar((Math.random() < 0.5 ? -1 : 1) * 4);
        this.detour = this.position.clone().add(side).addScaledVector(wish.normalize(), -1);
      }
      this.lastPos.copy(this.position);
      this.stuckT = 0;
    }
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.model.animate(dt, speed, this.crouchK, aimPitch);
  }

  faceTowards(p: THREE.Vector3, dt: number, rate = 8): void {
    const want = Math.atan2(-(p.x - this.position.x), -(p.z - this.position.z));
    const diff = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    this.yaw += diff * Math.min(1, dt * rate);
  }

  faceVelocity(dt: number): void {
    if (Math.hypot(this.vel.x, this.vel.z) > 0.3) this.faceTowards(this.position.clone().add(this.vel), dt, 6);
  }

  sync(): void {
    if (this.state === 'dead') return;
    const p = this.body.translation();
    this.position.set(p.x, p.y - HALF - RADIUS, p.z);
    this.model.root.position.copy(this.position);
    this.model.root.position.y -= 0.03;
    this.model.root.rotation.set(0, this.yaw + Math.PI, 0);
  }

  damage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    this.shownT = 3;
    return this.hp <= 0;
  }

  die(dir: THREE.Vector3): void {
    this.state = 'dead';
    if (this.cover) this.cover.owner = -1;
    this.collider.setEnabled(false);
    const flat = dir.clone().setY(0);
    this.fallDir = flat.lengthSq() > 0.01 ? flat.normalize() : new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.fallT = 0;
    this.fallSide = (Math.random() - 0.5) * 0.6;
  }

  /** Falls toward the hit direction around the feet, then lies on the ground. */
  private syncCorpse(dt: number): void {
    this.fallT = Math.min(1, this.fallT + dt / 0.75);
    const k = this.fallT * this.fallT;
    const axis = new THREE.Vector3(0, 1, 0).cross(this.fallDir).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, k * Math.PI * 0.49).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw + Math.PI + this.fallSide, 0)));
    this.model.root.quaternion.copy(q);
    this.model.root.position.copy(this.position).addScaledVector(this.fallDir, k * 0.35).setY(this.position.y + k * 0.18);
    this.model.animate(dt, 0, 0, 0);
  }
}
