import * as THREE from 'three';
import { toFloat } from '../render/floatGeometry';
import { damageMesh, crackGlass } from './carDamage';

/**
 * Crumples a vehicle's bodywork where it was hit: vertices near the impact point move into the body (deepest at the
 * point, fading out over `radius`, with a little crease noise), normals are recomputed. Each mesh gets its own float
 * copy of the geometry the first time (models share theirs); occupants, glass panes and small parts are left alone.
 */
/** Deepest any point of the bodywork can be pushed in from its original shape (m), however many hits it takes. */
const MAX_CRUSH = 0.28;
const R = new THREE.Vector3();

export function dent(group: THREE.Object3D, at: THREE.Vector3, depth: number, radius = 0.5 + depth * 2): void {
  group.updateMatrixWorld(true);
  const centre = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3()), into = centre.sub(at).setY(0).normalize();
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || m.name === 'rider' || (m.material as THREE.Material).transparent) return;
    let p: THREE.Object3D | null = m;
    while (p && p !== group) if ((p = p.parent)?.name === 'rider') return;
    if (m.geometry.attributes.position.count >= 60) meshes.push(m);
  });
  for (const m of meshes) {
    if (!m.userData.dentable) {
      [m.geometry, m.userData.dentable] = [toFloat(m.geometry), true];
      m.userData.rest = (m.geometry.attributes.position.array as Float32Array).slice();
    }
    const rest = m.userData.rest as Float32Array;
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), p = at.clone().applyMatrix4(inv);
    const s = new THREE.Vector3().setFromMatrixScale(m.matrixWorld), k = 3 / (s.x + s.y + s.z), r = radius * k;
    const maxD = MAX_CRUSH * k, dir = into.clone().transformDirection(inv).multiplyScalar(depth * k), pos = m.geometry.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    damageMesh(m, p, r * 1.15, Math.min(0.9, Math.max(0.3, depth * 3)));
    let moved = false;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const d = v.distanceTo(p);
      if (d >= r) continue;
      const w = (1 - d / r) ** 2 * (0.9 + 0.2 * Math.sin(v.x * 9 + v.y * 7 + v.z * 11));
      v.addScaledVector(dir, w);
      R.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
      if (v.distanceTo(R) > maxD) v.sub(R).setLength(maxD).add(R);
      pos.setXYZ(i, v.x, v.y, v.z);
      moved = true;
    }
    if (!moved) continue;
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.boundingSphere = null;
  }
  if (depth > 0.12) crackGlass(group, at, 0.6 + depth * 3);
}
