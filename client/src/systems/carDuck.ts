import * as THREE from 'three';
import type { Rig } from '../entities/rig';

/** The car body's box in the group's own space (models carry `userData.body`; others measured once and cached). */
function bodyBox(group: THREE.Object3D): THREE.Box3 {
  if (group.userData.body) return group.userData.body;
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
    for (let a = 0; a <= 1.2; a += 0.05) {
      const p = h.clone().sub(pivot).applyAxisAngle(axis, a).add(pivot), l = car.worldToLocal(p.clone());
      const over = Math.abs(l.x) < box.max.x + 0.3 && l.z > box.min.z && l.z < box.max.z;
      want = a;
      if (!over || l.y < roof) break;
    }
    bend = THREE.MathUtils.damp(bend, want * 1.15, want * 1.15 > bend ? 14 : 5, dt);
    if (bend < 0.005) return;
    for (const [b, w] of bones) {
      b!.parent!.getWorldQuaternion(P);
      Q.setFromAxisAngle(W.copy(axis), bend * w);
      b!.quaternion.premultiply(P.clone().invert().multiply(Q).multiply(P));
      b!.updateMatrixWorld(true);
    }
  };
}
