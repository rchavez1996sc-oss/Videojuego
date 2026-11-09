import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Enemies } from './enemies';

const W = new THREE.Vector3(), H = new THREE.Vector3(), P = new THREE.Vector3();
const PARTS = ['Hips', 'Spine2', 'Head', 'LeftLeg', 'RightLeg', 'LeftUpLeg', 'RightUpLeg'];

/**
 * A driven car's wheel rolling over a body lying in the road (fallen police): the wheel is kicked up at that corner
 * (a jolt that pitches/rolls the car, larger with speed) and the car loses a little speed. Once per wheel and body
 * every 0.5 s. Returns the strength of the worst bump this frame (0 when none) for the sound and camera.
 */
export function bumpOverBodies(body: RAPIER.RigidBody, group: THREE.Object3D, mounts: THREE.Vector3[], mass: number, speed: number, enemies: Enemies, clock: number, last: Map<string, number>): number {
  if (speed < 1) return 0;
  let worst = 0;
  for (const e of enemies.list) {
    if (e.alive) continue;
    const bones = PARTS.map((n) => e.model.bones.get(`mixamorig${n}`)).filter((b): b is THREE.Bone => !!b);
    if (!bones.length || bones[0].getWorldPosition(H).distanceToSquared(group.position) > 25) continue;
    mounts.forEach((m, i) => {
      group.localToWorld(W.copy(m));
      if (!bones.some((b) => (b.getWorldPosition(P), Math.hypot(W.x - P.x, W.z - P.z) < 0.35 && Math.abs(W.y - P.y) < 1.2))) return;
      const key = `${e.id}:${i}`;
      if ((last.get(key) ?? -9) > clock - 0.5) return;
      last.set(key, clock);
      const k = Math.min(0.6, speed * 0.055);
      body.applyImpulseAtPoint({ x: 0, y: mass * k, z: 0 }, { x: W.x, y: W.y, z: W.z }, true);
      const l = body.linvel();
      body.setLinvel({ x: l.x * 0.97, y: l.y, z: l.z * 0.97 }, true);
      worst = Math.max(worst, k);
    });
  }
  return worst;
}
