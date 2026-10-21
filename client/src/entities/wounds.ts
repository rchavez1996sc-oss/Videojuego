import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg'];
const GEO = new THREE.SphereGeometry(6, 10, 8).scale(1, 1.3, 0.35);
let mat: THREE.Material | null = null;

/** Wet blood blot on the body surface nearest the hit, parented to that bone (rig space is centimetres). */
export function addWound(bones: Map<string, THREE.Bone>, at: THREE.Vector3, lighting: Lighting): void {
  let best: THREE.Bone | null = null, bestD = Infinity;
  for (const n of BONES) {
    const b = bones.get(`mixamorig${n}`), d = b ? b.getWorldPosition(new THREE.Vector3()).distanceToSquared(at) : Infinity;
    if (b && d < bestD) [best, bestD] = [b, d];
  }
  if (!best) return;
  const local = best.worldToLocal(at.clone());
  const r = /Spine|Hips/.test(best.name) ? 13 : best.name.endsWith('Head') ? 10.5 : 7;
  const n = local.clone().setY(0);
  if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
  n.normalize();
  const m = new THREE.Mesh(GEO, (mat ??= lighting.setup(new THREE.MeshStandardMaterial({ color: '#4a0705', roughness: 0.3, metalness: 0.1 }), 'wound')));
  m.position.set(n.x * r, THREE.MathUtils.clamp(local.y, -4, 30), n.z * r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  m.scale.setScalar(0.7 + Math.random() * 0.6);
  best.add(m);
}
