import * as THREE from 'three';
import { crashDamage, enginePower, steerPull } from './vehicleWear';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Traffic, Vehicle } from './traffic';
import type { Player } from '../entities/player';
import type { ThirdPersonCamera } from '../core/camera';
import type { Input } from '../core/input';
import type { Enemies } from './enemies';
import type { Squad } from './squad';
import type { Sfx } from '../audio/sfx';
import type { Lighting } from '../render/lighting';
import type { Mixer } from '../audio/mixer';
import { EngineSound } from '../audio/engine';
import { SPECS, type CarState } from './carPhysics';
import { CarRig } from './carRig';
import { contactOf, jolt, overturned, readBody } from './vehicleBody';
import { dent } from '../fx/dents';
import { seatedRig, seatsOf } from '../entities/occupants';
import { roomy } from './respawn';
import { parkedCars } from '../world/parkedCars';
import { SeatAnim } from './carEntry';
import { Fling } from '../entities/fling';
import { busCabin } from './busCabin';
import { doorDuring, doorPulse, setDoor } from './carDoors';
import { suspendWheels } from './wheelSpin';
import { bumpOverBodies } from './bodyBump';
import { rideBike } from '../entities/bikePose';
import { SkidMarks, trackWheels } from '../fx/skidMarks';
import { stripAt } from '../world/groundStrips';
import { CarEscape, drivenCar, safeExit } from './carEscape';
import { joinPhysics } from './carContacts';
import { safely } from '../core/guard';
import type { Heightfield } from '../world/heightfield';
import type { Rig } from '../entities/rig';

interface Deps { hf: Heightfield; traffic: Traffic | null; world: RAPIER.World; player: Player; tpc: ThirdPersonCamera; enemies: Enemies; squad: Squad | null; sfx: Sfx; lighting: Lighting; mixer: Mixer }

const REACH = 2.2;

/**
 * Getting into traffic vehicles and driving them (E in/out): the player takes the driver's seat (the occupants get
 * out), drives with W/S/A/D and Space (handbrake), the chase camera swings in behind, people in the way are run
 * over, walls are hit (damage to car and driver), bullets hit the car; when it is wrecked the player is thrown out.
 */
export class Driving {
  private car: Vehicle | null = null;
  private state: CarState | null = null;
  private seat: THREE.Group | null = null;
  private engine: EngineSound;
  private prompt = document.createElement('div');
  private speedo = document.createElement('div');
  private bodyOff = 0;
  private idleMouse = 0;
  /** Inside of a bus around the camera while driving it. */
  private cabin: THREE.Group | null = null;
  /** A door opening and shutting by itself (getting in or out without the clip). */
  private swing: { g: THREE.Object3D; side: number; t: number } | null = null;
  private hitT = new Map<string, number>();
  private clock = 0;
  private anim: SeatAnim | null = null;
  private rig: CarRig | null = null;
  private after: (() => void) | null = null;

  private marks: SkidMarks;
  private escape = new CarEscape();

  constructor(private d: Deps) {
    this.engine = new EngineSound(d.mixer);
    this.marks = new SkidMarks(d.lighting);
    Fling.onSlam = (at, speed) => {
      const near = at.distanceTo(d.tpc.camera.position);
      d.sfx.thud(Math.min(1, speed / 10) / (1 + near / 15));
      if (near < 25) d.tpc.kick(0, 0, Math.min(0.25, speed * 0.015) / (1 + near / 8));
    };
    this.prompt.className = 'prompt';
    this.prompt.style.opacity = '0';
    this.speedo.className = 'speedo';
    this.speedo.style.cssText = 'position:fixed;right:28px;bottom:28px;font:800 34px "Barlow Condensed",sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 6px #000;opacity:0;pointer-events:none;letter-spacing:1px';
    document.body.append(this.prompt, this.speedo);
    if (d.traffic) d.traffic.onDrivenHit = (v, dmg, bullet) => v === this.car && (bullet ? Math.random() < 0.35 && d.player.hurt(dmg * 1.6) : d.player.hurt(dmg * 0.25));
  }

  get active(): boolean {
    return !!this.car;
  }

  /** The vehicle while the player sits at its wheel (not getting in or out). */
  get seated(): Vehicle | null {
    return this.anim ? null : this.car;
  }

  /** Runs instead of the on-foot update while driving; returns whether the player is driving. */
  update(dt: number, input: Input, alive: boolean): boolean {
    const { traffic, player } = this.d;
    this.clock += dt;
    if (this.swing && !doorPulse(this.swing.g, this.swing.side, (this.swing.t += dt))) this.swing = null;
    if (!traffic) return false;
    if (this.anim) {
      player.puppet = true;
      if (this.car) setDoor(this.car.group, this.doorSide(this.car), doorDuring(this.anim.out, this.anim.progress));
      if (alive && this.anim.update(dt)) return true;
      const then = this.after!;
      [this.anim, this.after, player.puppet] = [null, null, false];
      player.model.post = null;
      player.model.release(0.25);
      then();
      return !!this.car;
    }
    if (!this.car) {
      const ok = alive && !player.mantling, near = ok ? traffic.enterable(player.position, REACH) : null, spot = ok && !near ? parkedCars.nearest(player.position, REACH)?.spot : null;
      this.prompt.style.opacity = near || spot ? '1' : '0';
      if (near || spot) this.prompt.innerHTML = `<kbd>E</kbd> ${spot || near!.state === 'parked' ? 'SUBIR' : 'TOMAR EL VEHÍCULO'}`;
      if ((near || spot) && input.hit('KeyE')) {
        if (spot) parkedCars.take(spot, player.position);
        this.enter(near ?? traffic.adopt(spot!));
      }
      return !!this.car;
    }
    this.prompt.style.opacity = '0';
    if (this.car.burst && this.car.state === 'player') [player.hurt(999), this.car.state = 'wreck'];
    const how = this.car.state === 'wreck' ? 'bail' : this.escape.check(this.car, this.state!.speed, input.hit('KeyE'), input.down('KeyE'), dt, (x, z) => this.d.hf.heightAt(x, z));
    if (!alive || how !== 'stay') {
      if (how === 'bail' && alive) player.hurt(this.car.state === 'wreck' ? 20 : Math.min(40, Math.max(0, Math.abs(this.state!.speed) - 6) * 3));
      if (!safely('exit', () => (this.exit(alive, how === 'bail'), true), false)) this.forceOut();
      return !!this.anim;
    }
    if (!safely('drive', () => (this.drive(dt, input), true), false)) this.forceOut();
    return true;
  }

  private enter(v: Vehicle): void {
    const { traffic, player, world, tpc } = this.d, sp = SPECS[v.kind] ?? SPECS.sedan;
    traffic!.seize(v);
    [this.car, drivenCar.handle] = [v, v.collider.handle];
    this.state = { x: v.x, y: v.y ?? player.position.y, z: v.z, yaw: v.yaw, vel: new THREE.Vector3(), vy: 0, steer: 0, speed: 0, len: v.len, tilt: new THREE.Quaternion() };
    const col = world.getCollider(player.collisionHandle);
    this.bodyOff = col.parent()!.translation().y - player.position.y;
    col.setEnabled(false);
    tpc.vehicle = 4.5 + v.len * 0.6;
    tpc.lift = sp.height * 0.35;
    if (v.kind === 'micro') {
      this.cabin = busCabin(v.group, this.d.lighting);
      v.group.add(this.cabin);
      [tpc.vehicle, tpc.lift] = [0.15, this.cabin.userData.eye - 1.78];
    }
    const at = seatsOf(v.group, v.kind)[0];
    if (at && SeatAnim.possible() && v.kind !== 'moto' && v.kind !== 'delivery') {
      v.group.updateMatrixWorld(true);
      this.anim = new SeatAnim(player.model, false, v.group.localToWorld(new THREE.Vector3(...at)), v.yaw, player.position.y).begin(v.group);
      this.after = () => this.seatIn(v);
    } else {
      this.seatIn(v);
      this.swing = { g: v.group, side: this.doorSide(v), t: 0 };
    }
  }

  /** Side (sign of x) of the driver's door: the side of the driver's seat. */
  private doorSide(v: Vehicle): number {
    return Math.sign(seatsOf(v.group, v.kind)[0]?.[0] || 1);
  }

  /** The player's body hidden, the seated driver (playing the driving clip) shown in the seat. */
  private seatIn(v: Vehicle): void {
    const { lighting, player } = this.d;
    player.model.root.visible = false;
    const at = seatsOf(v.group, v.kind)[0];
    this.seat = at ? seatedRig(lighting, Math.random, v.kind !== 'moto' && v.kind !== 'delivery', 'fls', true) : null;
    if (this.seat && at) {
      if (v.kind === 'delivery') rideBike(this.seat, at[1]);
      this.seat.position.set(at[0], at[1], at[2]);
      v.group.add(this.seat);
    }
    this.speedo.style.opacity = '1';
  }

  /** Last resort if getting out threw half way: player on the ground beside the car, every driving state cleared. */
  private forceOut(): void {
    const { player, world } = this.d, v = this.car!;
    world.getCollider(player.collisionHandle).setEnabled(true);
    [this.anim, this.after, player.puppet, this.rig] = [null, null, false, null];
    player.respawn(safeExit(v, player.position, (x, z) => this.d.hf.heightAt(x, z)).add(new THREE.Vector3(Math.cos(v.yaw) * 2, 0, -Math.sin(v.yaw) * 2)), v.yaw);
    player.model.root.visible = true;
    if (v.state === 'player') v.state = 'parked';
    this.engine.set(false, 0, 0, 0, false);
    this.speedo.style.opacity = '0';
    this.clear();
  }

  private clear(): void {
    this.d.tpc.vehicle = this.d.tpc.lift = 0;
    this.cabin?.removeFromParent();
    [this.car, this.state, this.seat, this.cabin, drivenCar.handle] = [null, null, null, null, -1];
    this.escape.reset();
  }

  private exit(alive = true, bail = false): void {
    const { traffic, player, world } = this.d, v = this.car!, s = this.state!, sp = SPECS[v.kind] ?? SPECS.sedan;
    const fwd = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)), left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const side = Math.sign(seatsOf(v.group, v.kind)[0][0] || 1), base = new THREE.Vector3(s.x, s.y, s.z);
    const spots = [left.clone().multiplyScalar(side * (sp.half + 0.8)), left.clone().multiplyScalar(-side * (sp.half + 0.8)), fwd.clone().multiplyScalar(-(v.len / 2 + 1.1)), fwd.clone().multiplyScalar(v.len / 2 + 1.1)].map((o) => base.clone().add(o));
    const col = world.getCollider(player.collisionHandle);
    col.setEnabled(true);
    const at = seatsOf(v.group, v.kind)[0], calm = alive && !bail && v.state !== 'wreck' && !overturned(v) && at && SeatAnim.possible() && v.kind !== 'moto' && v.kind !== 'delivery';
    v.group.updateMatrixWorld(true);
    const anim = calm ? new SeatAnim(player.model, true, v.group.localToWorld(new THREE.Vector3(...at!)), s.yaw, s.y) : null;
    const walk = anim && roomy(world, anim.end.pos, player.collisionHandle);
    const pos = walk ? anim.end.pos : spots.find((p) => roomy(world, p, player.collisionHandle)) ?? (Number.isFinite(s.y) && s.y > this.d.hf.heightAt(s.x, s.z) - 1 ? base.clone().setY(s.y + sp.height + 0.3) : safeExit(v, player.position, (x, z) => this.d.hf.heightAt(x, z)));
    const keep = { hp: player.hp, regenCap: player.regenCap, stamina: player.stamina };
    player.respawn(pos, walk ? anim.end.yaw + Math.PI : s.yaw + Math.PI);
    Object.assign(player, keep);
    player.model.root.visible = true;
    if (this.seat) v.group.remove(this.seat);
    traffic!.park(v);
    if (this.rig) suspendWheels(v.group, this.rig.mounts, this.rig.mounts.map(() => 0));
    try {
      this.rig?.free(world);
    } catch (e) {
      console.error(e);
    }
    this.rig = null;
    this.escape.reset();
    this.engine.set(false, 0, 0, 0, false);
    this.speedo.style.opacity = '0';
    this.swing = walk ? this.swing : { g: v.group, side: this.doorSide(v), t: 0 };
    if (!walk) return this.clear();
    [this.anim, this.after] = [anim.begin(v.group), () => this.clear()];
  }

  private drive(dt: number, input: Input): void {
    const { world, player, tpc, sfx } = this.d, v = this.car!, s = this.state!, sp = SPECS[v.kind] ?? SPECS.sedan;
    this.rig ??= new CarRig(world, v, sp, (c) => c.shapeType() === RAPIER.ShapeType.Capsule || c.isSensor());
    const u = { throttle: input.down('KeyW') ? 1 : 0, brake: input.down('KeyS') ? 1 : 0, steer: (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0), handbrake: input.down('Space') };
    [u.throttle, u.steer] = [u.throttle * enginePower(v), u.steer + steerPull(v)];
    this.rig.update(u, dt);
    suspendWheels(v.group, this.rig.mounts, this.rig.drops());
    readBody(v);
    if (!this.marks.mesh.parent) v.group.parent?.add(this.marks.mesh);
    const lv = v.body.linvel(), earth = (p: THREE.Vector3) => (stripAt(p.x, p.y, p.z) ?? (this.d.hf.maskAt(p.x, p.z, 0) > 0.5 || this.d.hf.isPaved(p.z) ? 'hard' : 'dirt')) === 'dirt';
    trackWheels(this.marks, this.rig.contacts(), new THREE.Vector3(lv.x, lv.y, lv.z), v.yaw, !!u.brake && s.speed > 0, u.handbrake, earth, sp.small ? 0.12 : 0.2);
    joinPhysics(this.d.world, this.d.traffic!, v, this.d.player.position);
    Object.assign(s, { x: v.x, y: v.y, z: v.z, yaw: v.yaw, tilt: v.tilt, speed: this.rig.speed });
    const dv = jolt(v, dt);
    if (dv > 3) {
      const c = contactOf(world, v.collider);
      sfx.crash(0);
      tpc.kick(0, 0, Math.min(0.6, dv * 0.04));
      v.hp -= crashDamage(v, dv);
      if (v.hp <= 0) v.state = 'wreck';
      if (dv > 8) player.hurt((dv - 8) * 3.5);
      if (c && dv > 3) dent(v.group, c.at, Math.min(0.38, (dv - 2.5) * 0.055));
    }
    if (Math.abs(s.speed) > 0.4) this.runOver(s, sp.half, dt);
    const bump = bumpOverBodies(v.body, v.group, this.rig.mounts, this.rig.mass, Math.abs(s.speed), this.d.enemies, this.clock, this.hitT);
    if (bump) [sfx.thud(bump * 2), tpc.kick(0.01, 0, bump * 0.3)];
    world.getCollider(player.collisionHandle).parent()!.setNextKinematicTranslation({ x: s.x, y: s.y + this.bodyOff, z: s.z });
    const gear = sp.top / 4, sp1 = Math.abs(s.speed), rev = sp1 < 0.5 ? 0.12 : 0.3 + ((sp1 % gear) / gear) * 0.7;
    this.engine.set(true, rev, Math.max(u.throttle, u.brake * (s.speed < 0.5 ? 1 : 0)), sp1, !!sp.small);
    this.speedo.textContent = `${Math.round(sp1 * 3.6)} km/h`;
    (this.seat?.userData.rig as Rig | undefined)?.tick(dt);
    this.idleMouse = Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 0.5 ? 0 : this.idleMouse + dt;
    if (this.idleMouse > 1 && sp1 > 3 && !input.aiming) {
      const want = s.yaw + Math.PI + (s.speed < 0 ? Math.PI : 0), diff = Math.atan2(Math.sin(want - tpc.yaw), Math.cos(want - tpc.yaw));
      tpc.yaw += diff * Math.min(1, dt * 2.5);
      tpc.pitch = THREE.MathUtils.damp(tpc.pitch, -0.18, 2, dt);
    }
  }

  /** People in the bumper's swept box: below 4 m/s they stop the car; above, an impact (thrown at bumper speed, car keeps its speed but for the mass pushed). */
  private runOver(s: CarState, half: number, dt: number): void {
    const { traffic, sfx, tpc } = this.d, sp = Math.abs(s.speed), dir = Math.sign(s.speed);
    const fwd = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)), right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const reach = s.len / 2 + sp * dt + 0.45, dmg = Math.min(260, (sp - 3) * 24), from = new THREE.Vector3(s.x, s.y + 0.8, s.z);
    for (const t of traffic!.near) {
      if (t.kind === 'player' || !t.alive() || Math.abs(t.pos.y - s.y) > 2.2) continue;
      const rx = t.pos.x - s.x, rz = t.pos.z - s.z, along = (rx * fwd.x + rz * fwd.z) * dir, lat = rx * right.x + rz * right.z;
      if (Math.abs(lat) > half + 0.4 || along < s.len / 2 - 0.9 || along > reach) continue;
      if (sp < 4) {
        this.halt(0.2);
        continue;
      }
      if ((this.hitT.get(t.key) ?? -9) > this.clock - 0.6) continue;
      this.hitT.set(t.key, this.clock);
      const shove = fwd.clone().multiplyScalar(dir * sp * 0.95).addScaledVector(right, Math.sign(lat || 1) * (0.8 + sp * 0.15));
      t.hurt(t.kind === 'ally' ? dmg * 0.4 : dmg, from, shove);
      sfx.thud(Math.min(1, sp / 14));
      sfx.crash(0);
      tpc.kick(0.02, 0, Math.min(0.35, sp * 0.02));
      this.halt(this.rig!.mass / (this.rig!.mass + 90));
    }
  }

  /** Scales the driven car's velocity (a body in the way soaks up speed). */
  private halt(k: number): void {
    const b = this.car!.body, l = b.linvel();
    b.setLinvel({ x: l.x * k, y: l.y, z: l.z * k }, true);
  }
}
