import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rig } from '../../entities/rig';

const TURNS = [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4];

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
  for (const turn of TURNS) {
    const dir = f.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.8, z: p.z }, dir), 1.6, true, undefined, undefined, f.col);
    if (hit) continue;
    f.dir.lerp(dir, Math.min(1, dt * 6)).normalize();
    p.addScaledVector(f.dir, f.speed * dt);
    break;
  }
  const down = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 1.2, z: p.z }, { x: 0, y: -1, z: 0 }), 3, true, undefined, undefined, f.col);
  if (down) p.y += (p.y + 1.2 - down.timeOfImpact - p.y) * Math.min(1, dt * 12);
  f.rig.root.rotation.y = Math.atan2(f.dir.x, f.dir.z);
  f.col.setTranslation({ x: p.x, y: p.y + 0.9, z: p.z });
  f.rig.tick(dt * f.speed / 3.9);
  return true;
}
