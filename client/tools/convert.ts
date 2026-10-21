import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Offline Mixamo → glTF conversion, driven by scripts/mixamo.mjs through Playwright. */
const loader = new FBXLoader();

function resized(tex: THREE.Texture | null, size: number, jpeg: boolean): THREE.Texture | null {
  const img = tex?.image as (HTMLImageElement & { width: number; height: number }) | undefined;
  if (!tex || !img?.width) return null;
  const c = document.createElement('canvas');
  c.width = c.height = Math.min(size, img.width);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.flipY = tex.flipY;
  t.colorSpace = tex.colorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.mimeType = jpeg ? 'image/jpeg' : 'image/png';
  return t;
}

function hasAlpha(tex: THREE.Texture | null): boolean {
  const img = tex?.image as HTMLImageElement | undefined;
  if (!img?.width) return false;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) return true;
  return false;
}

async function glb(obj: THREE.Object3D, animations: THREE.AnimationClip[] = []): Promise<string> {
  const buf = (await new GLTFExporter().parseAsync(obj, { binary: true, animations, onlyVisible: false })) as ArrayBuffer;
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

async function character(url: string, tex: number, normal: number): Promise<{ data: string; info: string }> {
  const o = await loader.loadAsync(url);
  o.animations = [];
  const textures: THREE.Texture[] = [];
  o.traverse((m) => {
    for (const mat of [((m as THREE.Mesh).material ?? [])].flat() as THREE.MeshPhongMaterial[]) for (const t of [mat.map, mat.normalMap]) if (t) textures.push(t);
  });
  for (let i = 0; i < 200 && textures.some((t) => !(t.image as HTMLImageElement | undefined)?.width); i++) await new Promise((r) => setTimeout(r, 100));
  const info: string[] = [];
  const shared = new Map<string, THREE.MeshStandardMaterial>();
  o.traverse((m) => {
    if (!(m instanceof THREE.SkinnedMesh)) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshPhongMaterial[];
    const out = mats.map((p) => {
      const known = shared.get(p.name);
      if (known) return known;
      const alpha = /hair|lash/i.test(p.name + m.name) && hasAlpha(p.map);
      info.push(`${m.name}/${p.name} map=${!!p.map}:${(p.map?.image as HTMLImageElement)?.width}:${p.map?.image?.constructor?.name} normal=${!!p.normalMap} alpha=${alpha} transparent=${p.transparent} color=${p.color?.getHexString()}`);
      const mat = new THREE.MeshStandardMaterial({
        name: p.name, map: tex ? resized(p.map, tex, !alpha) : null, normalMap: normal ? resized(p.normalMap, normal, true) : null,
        roughness: 0.78, metalness: 0, alphaTest: alpha ? 0.5 : 0, side: alpha ? THREE.DoubleSide : THREE.FrontSide,
      });
      shared.set(p.name, mat);
      return mat;
    });
    out.forEach((mat) => mat.alphaTest && !tex && (mat.alphaTest = 0));
    m.material = Array.isArray(m.material) ? out : out[0];
    for (const k of Object.keys(m.geometry.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) m.geometry.deleteAttribute(k);
  });
  mergeSkinned(o);
  o.scale.setScalar(0.01);
  return { data: await glb(o), info: info.join('\n') };
}

/** One skinned mesh per material sharing a single skeleton (Mixamo exports one skin per clothing piece). */
function mergeSkinned(o: THREE.Object3D): void {
  o.traverse((n) => (n.name = n.name.replace(/^mixamorig\d+/, 'mixamorig')));
  const dups: THREE.Object3D[] = [];
  o.traverse((n) => n.parent && n.name && n.name === n.parent.name.replace(/_dup\d*$/, '') && dups.push(n));
  dups.forEach((n, i) => (n.name = `${n.name}_dup${i}`));
  o.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  o.traverse((m) => m instanceof THREE.SkinnedMesh && meshes.push(m));
  const bones: THREE.Bone[] = [], inverses: THREE.Matrix4[] = [], index = new Map<string, number>();
  for (const m of meshes) {
    m.skeleton.bones.forEach((b, i) => {
      if (index.has(b.name)) return;
      index.set(b.name, bones.length);
      bones.push(b);
      inverses.push(m.skeleton.boneInverses[i].clone());
    });
  }
  const skeleton = new THREE.Skeleton(bones, inverses);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const m of meshes) {
    const g = m.geometry.clone().applyMatrix4(m.bindMatrix);
    const si = g.attributes.skinIndex;
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, index.get(m.skeleton.bones[si.getComponent(i, k)].name)!);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    const mats = [m.material].flat() as THREE.Material[];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index!.count, materialIndex: 0 }];
    for (const grp of groups) {
      const part = g.clone();
      part.clearGroups();
      part.setIndex(Array.from(g.index!.array.slice(grp.start, grp.start + grp.count)));
      const mat = mats[grp.materialIndex ?? 0];
      (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(part);
    }
    m.removeFromParent();
  }
  const used = new Set<THREE.Object3D>(bones);
  const keep = (n: THREE.Object3D): boolean => used.has(n) || n.children.some(keep);
  const stray: THREE.Object3D[] = [];
  o.traverse((n) => n instanceof THREE.Bone && !keep(n) && stray.push(n));
  stray.forEach((n) => n.removeFromParent());
  for (const [mat, gs] of byMat) {
    const sm = new THREE.SkinnedMesh(mergeGeometries(gs), mat);
    sm.name = mat.name;
    o.add(sm);
    sm.bind(skeleton, new THREE.Matrix4());
  }
}

/** inPlace: 0 keeps the hips path (relative to the start), 1 pins X/Z, 2 removes the start→end drift on all axes (climbs). */
interface AnimSpec { key: string; url: string; inPlace: 0 | 1 | 2; maxDur?: number }

async function animations(skeletonUrl: string, list: AnimSpec[]): Promise<{ data: string; info: string }> {
  const skel = await loader.loadAsync(skeletonUrl);
  const meshes: THREE.Object3D[] = [];
  skel.traverse((m) => (m as THREE.Mesh).isMesh && meshes.push(m));
  meshes.forEach((m) => m.removeFromParent());
  skel.animations = [];
  const bones = new Set<string>();
  skel.traverse((b) => b.name && bones.add(b.name));
  const clips: THREE.AnimationClip[] = [];
  const info: string[] = [];
  for (const a of list) {
    let src: THREE.AnimationClip;
    try {
      src = (await loader.loadAsync(a.url)).animations[0];
    } catch (e) {
      info.push(`${a.key}: FAILED ${(e as Error).message}`);
      continue;
    }
    const tracks = src.tracks.filter((t) => {
      const [node, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)];
      return bones.has(node) && (prop === 'quaternion' || (prop === 'position' && node.endsWith('Hips')));
    });
    const hips = tracks.find((t) => t.name.endsWith('Hips.position'));
    if (hips) {
      const v = hips.values, n = v.length / 3, x0 = v[0], z0 = v[2];
      const drift = [v[v.length - 3] - v[0], v[v.length - 2] - v[1], v[v.length - 1] - v[2]];
      for (let i = 0; i < n; i++) {
        const k = n > 1 ? i / (n - 1) : 0;
        if (a.inPlace === 2) for (let c = 0; c < 3; c++) v[i * 3 + c] -= drift[c] * k;
        else {
          v[i * 3] = a.inPlace ? 0 : v[i * 3] - x0;
          v[i * 3 + 2] = a.inPlace ? 0 : v[i * 3 + 2] - z0;
        }
      }
      if (a.inPlace === 2) for (let i = 0; i < n; i++) {
        v[i * 3] -= x0;
        v[i * 3 + 2] -= z0;
      }
    }
    let clip = new THREE.AnimationClip(a.key, src.duration, tracks);
    if (a.maxDur && clip.duration > a.maxDur) clip = THREE.AnimationUtils.subclip(clip, a.key, 0, Math.round(a.maxDur * 30), 30);
    info.push(`${a.key}: ${clip.duration.toFixed(2)}s ${tracks.length}/${src.tracks.length} tracks`);
    clips.push(clip);
  }
  skel.scale.setScalar(0.01);
  return { data: await glb(skel, clips), info: info.join('\n') };
}

Object.assign(window, { character, animations, ready: true });
