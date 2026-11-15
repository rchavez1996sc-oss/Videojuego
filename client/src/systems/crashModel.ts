import * as THREE from 'three';

/** How much of a hit the shell absorbs (lower = sturdier) and how exposed the occupants are, per vehicle kind. */
const STURDY: Record<string, number> = { delivery: 1.35, moto: 1.25, tico: 1.15, beetle: 1.1, sedan: 1, wagon: 0.95, pickup: 0.85, combi: 0.9, micro: 0.55 };
const EXPOSED: Record<string, number> = { delivery: 2.4, moto: 1.7, tico: 1.2, beetle: 1.2, sedan: 1, wagon: 1, pickup: 0.9, combi: 0.95, micro: 0.6 };
const WINDOW = 0.18, START = 2.6, REARM = 1.6, GATHER = 0.2, G = 9.81;

export interface CrashEvent {
  /** Effective velocity change of the impact (m/s), landings and suspension bumps left out. */ dv: number;
  /** 0 = head-on / rear, 1 = flat on the side (no crumple zone). */ side: number;
  /** 1 front, -1 rear, 0 side. */ face: number;
}

/**
 * Turns the body's velocity history into discrete impacts: velocity change over a 180 ms window (a car crash pulse lasts ~0.1 s) (so a crash spread
 * over several physics steps counts once, and a one-step solver spike that reverts does not count), vertical change
 * only beyond a hard landing, capped by what is physically possible from the speed it had, and the peak of each
 * impact reported once.
 */
export class CrashMeter {
  private hist: { t: number; v: THREE.Vector3 }[] = [];
  private clock = 0;
  private peak = 0;
  private peakDir = new THREE.Vector3();
  private gatherT = -1;
  private armed = true;

  update(vel: THREE.Vector3, dt: number, yaw: number): CrashEvent | null {
    this.clock += dt;
    this.hist.push({ t: this.clock, v: vel.clone() });
    while (this.hist.length > 2 && this.clock - this.hist[1].t >= WINDOW) this.hist.shift();
    const old = this.hist[0], span = this.clock - old.t;
    const d = vel.clone().sub(old.v), dh = Math.hypot(d.x, d.z), dvert = Math.max(0, Math.abs(d.y + G * span) - 5);
    const before = old.v.length(), s = Math.min(Math.hypot(dh, dvert), before * 1.3 + 2);
    if (this.armed && s > START && this.gatherT < 0) [this.gatherT, this.peak] = [0, 0];
    if (this.gatherT >= 0) {
      if (s > this.peak) [this.peak, this.peakDir] = [s, d.clone().setY(0)];
      if ((this.gatherT += dt) >= GATHER) {
        this.gatherT = -1;
        this.armed = false;
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), n = this.peakDir.lengthSq() > 1e-6 ? this.peakDir.normalize() : fwd.clone().negate();
        const along = -n.dot(fwd);
        return { dv: this.peak, side: 1 - Math.abs(along), face: along > 0.6 ? 1 : along < -0.6 ? -1 : 0 };
      }
    } else if (!this.armed && s < REARM) this.armed = true;
    return null;
  }
}

/** Hit points the vehicle loses: nothing for parking knocks, a dent at town speed, wrecked only by a big hit. */
export function shellDamage(kind: string, e: CrashEvent): number {
  return Math.max(0, e.dv - 3.5) ** 1.35 * 1.5 * (STURDY[kind] ?? 1) * (1 + 0.25 * e.side);
}

/** Injury to the driver: none below ~30 km/h of velocity change, then rising fast; side hits and bikes far worse. */
export function occupantInjury(kind: string, e: CrashEvent): number {
  return Math.max(0, e.dv - 9) ** 1.5 * 1.1 * (EXPOSED[kind] ?? 1) * (e.face < 0 ? 0.7 : 1 + 0.45 * e.side);
}

/** 0..1 loudness/size of the crash sound for an event. */
export const crashHardness = (e: CrashEvent): number => Math.min(1, (e.dv - 2) / 16);
