import * as THREE from 'three';
import type { Rig } from '../entities/rig';

/** The car body's box in the group's own space (models carry `userData.body`; others measured once and cached). */
export function bodyBox(group: THREE.Object3D): THREE.Box3 {
  if (group.userData.body && !(group.userData.body as THREE.Box3).isEmpty()) return group.userData.body;
  const [p, q] = [group.position.clone(), group.quaternion.clone()];
  group.position.set(0, 0, 0);
  group.quaternion.identity();
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  group.position.copy(p);
  group.quaternion.copy(q);
  group.updateMatrixWorld(true);
  return (group.userData.body = box);
}

const SPLIT: [string, number][] = [['mixamorigSpine', 0.2], ['mixamorigSpine1', 0.3], ['mixamorigSpine2', 0.25], ['mixamorigNeck', 0.15], ['mixamorigHead', 0.1]];
const W = new THREE.Vector3(), Q = new THREE.Quaternion(), P = new THREE.Quaternion();

/**
 * Ducking under the roof while getting in or out: after the clip has posed the body each frame, if the head is over the
 * car (or in the door opening) and higher than the roof line, the back and neck bend forward just enough to pass under
 * it (searched on the head's arc about the lower back), eased in and out so it reads as a stoop, not a snap.
 * Returns the hook to put on `Rig.post`.
 */
export function duckUnderRoof(rig: Rig, car: THREE.Object3D): (dt: number) => void {
  const box = bodyBox(car), roof = box.max.y - 0.16, bones = SPLIT.map(([n, w]) => [rig.bones.get(n), w] as const).filter(([b]) => b);
  const head = rig.bones.get('mixamorigHead'), base = rig.bones.get('mixamorigSpine');
  let bend = 0;
  return (dt) => {
    if (!head || !base) return;
    rig.root.updateMatrixWorld(true);
    const h = head.getWorldPosition(new THREE.Vector3()), pivot = base.getWorldPosition(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.bones.get('mixamorigHips')!.getWorldQuaternion(Q)).setY(0).normalize();
    const axis = new THREE.Vector3(0, 1, 0).cross(fwd).negate().normalize();
    let want = 0;
    search: for (let a = 0; a <= 1.2; a += 0.05) {
      let best: number | null = null, bx = Infinity;
      for (const sign of [1, -1]) {
        const l = car.worldToLocal(h.clone().sub(pivot).applyAxisAngle(axis, a * sign).add(pivot));
        const over = Math.abs(l.x) < box.max.x + 0.3 && l.z > box.min.z && l.z < box.max.z;
        if ((!over || l.y < roof) && Math.abs(l.x) < bx) [best, bx] = [a * sign, Math.abs(l.x)];
      }
      if (best !== null) {
        want = best;
        break search;
      }
      const down = (sign: number) => car.worldToLocal(h.clone().sub(pivot).applyAxisAngle(axis, a * sign).add(pivot)).y;
      want = down(1) <= down(-1) ? a : -a;
    }
    bend = THREE.MathUtils.damp(bend, want * 1.15, Math.abs(want) * 1.15 > Math.abs(bend) ? 14 : 5, dt);
    if (Math.abs(bend) < 0.005) return;
    for (const [b, w] of bones) {
      b!.parent!.getWorldQuaternion(P);
      Q.setFromAxisAngle(W.copy(axis), bend * w);
      b!.quaternion.premultiply(P.clone().invert().multiply(Q).multiply(P));
      b!.updateMatrixWorld(true);
    }
    const l = car.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
    if (Math.abs(l.x) < box.max.x - 0.15 && l.z > box.min.z && l.z < box.max.z && l.y > roof) {
      rig.root.position.y -= Math.min(0.45, l.y - roof);
      rig.root.updateMatrixWorld(true);
    }
  };
}
