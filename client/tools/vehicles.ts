import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { splitWheels } from './wheelSplit';
import { cutDoors, type DoorSpec } from './doorCut';

/**
 * Offline vehicle models (Sketchfab, Release assets-v1) → one glTF with a node per vehicle (driven by
 * scripts/vehicles.mjs): +z forward, origin on the ground under the middle, one mesh per material. Paint materials
 * become `<key>-body` with a greyed colour map and a packed map (R paint mask, G roughness, B metalness) so the game
 * repaints them like the car pack; atlas bodies (buses) mask only saturated texels.
 */
interface Plan { doors?: DoorSpec; key: string; len: number; url: string; rotY?: number; drop?: string; paint: string; mode: 'full' | 'sat'; glass?: string; tex?: Record<string, string>; minWheels?: number }

async function loadAny(url: string): Promise<THREE.Object3D> {
  if (/\.fbx$/i.test(url)) return new FBXLoader().loadAsync(url);
  if (/\.obj$/i.test(url)) return new OBJLoader().loadAsync(url);
  if (/\.dae$/i.test(url)) return (await new ColladaLoader().loadAsync(url)).scene;
  return (await new GLTFLoader().loadAsync(url)).scene;
}

const img = (url: string) => new Promise<HTMLImageElement>((ok, fail) => Object.assign(new Image(), { onload: function (this: HTMLImageElement) { ok(this); }, onerror: fail, src: url }));
const canvas = (n: number) => Object.assign(document.createElement('canvas'), { width: n, height: n });

function texFrom(source: CanvasImageSource, flipY: boolean, srgb: boolean, n = 1024, png = false): { cv: HTMLCanvasElement; t: THREE.Texture } {
  const cv = canvas(n);
  cv.getContext('2d')!.drawImage(source, 0, 0, n, n);
  const t = Object.assign(new THREE.CanvasTexture(cv), { flipY, colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, userData: { mimeType: png ? 'image/png' : 'image/jpeg' } });
  return { cv, t };
}

/** Paint: colour greyed where it is paint, packed R mask / G roughness / B metal. */
function paintMaps(source: CanvasImageSource | null, flipY: boolean, mode: 'full' | 'sat', rough: number, metal: number): { map: THREE.Texture | null; orm: THREE.Texture } {
  const n = source ? 1024 : 16, col = source ? texFrom(source, flipY, true, n) : null, out = canvas(n), ox = out.getContext('2d')!, od = ox.createImageData(n, n);
  const cd = col ? col.cv.getContext('2d')!.getImageData(0, 0, n, n) : null;
  for (let i = 0; i < od.data.length; i += 4) {
    let paint = 255;
    if (cd) {
      const r = cd.data[i] / 255, g = cd.data[i + 1] / 255, b = cd.data[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
      if (mode === 'sat') paint = sat > 0.35 && mx > 0.15 ? 255 : 0;
      if (paint) cd.data[i] = cd.data[i + 1] = cd.data[i + 2] = Math.round(255 * Math.min(1, (0.3 * r + 0.59 * g + 0.11 * b) / 0.7 + 0.15));
    }
    od.data[i] = paint;
    od.data[i + 1] = Math.round(rough * 255);
    od.data[i + 2] = Math.round(metal * 255);
    od.data[i + 3] = 255;
  }
  if (col && cd) col.cv.getContext('2d')!.putImageData(cd, 0, 0);
  ox.putImageData(od, 0, 0);
  const orm = Object.assign(new THREE.CanvasTexture(out), { flipY, colorSpace: THREE.NoColorSpace, userData: { mimeType: 'image/png' } });
  return { map: col ? col.t : null, orm };
}

async function vehicle(p: Plan): Promise<THREE.Group> {
  const root = await loadAny(p.url);
  root.updateMatrixWorld(true);
  const drop = p.drop ? new RegExp(p.drop, 'i') : null, paintRe = new RegExp(p.paint, 'i'), glassRe = p.glass ? new RegExp(p.glass, 'i') : /glass/i;
  const extra = new Map<string, HTMLImageElement>();
  for (const [re, url] of Object.entries(p.tex ?? {})) extra.set(re, await img(url));
  const byMat = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const cache = new Map<THREE.Material, THREE.Material>();
  const convert = (src: THREE.Material): THREE.Material => {
    if (cache.has(src)) return cache.get(src)!;
    const s = src as THREE.MeshStandardMaterial & THREE.MeshPhongMaterial, name = src.name || 'mat';
    const given = [...extra.entries()].find(([re]) => new RegExp(re, 'i').test(name))?.[1];
    const source = (given ?? (s.map?.image as CanvasImageSource | undefined)) || null, flipY = given ? true : s.map?.flipY ?? true;
    const rough = s.roughness ?? (s.shininess !== undefined ? Math.max(0.3, 1 - s.shininess / 100) : 0.7), metal = s.metalness ?? 0;
    let m: THREE.MeshStandardMaterial;
    if (glassRe.test(name)) m = new THREE.MeshStandardMaterial({ name: 'car-glass', color: '#151a1e' });
    else if (paintRe.test(name)) {
      const pm = paintMaps(source, flipY, p.mode, Math.min(rough, 0.5), metal);
      m = new THREE.MeshStandardMaterial({ name: `${p.key}-body`, map: pm.map, roughnessMap: pm.orm, metalnessMap: pm.orm, color: '#ffffff', roughness: 1, metalness: 1 });
    } else {
      m = new THREE.MeshStandardMaterial({ name: `${p.key}-${name.replace(/[^\w]+/g, '_')}`, color: s.color?.clone() ?? new THREE.Color('#888'), roughness: rough, metalness: metal });
      if (source) m.map = texFrom(source, flipY, true, 512).t;
      else m.userData.trim = true;
    }
    cache.set(src, m);
    return m;
  };
  const fix = new THREE.Matrix4().makeRotationY(p.rotY ?? 0);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (drop && drop.test(mesh.name))) return;
    const mats = ([] as THREE.Material[]).concat(mesh.material);
    if (drop && mats.every((m) => drop.test(m.name))) return;
    const m4 = new THREE.Matrix4().multiplyMatrices(fix, mesh.matrixWorld), geo = mesh.geometry;
    const total = geo.index ? geo.index.count : geo.attributes.position.count;
    const groups = geo.groups.length && mats.length > 1 ? geo.groups : [{ start: 0, count: total, materialIndex: 0 }];
    for (const gr of groups) {
      const src = mats[gr.materialIndex ?? 0];
      if (!src || (drop && drop.test(src.name))) continue;
      const part = subset(geo, gr.start, Math.min(gr.count, total - gr.start)).applyMatrix4(m4);
      const m = convert(src), id = m.name;
      if (!byMat.has(id)) byMat.set(id, { mat: m, geos: [] });
      byMat.get(id)!.geos.push(part);
    }
  });
  const trim = [...byMat.values()].filter((e) => e.mat.userData.trim);
  if (trim.length > 1) {
    const geos = trim.flatMap((e) => e.geos.map((g) => {
      const c = (e.mat as THREE.MeshStandardMaterial).color, n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
      return g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }));
    for (const e of trim) byMat.delete(e.mat.name);
    byMat.set(`${p.key}-trim`, { mat: new THREE.MeshStandardMaterial({ name: `${p.key}-trim`, vertexColors: true, roughness: 0.55, metalness: 0.3 }), geos });
  }
  const out = new THREE.Group();
  out.name = p.key;
  for (const { mat, geos } of byMat.values()) {
    const g = mergeGeometries(geos);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = `${p.key}_${mat.name}`;
    out.add(mesh);
  }
  const box = new THREE.Box3().setFromObject(out), c = box.getCenter(new THREE.Vector3()), k = p.len / (box.max.z - box.min.z);
  for (const m of out.children) (m as THREE.Mesh).geometry.translate(-c.x, -box.min.y, -c.z).scale(k, k, k);
  out.userData.wheels = splitWheels(out, p.key, p.minWheels);
  if (p.doors) out.userData.doors = cutDoors(out, p.key, p.doors);
  return out;
}

/** Triangles [start, start + count) of a geometry (by index or by vertex order) as plain position/normal/uv. */
function subset(g: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry(), idx = g.index;
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const arr = new Float32Array(count * a.itemSize);
    for (let i = 0; i < count; i++) {
      const v = idx ? idx.getX(start + i) : start + i;
      for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(v, k);
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
}

function preview(g: THREE.Object3D): string {
  const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true });
  r.setSize(640, 360);
  const scene = new THREE.Scene(), box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()).length();
  scene.background = new THREE.Color('#8a9aa8');
  scene.add(new THREE.HemisphereLight('#ffffff', '#555', 2), g);
  const sun = new THREE.DirectionalLight('#fff', 2.5);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(35, 16 / 9, 0.01, size * 20);
  cam.position.set(size * 0.95, size * 0.3, size * 0.55);
  cam.lookAt(0, size * 0.12, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/jpeg', 0.85);
  r.dispose();
  return url;
}

async function convert(plans: Plan[]): Promise<{ data: string; info: string[]; previews: string[] }> {
  const scene = new THREE.Scene(), info: string[] = [], previews: string[] = [];
  for (const p of plans) {
    const v = await vehicle(p);
    const s = new THREE.Box3().setFromObject(v).getSize(new THREE.Vector3());
    info.push(`${p.key}: ${s.toArray().map((x) => x.toFixed(2)).join(' × ')} wheels ${v.userData.wheels} meshes ${v.children.length} (${v.children.map((m) => m.name.replace(`${p.key}_`, '')).join(', ')})`);
    info.push('   ' + v.children.filter((o) => /_wheel\d$/.test(o.name)).map((o) => { const b = new THREE.Box3().setFromObject(o), z = b.getSize(new THREE.Vector3()); return `${o.position.toArray().map((x) => x.toFixed(2))} r${(z.y / 2).toFixed(2)} w${z.x.toFixed(2)}`; }).join(' | '));
    if (v.userData.doors) info.push('   ' + v.userData.doors);
    const shown = v.clone();
    shown.traverse((o) => /_door[LR]$/.test(o.name) && (o.rotation.y = o.name.endsWith('L') ? -1.1 : 1.1));
    previews.push(preview(shown));
    scene.add(v);
  }
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  let bin = '';
  const u8 = new Uint8Array(glb);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return { data: btoa(bin), info, previews };
}

Object.assign(window, { convert, ready: true });
