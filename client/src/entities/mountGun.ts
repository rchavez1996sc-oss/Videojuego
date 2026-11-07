import * as THREE from 'three';
import { buildWeapon, type GunModel } from '../weapons/gunModels';
import { bakeLod } from '../render/merge';
import { parts } from './clipParts';
import { calibrateGrip, type GripPose } from './handIk';
import type { Lighting } from '../render/lighting';

/** One weapon a character carries, parented to the right hand. */
export interface Arm { model: GunModel; weapon: THREE.Object3D; muzzle: THREE.Object3D; ejector: THREE.Object3D; grip?: GripPose }

/**
 * Builds `model` (merged into one mesh unless `detailed`) and, if `grip`, parents it to the right hand calibrated so
 * that in its aiming pose (`p_aim` for the pistol, `aim` otherwise) it points straight ahead, slightly towards the left hand.
 */
export function mountGun(mixer: THREE.AnimationMixer, body: THREE.Object3D, bones: Map<string, THREE.Bone>, lighting: Lighting, model: GunModel, detailed: boolean, grip: boolean): Arm {
  const built = buildWeapon(model, lighting);
  let weapon: THREE.Object3D = built.group;
  if (!detailed) {
    const merged = bakeLod(built.group, lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), `${model}-baked`));
    merged.add(built.muzzle, built.ejector, ...(built.support ? [built.support] : []));
    weapon = merged;
  }
  const arm: Arm = { model, weapon, muzzle: built.muzzle, ejector: built.ejector };
  if (!grip) return arm;
  const rightHand = bones.get('mixamorigRightHand')!, leftHand = bones.get('mixamorigLeftHand')!;
  const a = mixer.clipAction(parts(model === 'pistol' ? 'p_aim' : 'aim').full).play();
  mixer.update(0);
  body.updateMatrixWorld(true);
  const rh = rightHand.getWorldPosition(new THREE.Vector3()), lh = leftHand.getWorldPosition(new THREE.Vector3());
  const ahead = new THREE.Vector3(0, 0, 1).add(lh.clone().sub(rh).setY(0).normalize().multiplyScalar(0.15)).normalize();
  const look = new THREE.Matrix4().lookAt(rh.clone().add(ahead), rh, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(look);
  const pos = rh.clone().add(new THREE.Vector3(0.0, 0.04, 0.06).applyQuaternion(q));
  const world = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
  rightHand.matrixWorld.clone().invert().multiply(world).decompose(weapon.position, weapon.quaternion, weapon.scale);
  rightHand.add(weapon);
  arm.grip = built.support && calibrateGrip(weapon, leftHand, built.support);
  a.stop();
  return arm;
}
