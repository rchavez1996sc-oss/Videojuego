import * as THREE from 'three';
import type { Traffic, Vehicle } from './traffic';

let last: Vehicle | undefined;

/** Test hook: disables the nearest driving vehicle and reports where it is. */
export function disableNearest(tr: Traffic, p: THREE.Vector3, kind?: string): string {
  const v = tr.list.filter((o) => o.state === 'drive' && (!kind || o.kind === kind)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (!v) return 'none';
  last = v;
  tr.damage(v, 1e4);
  return `${v.x.toFixed(0)},${v.z.toFixed(1)} speed ${v.speed.toFixed(1)}`;
}

/** Test hook: a spot `gap` metres in front of the fastest driving vehicle, in its lane. */
export function spotAhead(tr: Traffic, gap: number): THREE.Vector3 | null {
  const v = tr.list.filter((o) => o.state === 'drive').sort((a, b) => b.speed - a.speed)[0];
  return v ? new THREE.Vector3(v.x + v.dir * (v.len / 2 + gap), 0, v.z) : null;
}

export const lastDisabled = (): string => (last ? `${last.x.toFixed(1)},${last.z.toFixed(1)},${last.yaw.toFixed(2)}` : '');
export const states = (tr: Traffic): string => tr.list.map((v) => `${v.state[0]}@${v.x.toFixed(0)},${v.z.toFixed(1)}`).join(' ');
