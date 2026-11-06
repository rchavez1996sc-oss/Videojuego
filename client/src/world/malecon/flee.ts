import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rig } from '../../entities/rig';
import { innocents } from '../../systems/blame';

/** Other bystanders never block a fleer (they'd jam in a running-on-the-spot knot): only walls, cars and armed men do. */
const solid = (c: RAPIER.Collider) => !innocents.has(c.handle);

const TURNS = [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4];
const BODY = new RAPIER.Ball(0.3), ROT = { x: 0, y: 0, z: 0, w: 1 };

/** Sweeps a body-wide ball at chest height along `dir` (thin poles and wall edges a centre ray would slip past). */
function blocked(world: RAPIER.World, p: THREE.Vector3, dir: THREE.Vector3, dist: number, self: RAPIER.Collider): boolean {
  return !!world.castShape({ x: p.x, y: p.y + 0.95, z: p.z }, ROT, { x: dir.x, y: 0, z: dir.z }, BODY, 0, dist, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, self, undefined, solid);
}

/** An extra that heard gunfire: it runs away from the shot, steering round whatever is ahead, then slips away out of sight. */
export interface Fleer { rig: Rig; col: RAPIER.Collider; dir: THREE.Vector3; speed: number; t: number }

export function startFlee(rig: Rig, col: RAPIER.Collider, from: THREE.Vector3, floor: number): Fleer {
  const p = rig.root.position, dir = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
  if (dir.lengthSq() < 0.01) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
  dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.9);
  rig.root.position.y = floor;
  rig.far = false;
  rig.loop('civ_run');
  return { rig, col, dir, speed: 3.4 + Math.random() * 1.2, t: 0 };
}

/** Advances one fleer; false once it has vanished (far enough, or behind the camera after a while). */
export function stepFlee(f: Fleer, dt: number, world: RAPIER.World, camera: THREE.Camera): boolean {
  const p = f.rig.root.position;
  f.t += dt;
  const toCam = p.clone().sub(camera.position), d = toCam.length();
  const behind = toCam.dot(camera.getWorldDirection(new THREE.Vector3())) < 0;
  if (d > 70 || (f.t > 6 && (d > 40 || behind)) || f.t > 16) {
    f.rig.root.visible = false;
    f.col.setEnabled(false);
    return false;
  }
  let moved = false;
  for (const turn of TURNS) {
    const dir = f.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    if (blocked(world, p, dir, 1.4, f.col)) continue;
    const step = f.speed * dt, eased = f.dir.clone().lerp(dir, Math.min(1, dt * 6)).normalize();
    f.dir.copy(blocked(world, p, eased, step + 0.1, f.col) ? dir : eased);
    p.addScaledVector(f.dir, step);
    moved = true;
    break;
  }
  if (!moved) f.dir.negate();
  const down = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 1.2, z: p.z }, { x: 0, y: -1, z: 0 }), 3, true, undefined, undefined, f.col);
  if (down) p.y += (p.y + 1.2 - down.timeOfImpact - p.y) * Math.min(1, dt * 12);
  f.rig.root.rotation.y = Math.atan2(f.dir.x, f.dir.z);
  f.col.setTranslation({ x: p.x, y: p.y + 0.9, z: p.z });
  if (moved) f.rig.tick(dt * f.speed / 3.9);
  return true;
}
