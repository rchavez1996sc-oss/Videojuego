import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { VEHICLE_SOLVER } from '../physics/groups';
import type { Vehicle } from './traffic';

/** Kerb masses (kg): what decides who comes off worse in a crash. */
export const MASS: Record<string, number> = { delivery: 180, moto: 420, tico: 760, beetle: 850, sedan: 1250, wagon: 1450, pickup: 1800, combi: 2100, micro: 8800 };

const UP = new THREE.Vector3(0, 1, 0), G = 9.81;

/**
 * Turns a vehicle's body into a real rigid body under gravity (being driven, or hit by one): its mass with the centre
 * of mass low in the box, CCD so it never tunnels, light damping; keeps `linvel` (m/s) as its starting velocity.
 */
export function makeDynamic(v: Vehicle, linvel?: THREE.Vector3): void {
  const b = v.body;
  if (b.isDynamic()) return;
  b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  b.enableCcd(true);
  b.setTranslation({ ...b.translation(), y: b.translation().y + 0.05 }, true);
  const box = v.collider.shape as RAPIER.Cuboid, clear = v.kind === 'micro' ? 0.45 : 0.32, top = box.halfExtents.y * 2;
  v.collider.setHalfExtents({ x: box.halfExtents.x, y: (top - clear) / 2, z: box.halfExtents.z });
  v.collider.setTranslationWrtParent({ x: 0, y: clear + (top - clear) / 2, z: 0 });
  const m = MASS[v.kind] ?? 1300, h = (v.collider.shape as RAPIER.Cuboid).halfExtents, [w, y, l] = [h.x * 2, h.y * 2, h.z * 2];
  v.collider.setMassProperties(m, { x: 0, y: -h.y * 0.45, z: 0 }, { x: (m / 12) * (y * y + l * l), y: (m / 12) * (w * w + l * l), z: (m / 12) * (w * w + y * y) }, { x: 0, y: 0, z: 0, w: 1 });
  v.collider.setSolverGroups(VEHICLE_SOLVER);
  v.collider.setFriction(0.7);
  v.collider.setRestitution(0.12);
  b.setLinearDamping(0.05);
  b.setAngularDamping(0.5);
  if (linvel) b.setLinvel(linvel, true);
  // A body just placed (kinematic, born at the origin unturned) carries the velocity of that jump: a parked car starts still.
  if (v.speed < 0.5) [b.setAngvel({ x: 0, y: 0, z: 0 }, true), linvel || b.setLinvel({ x: 0, y: 0, z: 0 }, true)];
  v.dyn = { prev: new THREE.Vector3().copy(b.linvel() as THREE.Vector3), still: 0 };
}

/** Pose of a physical vehicle back into its record: position (feet of the body), heading, tilt and speed. */
export function readBody(v: Vehicle): void {
  const t = v.body.translation(), r = v.body.rotation(), q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q), yaw = Math.atan2(f.x, f.z);
  Object.assign(v, { x: t.x, y: t.y, z: t.z, yaw, speed: new THREE.Vector3().copy(v.body.linvel() as THREE.Vector3).length() });
  v.tilt = new THREE.Quaternion().setFromAxisAngle(UP, yaw).invert().multiply(q);
}

/** Velocity change this step beyond gravity (m/s): how hard it hit something. */
export function jolt(v: Vehicle, dt: number): number {
  const now = new THREE.Vector3().copy(v.body.linvel() as THREE.Vector3), prev = v.dyn!.prev;
  const dv = now.clone().sub(prev).setY(now.y - prev.y + G * dt).length();
  prev.copy(now);
  return dv;
}

/** A world point where `col` touches something else (for dents), and that collider. */
export function contactOf(world: RAPIER.World, col: RAPIER.Collider): { at: THREE.Vector3; other: RAPIER.Collider } | null {
  let out: { at: THREE.Vector3; other: RAPIER.Collider } | null = null;
  world.contactPairsWith(col, (other) => {
    if (out || other.isSensor()) return;
    world.contactPair(col, other, (m) => {
      if (!out && m.numSolverContacts() > 0) out = { at: new THREE.Vector3().copy(m.solverContactPoint(0) as THREE.Vector3), other };
    });
  });
  return out;
}

/** Tipped over: the body's up axis more than ~55° off vertical. */
export function overturned(v: Vehicle): boolean {
  return !!v.tilt && new THREE.Vector3(0, 1, 0).applyQuaternion(v.tilt).y < 0.57;
}

/**
 * `v` (a rigid body) ran into `other`, still moved by script (infinite mass to the solver, so `v` stopped as against a
 * wall): `other` joins the physics and the collision is redone with real masses — a nearly plastic impulse along the
 * contact normal, from `v`'s velocity before the hit, given back to `v` and applied to `other` at the contact point
 * (so it spins). The lighter one gets the bigger velocity change. Returns the contact point.
 */
export function exchange(world: RAPIER.World, v: Vehicle, other: Vehicle, knock: (o: Vehicle) => void): THREE.Vector3 {
  let n: THREE.Vector3 | null = null, at: THREE.Vector3 | null = null;
  world.contactPair(v.collider, other.collider, (m, flipped) => {
    if (n) return;
    n = new THREE.Vector3().copy(m.normal() as THREE.Vector3).multiplyScalar(flipped ? -1 : 1);
    if (m.numSolverContacts()) at = new THREE.Vector3().copy(m.solverContactPoint(0) as THREE.Vector3);
  });
  const centre = new THREE.Vector3(other.x, (other.y ?? v.y ?? 0) + 0.8, other.z), mine = new THREE.Vector3(v.x, (v.y ?? 0) + 0.8, v.z);
  const dir: THREE.Vector3 = n ?? centre.clone().sub(mine).setY(0).normalize();
  const point: THREE.Vector3 = at ?? mine.clone().lerp(centre, 0.5);
  knock(other);
  const m1 = MASS[v.kind] ?? 1300, m2 = MASS[other.kind] ?? 1300, u1 = v.dyn!.prev.clone(), u2 = new THREE.Vector3().copy(other.body.linvel() as THREE.Vector3);
  const vr = u1.clone().sub(u2).dot(dir);
  if (vr <= 0) return point;
  const j = (1.15 * vr) / (1 / m1 + 1 / m2);
  v.body.setLinvel(u1.addScaledVector(dir, -j / m1), true);
  push(other, new THREE.Vector3(dir.x * j, dir.y * j + j * 0.08, dir.z * j), point);
  return point;
}

const MAX_V = 45, MAX_W = 5;

/**
 * Impulse `imp` (N·s) at `point` with the vehicle's real mass and box inertia, computed here: a body that just turned
 * dynamic still has Rapier's default-density mass for this step, and `applyImpulseAtPoint` launched it at ~400 m/s.
 */
export function push(o: Vehicle, imp: THREE.Vector3, point: THREE.Vector3): void {
  const b = o.body, m = MASS[o.kind] ?? 1300, h = (o.collider.shape as RAPIER.Cuboid).halfExtents, [w, y, l] = [h.x * 2, h.y * 2, h.z * 2];
  const v = new THREE.Vector3().copy(b.linvel() as THREE.Vector3).addScaledVector(imp, 1 / m);
  if (v.length() > MAX_V) v.setLength(MAX_V);
  b.setLinvel(v, true);
  const r = b.rotation(), q = new THREE.Quaternion(r.x, r.y, r.z, r.w), t = b.translation();
  const arm = point.clone().sub(new THREE.Vector3(t.x, t.y + 0.6, t.z)), tq = arm.cross(imp).applyQuaternion(q.clone().invert());
  tq.set(tq.x / ((m / 12) * (y * y + l * l)), tq.y / ((m / 12) * (w * w + l * l)), tq.z / ((m / 12) * (w * w + y * y))).applyQuaternion(q);
  const av = new THREE.Vector3().copy(b.angvel() as THREE.Vector3).add(tq);
  if (av.length() > MAX_W) av.setLength(MAX_W);
  b.setAngvel(av, true);
}

/** Never lost: a physical vehicle that sank under the terrain (tunnelled) is put back on top; runaway speed is capped. */
export function keepSane(v: Vehicle, ground: number): void {
  const b = v.body, t = b.translation(), lv = b.linvel();
  if (t.y < ground - 0.8) {
    b.setTranslation({ x: t.x, y: ground + 0.3, z: t.z }, true);
    b.setLinvel({ x: lv.x * 0.5, y: 0, z: lv.z * 0.5 }, true);
  } else if (Math.hypot(lv.x, lv.y, lv.z) > MAX_V) {
    const k = MAX_V / Math.hypot(lv.x, lv.y, lv.z);
    b.setLinvel({ x: lv.x * k, y: lv.y * k, z: lv.z * k }, true);
  }
}
