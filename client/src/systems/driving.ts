import * as THREE from 'three';
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
import { SPECS, stepCar, type CarState } from './carPhysics';
import { seatedRig, SEATS } from '../entities/occupants';
import { innocents } from './blame';
import { hitHandler } from '../world/surfaces';
import { roomy } from './respawn';
import { parkedCars } from '../world/parkedCars';

interface Deps { traffic: Traffic | null; world: RAPIER.World; player: Player; tpc: ThirdPersonCamera; enemies: Enemies; squad: Squad | null; sfx: Sfx; lighting: Lighting; mixer: Mixer }

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
  private hitT = new Map<number, number>();
  private clock = 0;

  constructor(private d: Deps) {
    this.engine = new EngineSound(d.mixer);
    this.prompt.className = 'prompt';
    this.prompt.style.opacity = '0';
    this.speedo.className = 'speedo';
    this.speedo.style.cssText = 'position:fixed;right:28px;bottom:28px;font:800 34px "Barlow Condensed",sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 6px #000;opacity:0;pointer-events:none;letter-spacing:1px';
    document.body.append(this.prompt, this.speedo);
    if (d.traffic) d.traffic.onDrivenHit = (v, dmg) => v === this.car && d.player.hurt(dmg * 0.25);
  }

  get active(): boolean {
    return !!this.car;
  }

  /** Runs instead of the on-foot update while driving; returns whether the player is driving. */
  update(dt: number, input: Input, alive: boolean): boolean {
    const { traffic, player } = this.d;
    this.clock += dt;
    if (!traffic) return false;
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
    if (!alive || this.car.state === 'wreck' || (input.hit('KeyE') && Math.abs(this.state!.speed) < 4)) {
      if (this.car.state === 'wreck' && alive) player.hurt(20);
      this.exit();
      return false;
    }
    this.drive(dt, input);
    return true;
  }

  private enter(v: Vehicle): void {
    const { traffic, player, world, tpc, lighting } = this.d, sp = SPECS[v.kind] ?? SPECS.sedan;
    traffic!.seize(v);
    this.car = v;
    this.state = { x: v.x, y: v.y ?? player.position.y, z: v.z, yaw: v.yaw, vel: new THREE.Vector3(), vy: 0, steer: 0, speed: 0, len: v.len, tilt: new THREE.Quaternion() };
    const col = world.getCollider(player.collisionHandle);
    this.bodyOff = col.parent()!.translation().y - player.position.y;
    col.setEnabled(false);
    player.model.root.visible = false;
    const at = SEATS[v.kind]?.[0];
    this.seat = at ? seatedRig(lighting, Math.random, v.kind !== 'moto' && v.kind !== 'delivery', 'fls') : null;
    if (this.seat && at) {
      this.seat.position.set(at[0], at[1], at[2]);
      v.group.add(this.seat);
    }
    tpc.vehicle = 4.5 + v.len * 0.6;
    tpc.lift = sp.height * 0.35;
    this.speedo.style.opacity = '1';
  }

  private exit(): void {
    const { traffic, player, world, tpc } = this.d, v = this.car!, s = this.state!, sp = SPECS[v.kind] ?? SPECS.sedan;
    const fwd = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)), left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const side = Math.sign(SEATS[v.kind]?.[0][0] || 1), base = new THREE.Vector3(s.x, s.y, s.z);
    const spots = [left.clone().multiplyScalar(side * (sp.half + 0.8)), left.clone().multiplyScalar(-side * (sp.half + 0.8)), fwd.clone().multiplyScalar(-(v.len / 2 + 1.1)), fwd.clone().multiplyScalar(v.len / 2 + 1.1)].map((o) => base.clone().add(o));
    const col = world.getCollider(player.collisionHandle);
    col.setEnabled(true);
    const pos = spots.find((p) => roomy(world, p, player.collisionHandle)) ?? base.clone().setY(s.y + sp.height + 0.3);
    const keep = { hp: player.hp, regenCap: player.regenCap, stamina: player.stamina };
    player.respawn(pos, s.yaw + Math.PI);
    Object.assign(player, keep);
    player.model.root.visible = true;
    if (this.seat) v.group.remove(this.seat);
    traffic!.park(v);
    tpc.vehicle = tpc.lift = 0;
    this.engine.set(false, 0, 0, 0, false);
    this.speedo.style.opacity = '0';
    [this.car, this.state, this.seat] = [null, null, null];
  }

  private drive(dt: number, input: Input): void {
    const { world, player, tpc, enemies, squad, sfx } = this.d, v = this.car!, s = this.state!, sp = SPECS[v.kind] ?? SPECS.sedan;
    const people = new Set<number>([player.collisionHandle, ...enemies.list.map((e) => e.handle), ...(squad?.list.map((a) => a.unit.handle) ?? [])]);
    const skip = (h: number) => people.has(h) || innocents.has(h);
    const u = { throttle: input.down('KeyW') ? 1 : 0, brake: input.down('KeyS') ? 1 : 0, steer: (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0), handbrake: input.down('Space') };
    const impact = stepCar(world, s, sp, u, dt, v.collider, skip);
    Object.assign(v, { x: s.x, z: s.z, yaw: s.yaw, y: s.y, tilt: s.tilt, speed: Math.abs(s.speed) });
    if (impact > 3) {
      sfx.crash(0);
      tpc.kick(0, 0, Math.min(0.5, impact * 0.03));
      v.hp -= impact * 3;
      if (impact > 10) player.hurt((impact - 10) * 2.5);
    }
    if (Math.abs(s.speed) > 0.4) this.runOver(s, sp.half, people, dt);
    world.getCollider(player.collisionHandle).parent()!.setNextKinematicTranslation({ x: s.x, y: s.y + this.bodyOff, z: s.z });
    const gear = sp.top / 4, sp1 = Math.abs(s.speed), rev = sp1 < 0.5 ? 0.12 : 0.3 + ((sp1 % gear) / gear) * 0.7;
    this.engine.set(true, rev, Math.max(u.throttle, u.brake * (s.speed < 0.5 ? 1 : 0)), sp1, !!sp.small);
    this.speedo.textContent = `${Math.round(sp1 * 3.6)} km/h`;
    this.idleMouse = Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 0.5 ? 0 : this.idleMouse + dt;
    if (this.idleMouse > 1 && sp1 > 3) {
      const want = s.yaw + Math.PI + (s.speed < 0 ? Math.PI : 0), diff = Math.atan2(Math.sin(want - tpc.yaw), Math.cos(want - tpc.yaw));
      tpc.yaw += diff * Math.min(1, dt * 2.5);
      tpc.pitch = THREE.MathUtils.damp(tpc.pitch, -0.18, 2, dt);
    }
  }

  /**
   * People in the box swept by the bumper this frame (so nobody slips between frames at speed) are hit: slow pushes
   * stop the car against them (the squad steps aside), from 4 m/s it is a real impact (damage from speed, thud, jolt, the car loses speed) and
   * a policeman still standing afterwards stops the car instead of being driven through.
   */
  private runOver(s: CarState, half: number, people: Set<number>, dt: number): void {
    const { world, enemies, squad, player, sfx, tpc } = this.d, fwd = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)), sp = Math.abs(s.speed);
    const travel = sp * dt + 0.5, ahead = Math.sign(s.speed) * (s.len / 2 + travel / 2), at = { x: s.x + fwd.x * ahead, y: s.y + 0.9, z: s.z + fwd.z * ahead };
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw), dmg = Math.min(260, (sp - 3) * 24);
    const from = new THREE.Vector3(s.x, s.y + 0.8, s.z), stop = () => ((s.speed = 0), s.vel.set(0, 0, 0));
    world.intersectionsWithShape(at, q, new RAPIER.Cuboid(half + 0.35, 0.8, travel / 2), (c) => {
      const h = c.handle;
      if (h === player.collisionHandle || (!innocents.has(h) && !people.has(h))) return true;
      const e = enemies.list.find((x) => x.handle === h && x.alive), a = squad?.list.find((x) => x.unit.handle === h && x.unit.alive);
      if (people.has(h) && !e && !a) return true;
      if (sp < 4) return a || stop(), true;
      if ((this.hitT.get(h) ?? -9) > this.clock - 0.6) return true;
      this.hitT.set(h, this.clock);
      if (innocents.has(h)) hitHandler(h)?.(dmg, at);
      else if (e) enemies.runOver(e, dmg, from);
      else squad!.hurt(a!, dmg * 0.4, from);
      sfx.thud(Math.min(1, sp / 14));
      sfx.crash(0);
      tpc.kick(0.02, 0, Math.min(0.35, sp * 0.02));
      s.vel.multiplyScalar(0.78);
      s.speed *= 0.78;
      if (e?.alive) stop();
      return true;
    });
  }
}
