import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Lot } from './houses';
import { buildLadder } from './ladders';

const FLOOR = 2.7;

/** A flat roof as an axis-aligned rectangle (houses face ±z) with its walking height. */
interface Roof { x0: number; x1: number; z0: number; z1: number; top: number }

/** Roofs of the city houses, registered as they are built; `rooftopLinks` joins them. */
export const roofs: Roof[] = [];

export function addRoof(lot: Lot, floors: number): number {
  const back = lot.z + (lot.facing === 0 ? -lot.d : lot.d);
  roofs.push({ x0: lot.x - lot.w / 2, x1: lot.x + lot.w / 2, z0: Math.min(lot.z, back), z1: Math.max(lot.z, back), top: lot.y + floors * FLOOR });
  return floors;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => [Math.max(a0, b0), Math.min(a1, b1)];

/**
 * A rooftop route across the barrio: where two touching roofs differ by a floor or two, a steel ladder on the taller
 * wall (climbable like the others); where a passage or back alley separates roofs of the same height, a scaffold plank
 * (with a second board on some) bridges it. Only some of each, so routes exist without every roof being linked.
 */
export function rooftopLinks(b: Builder, rand: () => number): void {
  const list = roofs.splice(0);
  const q = (yaw: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], c = list[j];
    for (const axis of ['x', 'z'] as const) {
      const [lo, hi] = axis === 'x' ? (a.x1 <= c.x0 + 0.3 ? [a, c] : c.x1 <= a.x0 + 0.3 ? [c, a] : [null, null]) : a.z1 <= c.z0 + 0.3 ? [a, c] : c.z1 <= a.z0 + 0.3 ? [c, a] : [null, null];
      if (!lo || !hi) continue;
      const gap = axis === 'x' ? hi.x0 - lo.x1 : hi.z0 - lo.z1;
      const [s0, s1] = axis === 'x' ? overlap(lo.z0, lo.z1, hi.z0, hi.z1) : overlap(lo.x0, lo.x1, hi.x0, hi.x1);
      if (s1 - s0 < 1.6) continue;
      const mid = s0 + 0.8 + rand() * (s1 - s0 - 1.6), edge = axis === 'x' ? lo.x1 + gap / 2 : lo.z1 + gap / 2;
      const dh = hi.top - lo.top;
      if (gap < 0.35 && Math.abs(dh) > 2 && Math.abs(dh) < 6 && rand() < 0.45) {
        const [low, high] = dh > 0 ? [lo, hi] : [hi, lo], away = (low === lo ? -1 : 1) * 0.3;
        const base = axis === 'x' ? new THREE.Vector3(edge + away, low.top, mid) : new THREE.Vector3(mid, low.top, edge + away);
        buildLadder(b, base, high.top, axis === 'x' ? new THREE.Vector3(Math.sign(away), 0, 0) : new THREE.Vector3(0, 0, Math.sign(away)));
      } else if (gap > 1.2 && gap < 3.6 && Math.abs(dh) < 0.35 && rand() < 0.4) {
        const len = gap + 1.2, y = Math.max(lo.top, hi.top) + 0.03, rot = q(axis === 'x' ? Math.PI / 2 : 0);
        const at = (o: number) => (axis === 'x' ? new THREE.Vector3(edge, y, mid + o) : new THREE.Vector3(mid + o, y, edge));
        b.box('desk', [0.32, 0.05, len], at(0), rot, true);
        if (rand() < 0.5) b.box('desk', [0.28, 0.05, len - 0.3], at(0.34), rot, true);
      }
    }
  }
}
