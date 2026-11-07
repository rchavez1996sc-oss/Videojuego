import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
import type { CarKind } from '../world/urbanProps';
import { vehicleLook, bikeLook, type VehicleMats } from './vehicleLook';
import { carModels } from '../render/carModels';
import type { ParkedSpot } from '../world/parkedCars';
import { onHit, setSurface } from '../world/surfaces';
import { seatedPerson, seatedRig, seatsOf } from '../entities/occupants';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import type { Rig } from '../entities/rig';
import { Riders } from './riders';
import { shadowedCars } from '../fx/contactShadows';
import { vehicleColliders } from '../physics/noLift';
import { keepSane, makeDynamic, MASS, push } from './vehicleBody';
import { tumbleStep } from './tumble';
import { rollAlong } from './wheelSpin';
import { SPECS } from './carPhysics';
import { runInto } from './trafficImpacts';

/** `player`: driven by the player (moved by `Driving`); `parked`: left where the player got out; `tumble`: a real rigid body after a crash until it settles. */
type State = 'drive' | 'off' | 'tumble' | 'wreck' | 'player' | 'parked';

export interface Vehicle {
  kind: CarKind | 'moto' | 'delivery'; group: THREE.Group; body: RAPIER.RigidBody; collider: RAPIER.Collider; dir: 1 | -1;
  x: number; z: number; base: number; lane: number; half: number; yaw: number; speed: number; cruise: number; len: number;
  honkT: number; horn: number; panic: boolean; state: State; hp: number; spin: number; drift: number; smokeT: number;
  /** Seat holders (Mixamo sitters), the driver first. */ seats: THREE.Group[];
  /** While player-driven: floor height and body tilt (pitch/roll on slopes and in turns). */ y?: number; tilt?: THREE.Quaternion;
  /** Set once the body is dynamic: last velocity (for jolts) and how long it has been still. */ dyn?: { prev: THREE.Vector3; still: number };
}

export interface Victim { key: string; kind: 'player' | 'police' | 'ally' | 'civilian'; pos: THREE.Vector3; alive(): boolean; hurt(damage: number, from: THREE.Vector3, shove: THREE.Vector3): void }

/** A straight road along x: centre `z`, lane offset from the centre, half width, how many vehicles use it (and which kinds). */
export interface Road { z: number; lane: number; half: number; count: number; kinds?: (CarKind | 'moto' | 'delivery')[] }

const HP = 140;

/** Avenue traffic with drivers/passengers; vehicles take bullet damage and, once disabled or hit, become real rigid bodies. */
export class Traffic {
  readonly group = new THREE.Group();
  private xMin: number;
  private xMax: number;
  readonly list: Vehicle[] = [];
  private calmT = 99;
  private cam = new THREE.Vector3();
  onHonk: (at: THREE.Vector3, pitch: number) => void = () => {};
  onDisabled: (at: THREE.Vector3, weight: number) => void = () => {};
  onCrash: (at: THREE.Vector3, hard: number) => void = () => {};
  onSmoke: (at: THREE.Vector3) => void = () => {};
  /** People a moving vehicle can run into (player, squad, soldiers); `hurt` receives damage, origin and a shove. */
  victims: () => Victim[] = () => [];
  /** This frame's `victims()` (also used by `Driving`). */ near: Victim[] = [];
  private hitT = new Map<string, number>();
  private byHandle = new Map<number, Vehicle>();
  private riders: Riders;
  private clock = 0;
  private look: VehicleMats;
  /** Other people on the road drivers brake for (the squad). */
  obstacles: () => THREE.Vector3[] = () => [];
  /** Stop line ahead on red for a vehicle front at x (see `TrafficLights.stopLine`). */
  stopLine: (x: number, dir: number, base: number, speed: number) => number | null = () => null;

  constructor(readonly world: RAPIER.World, private hf: Heightfield, private lighting: Lighting, materials: Record<string, THREE.Material>, bake: { material: THREE.Material; keys: string[] }[], roads: Road[], span: [number, number] = [-245, 245]) {
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
      seatsOf(g, kind).forEach(([x, y, z], k) => {
        if (k > 0 && rand() < 0.45) return;
        const rider = seatedRig(lighting, rand, kind !== 'moto' && kind !== 'delivery', undefined, k === 0);
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
    return bikeLook(this.lighting, this.look, i);
  }
  private register(kind: Vehicle['kind'], g: THREE.Group, seats: THREE.Group[], x: number, z: number, dir: 1 | -1, road: Road, cruise: number, horn: number, honkT: number, yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2): Vehicle {
    this.group.add(g);
    const len = kind === 'delivery' ? 1.9 : kind === 'moto' ? 2.3 : kind === 'micro' ? 8.6 : kind === 'combi' ? 4.8 : kind === 'tico' ? 3.4 : kind === 'pickup' ? 5 : 4.4;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(kind === 'delivery' ? 0.4 : kind === 'micro' ? 1.15 : 0.9, kind === 'micro' ? 1.4 : 0.8, len / 2).setTranslation(0, kind === 'micro' ? 1.4 : 0.8, 0), body);
    setSurface(collider.handle, 'metal');
    vehicleColliders.add(collider.handle), shadowedCars.set(g, [kind === 'delivery' ? 0.8 : kind === 'micro' ? 2.3 : kind === 'moto' ? 1.4 : 1.8, len]);
    const v: Vehicle = { kind, group: g, body, collider, dir, x, z, base: road.z, lane: road.lane, half: road.half, yaw, speed: cruise, cruise, len, honkT, horn, panic: false, state: 'drive', hp: HP, spin: 0, drift: 0, smokeT: 0, seats };
    this.byHandle.set(collider.handle, v);
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
    const was = v.hp;
    if (v.state === 'player' || v.state === 'parked' || v.state === 'tumble' || v.state === 'wreck') {
      v.hp -= dmg;
      if (v.state !== 'tumble') this.onDrivenHit(v, dmg);
      if (v.hp <= 0 && (v.state === 'player' || v.state === 'parked')) [v.state, v.speed] = ['wreck', 0];
      if (was > 0 && v.hp <= 0 && v.seats.some((s) => s.visible)) this.disabled(v);
      return;
    }
    if (v.state !== 'drive') return;
    v.hp -= dmg;
    v.panic = true;
    if (v.hp > 0) return;
    this.knock(v);
    v.body.setAngvel({ x: 0, y: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random()), z: 0 }, true);
    this.disabled(v);
  }

  /** The vehicle as a real rigid body from now on (its current velocity kept); a driving one starts tumbling. */
  knock(v: Vehicle, linvel?: THREE.Vector3): void {
    if (v.state === 'off') return;
    makeDynamic(v, linvel ?? new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.state === 'drive' ? v.speed : 0));
    if (v.state === 'drive') v.state = 'tumble';
  }

  vehicleOf(handle: number): Vehicle | undefined {
    return this.byHandle.get(handle);
  }

  private disabled(v: Vehicle): void {
    this.onDisabled(new THREE.Vector3(v.x, 1, v.z), v.kind === 'micro' ? 6 : v.kind === 'combi' ? 4 : v.kind === 'moto' || v.kind === 'delivery' ? 1 : 2);
    const driver = v.seats[0];
    if ((v.kind === 'moto' || v.kind === 'delivery') && driver?.parent === v.group) {
      v.group.updateMatrixWorld(true);
      this.riders.throwOff(driver, new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)).multiplyScalar(Math.random() < 0.5 ? -1 : 1));
    }
  }

  /** The closest vehicle the player can take (not wrecked) whose body is within `reach` of `p`. */
  enterable(p: THREE.Vector3, reach: number): Vehicle | null {
    let best: Vehicle | null = null, bd = reach;
    for (const v of this.list) {
      if (v.state === 'off' || v.state === 'tumble' || v.state === 'wreck' || v.state === 'player' || !v.group.visible) continue;
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

  /** A blast wrecks vehicles in range and throws them: an impulse away from it and upwards, by distance. */
  explosion(at: THREE.Vector3, radius: number): void {
    for (const v of this.list) {
      const d = Math.hypot(v.x - at.x, v.z - at.z);
      if (v.state === 'off' || d > radius) continue;
      this.damage(v, HP);
      this.knock(v);
      const k = (1 - d / radius) * (MASS[v.kind] ?? 1300), out = new THREE.Vector3(v.x - at.x, 0, v.z - at.z).normalize();
      push(v, new THREE.Vector3(out.x * k * 6, k * 5, out.z * k * 6), new THREE.Vector3(at.x + (v.x - at.x) * 0.9, (v.y ?? at.y) + 0.4, at.z + (v.z - at.z) * 0.9));
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
      if (v.state === 'drive' || v.state === 'tumble') runInto(v, dt, this.clock, this.near, this.hitT);
      if (v.body.isDynamic()) {
        keepSane(v, this.hf.heightAt(v.body.translation().x, v.body.translation().z));
        if (v.state !== 'player') tumbleStep(this, this.world, v, dt);
      }
      if (v.state === 'player' || v.state === 'parked' || v.state === 'tumble') {
        this.place(v, camera);
        continue;
      }
      if (v.state === 'drive') {
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
    if (v.group.visible) rollAlong(v.group, v.x, v.z, v.yaw, SPECS[v.kind]?.base ?? 2.6);
    v.group.position.set(v.x, y, v.z);
    v.group.quaternion.copy(q);
    if (v.body.isDynamic()) return;
    v.body.setNextKinematicTranslation({ x: v.x, y, z: v.z });
    v.body.setNextKinematicRotation(q);
  }
}
