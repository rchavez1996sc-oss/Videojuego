import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Lighting } from './lighting';
import { LOOKS, variants } from './outfitTint';
import { pets, type PetKind } from './pets';

export type CharKind = 'pnp' | 'fls' | 'civ_a' | 'civ_b' | 'civ_c' | 'vip';

interface Manifest { version?: number; characters: Record<CharKind, { near: string; far: string }>; animations: string; pets?: Record<PetKind, string> }

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

/** Passing frame of the walk cycle (feet together, arms down): a relaxed unarmed stance. */
const STAND_AT = 0.25;

/** One frame of `clip` as a static clip. */
function still(clip: THREE.AnimationClip, name: string, time: number): THREE.AnimationClip {
  return new THREE.AnimationClip(name, 1, clip.tracks.map((t) => {
    const Track = t.constructor as new (name: string, times: number[], values: number[]) => THREE.KeyframeTrack;
    return new Track(t.name, [0], Array.from(t.createInterpolant().evaluate(time)));
  }));
}

/** Bones the source rig lacks (the pistol clips have no Spine2) held at `ref`'s first frame, so nothing else accumulates on them. */
function fillMissing(clip: THREE.AnimationClip, ref: THREE.AnimationClip): void {
  const have = new Set(clip.tracks.map((t) => t.name));
  for (const t of ref.tracks) if (!have.has(t.name) && t.name.endsWith('.quaternion')) clip.tracks.push(new THREE.QuaternionKeyframeTrack(t.name, [0], Array.from(t.createInterpolant().evaluate(0))));
}

/** Fold the hips tilt this clip has relative to `ref` (same source rig) into the spine: the legs come from other clips. */
function onHips(pose: THREE.AnimationClip, ref: THREE.AnimationClip): THREE.AnimationClip {
  const q = (c: THREE.AnimationClip, bone: string) => c.tracks.find((t) => t.name === `mixamorig${bone}.quaternion`);
  const hips = q(pose, 'Hips'), spine = q(pose, 'Spine'), base = q(ref, 'Hips');
  if (!hips || !spine || !base) return pose;
  const inv = new THREE.Quaternion().fromArray(Array.from(base.createInterpolant().evaluate(0))).invert();
  const at = hips.createInterpolant(), out = new Float32Array(spine.values.length);
  const h = new THREE.Quaternion(), sp = new THREE.Quaternion();
  spine.times.forEach((t, k) => {
    h.fromArray(Array.from(at.evaluate(t)));
    sp.fromArray(spine.values, k * 4);
    inv.clone().multiply(h).multiply(sp).toArray(out, k * 4);
  });
  spine.values = out;
  return pose;
}

/** Mixamo characters converted by scripts/mixamo.mjs; shared geometry/materials, cloned skeletons per instance. */
class CharacterLibrary {
  readonly clips = new Map<string, THREE.AnimationClip>();
  private protos = new Map<CharKind, { near: THREE.Object3D; far: THREE.SkinnedMesh[] }>();
  /** Clothing variants of each civilian material, keyed by the base (first) variant. */
  private looks = new Map<THREE.Material, THREE.Material[]>();
  ready = false;

  async load(lighting: Lighting): Promise<void> {
    const manifest = (await (await fetch(`${BASE}manifest.json`, { cache: 'no-cache' })).json()) as Manifest;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const get = (url: string) => loader.loadAsync(`${BASE}${url}?v=${manifest.version ?? 0}`);
    const petsReady = pets.load(lighting, manifest.version ?? 0, manifest.pets);
    const [anims, ...models] = await Promise.all([get(manifest.animations), ...Object.values(manifest.characters).flatMap((c) => [get(c.near), get(c.far)])]);
    for (const clip of anims.animations) this.clips.set(clip.name, clip);
    const walk = this.clips.get('civ_walk');
    if (walk) this.clips.set('civ_stand', still(walk, 'civ_stand', walk.duration * STAND_AT));
    const shoot = this.clips.get('p_shoot');
    const rest = this.clips.get('idle');
    if (rest) for (const [key, clip] of this.clips) if (key.startsWith('p_')) fillMissing(clip, rest);
    const pIdle = this.clips.get('p_idle'), reload = this.clips.get('p_reload');
    if (shoot && pIdle) this.clips.set('p_aim', onHips(still(shoot, 'p_aim', 0), pIdle));
    if (reload && pIdle) onHips(reload, pIdle);
    const masks = new Map<string, THREE.Texture>();
    await Promise.all(Object.keys(manifest.characters).filter((k) => k.startsWith('civ')).map((k) => new THREE.TextureLoader().loadAsync(`${BASE}characters/${k}.mask.png?v=${manifest.version ?? 0}`).then((t) => {
      t.flipY = false;
      masks.set(k, t);
    }, () => {})));
    Object.keys(manifest.characters).forEach((kind, i) => {
      const near = models[i * 2].scene, farScene = models[i * 2 + 1].scene;
      const mats = new Map<string, THREE.Material>();
      near.traverse((m) => {
        if (!(m instanceof THREE.SkinnedMesh)) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.envMapIntensity = 0.6;
        if (kind.startsWith('civ')) {
          const looks = variants(mat, `char-${kind}-${mat.name}`, lighting, masks.get(kind));
          this.looks.set(looks[0], looks);
          m.material = looks[0];
        } else m.material = lighting.setup(mat, `char-${kind}-${mat.name}`);
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
    await petsReady;
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
    const look = Math.floor(Math.random() * LOOKS);
    for (const m of [...near, ...far]) m.material = this.looks.get(m.material as THREE.Material)?.[look] ?? m.material;
    return { model, near, far, bones };
  }
}

export const characters = new CharacterLibrary();
