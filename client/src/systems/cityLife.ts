import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Traffic, type Road } from './traffic';
import { TrafficLights, type LightRoad } from './trafficLights';
import { RoofDogs } from './roofDogs';
import { Dogs } from './dogs';
import { Birds } from '../fx/birds';
import { Pigeons } from '../fx/pigeons';
import { surfaceTop } from '../world/groundStrips';
import { Ambience } from '../audio/ambience';
import type { Mixer } from '../audio/mixer';
import type { Barrio } from '../world/barrio';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';

/** `span`: x range the traffic drives over (default ±245). */
export interface LifeDef { traffic: number; dogs: number; birds: number; roads?: Road[]; span?: [number, number]; lights?: LightRoad[]; pigeons?: number }

/** Everything that makes the barrio feel inhabited besides the pedestrians: traffic, strays, vultures and sound. */
export class CityLife {
  readonly group = new THREE.Group();
  private traffic: Traffic;
  private dogs: Dogs;
  private roofDogs = new RoofDogs();
  private birds: Birds;
  private ambience: Ambience;
  private lights: TrafficLights | null = null;
  private pigeons: Pigeons;

  constructor(def: LifeDef, world: RAPIER.World, hf: Heightfield, barrio: Barrio, lighting: Lighting, mixer: Mixer, private camera: THREE.Camera) {
    this.traffic = new Traffic(world, hf, lighting, barrio.materials, barrio.bake, def.roads ?? [{ z: 0, lane: 3.2, half: 7.6, count: def.traffic }], def.span);
    this.dogs = new Dogs(barrio.graph, hf, def.dogs);
    this.birds = new Birds(def.birds, 250);
    this.ambience = new Ambience(mixer);
    this.pigeons = new Pigeons(pigeonHomes(barrio, hf, def.pigeons ?? 0), lighting, Math.random);
    this.group.add(this.traffic.group, this.dogs.group, this.roofDogs.group, this.birds.mesh, this.pigeons.group);
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
