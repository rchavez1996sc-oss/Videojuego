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
  return { data: btoa(s), info: `missing ${[...missing].join(' ')} | ${size.toArray().map((v) => (v * k).toFixed(2)).join(' × ')} m, ${g.attributes.position.count / 3} tris` };
}

Object.assign(window, { prop, ready: true });

/**
 * A kit cut out of a whole scene (Sketchfab DAE with absolute texture paths): the nodes whose name matches `anchor`
 * and every mesh within `reach` m of them, minus `drop`; textures looked up by file name in `texDir`. Exported with
 * its materials and textures, base at y 0, centred on the anchors; plus a preview render.
 */
async function kit(url: string, texDir: string, anchor: string, reach: number, drop: string, dropMat = '^$'): Promise<{ data: string; info: string; preview: string }> {
  const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier((u) => (/\.(png|jpe?g)$/i.test(u) && !u.startsWith('data:') ? `${texDir}${decodeURIComponent(u).split(/[\\/]/).pop()}` : u));
  const root = (await new ColladaLoader(mgr).loadAsync(url)).scene;
  await new Promise((r) => setTimeout(r, 1500));
  root.updateMatrixWorld(true);
  const anchors = new THREE.Box3(), a = new RegExp(anchor, 'i'), d = new RegExp(drop, 'i');
  root.traverse((o) => a.test(o.name) && anchors.expandByObject(o));
  const zone = anchors.clone().expandByScalar(reach), out = new THREE.Group(), names: string[] = [], byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let p: THREE.Object3D | null = m, name = '';
    while (p && !name) (name = p.name), (p = p.parent);
    if (d.test(name) || d.test(m.parent?.name ?? '') || !zone.intersectsBox(new THREE.Box3().setFromObject(m))) return;
    const mats = ([] as THREE.Material[]).concat(m.material), dm = new RegExp(dropMat, 'i');
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(), groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex ?? 0];
      if (!mat || dm.test(mat.name)) continue;
      const part = new THREE.BufferGeometry();
      for (const [k, at] of Object.entries(g.attributes)) if (['position', 'normal', 'uv'].includes(k)) part.setAttribute(k, new THREE.BufferAttribute((at.array as Float32Array).slice(gr.start * at.itemSize, (gr.start + gr.count) * at.itemSize), at.itemSize));
      if (!part.attributes.uv) part.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gr.count * 2), 2));
      if (!part.attributes.normal) part.computeVertexNormals();
      part.applyMatrix4(m.matrixWorld);
      (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(part);
    }
    names.push(m.parent?.name || name);
  });
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos)!, mat);
    mesh.name = mat.name || 'part';
    out.add(mesh);
  }
  const missing = new Set<string>();
  for (const m of out.children) for (const mat of ([] as THREE.Material[]).concat((m as THREE.Mesh).material)) {
    const r = mat as unknown as Record<string, THREE.Texture | null>;
    for (const k of ['map', 'normalMap', 'emissiveMap', 'specularMap', 'bumpMap', 'alphaMap', 'lightMap', 'aoMap']) {
      const t = r[k];
      if (t && !(t.image && (t.image as HTMLImageElement).width)) (missing.add(`${mat.name}.${k}`), (r[k] = null));
    }
  }
  const box = new THREE.Box3().setFromObject(out), c = anchors.getCenter(new THREE.Vector3());
  for (const m of out.children) (m as THREE.Mesh).geometry.translate(-c.x, -box.min.y, -c.z);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 2, 0.1, 100), r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
  r.setSize(1024, 512);
  scene.background = new THREE.Color('#9aa4ad');
  const sun = new THREE.DirectionalLight('#fff', 2);
  sun.position.set(3, 6, 4);
  scene.add(out, new THREE.AmbientLight('#fff', 1.6), sun);
  const size = box.getSize(new THREE.Vector3());
  cam.position.set(size.x * 0.9 + 2, size.y * 0.9 + 1, size.z * 1.4 + 3);
  cam.lookAt(0, size.y * 0.35, 0);
  r.render(scene, cam);
  const preview = r.domElement.toDataURL('image/jpeg', 0.85);
  const buf = (await new GLTFExporter().parseAsync(out, { binary: true })) as ArrayBuffer;
  let s = '';
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return { data: btoa(s), preview, info: `missing ${[...missing].join(' ')} | ${size.toArray().map((v) => v.toFixed(2)).join(' × ')} m: ${[...new Set(names.map((n) => n.replace(/\.\d+$/, '')))].join(', ')}` };
}

Object.assign(window, { kit });
