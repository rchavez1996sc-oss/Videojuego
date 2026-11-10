import * as THREE from 'three';
import type { Traffic, Vehicle } from './traffic';
import { MASS, push } from './vehicleBody';
import { unblamed } from './blame';
import { HP } from './traffic';
import { wearStage } from './vehicleWear';
import { dent } from '../fx/dents';

const grade = new WeakMap<Vehicle, number>();
const fuse = new WeakMap<Vehicle, number>();
const CHAR = new THREE.MeshStandardMaterial({ color: '#1b1917', roughness: 0.95, metalness: 0.1 });

/** Each new wear grade bends the body a little more somewhere (deeper the worse it gets), so the 10 grades show. */
function bend(v: Vehicle, s: number): void {
  const side = Math.random() < 0.5 ? -1 : 1, along = (Math.random() - 0.5) * v.len * 0.8, w = v.kind === 'micro' ? 1.15 : 0.85;
  const f = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)), r = new THREE.Vector3(f.z, 0, -f.x);
  const at = new THREE.Vector3(v.x, (v.y ?? 0) + 0.55 + Math.random() * 0.4, v.z).addScaledVector(f, along).addScaledVector(r, side * w);
  dent(v.group, at, Math.min(0.2, 0.012 * s + 0.01), 0.25 + s * 0.02);
}

/**
 * Called each frame per vehicle: a new grade adds a dent; from grade 10 (on fire) 70 % of vehicles get a 4–8 s fuse and
 * then blow up (`boom`). A wreck that skipped grade 10 in one big hit counts too.
 */
export function burnTick(v: Vehicle, now: number, boom: (v: Vehicle) => void): void {
  if (v.burst || v.state === 'off') return;
  const s = wearStage(v), was = grade.get(v) ?? 0;
  if (s > was && s <= 10 && v.group.visible) for (let k = was + 1; k <= s; k++) bend(v, k);
  grade.set(v, s);
  if (s < 10) return;
  if (!fuse.has(v)) fuse.set(v, Math.random() < 0.7 ? now + 4 + Math.random() * 4 : Infinity);
  if (now >= fuse.get(v)!) boom(v);
}

/** What is left after the blast: the whole body charred black. */
export function charBody(v: Vehicle): void {
  v.burst = true;
  v.hp = Math.min(v.hp, -HP);
  v.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !('isInstancedMesh' in o)) (o as THREE.Mesh).material = CHAR;
  });
}

/** The fuel tank goes: occupants die (not the player's fault), the car is thrown up, charred, and the blast goes off. */
export function explodeVehicle(t: Traffic, v: Vehicle, ground: number): void {
  const at = new THREE.Vector3(v.x, (v.y ?? ground) + 0.8, v.z), crewed = v.hp > 0 && v.seats.some((s) => s.visible);
  charBody(v);
  unblamed(() => {
    if (crewed) t.disabled(v);
    v.seats.forEach((s) => (s.visible = false));
    if (v.state !== 'player') t.knock(v);
    if (v.state !== 'player' && v.state !== 'tumble') v.state = 'wreck';
    push(v, new THREE.Vector3((Math.random() - 0.5) * 2, 6, (Math.random() - 0.5) * 2).multiplyScalar(MASS[v.kind] ?? 1300), at.clone().add(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)));
    t.onBurst(at);
  });
}
