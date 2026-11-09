import * as THREE from 'three';
import { twoBoneIk } from './handIk';
import type { Rig } from './rig';

const X = new THREE.Vector3(1, 0, 0), PQ = new THREE.Quaternion(), D = new THREE.Quaternion();

function lean(bone: THREE.Object3D, angle: number): void {
  bone.parent!.getWorldQuaternion(PQ);
  D.setFromAxisAngle(X, angle);
  bone.quaternion.premultiply(PQ.clone().invert().multiply(D).multiply(PQ));
  bone.updateMatrixWorld(true);
}

/**
 * A `seatedRig` holder (hips at its origin, facing +z, not yet added to the bike) turned into a motorcycle rider:
 * the chair pose, torso leaning forward, both hands on the handlebar grips and both feet on the pegs (two-bone IK),
 * then frozen — the pose is absolute, so the clip must not tick over it. `hipY` = hip height above the ground.
 */
export function rideBike(holder: THREE.Group, hipY: number): void {
  const rig = holder.userData.rig as Rig, b = (n: string) => rig.bones.get(`mixamorig${n}`)!;
  if (!b('Spine') || !b('LeftHand') || !b('LeftFoot')) return;
  rig.loop('sit');
  rig.tick(0.01);
  rig.tick = () => {};
  holder.userData.bike = true;
  holder.updateMatrixWorld(true);
  lean(b('Spine'), 0.22);
  lean(b('Spine1'), 0.08);
  lean(b('Head'), -0.22);
  for (const [s, side] of [['Left', 1], ['Right', -1]] as const) {
    twoBoneIk(b(`${s}Arm`), b(`${s}ForeArm`), b(`${s}Hand`), holder.localToWorld(new THREE.Vector3(0.3 * side, 0.16, 0.38)), 1);
    b(`${s}ForeArm`).updateMatrixWorld(true);
    twoBoneIk(b(`${s}UpLeg`), b(`${s}Leg`), b(`${s}Foot`), holder.localToWorld(new THREE.Vector3(0.19 * side, 0.33 - hipY, 0.12)), 1);
    b(`${s}Leg`).updateMatrixWorld(true);
  }
}
