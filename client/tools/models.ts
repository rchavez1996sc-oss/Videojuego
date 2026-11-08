import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** One static model to convert (see scripts/models.mjs). */
interface Plan { uScale?: number; cut?: number; key: string; url: string; tex?: string; texDir?: string; maps?: Record<string, string>; height?: number; scale?: number; rotX?: number; rotY?: number; drop?: string; keep?: string; tint?: Record<string, string> }

async function load(p: Plan): Promise<THREE.Object3D> {
  const url = p.url, dir = url.slice(0, url.lastIndexOf('/') + 1), mgr = new THREE.LoadingManager();
  if (p.texDir) mgr.setURLModifier((u) => (/\.(png|jpe?g|tga)$/i.test(u) && !u.startsWith('data:') ? `${p.texDir}${decodeURIComponent(u).split(/[\\/]/).pop()}` : u));
  if (/\.fbx$/i.test(url)) return new FBXLoader(mgr).loadAsync(url);
  if (/\.dae$/i.test(url)) return (await new ColladaLoader(mgr).loadAsync(url)).scene;
  if (/\.obj$/i.test(url)) {
    const obj = new OBJLoader();
    const mtl = url.replace(/\.obj$/i, '.mtl');
    const ok = await fetch(mtl).then((r) => r.ok).catch(() => false);
    if (ok) obj.setMaterials(await new MTLLoader().setPath(dir).loadAsync(mtl.slice(dir.length)).then((m) => (m.preload(), m)));
    return obj.loadAsync(url);
  }
  return (await new GLTFLoader().loadAsync(url)).scene;
}

const img = (url: string) => new Promise<HTMLImageElement>((ok, no) => Object.assign(new Image(), { onload: function (this: HTMLImageElement) { ok(this); }, onerror: no, src: url }));

/** A texture redrawn at ≤ `n` px as JPEG (or PNG with alpha), so the glb stays small. */
function shrink(t: THREE.Texture | null, n = 1024, alpha = false): THREE.Texture | null {
  const src = t?.image as (HTMLImageElement & { width: number; height: number }) | undefined;
  if (!src || !src.width) return null;
  const s = Math.min(1, n / Math.max(src.width, src.height)), cv = Object.assign(document.createElement('canvas'), { width: Math.max(4, Math.round(src.width * s)), height: Math.max(4, Math.round(src.height * s)) });
  cv.getContext('2d')!.drawImage(src as CanvasImageSource, 0, 0, cv.width, cv.height);
  return Object.assign(new THREE.CanvasTexture(cv), { flipY: t!.flipY, colorSpace: THREE.SRGBColorSpace, wrapS: t!.wrapS, wrapT: t!.wrapT, userData: { mimeType: alpha ? 'image/png' : 'image/jpeg' } });
}

async function convert(p: Plan): Promise<{ data: string; info: string; preview: string }> {
  const root = await load(p);
  await new Promise((r) => setTimeout(r, 1200));
  root.rotation.set(p.rotX ?? 0, p.rotY ?? 0, 0);
  root.updateMatrixWorld(true);
  const fallback = p.tex ? new THREE.Texture(await img(p.tex)) : null;
  if (fallback) fallback.needsUpdate = true;
  const extra = new Map<string, THREE.Texture>();
  for (const [re, u] of Object.entries(p.maps ?? {})) {
    const t = new THREE.Texture(await img(u));
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    extra.set(re, t);
  }
  const drop = p.drop ? new RegExp(p.drop, 'i') : null, keep = p.keep ? new RegExp(p.keep, 'i') : null;
  const byMat = new Map<string, { mat: THREE.MeshStandardMaterial; geos: THREE.BufferGeometry[] }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (drop && drop.test(m.name)) || (keep && !keep.test(m.name) && !keep.test(m.parent?.name ?? ''))) return;
    const mats = ([] as THREE.Material[]).concat(m.material), g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    const groups = g.groups.length && mats.length > 1 ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const src = mats[gr.materialIndex ?? 0] as THREE.MeshStandardMaterial & THREE.MeshPhongMaterial;
      if (!src || (drop && drop.test(src.name))) continue;
      const part = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'uv']) {
        const a = g.attributes[k];
        if (a) part.setAttribute(k, new THREE.BufferAttribute((a.array as Float32Array).slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
      }
      if (!part.attributes.uv) part.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gr.count * 2), 2));
      else if (p.uScale) { const uv = part.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * p.uScale); }
      if (!part.attributes.normal) part.computeVertexNormals();
      part.applyMatrix4(m.matrixWorld);
      const id = src.name || src.uuid;
      if (!byMat.has(id)) {
        const given = [...extra.entries()].find(([re]) => new RegExp(re, 'i').test(id))?.[1];
        const map = shrink(given ?? ((src.map?.image as { width?: number } | undefined)?.width ? src.map : fallback) ?? null, 1024, !!src.transparent && src.alphaTest > 0);
        const tint = Object.entries(p.tint ?? {}).find(([re]) => new RegExp(re, 'i').test(id))?.[1];
        const mat = new THREE.MeshStandardMaterial({ name: id.replace(/[^\w-]+/g, '_'), map, color: tint ? new THREE.Color(tint) : map ? new THREE.Color('#ffffff') : src.color?.clone() ?? new THREE.Color('#999'), roughness: 0.85, metalness: 0, transparent: !!src.transparent && !!map && src.alphaTest > 0, alphaTest: src.alphaTest || 0, side: THREE.DoubleSide });
        byMat.set(id, { mat, geos: [] });
      }
      byMat.get(id)!.geos.push(part);
    }
  });
  const out = new THREE.Group();
  for (const { mat, geos } of byMat.values()) {
    const all = mergeGeometries(geos)!;
    all.deleteAttribute('normal');
    const g = mergeVertices(all, 1e-4);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = mat.name;
    out.add(mesh);
  }
  let box = new THREE.Box3().setFromObject(out);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = p.height ? p.height / size.y : p.scale ?? 1;
  for (const m of out.children) (m as THREE.Mesh).geometry.translate(-c.x, -box.min.y, -c.z).scale(k, k, k);
  if (p.cut) for (const m of out.children) {
    const g = (m as THREE.Mesh).geometry, pos = g.attributes.position, idx = g.index!.array, keep: number[] = [];
    for (let i = 0; i < idx.length; i += 3) if (Math.max(pos.getY(idx[i]), pos.getY(idx[i + 1]), pos.getY(idx[i + 2])) > p.cut) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    g.setIndex(keep);
  }
  box = new THREE.Box3().setFromObject(out);
  const s2 = box.getSize(new THREE.Vector3());
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 2, 0.05, 500), r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true });
  r.setSize(1024, 512);
  scene.background = new THREE.Color('#9aa4ad');
  const sun = new THREE.DirectionalLight('#fff', 2);
  sun.position.set(3, 6, 4);
  scene.add(out, new THREE.AmbientLight('#fff', 1.8), sun);
  const d = Math.max(s2.x, s2.y, s2.z);
  cam.position.set(d * 0.9, s2.y * 0.6 + d * 0.35, d * 1.5);
  cam.lookAt(0, s2.y * 0.45, 0);
  r.render(scene, cam);
  const preview = r.domElement.toDataURL('image/jpeg', 0.85);
  const tris = out.children.reduce((n, m) => n + (m as THREE.Mesh).geometry.attributes.position.count / 3, 0);
  const buf = (await new GLTFExporter().parseAsync(out, { binary: true })) as ArrayBuffer;
  let str = '';
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i += 32768) str += String.fromCharCode(...u8.subarray(i, i + 32768));
  return { data: btoa(str), preview, info: `${s2.toArray().map((v) => v.toFixed(2)).join(' × ')} m (×${k.toPrecision(3)}), ${Math.round(tris)} tris, mats ${[...byMat.keys()].slice(0, 8).join(',')}` };
}

/**
 * A wall scan flattened to a picture: orthographic render straight at its `front` (local axis, e.g. '-z') with flat
 * bright light, transparent background, ground strip cut off (`cut` m) — a mural to paint on existing walls.
 */
async function flatten(p: Plan & { front: string; cut?: number }): Promise<{ png: string; aspect: number }> {
  const root = await load(p);
  await new Promise((r) => setTimeout(r, 1200));
  root.updateMatrixWorld(true);
  const fallback = p.tex ? Object.assign(new THREE.Texture(await img(p.tex)), { needsUpdate: true, colorSpace: THREE.SRGBColorSpace }) : null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.material = ([] as THREE.Material[]).concat(m.material).map((x) => {
      const map = (x as THREE.MeshStandardMaterial).map ?? fallback;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
    });
    if (Array.isArray(m.material) && m.material.length === 1) m.material = m.material[0];
  });
  const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const axis = p.front.slice(-1) as 'x' | 'z', sign = p.front.startsWith('-') ? -1 : 1, across = axis === 'x' ? size.z : size.x;
  const cut = p.cut ?? 0.15, y0 = box.min.y + cut, h = size.y - cut, aspect = across / h, W = 1024, H = Math.round(W / aspect);
  const cam = new THREE.OrthographicCamera(-across / 2, across / 2, h / 2, -h / 2, 0.01, 100);
  cam.position.copy(c).setY(y0 + h / 2);
  cam.position[axis] += sign * 50;
  cam.lookAt(c.x, y0 + h / 2, c.z);
  const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, alpha: true, antialias: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setSize(W, H);
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(root);
  r.render(scene, cam);
  return { png: r.domElement.toDataURL('image/png'), aspect };
}

Object.assign(window, { convert, flatten, ready: true });
