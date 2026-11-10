import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Traffic, type Road } from './traffic';
import { TrafficLights, type LightRoad } from './trafficLights';
import { RoofDogs } from './roofDogs';
import { Dogs } from './dogs';
import { Birds } from '../fx/birds';
import { Pigeons } from '../fx/pigeons';
import { WindLitter } from '../fx/windLitter';
import { puddles } from '../world/puddles';
import { surfaceTop, stripAt } from '../world/groundStrips';
import { Ambience } from '../audio/ambience';
import type { Mixer } from '../audio/mixer';
import type { Barrio } from '../world/barrio';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';

/** `span`: x range the traffic drives over (default ±245). */
export interface LifeDef { traffic: number; dogs: number; birds: number; roads?: Road[]; span?: [number, number]; lights?: LightRoad[]; pigeons?: number; windLitter?: number; puddles?: number }

/** Everything that makes the barrio feel inhabited besides the pedestrians: traffic, strays, vultures and sound. */
export class CityLife {
  readonly group = new THREE.Group();
  private traffic: Traffic;
  private dogs: Dogs;
  private roofDogs = new RoofDogs();
  private birds: Birds;
  private ambience: Ambience;
  private lights: TrafficLights | null = null;
  private earth: (x: number, y: number, z: number) => boolean;
  private pigeons: Pigeons;
  private litter: WindLitter;
  private dustT = new WeakMap<object, number>();
  /** A puff of dust behind a vehicle driving on bare earth (position, colour). */
  onDust: ((at: THREE.Vector3, tint: THREE.Color) => void) | null = null;

  constructor(def: LifeDef, world: RAPIER.World, hf: Heightfield, barrio: Barrio, lighting: Lighting, mixer: Mixer, private camera: THREE.Camera) {
    this.traffic = new Traffic(world, hf, lighting, barrio.materials, barrio.bake, def.roads ?? [{ z: 0, lane: 3.2, half: 7.6, count: def.traffic }], def.span);
    this.dogs = new Dogs(barrio.graph, hf, def.dogs);
    this.birds = new Birds(def.birds, 250);
    this.ambience = new Ambience(mixer);
    this.pigeons = new Pigeons(pigeonHomes(barrio, hf, def.pigeons ?? 0), lighting, Math.random);
    const floor = (x: number, z: number) => surfaceTop(x, barrio.graph.ground?.(x, z) ?? hf.heightAt(x, z), z);
    this.litter = new WindLitter(lighting, def.windLitter ?? 0, floor);
    this.earth = (x, y, z) => {
      const s = stripAt(x, y, z);
      return s ? s === 'dirt' : !(hf.maskAt(x, z, 0) > 0.5 || hf.isPaved(z)) && hf.maskAt(x, z, 1) < 0.3;
    };
    this.group.add(this.traffic.group, this.dogs.group, this.roofDogs.group, this.birds.mesh, this.pigeons.group, this.litter.group);
    const wet = puddles(lighting, puddleSpots(barrio, def.puddles ?? 0, floor));
    if (wet) this.group.add(wet);
    if (location.search.includes('shot')) Object.assign(window, { __litter: this.litter, __puddles: wet });
    if (def.lights?.length) {
      const lights = (this.lights = new TrafficLights(def.lights, hf, lighting, world));
      this.group.add(lights.group);
      this.traffic.stopLine = (x, dir, base, speed) => lights.stopLine(x, dir, base, speed);
    }
    this.traffic.onHonk = (at, pitch) => this.cue(at, (d, p) => this.ambience.horn(d, p, pitch));
    this.dogs.onBark = this.roofDogs.onBark = (at) => this.cue(at, (d, p) => this.ambience.bark(d, p));
    this.pigeons.onFlutter = (at, n) => this.cue(at, (d, p) => this.ambience.flutter(d, p, n));
    if (location.search.includes('shot')) (window as unknown as { __pigeons: Pigeons }).__pigeons = this.pigeons;
  }

  /** Vehicles going faster than ~15 km/h over bare earth near the camera kick up tan dust behind the rear wheels. */
  private raiseDust(): void {
    if (!this.onDust) return;
    const now = performance.now() / 1000;
    for (const v of this.traffic.list) {
      const sp = Math.abs(v.speed), p = v.group.position;
      if (sp < 4 || p.distanceToSquared(this.camera.position) > 3600 || now - (this.dustT.get(v) ?? 0) < 0.5 / Math.min(sp / 4, 3)) continue;
      if (!this.earth(p.x, p.y, p.z)) continue;
      this.dustT.set(v, now);
      const back = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(-Math.sign(v.speed) * v.len * 0.45);
      this.onDust(p.clone().add(back).setY(p.y + 0.25), new THREE.Color(0.62, 0.55, 0.45).multiplyScalar(0.85 + Math.random() * 0.25));
    }
  }

  private cue(at: THREE.Vector3, play: (distance: number, pan: number) => void): void {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    play(at.distanceTo(this.camera.position), at.clone().sub(this.camera.position).normalize().dot(right));
  }

  get trafficEvents(): Traffic {
    return this.traffic;
  }

  explosion(at: THREE.Vector3, radius: number): void {
    this.traffic.explosion(at, radius);
  }

  alarm(at: THREE.Vector3, radius: number): void {
    this.traffic.alarm(at);
    this.dogs.alarm(at, radius);
    this.pigeons.alarm(at, radius);
  }

  update(dt: number, player: THREE.Vector3, inCombat: boolean): void {
    this.lights?.update(dt);
    this.traffic.update(dt, player, this.camera.position);
    this.dogs.update(dt, this.camera.position);
    this.roofDogs.update(dt, this.camera.position);
    this.birds.update(dt);
    this.litter.update(dt, this.camera.position);
    this.raiseDust();
    this.pigeons.update(dt, this.camera, [...this.traffic.near.map((t) => ({ pos: t.pos, r: t.kind === 'player' ? 2 : 0.4 })), ...this.traffic.list.filter((v) => Math.abs(v.speed) > 1).map((v) => ({ pos: v.group.position, r: 4 }))]);
    this.ambience.update(dt, inCombat);
  }
}

/** Flock homes: street-graph nodes at least 30 m apart, nudged off the node onto the walkable surface. */
function pigeonHomes(barrio: Barrio, hf: Heightfield, count: number): THREE.Vector3[] {
  const g = barrio.graph, out: THREE.Vector3[] = [];
  for (let k = 0; k < g.nodes.length * 3 && out.length < count; k++) {
    const idx = Math.floor(Math.random() * g.nodes.length), n = g.nodes[idx];
    if (g.exits.includes(idx) || g.nodes.filter((o) => o.distanceToSquared(n) < 900).length > 14) continue;
    const x = n.x + (Math.random() - 0.5) * 3, z = n.z + (Math.random() - 0.5) * 3;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 30)) continue;
    const y = g.ground?.(x, z) ?? hf.heightAt(x, z);
    out.push(new THREE.Vector3(x, surfaceTop(x, y, z), z));
  }
  return out;
}

/** Puddle spots: beside street-graph nodes (kerbs, doorways), 0.8–2.6 m across, at least 12 m apart. */
function puddleSpots(barrio: Barrio, count: number, floor: (x: number, z: number) => number): { x: number; y: number; z: number; size: number }[] {
  const g = barrio.graph, out: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < count * 20 && out.length < count; k++) {
    const n = g.nodes[Math.floor(Math.random() * g.nodes.length)], a = Math.random() * 6.28, r = 1.5 + Math.random() * 3;
    const x = n.x + Math.cos(a) * r, z = n.z + Math.sin(a) * r;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 12) || barrio.blocked(x, z)) continue;
    out.push({ x, y: floor(x, z), z, size: 0.8 + Math.random() * 1.8 });
  }
  return out;
}
