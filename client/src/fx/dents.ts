import * as THREE from 'three';
import { toFloat } from '../render/floatGeometry';

/**
 * Crumples a vehicle's bodywork where it was hit: vertices near the impact point move into the body (deepest at the
 * point, fading out over `radius`, with a little crease noise), normals are recomputed. Each mesh gets its own float
 * copy of the geometry the first time (models share theirs); occupants, glass panes and small parts are left alone.
 */
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
    if (!m.userData.dentable) [m.geometry, m.userData.dentable] = [toFloat(m.geometry), true];
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), p = at.clone().applyMatrix4(inv);
    const s = new THREE.Vector3().setFromMatrixScale(m.matrixWorld), k = 3 / (s.x + s.y + s.z), r = radius * k;
    const dir = into.clone().transformDirection(inv).multiplyScalar(depth * k), pos = m.geometry.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    let moved = false;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const d = v.distanceTo(p);
      if (d >= r) continue;
      const w = (1 - d / r) ** 2 * (0.8 + 0.4 * Math.sin(v.x * 37 + v.y * 23 + v.z * 41));
      pos.setXYZ(i, v.x + dir.x * w, v.y + dir.y * w, v.z + dir.z * w);
      moved = true;
    }
    if (!moved) continue;
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.boundingSphere = null;
  }
}
