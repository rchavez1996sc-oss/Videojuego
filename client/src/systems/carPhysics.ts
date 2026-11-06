import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

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

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Arcade bicycle model: throttle/brake/reverse on the speed along the heading, speed-sensitive steering, grip that
 * pulls the velocity onto the heading (low on the handbrake → drifts). The box is swept against the world (people
 * excluded: they are run over, not walls) and slides off walls; floor height and body pitch/roll come from four rays
 * under the corners; kerbs up to 0.45 m are climbed, higher steps stop the car, drops make it fall.
 * Returns the impact speed when it hit something this step (0 otherwise).
 */
export function stepCar(world: RAPIER.World, c: CarState, sp: Spec, u: Controls, dt: number, self: RAPIER.Collider, skip: (h: number) => boolean): number {
  const fwd = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
  let speed = c.speed;
  if (u.throttle > 0) speed += (speed < -0.3 ? 14 : sp.acc * (1 - Math.max(0, speed) / sp.top * 0.65)) * u.throttle * dt;
  if (u.brake > 0) speed -= (speed > 0.3 ? 14 : sp.acc * 0.6) * u.brake * dt;
  if (u.handbrake) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 7 * dt);
  if (!u.throttle && !u.brake) speed -= Math.sign(speed) * Math.min(Math.abs(speed), (0.8 + Math.abs(speed) * 0.05) * dt);
  speed = THREE.MathUtils.clamp(speed, -sp.top * 0.3, sp.top);
  c.steer = THREE.MathUtils.damp(c.steer, u.steer * 0.6 / (1 + Math.abs(speed) / 11), 6, dt);
  const yawRate = (speed * Math.tan(c.steer)) / sp.base * (u.handbrake ? 1.5 : 1);
  c.yaw += yawRate * dt;
  fwd.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
  const grip = u.handbrake ? 1.4 : Math.abs(speed) > 14 ? 5 : 9;
  c.vel.lerp(fwd.clone().multiplyScalar(speed), 1 - Math.exp(-grip * dt));
  c.speed = speed;

  const move = c.vel.clone().multiplyScalar(dt), len = move.length();
  const q = new THREE.Quaternion().setFromAxisAngle(UP, c.yaw), box = new RAPIER.Cuboid(sp.half, sp.height * 0.32, c.len / 2);
  const centre = { x: c.x, y: c.y + sp.height * 0.32 + 0.35, z: c.z };
  const filter = (col: RAPIER.Collider) => col.handle !== self.handle && !skip(col.handle) && col.isEnabled();
  const walls = (col: RAPIER.Collider) => filter(col) && col.shapeType() !== RAPIER.ShapeType.HeightField;
  let impact = 0;
  if (len > 1e-4) {
    const hit = world.castShape(centre, q, { x: move.x / dt, y: 0, z: move.z / dt }, box, 0, dt, false, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, self, undefined, walls);
    if (hit) {
      const n = new THREE.Vector3(hit.normal1.x, 0, hit.normal1.z);
      if (n.lengthSq() < 1e-4) n.copy(c.vel).negate();
      n.normalize();
      const into = -c.vel.dot(n);
      if (into > 0) {
        impact = into;
        c.vel.addScaledVector(n, into * 1.25).multiplyScalar(into > 6 ? 0.55 : 0.85);
        c.speed = c.vel.dot(fwd);
      }
      move.multiplyScalar(Math.max(0, hit.time_of_impact / dt - 0.05));
    }
  }
  const nx = c.x + move.x, nz = c.z + move.z;
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x), half = c.len * 0.38;
  const probe = (a: number, s: number) => {
    const px = nx + fwd.x * a + right.x * s, pz = nz + fwd.z * a + right.z * s;
    const r = world.castRay(new RAPIER.Ray({ x: px, y: c.y + 1.4, z: pz }, { x: 0, y: -1, z: 0 }), 6, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, self, undefined, filter);
    return r ? c.y + 1.4 - r.timeOfImpact : -Infinity;
  };
  const f = probe(half, 0), b = probe(-half, 0), l = probe(0, -sp.half * 0.8), r = probe(0, sp.half * 0.8);
  const floor = Math.max((f + b) / 2, (l + r) / 2, Math.min(f, b, l, r));
  if (Number.isFinite(floor) && floor > c.y + 0.45 && c.vy <= 0) {
    impact = Math.max(impact, Math.abs(c.speed));
    c.vel.multiplyScalar(-0.2);
    c.speed = c.vel.dot(fwd);
    return impact;
  }
  c.x = nx;
  c.z = nz;
  if (!Number.isFinite(floor) || floor < c.y - 0.08) {
    c.vy -= 9.8 * dt;
    c.y += c.vy * dt;
    if (Number.isFinite(floor) && c.y < floor) [c.y, c.vy] = [floor, 0];
  } else [c.y, c.vy] = [THREE.MathUtils.damp(c.y, floor, 18, dt), 0];
  const pitch = Number.isFinite(f + b) ? -Math.atan2(f - b, half * 2) : 0, roll = Number.isFinite(l + r) ? Math.atan2(l - r, sp.half * 1.6) : 0;
  const lean = THREE.MathUtils.clamp(yawRate * c.speed * 0.006, -0.06, 0.06), squat = THREE.MathUtils.clamp(-(u.throttle - u.brake) * 0.012, -0.02, 0.02);
  c.tilt.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.clamp(pitch, -0.4, 0.4) + squat, 0, THREE.MathUtils.clamp(roll, -0.3, 0.3) + lean)), 1 - Math.exp(-10 * dt));
  return impact;
}
