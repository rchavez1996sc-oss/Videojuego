import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Traffic } from './traffic';
import { Dogs } from './dogs';
import { Birds } from '../fx/birds';
import { Ambience } from '../audio/ambience';
import type { Mixer } from '../audio/mixer';
import type { Barrio } from '../world/barrio';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';

export interface LifeDef { traffic: number; dogs: number; birds: number; radio: [number, number] }

/** Everything that makes the barrio feel inhabited besides the pedestrians: traffic, strays, vultures and sound. */
export class CityLife {
  readonly group = new THREE.Group();
  private traffic: Traffic;
  private dogs: Dogs;
  private birds: Birds;
  private ambience: Ambience;
  private radio: THREE.Vector3;

  constructor(def: LifeDef, world: RAPIER.World, hf: Heightfield, barrio: Barrio, lighting: Lighting, mixer: Mixer, private camera: THREE.Camera) {
    this.traffic = new Traffic(world, hf, barrio.materials, barrio.bake, def.traffic);
    this.dogs = new Dogs(barrio.graph, hf, lighting, def.dogs);
    this.birds = new Birds(def.birds, 250);
    this.ambience = new Ambience(mixer);
    this.radio = new THREE.Vector3(def.radio[0], hf.heightAt(def.radio[0], def.radio[1]) + 1.5, def.radio[1]);
    this.group.add(this.traffic.group, this.dogs.group, this.birds.mesh);
    this.traffic.onHonk = (at) => this.cue(at, (d, p) => this.ambience.horn(d, p));
    this.dogs.onBark = (at) => this.cue(at, (d, p) => this.ambience.bark(d, p));
  }

  private cue(at: THREE.Vector3, play: (distance: number, pan: number) => void): void {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    play(at.distanceTo(this.camera.position), at.clone().sub(this.camera.position).normalize().dot(right));
  }

  alarm(at: THREE.Vector3, radius: number): void {
    this.traffic.alarm(at);
    this.dogs.alarm(at, radius);
  }

  update(dt: number, player: THREE.Vector3, inCombat: boolean): void {
    this.traffic.update(dt, player);
    this.dogs.update(dt, this.camera.position);
    this.birds.update(dt);
    this.cue(this.radio, (d, p) => this.ambience.update(dt, d, p, inCombat));
  }
}
