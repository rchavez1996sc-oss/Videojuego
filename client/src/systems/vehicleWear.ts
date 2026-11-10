import * as THREE from 'three';
import type { Vehicle } from './traffic';
import { HP } from './traffic';
import { MASS } from './vehicleBody';
import { dent } from '../fx/dents';
import { crackGlass } from '../fx/carDamage';

/**
 * Ten grades of wear by remaining health (each 10 % lost is one grade), so a vehicle degrades instead of dying at once:
 * 1–2 scratched and dented · 3–4 white steam from the bonnet · 5–6 grey smoke, weaker engine, pulls to one side
 * · 7–8 black smoke, misfiring · 9 flames under the bonnet · 10 on fire (it may blow up) · 11 = wrecked, dead engine.
 */
export function wearStage(v: Vehicle): number {
  const f = v.hp / HP;
  return f > 0.999 ? 0 : f > 0 ? Math.min(10, Math.ceil((1 - f) * 10)) : 11;
}

/** Engine power left at each grade (wrecks have none). */
const POWER = [1, 1, 1, 0.97, 0.94, 0.88, 0.8, 0.7, 0.6, 0.45, 0.32, 0];
/** Seconds between smoke puffs and their shade (> 1 = a flame lick) per grade. */
const PUFF: [number, number][] = [[0, 0], [0, 0], [0, 0], [0.9, 0.85], [0.55, 0.78], [0.35, 0.55], [0.25, 0.45], [0.16, 0.22], [0.12, 0.16], [0.08, 0.1], [0.06, 0.08]];

export function enginePower(v: Vehicle): number {
  const s = wearStage(v);
  if (s >= 7 && s <= 10 && Math.sin(performance.now() * 0.011 + v.horn) > (s <= 8 ? 0.82 : 0.6)) return 0;
  return POWER[s];
}

/** Steering pull of a bent front end (grade 5+), a fixed side per vehicle. */
export function steerPull(v: Vehicle): number {
  const s = Math.min(10, wearStage(v));
  return s >= 5 ? (v.horn % 2 > 1 ? 0.035 : -0.035) * (s - 4) : 0;
}

const last = new WeakMap<Vehicle, number>();

/**
 * Smoke (and at stage 5 flames) from the engine bay of a damaged vehicle within `range` of the camera, and the
 * traffic's cruise held down to what the engine still gives. Wrecks smoke on their own (traffic).
 */
export function wearTick(v: Vehicle, camera: THREE.Vector3, y: number, emit: (at: THREE.Vector3, shade: number) => void, range = 140): void {
  const s = wearStage(v);
  if (s < 3 || s > 10) return;
  if (v.state === 'drive') v.speed = Math.min(v.speed, v.cruise * Math.max(0.35, POWER[s]));
  const now = performance.now() / 1000, [every, shade] = PUFF[s];
  if (now - (last.get(v) ?? 0) < every || Math.hypot(v.x - camera.x, v.z - camera.z) > range) return;
  last.set(v, now);
  const front = v.kind === 'micro' ? -0.42 : 0.33, at = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.len * front).add(new THREE.Vector3(v.x, y + (v.kind === 'moto' || v.kind === 'delivery' ? 0.7 : 1.0), v.z));
  emit(at, shade * (0.85 + Math.random() * 0.3));
  if (s >= 9) for (let k = 0; k < (s === 10 ? 4 : 2); k++) emit(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.25, (Math.random() - 0.5) * 0.4)), 2.2 + Math.random() * 1.5);
}

/** A bullet hole: a small chipped, dimpled patch of paint where it struck, and the glass round it crazed. */
export function bulletMark(group: THREE.Object3D, at: THREE.Vector3): void {
  dent(group, at, 0.012, 0.07);
  crackGlass(group, at, 0.3);
}

/** Crash damage from the velocity change (m/s): grows faster than linear with speed, and bigger vehicles carry more energy into it. */
export function crashDamage(v: Vehicle, dv: number): number {
  return Math.max(0, dv - 3) ** 1.2 * 3.5 * ((MASS[v.kind] ?? 1300) / 1300) ** 0.25;
}
