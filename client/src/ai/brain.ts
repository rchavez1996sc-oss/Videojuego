import * as THREE from 'three';
import type { Enemy } from '../entities/enemy';
import type { CoverIndex } from './cover';
import { difficulty } from '../core/difficulty';

export interface AIContext {
  time: number;
  playerFeet: THREE.Vector3;
  playerChest: THREE.Vector3;
  playerConcealment: number;
  /** True when nothing but the player blocks the segment. */
  sees(from: THREE.Vector3, to: THREE.Vector3, self: number): boolean;
  /** True when the segment is blocked by world geometry. */
  blocked(from: THREE.Vector3, to: THREE.Vector3, self: number): boolean;
  groundY(x: number, z: number): number;
  cover: CoverIndex;
  alertNearby(e: Enemy): void;
  /** Street corners leading to `to` when the straight walk is blocked; empty if the way is clear. */
  route(from: THREE.Vector3, to: THREE.Vector3, self: number): THREE.Vector3[];
}

/** Sets a destination, routing along the streets when buildings are in the way. */
export function goTo(e: Enemy, ctx: Pick<AIContext, 'route'>, to: THREE.Vector3, run: boolean): void {
  e.moveTarget = to;
  e.running = run;
  e.path = ctx.route(e.position, to, e.handle);
}

const THINK = 0.2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function eye(e: Enemy, standing = false): THREE.Vector3 {
  return e.position.clone().setY(e.position.y + (standing ? 1.62 : e.eyeY));
}

function perceive(e: Enemy, ctx: AIContext): void {
  const to = ctx.playerChest.clone().sub(eye(e));
  const dist = to.length();
  e.canSee = false;
  if (dist > e.def.sight) return;
  const fwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
  const angle = THREE.MathUtils.radToDeg(fwd.angleTo(to.clone().setY(0)));
  const fov = e.state === 'combat' ? 300 : e.awareness > 0.4 ? 200 : e.def.fov;
  if (angle > fov / 2 && dist > 4) return;
  if (!ctx.sees(eye(e), ctx.playerChest, e.handle)) return;
  e.canSee = true;
  const vis = ctx.playerConcealment * Math.max(0.15, 1 - dist / e.def.sight);
  e.awareness += dist < 10 ? 1 : (THINK * vis * 2.2) / (e.def.reaction * difficulty.value.reaction);
  if (e.awareness >= 0.6) {
    e.lastKnown.copy(ctx.playerFeet);
    e.lastSeenT = ctx.time;
  }
}

function setState(e: Enemy, s: Enemy['state'], ctx: AIContext): void {
  if (e.state === s) return;
  e.state = s;
  e.stateT = 0;
  if (s === 'combat') {
    e.engaged = true;
    e.burstLeft = 0;
    e.pauseT = e.def.reaction * difficulty.value.reaction * rand(0.7, 1.3);
    ctx.alertNearby(e);
  }
}

function pickCover(e: Enemy, ctx: AIContext, preferred: number, radius = 30, anchor = e.position): boolean {
  const threat = e.lastKnown.clone().setY(e.lastKnown.y + 1.3);
  for (const c of ctx.cover.candidates(anchor, threat, radius, preferred, e.id)) {
    const spot = c.pos.clone().setY(ctx.groundY(c.pos.x, c.pos.z));
    if (!ctx.blocked(spot.clone().setY(spot.y + 1.0), threat, e.handle)) continue;
    if (e.cover) e.cover.owner = -1;
    c.owner = e.id;
    e.cover = c;
    goTo(e, ctx, spot, true);
    return true;
  }
  return false;
}

function coverCompromised(e: Enemy, ctx: AIContext): boolean {
  if (!e.cover) return true;
  const spot = e.cover.pos.clone().setY(ctx.groundY(e.cover.pos.x, e.cover.pos.z) + 1.0);
  return !ctx.blocked(spot, ctx.playerChest, e.handle);
}

function thinkCombat(e: Enemy, ctx: AIContext): void {
  const unseen = ctx.time - e.lastSeenT;
  if (e.isStatic) return;
  const lowHp = e.hp < e.def.hp * 0.35;
  if (lowHp && e.stateT > 1 && (!e.cover || e.cover.pos.distanceTo(e.lastKnown) < 40)) {
    pickCover(e, ctx, 60, 45);
    return;
  }
  if (!e.moveTarget && coverCompromised(e, ctx) && !pickCover(e, ctx, e.def.preferredRange)) {
    const away = e.position.clone().sub(e.lastKnown).setY(0).normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(Math.random() < 0.5 ? -6 : 6);
    goTo(e, ctx, e.lastKnown.clone().addScaledVector(away, e.def.preferredRange).add(side), true);
  }
  if (unseen > 2.5 && !e.moveTarget) hunt(e, ctx);
}

/** Closes in on the last known position cover-to-cover, sometimes swinging wide to flank; searches around it on arrival. */
function hunt(e: Enemy, ctx: AIContext): void {
  const toPlayer = e.lastKnown.clone().sub(e.position).setY(0);
  const dist = toPlayer.length();
  if (dist < 6) {
    goTo(e, ctx, e.lastKnown.clone().add(new THREE.Vector3(rand(-14, 14), 0, rand(-14, 14))), false);
    return;
  }
  if (dist > 60) {
    goTo(e, ctx, e.position.clone().addScaledVector(toPlayer.normalize(), Math.min(70, dist - 35)), true);
    return;
  }
  const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize().multiplyScalar(Math.random() < 0.5 ? -1 : 1);
  const flank = Math.random() < 0.35;
  const anchor = flank ? e.lastKnown.clone().addScaledVector(side, Math.min(25, dist * 0.6)) : e.position.clone().addScaledVector(toPlayer.normalize(), Math.min(32, dist * 0.6));
  if (pickCover(e, ctx, flank ? 16 : 12, 22, anchor)) return;
  goTo(e, ctx, anchor.add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3))), true);
}

export function think(e: Enemy, ctx: AIContext, dt: number): void {
  e.stateT += dt;
  e.thinkT -= dt;
  if (e.thinkT > 0) return;
  e.thinkT = THINK;
  perceive(e, ctx);
  if (e.state !== 'combat') e.awareness = Math.max(0, e.awareness - (e.canSee ? 0 : 0.012));
  if (e.awareness >= 1 && e.state !== 'combat') setState(e, 'combat', ctx);
  else if (e.awareness >= 0.35 && e.state === 'patrol') setState(e, 'alert', ctx);

  if (e.state === 'combat') thinkCombat(e, ctx);
  else if (e.state === 'alert') {
    e.crouched = false;
    if (e.moveTarget && e.moveTarget.distanceTo(e.lastKnown) > 20) {
      e.moveTarget = null;
      e.path = [];
    }
    if (!e.isStatic && !e.moveTarget && e.position.distanceTo(e.lastKnown) > 3) {
      goTo(e, ctx, e.lastKnown.clone().add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4))), e.awareness > 0.7);
    }
    if (!e.isStatic && !e.moveTarget && e.position.distanceTo(e.lastKnown) <= 3) {
      goTo(e, ctx, e.lastKnown.clone().add(new THREE.Vector3(rand(-12, 12), 0, rand(-12, 12))), false);
    }
    if (e.engaged && e.stateT > 4) setState(e, 'combat', ctx);
    else if (!e.engaged && e.stateT > 25) {
      e.awareness = 0.2;
      setState(e, 'patrol', ctx);
    }
  } else if (e.patrol.length > 1 && !e.moveTarget) {
    e.patrolIndex = (e.patrolIndex + 1) % e.patrol.length;
    goTo(e, ctx, e.patrol[e.patrolIndex].clone(), false);
  }
}

/** Per-frame aim/fire control; returns true when a round should be fired this frame. */
export function act(e: Enemy, ctx: AIContext, dt: number): boolean {
  if (e.state === 'combat') {
    const atCover = !!e.cover && !e.moveTarget;
    e.faceTowards(e.canSee ? ctx.playerFeet : e.lastKnown, dt, 9);
    if (e.pauseT > 0) {
      e.pauseT -= dt;
      e.crouched = atCover;
      if (e.pauseT <= 0) e.burstLeft = Math.round(rand(e.def.burst[0], e.def.burst[1]));
      return false;
    }
    if (atCover) e.crouched = !ctx.sees(eye(e, true), ctx.playerChest, e.handle) ? true : false;
    if (!e.canSee || e.burstLeft <= 0) {
      if (e.burstLeft <= 0) e.pauseT = rand(e.def.burstPause[0], e.def.burstPause[1]);
      return false;
    }
    e.fireCooldown -= dt;
    if (e.fireCooldown > 0) return false;
    e.fireCooldown = 60 / e.def.rpm;
    e.burstLeft--;
    return true;
  }
  if (e.state === 'alert') e.faceTowards(e.lastKnown, dt, 3);
  else if (e.moveTarget) e.faceVelocity(dt);
  else e.yaw += Math.sin(ctx.time * 0.4 + e.id) * dt * 0.3;
  return false;
}
