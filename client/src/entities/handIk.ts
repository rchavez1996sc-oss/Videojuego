import * as THREE from 'three';

const v = () => new THREE.Vector3();
const [A, B, C, T, AX0, AX1] = [v(), v(), v(), v(), v(), v()];
const [QA, QB, QP, R0, R1, R2, Q0, Q1] = Array.from({ length: 8 }, () => new THREE.Quaternion());
const clampAcos = (x: number) => Math.acos(THREE.MathUtils.clamp(x, -1, 1));

/** Rotates `bone` by the world-space rotation `r` (given its world rotation `world` before the change). */
function turn(bone: THREE.Object3D, world: THREE.Quaternion, r: THREE.Quaternion): void {
  bone.quaternion.multiply(QP.copy(world).invert().multiply(r).multiply(world));
}

/**
 * Analytic two-bone IK (shoulder `a`, elbow `b`, wrist `c`) pulling the wrist to `target`, blended in by `weight`.
 * Keeps the current bend plane, so the elbow stays where the animation had it pointing. Matrices must be current.
 */
export function twoBoneIk(a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D, target: THREE.Vector3, weight: number): void {
  if (weight <= 0.001) return;
  a.getWorldPosition(A); b.getWorldPosition(B); c.getWorldPosition(C);
  a.getWorldQuaternion(QA); b.getWorldQuaternion(QB);
  const lab = A.distanceTo(B), lcb = B.distanceTo(C), lat = THREE.MathUtils.clamp(T.copy(target).sub(A).length(), 0.01, lab + lcb - 1e-4);
  const ca = C.clone().sub(A).normalize(), ba = B.clone().sub(A).normalize(), ab = A.clone().sub(B).normalize(), cb = C.clone().sub(B).normalize(), ta = T.copy(target).sub(A).normalize();
  const acab0 = clampAcos(ca.dot(ba)), babc0 = clampAcos(ab.dot(cb)), acat0 = clampAcos(ca.dot(ta));
  const acab1 = clampAcos((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat)), babc1 = clampAcos((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb));
  AX0.crossVectors(ca, ba);
  if (AX0.lengthSq() < 1e-8) return;
  AX0.normalize();
  AX1.crossVectors(ca, ta);
  R0.setFromAxisAngle(AX0, acab1 - acab0);
  R1.setFromAxisAngle(AX0, babc1 - babc0);
  if (AX1.lengthSq() > 1e-8) R2.setFromAxisAngle(AX1.normalize(), acat0);
  else R2.identity();
  Q0.copy(a.quaternion); Q1.copy(b.quaternion);
  turn(b, QB, R1);
  turn(a, QA, R2.multiply(R0));
  a.quaternion.copy(Q0.slerp(a.quaternion, weight));
  b.quaternion.copy(Q1.slerp(b.quaternion, weight));
}

const RH = v(), LEFT = v(), DOWN = new THREE.Vector3(0, -1, 0);

/** Pistol support hand: the left wrist pulled beside and just under the right one so both hands close round the grip. */
export function supportHand(bones: Map<string, THREE.Bone>, model: THREE.Object3D, weight: number): void {
  const arm = bones.get('mixamorigLeftArm'), fore = bones.get('mixamorigLeftForeArm'), hand = bones.get('mixamorigLeftHand'), right = bones.get('mixamorigRightHand');
  if (!arm || !fore || !hand || !right || weight <= 0.001) return;
  model.updateMatrixWorld(true);
  right.getWorldPosition(RH);
  LEFT.setFromMatrixColumn(model.matrixWorld, 0).normalize();
  twoBoneIk(arm, fore, hand, RH.addScaledVector(LEFT, 0.05).addScaledVector(DOWN, 0.035), weight);
}
