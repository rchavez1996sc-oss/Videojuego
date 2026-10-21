import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { characters } from '../render/characters';

export const DEATHS = ['death_front', 'death_back', 'fall_back', 'dying', 'death_right', 'death_head'];
const BODY = 0.9, UP = new THREE.Vector3(0, 1, 0);
const travel = new Map<string, THREE.Vector3>();

/** Where the hips end up at the end of a death clip, in metres of model space. */
function hipsTravel(key: string): THREE.Vector3 {
  let t = travel.get(key);
  if (!t) {
    const track = characters.clips.get(key)?.tracks.find((k) => k.name === 'mixamorigHips.position');
    const v = track?.values, n = v ? v.length : 0;
    t = v && n >= 6 ? new THREE.Vector3(v[n - 3] - v[0], 0, v[n - 1] - v[2]).multiplyScalar(0.01) : new THREE.Vector3();
    travel.set(key, t);
  }
  return t;
}

/**
 * Picks a death clip whose fall has room (preferred ones first), so a body never ends up through a wall;
 * if nothing fits, also returns how far to slide the body back from the obstacle.
 */
export function pickDeath(world: RAPIER.World, feet: THREE.Vector3, yaw: number, preferred: string[], exclude: number): { key: string; shift: THREE.Vector3 } {
  const origin = { x: feet.x, y: feet.y + 0.45, z: feet.z };
  let best = { key: preferred[0], shift: new THREE.Vector3(), short: Infinity };
  for (const key of [...preferred, ...DEATHS.filter((d) => !preferred.includes(d))]) {
    const off = hipsTravel(key).clone().applyAxisAngle(UP, yaw + Math.PI), len = off.length();
    if (len < 0.05) return { key, shift: new THREE.Vector3() };
    const dir = off.divideScalar(len), need = len + BODY;
    const hit = world.castRay(new RAPIER.Ray(origin, dir), need, true, undefined, undefined, undefined, undefined, (c) => c.handle !== exclude && c.isEnabled());
    if (!hit) return { key, shift: new THREE.Vector3() };
    const short = need - hit.timeOfImpact;
    if (short < best.short) best = { key, shift: dir.multiplyScalar(-short), short };
  }
  return { key: best.key, shift: best.shift };
}
