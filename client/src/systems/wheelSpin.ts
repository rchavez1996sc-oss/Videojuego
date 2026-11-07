import * as THREE from 'three';

const q = new THREE.Quaternion(), s = new THREE.Quaternion();

/**
 * Rolls a vehicle's wheels by `roll` metres travelled and turns the front ones by `steer` rad about the body's up axis (same sense as its yaw):
 * each wheel keeps its rest pose and its own rolled angle, so steering never piles onto the spin.
 */
export function turnWheels(group: THREE.Object3D, roll: number, steer: number): void {
  const wheels = group.userData.wheels as THREE.Object3D[] | undefined;
  if (!wheels?.length) return;
  const axis = group.userData.spinAxis as THREE.Vector3, r = (group.userData.wheelR as number) || 0.3;
  const up = (group.userData.upAxis ??= new THREE.Vector3(0, 1, 0).applyQuaternion(wheels[0].parent!.quaternion.clone().invert())) as THREE.Vector3;
  for (const w of wheels) {
    const d = w.userData;
    d.rest ??= w.quaternion.clone();
    d.front ??= w.position.clone().applyQuaternion(w.parent!.quaternion).z > 0;
    d.angle = ((d.angle ?? 0) + roll / r) % (Math.PI * 2);
    s.setFromAxisAngle(axis, d.angle);
    w.quaternion.copy(d.rest).premultiply(s);
    if (d.front && steer) w.quaternion.premultiply(q.setFromAxisAngle(up, steer));
  }
}

/**
 * Wheels of a vehicle about to be moved from where its group is to (`x`, `z`, `yaw`): rolled by the distance along
 * the heading, front ones steered to the angle that gives this turn over `base` (wheelbase), smoothed.
 */
export function rollAlong(group: THREE.Object3D, x: number, z: number, yaw: number, base: number): void {
  const u = group.userData, roll = (x - group.position.x) * Math.sin(yaw) + (z - group.position.z) * Math.cos(yaw);
  const last = u.lastYaw ?? yaw, turn = Math.atan2(Math.sin(yaw - last), Math.cos(yaw - last));
  u.lastYaw = yaw;
  if (Math.abs(roll) > 3) return;
  const want = Math.abs(roll) > 1e-3 ? THREE.MathUtils.clamp(Math.atan((turn * base) / roll), -0.6, 0.6) : (u.steer ?? 0);
  u.steer = THREE.MathUtils.lerp(u.steer ?? 0, want, 0.25);
  turnWheels(group, roll, u.steer);
}

/**
 * Model wheels follow their own spring (the driven car): each takes the drop of the nearest mount, so on a tilted body
 * or a kerb the wheel stays on the ground instead of sinking into it or floating.
 */
export function suspendWheels(group: THREE.Object3D, mounts: THREE.Vector3[], drops: number[]): void {
  const wheels = group.userData.wheels as THREE.Object3D[] | undefined;
  if (!wheels?.length || !mounts.length) return;
  for (const w of wheels) {
    const u = w.userData;
    if (u.base === undefined) {
      u.base = w.position.clone();
      group.updateMatrixWorld(true);
      const at = group.worldToLocal(w.getWorldPosition(new THREE.Vector3()));
      u.mount = mounts.reduce((best, m, i) => (Math.hypot(m.x - at.x, m.z - at.z) < Math.hypot(mounts[best].x - at.x, mounts[best].z - at.z) ? i : best), 0);
    }
    w.position.copy(u.base);
    w.position.y -= drops[u.mount] / (w.parent!.scale.y || 1);
  }
}
