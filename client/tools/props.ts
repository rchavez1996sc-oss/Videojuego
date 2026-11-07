import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Small static props (Sketchfab FBX) → one mesh, base at y 0, centred, `height` m tall, geometry only (glb, base64). */
async function prop(url: string, height: number): Promise<{ data: string; info: string }> {
  const root = await new FBXLoader().loadAsync(url);
  root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    geos.push(g);
  });
  const g = mergeGeometries(geos)!, box = new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), k = height / size.y;
  g.translate(-c.x, -box.min.y, -c.z).scale(k, k, k);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  mesh.name = 'prop';
  const buf = (await new GLTFExporter().parseAsync(mesh, { binary: true })) as ArrayBuffer;
  let s = '';
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return { data: btoa(s), info: `${size.toArray().map((v) => (v * k).toFixed(2)).join(' × ')} m, ${g.attributes.position.count / 3} tris` };
}

Object.assign(window, { prop, ready: true });
