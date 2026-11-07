import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { Builder } from '../world/buildingKit';
import type { CarKind } from '../world/urbanProps';
import { vehicleLook, buildLoose, type VehicleMats } from './vehicleLook';
import { carModels } from '../render/carModels';
import type { ParkedSpot } from '../world/parkedCars';
import { deliveryBike } from '../world/deliveryBike';
import { onHit, setSurface } from '../world/surfaces';
import { seatedPerson, seatedRig, SEATS } from '../entities/occupants';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import type { Rig } from '../entities/rig';
import { Riders } from './riders';
import { unblamed } from './blame';

/** `player`: driven by the player (moved by `Driving`); `parked`: left where the player got out. */
type State = 'drive' | 'off' | 'crash' | 'wreck' | 'player' | 'parked';

export interface Vehicle {
  kind: CarKind | 'moto' | 'delivery'; group: THREE.Group; body: RAPIER.RigidBody; collider: RAPIER.Collider; dir: 1 | -1;
  x: number; z: number; base: number; lane: number; half: number; yaw: number; speed: number; cruise: number; len: number;
  honkT: number; horn: number; panic: boolean; state: State; hp: number; spin: number; drift: number; smokeT: number;
  /** Seat holders (Mixamo sitters), the driver first. */ seats: THREE.Group[];
  /** While player-driven: floor height and body tilt (pitch/roll on slopes and in turns). */ y?: number; tilt?: THREE.Quaternion;
}

export interface Victim { key: string; kind: 'player' | 'police' | 'ally' | 'civilian'; pos: THREE.Vector3; alive(): boolean; hurt(damage: number, from: THREE.Vector3, shove: THREE.Vector3): void }

/** A straight road along x: centre `z`, lane offset from the centre, half width, how many vehicles use it (and which kinds). */
export interface Road { z: number; lane: number; half: number; count: number; kinds?: (CarKind | 'moto' | 'delivery')[] }

const HP = 140;

/** Avenue traffic with drivers/passengers; vehicles take bullet damage and, once disabled, skid out of control. */
export class Traffic {
  readonly group = new THREE.Group();
  private xMin: number;
  private xMax: number;
  readonly list: Vehicle[] = [];
  private calmT = 99;
  private cam = new THREE.Vector3();
  onHonk: (at: THREE.Vector3, pitch: number) => void = () => {};
  onDisabled: (at: THREE.Vector3, weight: number) => void = () => {};
  onCrash: (at: THREE.Vector3) => void = () => {};
  onSmoke: (at: THREE.Vector3) => void = () => {};
  /** People a moving vehicle can run into (player, squad, soldiers); `hurt` receives damage, origin and a shove. */
  victims: () => Victim[] = () => [];
  /** This frame's `victims()` (also used by `Driving`). */ near: Victim[] = [];
  private hitT = new Map<string, number>();
  private riders: Riders;
  private clock = 0;
  private look: VehicleMats;
  private spinQ = new THREE.Quaternion();
  /** Other people on the road drivers brake for (the squad). */
  obstacles: () => THREE.Vector3[] = () => [];
  /** Stop line ahead on red for a vehicle front at x (see `TrafficLights.stopLine`). */
  stopLine: (x: number, dir: number, base: number, speed: number) => number | null = () => null;

  constructor(private world: RAPIER.World, private hf: Heightfield, private lighting: Lighting, materials: Record<string, THREE.Material>, bake: { material: THREE.Material; keys: string[] }[], roads: Road[], span: [number, number] = [-245, 245]) {
    [this.xMin, this.xMax] = span;
    this.riders = new Riders(this.group, hf);
    const lanes = roads.flatMap((r) => Array<Road>(r.count).fill(r)), count = lanes.length;
    this.look = { materials, bake };
    const kinds: (CarKind | 'moto' | 'delivery')[] = ['combi', 'moto', 'tico', 'sedan', 'micro', 'delivery', 'moto', 'combi', 'wagon', 'pickup', 'moto', 'tico', 'micro', 'delivery'];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const kind = lanes[i].kinds?.[i % lanes[i].kinds!.length] ?? kinds[i % kinds.length];
      const g = kind === 'delivery' ? this.bike(i) : kind === 'moto' ? vehicleLook(lighting, this.look, 'moto', `moto${i % 3}`, carModels.pick('moto', i)) : vehicleLook(lighting, this.look, kind, kind === 'combi' || kind === 'micro' ? 'car5' : kind === 'tico' ? 'car3' : `car${i % 6}`, carModels.pick(kind, i), i);
      const riders: THREE.BufferGeometry[] = [], seats: THREE.Group[] = [];
      let riderMat: THREE.Material | null = null;
      SEATS[kind].forEach(([x, y, z], k) => {
        if (k > 0 && rand() < 0.45) return;
        const rider = seatedRig(lighting, rand, kind !== 'moto' && kind !== 'delivery');
        if (rider) {
          rider.position.set(x, y, z);
          seats.push(rider);
          return void g.add(rider);
        }
        const p = seatedPerson(lighting, rand);
        riderMat = p.material as THREE.Material;
        riders.push(p.geometry.clone().translate(x, y - 0.95, z));
      });
      if (riders.length) g.add(new THREE.Mesh(mergeGeometries(riders), riderMat!));
      const dir = i % 2 ? 1 : -1;
      const cruise = kind === 'delivery' ? 9 : kind === 'moto' ? 7 : kind === 'combi' || kind === 'micro' ? 11 : 10;
      this.register(kind, g, seats, this.xMin + ((i * 77) % (this.xMax - this.xMin)), lanes[i].z + dir * lanes[i].lane, dir, lanes[i], cruise, 360 + rand() * 110, 3 + rand() * 10);
    }
  }

  private bike(i: number): THREE.Group {
    const b = new Builder(null, null);
    deliveryBike(b, i % 3);
    return new THREE.Group().add(...buildLoose(b, this.lighting, this.look));
  }
  private register(kind: Vehicle['kind'], g: THREE.Group, seats: THREE.Group[], x: number, z: number, dir: 1 | -1, road: Road, cruise: number, horn: number, honkT: number, yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2): Vehicle {
    this.group.add(g);
    const len = kind === 'delivery' ? 1.9 : kind === 'moto' ? 2.3 : kind === 'micro' ? 8.6 : kind === 'combi' ? 4.8 : kind === 'tico' ? 3.4 : kind === 'pickup' ? 5 : 4.4;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(kind === 'delivery' ? 0.4 : kind === 'micro' ? 1.15 : 0.9, kind === 'micro' ? 1.4 : 0.8, len / 2).setTranslation(0, kind === 'micro' ? 1.4 : 0.8, 0), body);
    setSurface(collider.handle, 'metal');
    const v: Vehicle = { kind, group: g, body, collider, dir, x, z, base: road.z, lane: road.lane, half: road.half, yaw, speed: cruise, cruise, len, honkT, horn, panic: false, state: 'drive', hp: HP, spin: 0, drift: 0, smokeT: 0, seats };
    this.list.push(v);
    onHit(collider.handle, (dmg, p) => {
      this.damage(v, (kind === 'moto' || kind === 'delivery') && p.y - g.position.y > 1 ? HP : dmg);
      return false;
    });
    return v;
  }

  /** A parked car of the level the player gets into: it becomes a vehicle of this list, left `parked`. */
  adopt(s: ParkedSpot): Vehicle {
    const g = vehicleLook(this.lighting, this.look, s.kind, s.paint, s.model, s.company);
    const v = this.register(s.kind, g, [], s.pos.x, s.pos.z, 1, { z: s.pos.z, lane: 0, half: 4, count: 0 }, 0, 330 + Math.random() * 120, 99, s.yaw);
    Object.assign(v, { state: 'parked', speed: 0, y: s.pos.y });
    this.place(v, s.pos);
    return v;
  }

  /** Bullets into the player's (or a parked) vehicle: the car soaks it; at 0 it is wrecked and smokes. */
  onDrivenHit: (v: Vehicle, dmg: number) => void = () => {};

  damage(v: Vehicle, dmg: number): void {
    if (v.state === 'player' || v.state === 'parked') {
      v.hp -= dmg;
      this.onDrivenHit(v, dmg);
      if (v.hp <= 0) [v.state, v.speed] = ['wreck', 0];
      return;
    }
    if (v.state !== 'drive') return;
    v.hp -= dmg;
    v.panic = true;
    if (v.hp > 0) return;
    v.state = 'crash';
    v.spin = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.6);
    v.drift = v.dir * (1.5 + Math.random() * 2.5);
    this.onDisabled(new THREE.Vector3(v.x, 1, v.z), v.kind === 'micro' ? 6 : v.kind === 'combi' ? 4 : v.kind === 'moto' || v.kind === 'delivery' ? 1 : 2);
    const driver = v.seats[0];
    if ((v.kind === 'moto' || v.kind === 'delivery') && driver?.parent === v.group) {
      v.group.updateMatrixWorld(true);
      this.riders.throwOff(driver, new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)).multiplyScalar(v.drift > 0 ? -1 : 1));
    }
  }

  /** The closest vehicle the player can take (not wrecked) whose body is within `reach` of `p`. */
  enterable(p: THREE.Vector3, reach: number): Vehicle | null {
    let best: Vehicle | null = null, bd = reach;
    for (const v of this.list) {
      if (v.state === 'off' || v.state === 'crash' || v.state === 'wreck' || v.state === 'player' || !v.group.visible) continue;
      const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)), rel = new THREE.Vector3(p.x - v.x, 0, p.z - v.z);
      const along = Math.max(0, Math.abs(rel.dot(fwd)) - v.len / 2), side = Math.max(0, Math.abs(rel.x * fwd.z - rel.z * fwd.x) - 1);
      const d = Math.hypot(along, side);
      if (d < bd) [best, bd] = [v, d];
    }
    return best;
  }

  /** The player takes the wheel: driver and passengers get out (hidden), the car stops obeying its lane. */
  seize(v: Vehicle): void {
    v.state = 'player';
    v.panic = false;
    for (const s of v.seats) s.visible = false;
    v.y = this.hf.heightAt(v.x, v.z);
  }

  /** The player got out: the car stays where it stopped. */
  park(v: Vehicle): void {
    if (v.state === 'player') v.state = 'parked';
    v.speed = 0;
  }

  /** Gunfire or a blast: only a scare near the camera clears the streets (fights far away leave traffic alone). */
  alarm(at: THREE.Vector3): void {
    if (Math.hypot(at.x - this.cam.x, at.z - this.cam.z) > 200) return;
    this.calmT = 0;
    for (const v of this.list) if (v.state === 'drive' && Math.abs(v.x - at.x) < 160) v.panic = true;
  }

  explosion(at: THREE.Vector3, radius: number): void {
    for (const v of this.list) if ((v.state === 'drive' || v.state === 'player' || v.state === 'parked') && Math.hypot(v.x - at.x, v.z - at.z) < radius) this.damage(v, HP);
  }

  private crashStep(v: Vehicle, dt: number): void {
    const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    const step = v.speed * dt + v.len / 2 + 0.3;
    const y = this.hf.heightAt(v.x, v.z) + 0.6;
    const hit = this.world.castRay(new RAPIER.Ray({ x: v.x, y, z: v.z }, fwd), step, true, undefined, undefined, undefined, undefined, (c) => c.handle !== v.collider.handle);
    if (hit || Math.abs(v.z - v.base) > v.half - 0.1) {
      if (v.speed > 2) this.onCrash(new THREE.Vector3(v.x, y, v.z));
      v.speed = 0;
    }
    v.speed = Math.max(0, v.speed - 7 * dt);
    v.x += fwd.x * v.speed * dt;
    v.z = THREE.MathUtils.clamp(v.z + fwd.z * v.speed * dt + v.drift * dt * Math.min(1, v.speed / 4), v.base - v.half, v.base + v.half);
    v.yaw += v.spin * dt * Math.min(1, v.speed / 3);
    if (v.speed <= 0.05) v.state = 'wreck';
  }

  /** Bodies inside the bumper's sweep this frame take damage from speed and how square the hit is, and get shoved aside. */
  private impacts(v: Vehicle, dt: number, now: number): void {
    if (v.speed < 2.5) return;
    const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)), right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const t of this.near) {
      if (!t.alive()) continue;
      const rel = new THREE.Vector3(t.pos.x - v.x, 0, t.pos.z - v.z);
      const along = rel.dot(fwd), lat = rel.dot(right);
      if (Math.abs(lat) > 1.3 || along < -v.len / 2 - 0.3 || along > v.len / 2 + 0.45 + v.speed * dt) continue;
      if ((this.hitT.get(t.key) ?? -9) > now - 1.2) continue;
      this.hitT.set(t.key, now);
      const square = along > v.len / 2 - 0.6 ? 1 - Math.min(1, Math.abs(lat) / 1.3) * 0.5 : 0.35;
      const damage = Math.min(75, (v.speed - 2) * 5.5) * square;
      const shove = fwd.clone().multiplyScalar(v.speed * 0.55 * square).addScaledVector(right, Math.sign(lat || 1) * (2 + v.speed * 0.25));
      unblamed(() => t.hurt(damage, new THREE.Vector3(v.x, t.pos.y + 0.8, v.z), shove));
      if (square > 0.6) v.speed *= 0.6;
    }
  }

  /** Moves a far-off car to just beyond view behind/ahead of the player so the nearby avenue stays busy. */
  private bringNear(v: Vehicle, camX: number): void {
    const x = THREE.MathUtils.clamp(camX - v.dir * (150 + Math.random() * 40), this.xMin, this.xMax);
    if (this.list.some((o) => o !== v && o.dir === v.dir && o.base === v.base && o.state !== 'off' && Math.abs(o.x - x) < o.len + 10)) return;
    v.x = x;
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.Vector3): void {
    this.calmT += dt;
    this.cam.copy(camera);
    this.clock += dt;
    this.near = this.victims();
    const walkers = this.near.flatMap((t) => (t.kind === 'civilian' ? [t.pos] : []));
    this.riders.update(dt, camera);
    for (const v of this.list) {
      if (v.state === 'off') {
        if (this.calmT > 20 && Math.random() < dt * 0.5) {
          Object.assign(v, { state: 'drive', panic: false, hp: HP, x: v.dir > 0 ? this.xMin : this.xMax, z: v.base + v.dir * v.lane, yaw: v.dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
          v.group.visible = true;
        } else continue;
      }
      if (v.state === 'drive' || v.state === 'crash') this.impacts(v, dt, this.clock);
      if (v.state === 'player' || v.state === 'parked') {
        this.place(v, camera);
        continue;
      }
      if (v.state === 'crash') this.crashStep(v, dt);
      else if (v.state === 'drive') {
        let target = v.panic ? 19 : v.cruise;
        const ahead = (px: number, pz: number, gap: number) => (px - v.x) * v.dir > 0 && (px - v.x) * v.dir < gap && Math.abs(pz - v.z) < 1.8;
        if (ahead(player.x, player.z, 12 + v.speed) || [...this.obstacles(), ...walkers].some((o) => ahead(o.x, o.z, 10 + v.speed))) {
          target = 0;
          v.honkT -= dt * 4;
        }
        for (const o of this.list) if (o !== v && o.state !== 'off' && (o.dir === v.dir || o.state !== 'drive') && ahead(o.x, o.z, v.len + 4 + v.speed * 0.6)) target = Math.min(target, o.state === 'drive' ? o.speed * 0.8 : 0);
        const line = v.panic ? null : this.stopLine(v.x + v.dir * v.len / 2, v.dir, v.base, v.speed);
        if (line !== null) target = Math.min(target, Math.sqrt(Math.max(0, 8 * ((line - v.x) * v.dir - v.len / 2 - 0.4))));
        v.speed = THREE.MathUtils.damp(v.speed, target, target < v.speed ? 4 : 1.2, dt);
        v.x += v.dir * v.speed * dt;
        v.honkT -= dt;
        if (v.honkT <= 0) {
          v.honkT = 15 + Math.random() * 30;
          if (Math.hypot(v.x - camera.x, v.z - camera.z) < 110) this.onHonk(new THREE.Vector3(v.x, 0, v.z), v.horn);
        }
        if (!v.panic && this.calmT > 20 && Math.abs(v.x - camera.x) > 160) this.bringNear(v, camera.x);
        if ((v.dir > 0 && v.x > this.xMax) || (v.dir < 0 && v.x < this.xMin)) {
          if (v.panic || this.calmT < 20) {
            v.state = 'off';
            v.group.visible = false;
            v.body.setNextKinematicTranslation({ x: 0, y: -50, z: 0 });
            continue;
          }
          v.x = v.dir > 0 ? this.xMin : this.xMax;
        }
      } else if ((v.smokeT -= dt) <= 0 && Math.hypot(v.x - camera.x, v.z - camera.z) < 140) {
        v.smokeT = 0.12;
        this.onSmoke(new THREE.Vector3(v.x, this.hf.heightAt(v.x, v.z) + 1.2, v.z).add(new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.len * 0.35)));
      }
      this.place(v, camera);
    }
  }

  private place(v: Vehicle, camera: THREE.Vector3): void {
    const y = v.y ?? this.hf.heightAt(v.x, v.z);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), v.yaw);
    if (v.tilt) q.multiply(v.tilt);
    const dist = Math.hypot(v.x - camera.x, v.z - camera.z);
    v.group.visible = dist < 150;
    for (const s of v.seats) (s.userData.rig as Rig).far = dist > 25;
    const wheels = v.group.userData.wheels as THREE.Object3D[] | undefined, roll = (v.x - v.group.position.x) * Math.sin(v.yaw) + (v.z - v.group.position.z) * Math.cos(v.yaw);
    if (wheels?.length && v.group.visible && Math.abs(roll) < 3) {
      this.spinQ.setFromAxisAngle(v.group.userData.spinAxis, roll / v.group.userData.wheelR);
      for (const w of wheels) w.quaternion.premultiply(this.spinQ);
    }
    v.group.position.set(v.x, y, v.z);
    v.group.quaternion.copy(q);
    v.body.setNextKinematicTranslation({ x: v.x, y, z: v.z });
    v.body.setNextKinematicRotation(q);
  }
}
