import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { cutDoors, type DoorSpec } from './doorCut';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Offline car-pack FBX → one glTF with a node per car (driven by scripts/cars.mjs): each body with its four wheels,
 * aligned to +z forward, origin at the ground under the middle, in metres; wheels as separate nodes centred on their
 * hub (they spin). Textures: body colour 1024 and a packed map (R paint mask, G roughness, B metalness) so the game
 * can repaint the bodywork and keep trims, tyres and lights.
 */
const load = (url: string) => new Promise<HTMLImageElement>((ok, fail) => Object.assign(new Image(), { onload: function (this: HTMLImageElement) { ok(this); }, onerror: fail, src: url }));
const canvas = (n: number) => Object.assign(document.createElement('canvas'), { width: n, height: n });
const tex = (c: HTMLCanvasElement, mime: string, srgb: boolean) => Object.assign(new THREE.CanvasTexture(c), { flipY: true, colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace, userData: { mimeType: mime } });

/** Body colour (paint pixels kept, the game re-tints them) and packed mask/roughness/metal from colour + metallic + glossiness. */
async function bodyMaps(dir: string, name: string, colour: string, n = 1024): Promise<{ map: THREE.Texture; orm: THREE.Texture }> {
  const [c, m, g] = await Promise.all([load(`${dir}/${colour}`), load(`${dir}/${name}_Metallic.png`), load(`${dir}/${name}_Glossiness.png`)]);
  const read = (img: HTMLImageElement) => { const cv = canvas(n), x = cv.getContext('2d')!; x.drawImage(img, 0, 0, n, n); return { cv, d: x.getImageData(0, 0, n, n) }; };
  const col = read(c), met = read(m).d.data, glo = read(g).d.data, out = canvas(n), ox = out.getContext('2d')!, od = ox.createImageData(n, n);
  const cd = col.d.data;
  for (let i = 0; i < cd.length; i += 4) {
    const r = cd[i] / 255, gg = cd[i + 1] / 255, b = cd[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx > 0 ? (mx - mn) / mx : 0;
    const paint = sat > 0.4 && mx > 0.12 ? 255 : 0;
    od.data[i] = paint;
    od.data[i + 1] = Math.round(255 - glo[i] * 0.85);
    od.data[i + 2] = met[i];
    od.data[i + 3] = 255;
    if (paint) {
      const v = Math.min(1, mx / 0.85);
      cd[i] = cd[i + 1] = cd[i + 2] = Math.round(255 * v);
    }
  }
  col.cv.getContext('2d')!.putImageData(col.d, 0, 0);
  ox.putImageData(od, 0, 0);
  return { map: tex(col.cv, 'image/jpeg', true), orm: tex(out, 'image/png', false) };
}

async function plain(url: string, n: number, srgb = true): Promise<THREE.Texture> {
  const cv = canvas(n);
  cv.getContext('2d')!.drawImage(await load(url), 0, 0, n, n);
  return tex(cv, 'image/jpeg', srgb);
}

interface Plan { body: string; key: string; tex: string; colour: string; flip?: boolean; doors?: DoorSpec }

interface Simple { body: string; key: string; flip?: boolean }

/** Low-poly pack: one mesh per car (wheels included) on a shared palette texture with a normal map; units of 10 cm. */
async function simpleCars(fbx: string, dir: string, plans: Simple[]): Promise<THREE.Group[]> {
  const src = await new FBXLoader().loadAsync(fbx);
  src.updateMatrixWorld(true);
  const map = await plain(`${dir}/tex.png`, 1024), normalMap = await plain(`${dir}/tex_NRM.png`, 1024, false);
  const mat = new THREE.MeshStandardMaterial({ name: 'lowpoly-paint', map, normalMap, roughness: 0.45, metalness: 0.25 });
  const out: THREE.Group[] = [];
  for (const p of plans) {
    let mesh: THREE.Mesh | null = null;
    src.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name === p.body) mesh = o as THREE.Mesh; });
    const m = mesh as unknown as THREE.Mesh, g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-c.x, -g.boundingBox!.min.y, -c.z).scale(0.1, 0.1, 0.1);
    if (p.flip) g.rotateY(Math.PI);
    const car = new THREE.Group();
    car.name = p.key;
    const body = new THREE.Mesh(g, mat);
    body.name = `${p.key}_body`;
    car.add(body);
    out.push(car);
  }
  return out;
}

async function convert(fbx: string, dir: string, plans: Plan[], fbx2?: string, dir2?: string, plans2: Simple[] = []): Promise<{ data: string; info: string[]; previews: string[] }> {
  const src = await new FBXLoader().loadAsync(fbx);
  src.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  src.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
  const wheels = meshes.filter((m) => /^Wheel/i.test(m.name)), centre = (m: THREE.Object3D) => new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
  const lights = await plain(`${dir}/lights.jpg`, 512);
  const root = new THREE.Group(), info: string[] = [], previews: string[] = [];
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1024, 512);
  for (const p of plans) {
    const body = meshes.find((m) => m.name === p.body)!, c = centre(body);
    const mine = wheels.map((w) => ({ w, d: centre(w).distanceTo(c) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.w);
    const pts = mine.map(centre);
    const mx = pts.reduce((s, v) => s + v.x, 0) / 4, mz = pts.reduce((s, v) => s + v.z, 0) / 4;
    let sxx = 0, szz = 0, sxz = 0;
    for (const v of pts) { sxx += (v.x - mx) ** 2; szz += (v.z - mz) ** 2; sxz += (v.x - mx) * (v.z - mz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    const toLocal = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)
      .multiply(new THREE.Matrix4().makeRotationY(ang - Math.PI / 2 + (p.flip ? Math.PI : 0)))
      .multiply(new THREE.Matrix4().makeTranslation(-mx, 0, -mz));
    const { map, orm } = await bodyMaps(dir, p.tex, p.colour);
    const paint = new THREE.MeshStandardMaterial({ name: `${p.key}-body`, map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1 });
    const optics = new THREE.MeshStandardMaterial({ name: `${p.key}-optics`, map: lights, roughness: 0.15, metalness: 0.1 });
    const glass = new THREE.MeshStandardMaterial({ name: 'car-glass', color: '#151a1e', roughness: 0.05, metalness: 0 });
    const letter = (mine[0].name.match(/^Wheel_(\w)/i)?.[1] ?? 'A').toUpperCase();
    const wheelMap = await plain(`${dir}/${letter === 'A' ? 'Wheel_A' : `wheel_${letter}`}_Diffuse.png`, 512).catch(() => plain(`${dir}/wheel_1_Diffuse.png`, 512));
    const wheelMat = new THREE.MeshStandardMaterial({ name: `${p.key}-wheel`, map: wheelMap, roughness: 0.75, metalness: 0.2 });
    const pick = (n: string) => (/glass/i.test(n) ? glass : /optic/i.test(n) ? optics : /whee/i.test(n) ? wheelMat : paint);
    const car = new THREE.Group();
    car.name = p.key;
    const g = body.geometry.clone().applyMatrix4(body.matrixWorld).applyMatrix4(toLocal);
    const mats = ([] as THREE.Material[]).concat(body.material).map((m) => pick(m.name));
    const bodyMesh = new THREE.Mesh(g, mats.length > 1 ? mats : mats[0]);
    bodyMesh.name = `${p.key}_body`;
    car.add(bodyMesh);
    mine.forEach((w, k) => {
      const wg = w.geometry.clone().applyMatrix4(w.matrixWorld).applyMatrix4(toLocal);
      wg.computeBoundingBox();
      const hub = wg.boundingBox!.getCenter(new THREE.Vector3());
      wg.translate(-hub.x, -hub.y, -hub.z);
      const wm = ([] as THREE.Material[]).concat(w.material).map((m) => pick(m.name));
      const mesh = new THREE.Mesh(wg, wm.length > 1 ? wm : wm[0]);
      mesh.position.copy(hub);
      mesh.name = `${p.key}_wheel${k}`;
      car.add(mesh);
    });
    info.push(cutDoors(car, p.key, p.doors));
    const box = new THREE.Box3().setFromObject(car);
    car.position.y = -box.min.y;
    const size = box.getSize(new THREE.Vector3());
    info.push(`${p.key}: ${size.toArray().map((v) => v.toFixed(2)).join(' × ')} m, glass z ${glassZ(bodyMesh).toFixed(2)}`);
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-2.2, 2.2, 1.1, -1.1, 0.1, 50);
    scene.background = new THREE.Color('#bbbbbb');
    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(3, 5, 4);
    scene.add(new THREE.AmbientLight('#ffffff', 1.5), sun);
    const view = car.clone();
    view.traverse((o) => /_door[LR]$/.test(o.name) && (o.rotation.y = o.name.endsWith('L') ? -1.1 : 1.1));
    scene.add(view);
    cam.position.set(4.2, 1.5, 2.6);
    cam.lookAt(0, 0.9, 0);
    renderer.render(scene, cam);
    previews.push(renderer.domElement.toDataURL('image/jpeg', 0.8));
    root.add(car);
  }
  if (fbx2 && dir2) for (const car of await simpleCars(fbx2, dir2, plans2)) {
    const size = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
    info.push(`${car.name}: ${size.toArray().map((v) => v.toFixed(2)).join(' × ')} m`);
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-3.2, 3.2, 1.6, -1.6, 0.1, 50), sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(3, 5, 4);
    scene.background = new THREE.Color('#bbbbbb');
    scene.add(new THREE.AmbientLight('#ffffff', 1.5), sun, car.clone());
    cam.position.set(8, 0.9, 0);
    cam.lookAt(0, 0.9, 0);
    renderer.render(scene, cam);
    previews.push(renderer.domElement.toDataURL('image/jpeg', 0.8));
    root.add(car);
  }
  const buf = (await new GLTFExporter().parseAsync(root, { binary: true })) as ArrayBuffer;
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return { data: btoa(s), info, previews };
}

/** Mean z of the glass triangles (the cabin sits behind the middle on most cars: a hint for which end is the front). */
function glassZ(m: THREE.Mesh): number {
  const g = m.geometry, mats = ([] as THREE.Material[]).concat(m.material), pos = g.attributes.position, idx = g.index;
  let sum = 0, n = 0;
  for (const grp of g.groups) {
    if (!/glass/i.test(mats[grp.materialIndex ?? 0].name)) continue;
    for (let i = grp.start; i < grp.start + grp.count; i++) { sum += pos.getZ(idx ? idx.getX(i) : i); n++; }
  }
  return n ? sum / n : 0;
}

async function inspect(fbx: string): Promise<string> {
  const src = await new FBXLoader().loadAsync(fbx);
  src.updateMatrixWorld(true);
  const out: string[] = [];
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()), c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    out.push(`"${m.name}" ${([] as THREE.Material[]).concat(m.material).map((x) => x.name).join('+')} tris=${(m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3} size=${s.toArray().map((v) => v.toFixed(1))} at=${c.toArray().map((v) => v.toFixed(1))}`);
  });
  return out.join('\n');
}

Object.assign(window, { convert, inspect, ready: true });
