import * as THREE from 'three';

/** Handling per vehicle kind: acceleration (m/s²), top speed (m/s), wheelbase (m), half width (m), roof height (m). */
export interface Spec { acc: number; top: number; base: number; half: number; height: number; small?: boolean }
export const SPECS: Record<string, Spec> = {
  moto: { acc: 5.5, top: 15, base: 1.6, half: 0.75, height: 1.9, small: true },
  delivery: { acc: 7, top: 19, base: 1.3, half: 0.4, height: 1.6, small: true },
  tico: { acc: 5, top: 21, base: 2.2, half: 0.75, height: 1.5 },
  sedan: { acc: 6.5, top: 27, base: 2.6, half: 0.9, height: 1.5 },
  beetle: { acc: 4.8, top: 22, base: 2.4, half: 0.8, height: 1.5 },
  wagon: { acc: 6, top: 25, base: 2.7, half: 0.9, height: 1.6 },
  pickup: { acc: 6, top: 25, base: 3.0, half: 0.95, height: 1.9 },
  combi: { acc: 4.3, top: 21, base: 2.6, half: 0.9, height: 2.1 },
  micro: { acc: 3.2, top: 17, base: 4.6, half: 1.15, height: 2.9 },
};

export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean }

/** Body state of the driven vehicle (x, z, yaw shared with the traffic record; velocity kept separately for drifting). */
export interface CarState { x: number; y: number; z: number; yaw: number; vel: THREE.Vector3; vy: number; steer: number; speed: number; len: number; tilt: THREE.Quaternion }
