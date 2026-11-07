import * as THREE from 'three';

/**
 * Handling per vehicle kind: launch acceleration (m/s²), top speed (m/s), wheelbase, half width, roof height (m), tyre
 * grip (friction slip), steering lock (rad) and how fast the wheel turns, spring stiffness. A modern sedan pulls hard
 * to 170 km/h and grips; the Beetle is gutless, soft and floaty; the micro crawls to 80, leans and turns like a ship.
 */
export interface Spec { acc: number; top: number; base: number; half: number; height: number; small?: boolean; grip: number; lock: number; steerRate: number; spring: number }
export const SPECS: Record<string, Spec> = {
  moto: { acc: 2.6, top: 15, base: 1.6, half: 0.75, height: 1.9, small: true, grip: 1.5, lock: 0.7, steerRate: 6, spring: 30 },
  delivery: { acc: 5.5, top: 23, base: 1.3, half: 0.4, height: 1.6, small: true, grip: 1.7, lock: 0.75, steerRate: 8, spring: 34 },
  tico: { acc: 3.6, top: 33, base: 2.2, half: 0.75, height: 1.5, grip: 2.0, lock: 0.62, steerRate: 7, spring: 34 },
  sedan: { acc: 7.2, top: 47, base: 2.6, half: 0.9, height: 1.5, grip: 2.7, lock: 0.6, steerRate: 8, spring: 44 },
  beetle: { acc: 2.8, top: 31, base: 2.4, half: 0.8, height: 1.5, grip: 1.8, lock: 0.58, steerRate: 5, spring: 24 },
  wagon: { acc: 5.8, top: 42, base: 2.7, half: 0.9, height: 1.6, grip: 2.4, lock: 0.58, steerRate: 7, spring: 40 },
  pickup: { acc: 5.0, top: 40, base: 3.0, half: 0.95, height: 1.9, grip: 2.2, lock: 0.55, steerRate: 6, spring: 38 },
  combi: { acc: 2.9, top: 31, base: 2.6, half: 0.9, height: 2.1, grip: 1.9, lock: 0.55, steerRate: 4.5, spring: 30 },
  micro: { acc: 1.5, top: 23, base: 4.6, half: 1.15, height: 2.9, grip: 1.8, lock: 0.5, steerRate: 2.6, spring: 28 },
};

export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean }

/** Body state of the driven vehicle (x, z, yaw shared with the traffic record; velocity kept separately for drifting). */
export interface CarState { x: number; y: number; z: number; yaw: number; vel: THREE.Vector3; vy: number; steer: number; speed: number; len: number; tilt: THREE.Quaternion }
