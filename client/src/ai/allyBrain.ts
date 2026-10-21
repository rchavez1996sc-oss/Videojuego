import * as THREE from 'three';
import type { Enemy } from '../entities/enemy';
import { goTo, type AIContext } from './brain';

export interface Ally { unit: Enemy; name: string; slot: number; target: Enemy | null; downedT: number; lost: boolean }

export interface AllyContext {
  leader: THREE.Vector3;
  leaderYaw: number;
  leaderAlive: boolean;
  foes: Enemy[];
  visible(from: Enemy, target: Enemy): boolean;
  groundY(x: number, z: number): number;
  route: AIContext['route'];
}

/** Formation offsets in the leader's frame (+z is behind). */
const SLOTS: [number, number][] = [[-2.4, 3.5], [2.4, 3.5], [-3.4, 7.5], [3.4, 7.5]];
const UP = new THREE.Vector3(0, 1, 0);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function slotPosition(i: number, leader: THREE.Vector3, yaw: number, groundY: AllyContext['groundY']): THREE.Vector3 {
  const [x, z] = SLOTS[i % SLOTS.length];
  const p = new THREE.Vector3(x, 0, z).applyAxisAngle(UP, yaw).add(leader);
  p.y = groundY(p.x, p.z);
  return p;
}

function pickTarget(a: Ally, ctx: AllyContext): Enemy | null {
  const u = a.unit;
  if (a.target?.alive && a.target.position.distanceTo(u.position) < u.def.sight && ctx.visible(u, a.target)) return a.target;
  return ctx.foes
    .filter((f) => f.alive && f.position.distanceTo(u.position) < u.def.sight)
    .sort((p, q) => p.position.distanceToSquared(u.position) - q.position.distanceToSquared(u.position))
    .slice(0, 5)
    .find((f) => ctx.visible(u, f)) ?? null;
}

/** Follows the leader in formation; engages visible enemies but never strays far from the squad. */
export function allyThink(a: Ally, ctx: AllyContext, dt: number): void {
  const u = a.unit;
  u.stateT += dt;
  u.thinkT -= dt;
  if (u.thinkT > 0) return;
  u.thinkT = 0.25;
  a.target = pickTarget(a, ctx);
  u.canSee = !!a.target;
  if (u.canSee && u.state !== 'combat') {
    u.state = 'combat';
    u.stateT = 0;
    u.pauseT = u.def.reaction * rand(0.7, 1.3);
  } else if (!u.canSee && u.state === 'combat' && u.stateT > 3) {
    u.state = 'patrol';
    u.stateT = 0;
  }
  if (!ctx.leaderAlive) return;
  const slot = slotPosition(a.slot, ctx.leader, ctx.leaderYaw, ctx.groundY);
  const d = Math.hypot(slot.x - u.position.x, slot.z - u.position.z);
  const engaged = u.state === 'combat';
  if (d > (engaged ? 14 : 3.5)) {
    if (!u.moveTarget || u.moveTarget.distanceTo(slot) > 3) goTo(u, ctx, slot, d > 8 || engaged);
  } else if (engaged || d < 1.2) {
    u.moveTarget = null;
    u.path = [];
  }
  u.crouched = engaged && !u.moveTarget && a.slot % 2 === 0;
}

/** Per-frame aim and trigger; true when a round should be fired. */
export function allyAct(a: Ally, ctx: AllyContext, dt: number): boolean {
  const u = a.unit;
  if (u.state === 'combat' && a.target) {
    u.faceTowards(a.target.position, dt, 9);
    if (u.pauseT > 0) {
      u.pauseT -= dt;
      if (u.pauseT <= 0) u.burstLeft = Math.round(rand(u.def.burst[0], u.def.burst[1]));
      return false;
    }
    if (u.burstLeft <= 0) {
      u.pauseT = rand(u.def.burstPause[0], u.def.burstPause[1]);
      return false;
    }
    u.fireCooldown -= dt;
    if (u.fireCooldown > 0) return false;
    u.fireCooldown = 60 / u.def.rpm;
    u.burstLeft--;
    return true;
  }
  if (u.moveTarget) u.faceVelocity(dt);
  else u.faceTowards(ctx.leader.clone().add(new THREE.Vector3(-Math.sin(ctx.leaderYaw), 0, -Math.cos(ctx.leaderYaw)).multiplyScalar(30)), dt, 3);
  return false;
}
