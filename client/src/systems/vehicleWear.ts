import * as THREE from 'three';
import type { Vehicle } from './traffic';
import { HP } from './traffic';
import { dent } from '../fx/dents';
import { crackGlass } from '../fx/carDamage';

/**
 * Wear by remaining health, so a vehicle degrades instead of dying all at once:
 * 0 intact · 1 scratched/dented (> 80 %) · 2 white steam from the bonnet · 3 grey smoke, engine weak, pulls to one side
 * · 4 black smoke, misfiring, much weaker · 5 flames under the bonnet, barely moves · then wrecked at 0 (dead engine).
 */
export function wearStage(v: Vehicle): number {
  const f = v.hp / HP;
  return f > 0.999 ? 0 : f > 0.8 ? 1 : f > 0.6 ? 2 : f > 0.4 ? 3 : f > 0.2 ? 4 : f > 0 ? 5 : 6;
}

/** Engine power left at each stage (wrecks have none). */
const POWER = [1, 1, 0.95, 0.85, 0.65, 0.45, 0];
/** Seconds between smoke puffs and their shade (> 1 = a flame lick) per stage. */
const PUFF: [number, number][] = [[0, 0], [0, 0], [0.55, 0.78], [0.25, 0.45], [0.12, 0.16], [0.08, 0.1]];

export function enginePower(v: Vehicle): number {
  const s = wearStage(v);
  if (s >= 4 && Math.sin(performance.now() * 0.011 + v.horn) > (s === 4 ? 0.82 : 0.6)) return 0;
  return POWER[s];
}

/** Steering pull of a bent front end (stage 3+), a fixed side per vehicle. */
export function steerPull(v: Vehicle): number {
  return wearStage(v) >= 3 ? (v.horn % 2 > 1 ? 0.07 : -0.07) * (wearStage(v) - 2) : 0;
}

const last = new WeakMap<Vehicle, number>();

/**
 * Smoke (and at stage 5 flames) from the engine bay of a damaged vehicle within `range` of the camera, and the
 * traffic's cruise held down to what the engine still gives. Wrecks smoke on their own (traffic).
 */
export function wearTick(v: Vehicle, camera: THREE.Vector3, y: number, emit: (at: THREE.Vector3, shade: number) => void, range = 140): void {
  const s = wearStage(v);
  if (s < 2 || s > 5) return;
  if (v.state === 'drive') v.speed = Math.min(v.speed, v.cruise * Math.max(0.35, POWER[s]));
  const now = performance.now() / 1000, [every, shade] = PUFF[s];
  if (now - (last.get(v) ?? 0) < every || Math.hypot(v.x - camera.x, v.z - camera.z) > range) return;
  last.set(v, now);
  const front = v.kind === 'micro' ? -0.42 : 0.33, at = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.len * front).add(new THREE.Vector3(v.x, y + (v.kind === 'moto' || v.kind === 'delivery' ? 0.7 : 1.0), v.z));
  emit(at, shade * (0.85 + Math.random() * 0.3));
  if (s === 5) for (let k = 0; k < 2; k++) emit(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.25, (Math.random() - 0.5) * 0.4)), 2.2 + Math.random() * 1.5);
}

/** A bullet hole: a small chipped, dimpled patch of paint where it struck, and the glass round it crazed. */
export function bulletMark(group: THREE.Object3D, at: THREE.Vector3): void {
  dent(group, at, 0.012, 0.07);
  crackGlass(group, at, 0.3);
}
