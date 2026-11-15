import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Vehicle } from './traffic';
import { contactOf } from './vehicleBody';
import { dent } from '../fx/dents';
import { shotMode } from '../core/settings';
import { CrashMeter, crashHardness, occupantInjury, shellDamage, type CrashEvent } from './crashModel';

const meters = new WeakMap<Vehicle, CrashMeter>();

export interface ImpactOut { event: CrashEvent; at: THREE.Vector3 | null; damage: number; injury: number; hard: number }

/**
 * One step of a rigid-body vehicle's crash bookkeeping: detects discrete impacts (see `CrashMeter`), dents the shell
 * where it touched (deeper for harder hits, capped), and returns the hit points it loses, the injury to whoever sits
 * in it and how loud it was — or null. Small knocks (< ~4 m/s) only dent a little and cost nothing.
 */
export function vehicleImpact(world: RAPIER.World, v: Vehicle, dt: number): ImpactOut | null {
  let m = meters.get(v);
  if (!m) meters.set(v, (m = new CrashMeter()));
  const lv = v.body.linvel(), e = m.update(new THREE.Vector3(lv.x, lv.y, lv.z), dt, v.yaw);
  if (!e) return null;
  const c = contactOf(world, v.collider), at = c?.at ?? null;
  if (shotMode) ((window as unknown as { __crashes?: unknown[] }).__crashes ??= []).push({ kind: v.kind, dv: +e.dv.toFixed(1), side: +e.side.toFixed(2), face: e.face });
  if (at && e.dv > 3.5) dent(v.group, at, Math.min(0.32, (e.dv - 3) * 0.035));
  return { event: e, at, damage: shellDamage(v.kind, e), injury: occupantInjury(v.kind, e), hard: crashHardness(e) };
}

/** Speed at which the shell grinds along something (contact with anything but the ground under the wheels), m/s. */
export function scrapeSpeed(world: RAPIER.World, v: Vehicle, ignore: (c: RAPIER.Collider) => boolean): number {
  let touching = false;
  world.contactPairsWith(v.collider, (o) => {
    if (touching || o.isSensor() || ignore(o)) return;
    world.contactPair(v.collider, o, (mf) => { if (mf.numSolverContacts() > 0) touching = true; });
  });
  if (!touching) return 0;
  const lv = v.body.linvel();
  return Math.hypot(lv.x, lv.z);
}
