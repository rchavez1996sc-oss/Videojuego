import * as THREE from 'three';
import type { Vehicle, Victim } from './traffic';
import { unblamed } from './blame';

/** Bodies inside the bumper's sweep this frame take damage from speed and how square the hit is, and are thrown at about the bumper's speed. */
export function runInto(v: Vehicle, dt: number, now: number, near: Victim[], hitT: Map<string, number>): void {
  if (v.speed < 2.5) return;
  const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)), right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  for (const t of near) {
    if (!t.alive()) continue;
    const rel = new THREE.Vector3(t.pos.x - v.x, 0, t.pos.z - v.z);
    const along = rel.dot(fwd), lat = rel.dot(right);
    if (Math.abs(lat) > 1.3 || along < -v.len / 2 - 0.3 || along > v.len / 2 + 0.45 + v.speed * dt) continue;
    if ((hitT.get(t.key) ?? -9) > now - 1.2) continue;
    hitT.set(t.key, now);
    const square = along > v.len / 2 - 0.6 ? 1 - Math.min(1, Math.abs(lat) / 1.3) * 0.5 : 0.35;
    const damage = Math.min(75, (v.speed - 2) * 5.5) * square;
    const shove = fwd.clone().multiplyScalar(v.speed * 0.95 * square).addScaledVector(right, Math.sign(lat || 1) * (0.8 + v.speed * 0.15));
    unblamed(() => t.hurt(damage, new THREE.Vector3(v.x, t.pos.y + 0.8, v.z), shove));
    if (square > 0.6) v.speed *= 0.6;
  }
}
