import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { pickDeath } from './deathFall';
import { CLIMBS, findLedge, mantlePath, type Ledge } from './mantle';
import type { Palette } from './mannequin';
import { Rig, type Outfit } from './rig';
import type { CharKind } from '../render/characters';
import { MuzzleFlash } from '../fx/muzzleFlash';
import type { Lighting } from '../render/lighting';
import type { CoverPoint } from '../ai/cover';

export interface EnemyDef {
  hp: number; damage: number; rpm: number; burst: [number, number]; burstPause: [number, number];
  spread: number; spreadPerMeter: number; reaction: number; sight: number; fov: number; hearing: number;
  walk: number; run: number; preferredRange: number; palette: Palette; rig?: CharKind;
}

export type EnemyState = 'patrol' | 'alert' | 'combat' | 'dead';

const HALF = 0.55, RADIUS = 0.35, GRAVITY = 22;

export class Enemy {
  readonly model: Rig;
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
  /** Street corners to walk through before heading for `moveTarget`. */
  path: THREE.Vector3[] = [];
  running = false;
  crouched = false;
  burstLeft = 0;
  fireCooldown = 0;
  pauseT = 0;
  thinkT = Math.random() * 0.2;
  stateT = 0;
  patrolIndex = 0;
  /** Seconds spent holding the current cover; triggers a peek or a push forward. */
  coverT = 0;
  /** Side step out of cover to shoot from, then back; null when not peeking. */
  peek: THREE.Vector3 | null = null;
  peekT = 0;
  shownT = 0;
  shadowed = true;
  private vel = new THREE.Vector3();
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private ctrl: RAPIER.KinematicCharacterController;
  private crouchK = 0;
  private stuckT = 0;
  private frozen = 0;
  private hop: { ledge: Ledge; start: THREE.Vector3; t: number; dur: number } | null = null;
  private detour: THREE.Vector3 | null = null;
  private progT = 0;
  private progD = Infinity;
  private progGoal: THREE.Vector3 | null = null;
  private lastPos = new THREE.Vector3();
  private fallDir = new THREE.Vector3();
  private colliderCrouched = false;

  constructor(readonly id: number, readonly def: EnemyDef, private world: RAPIER.World, lighting: Lighting, spawn: THREE.Vector3, readonly patrol: THREE.Vector3[], readonly isStatic: boolean, outfit?: Outfit) {
    this.hp = def.hp;
    this.model = new Rig(def.rig ?? 'pnp', lighting, true, false, outfit);
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
    if (this.hop) return this.updateHop(dt, aimPitch);
    const target = this.detour ?? this.path[0] ?? this.moveTarget;
    const wish = new THREE.Vector3();
    if (target && !this.isStatic) {
      wish.set(target.x - this.position.x, 0, target.z - this.position.z);
      const d = wish.length();
      if (d < 0.4) {
        if (this.detour) this.detour = null;
        else if (this.path.length) this.path.shift();
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

    this.unstick(dt);
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      if (wish.lengthSq() > 0.5 && this.position.distanceTo(this.lastPos) < 0.3) {
        const ledge = findLedge(this.world, this.position, Math.atan2(-wish.x, -wish.z), this.collider.handle, 1.9);
        if (ledge) {
          this.hop = { ledge, start: this.position.clone(), t: 0, dur: ledge.vault ? 0.7 : 0.7 + ledge.height * 0.3 };
          this.yaw = Math.atan2(-wish.x, -wish.z);
          this.stuckT = 0;
          return;
        }
        if (++this.frozen > 5) {
          this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + 0.6, z: p.z + m.z });
          this.frozen = 0;
        }
        const side = new THREE.Vector3(-wish.z, 0, wish.x).normalize().multiplyScalar((Math.random() < 0.5 ? -1 : 1) * 4);
        this.detour = this.position.clone().add(side).addScaledVector(wish.normalize(), -1);
      } else this.frozen = 0;
      this.lastPos.copy(this.position);
      this.stuckT = 0;
    }
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.model.aiming = this.state === 'combat';
    this.model.animate(dt, speed, this.crouchK, aimPitch);
  }

  /** Vaulting or climbing over a fence, railing or low wall in the way, with the player's clips. */
  private updateHop(dt: number, aimPitch: number): void {
    const h = this.hop!, c = h.ledge.vault || h.ledge.height < 1.6 ? CLIMBS.vault : CLIMBS.low;
    h.t = Math.min(1, h.t + dt / h.dur);
    const feet = mantlePath(h.start, h.ledge, h.t, c.lift);
    this.body.setNextKinematicTranslation({ x: feet.x, y: feet.y + HALF + RADIUS, z: feet.z });
    this.model.hold(c.key, (this.model.durationOf(c.key) * c.span) / h.dur, true, c.from);
    this.model.animate(dt, 0, 0, aimPitch);
    if (h.t < 1) return;
    this.model.release();
    this.hop = null;
    this.vel.set(0, -1, 0);
    this.lastPos.copy(feet);
  }

  /** Drops the current waypoint when a few seconds of walking haven't brought it any closer. */
  private unstick(dt: number): void {
    const goal = this.path[0] ?? this.moveTarget;
    if (!goal || this.isStatic) return;
    if (goal !== this.progGoal) {
      this.progGoal = goal;
      this.progD = Infinity;
      this.progT = 0;
    }
    this.progT += dt;
    if (this.progT < 3) return;
    const d = Math.hypot(goal.x - this.position.x, goal.z - this.position.z);
    if (d > this.progD - 1.5) {
      this.detour = null;
      if (this.path.length) this.path.shift();
      else this.moveTarget = null;
      this.progD = Infinity;
    } else this.progD = d;
    this.progT = 0;
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

  teleport(p: THREE.Vector3): void {
    this.body.setTranslation({ x: p.x, y: p.y + HALF + RADIUS + 0.05, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + HALF + RADIUS + 0.05, z: p.z });
    this.position.copy(p);
    this.moveTarget = null;
    this.path = [];
    this.vel.set(0, 0, 0);
  }

  /** Back on their feet after being downed (allies only). */
  revive(hp: number): void {
    this.state = 'patrol';
    this.hp = hp;
    this.collider.setEnabled(true);
    this.model.revive();
    this.moveTarget = null;
    this.path = [];
  }

  damage(amount: number, at?: THREE.Vector3): boolean {
    if (!this.alive) return false;
    if (at) this.model.wound(at);
    this.hp -= amount;
    this.shownT = 3;
    if (this.hp > 0) this.model.gesture('hit');
    return this.hp <= 0;
  }

  die(dir: THREE.Vector3): void {
    this.state = 'dead';
    if (this.cover) this.cover.owner = -1;
    this.collider.setEnabled(false);
    const flat = dir.clone().setY(0);
    this.fallDir = flat.lengthSq() > 0.01 ? flat.normalize() : new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const fromFront = this.fallDir.dot(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))) < 0;
    const wish = this.crouched ? ['death_crouch'] : fromFront ? (Math.random() < 0.4 ? ['death_head', 'death_front', 'fall_back'] : ['fall_back', 'death_front', 'death_head']) : Math.random() < 0.5 ? ['death_back', 'dying'] : ['dying', 'death_back'];
    const fall = pickDeath(this.world, this.position, this.yaw, wish, this.collider.handle);
    this.position.add(fall.shift);
    this.model.die(fall.key);
  }

  /** The death clip plays out where the body stood. */
  private syncCorpse(dt: number): void {
    this.model.root.position.copy(this.position).setY(this.position.y - 0.03);
    this.model.animate(dt, 0, 0, 0);
  }
}
