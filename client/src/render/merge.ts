import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collapses every mesh under each "bone" (an animated node) into one mesh per material,
 * expressed in that bone's local space. Nodes that are not meshes (sockets) are kept.
 */
export function mergeRig(root: THREE.Object3D, bones: Set<THREE.Object3D>, shared?: THREE.MeshStandardMaterial): void {
  root.updateMatrixWorld(true);
  for (const bone of bones) {
    const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert();
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const meshes: THREE.Mesh[] = [];
    const walk = (o: THREE.Object3D) => {
      for (const c of [...o.children]) {
        if (bones.has(c)) continue;
        if (c instanceof THREE.Mesh) {
          const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
          let mat = c.material as THREE.Material;
          if (shared && mat instanceof THREE.MeshStandardMaterial && !mat.map && mat.metalness < 0.5) {
            const col = mat.color, n = g.attributes.position.count, arr = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) arr.set([col.r, col.g, col.b], i * 3);
            g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
            mat = shared;
          }
          const list = byMat.get(mat) ?? [];
          list.push(g);
          byMat.set(mat, list);
          meshes.push(c);
        }
        walk(c);
      }
    };
    walk(bone);
    for (const m of meshes) {
      for (const child of [...m.children]) {
        child.applyMatrix4(m.matrix);
        m.parent!.add(child);
      }
      m.removeFromParent();
    }
    for (const [mat, geos] of byMat) {
      const merged = new THREE.Mesh(mergeGeometries(geos), mat);
      merged.castShadow = merged.receiveShadow = true;
      bone.add(merged);
    }
  }
}

/** Whole rig in its current pose as one vertex-coloured mesh (for distance LOD). */
export function bakeLod(root: THREE.Object3D, material: THREE.Material): THREE.Mesh {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const geos: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!g.attributes.color) {
      const col = (o.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0.3, 0.3, 0.3);
      const n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([col.r, col.g, col.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    geos.push(g);
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), material);
  mesh.castShadow = true;
  return mesh;
}
