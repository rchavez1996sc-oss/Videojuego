import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Lighting } from './lighting';

export type CharKind = 'pnp' | 'fls' | 'civ_a' | 'civ_b' | 'civ_c';

interface Manifest { version?: number; characters: Record<CharKind, { near: string; far: string }>; animations: string }

/** Instance pieces: the animated near model and a low-poly copy bound to the same bones. */
export interface CharInstance { model: THREE.Object3D; near: THREE.SkinnedMesh[]; far: THREE.SkinnedMesh[]; bones: Map<string, THREE.Bone> }

const BASE = `${import.meta.env.BASE_URL}assets/`;
/** Generous pose-independent cull sphere from the bind-pose geometry (in the mesh's own, possibly quantized, space). */
function bounds(m: THREE.SkinnedMesh): THREE.Sphere {
  if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
  const s = m.geometry.boundingSphere!.clone();
  s.radius *= 1.6;
  return s;
}

/** Same joints in the same order with the same bind pose: the meshes can share one bone texture upload per frame. */
function sameSkin(a: THREE.Skeleton, b: THREE.Skeleton): boolean {
  return a.bones.length === b.bones.length && a.bones.every((bone, i) => bone.name === b.bones[i].name && a.boneInverses[i].equals(b.boneInverses[i]));
}

/** Mixamo characters converted by scripts/mixamo.mjs; shared geometry/materials, cloned skeletons per instance. */
class CharacterLibrary {
  readonly clips = new Map<string, THREE.AnimationClip>();
  private protos = new Map<CharKind, { near: THREE.Object3D; far: THREE.SkinnedMesh[] }>();
  ready = false;

  async load(lighting: Lighting): Promise<void> {
    const manifest = (await (await fetch(`${BASE}manifest.json`, { cache: 'no-cache' })).json()) as Manifest;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const get = (url: string) => loader.loadAsync(`${BASE}${url}?v=${manifest.version ?? 0}`);
    const [anims, ...models] = await Promise.all([get(manifest.animations), ...Object.values(manifest.characters).flatMap((c) => [get(c.near), get(c.far)])]);
    for (const clip of anims.animations) this.clips.set(clip.name, clip);
    Object.keys(manifest.characters).forEach((kind, i) => {
      const near = models[i * 2].scene, farScene = models[i * 2 + 1].scene;
      const mats = new Map<string, THREE.Material>();
      near.traverse((m) => {
        if (!(m instanceof THREE.SkinnedMesh)) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.envMapIntensity = 0.6;
        m.material = lighting.setup(mat, `char-${kind}-${mat.name}`);
        mats.set(mat.name, m.material as THREE.Material);
      });
      const far: THREE.SkinnedMesh[] = [];
      farScene.traverse((m) => {
        if (!(m instanceof THREE.SkinnedMesh)) return;
        m.material = mats.get((m.material as THREE.Material).name) ?? m.material;
        far.push(m);
      });
      this.protos.set(kind as CharKind, { near, far });
    });
    this.ready = true;
  }

  create(kind: CharKind): CharInstance {
    const proto = this.protos.get(kind) ?? this.protos.values().next().value!;
    const model = SkeletonUtils.clone(proto.near);
    const bones = new Map<string, THREE.Bone>();
    const near: THREE.SkinnedMesh[] = [];
    model.traverse((o) => {
      if (o instanceof THREE.Bone) bones.set(o.name, o);
      if (o instanceof THREE.SkinnedMesh) near.push(o);
    });
    near.forEach((m) => (m.boundingSphere = bounds(m)));
    const shared = near[0].skeleton;
    for (const m of near.slice(1)) if (sameSkin(m.skeleton, shared)) m.bind(shared, m.bindMatrix);
    const far = proto.far.map((src) => {
      const m = new THREE.SkinnedMesh(src.geometry, src.material);
      m.boundingSphere = bounds(m);
      near[0].parent!.add(m);
      const skel = sameSkin(src.skeleton, shared) ? shared : new THREE.Skeleton(src.skeleton.bones.map((b) => bones.get(b.name)!), src.skeleton.boneInverses);
      m.bind(skel, near[0].bindMatrix);
      m.visible = false;
      return m;
    });
    return { model, near, far, bones };
  }
}

export const characters = new CharacterLibrary();
