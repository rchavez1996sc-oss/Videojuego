import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Lighting } from './lighting';

export type PetKind = 'dog' | 'cat';

/** A stray: its root (faces +z), and a per-frame pose update from ground speed (m/s). */
export interface Pet { kind: PetKind; root: THREE.Group; update(dt: number, speed: number): void }

const BASE = `${import.meta.env.BASE_URL}assets/`;
/** Ground speed the dog's walk clip was authored at; faster movement plays it faster (capped, reads as a trot). */
const DOG_WALK = 0.8;
const UP = new THREE.Vector3(0, 1, 0), SIDE = new THREE.Vector3(1, 0, 0);

interface Joint { bone: THREE.Bone; rest: THREE.Quaternion; swing: THREE.Vector3; turn: THREE.Vector3 }

/** Stray dog (FBX take split into walk / idle by scripts/pets.mjs) and cat (rigged, unanimated: legs, tail and head driven here). */
class PetLibrary {
  private protos = new Map<PetKind, { scene: THREE.Object3D; clips: THREE.AnimationClip[] }>();

  async load(lighting: Lighting, version: number, files?: Record<PetKind, string>): Promise<void> {
    if (!files) return;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    await Promise.all(Object.entries(files).map(async ([kind, url]) => {
      const g = await loader.loadAsync(`${BASE}${url}?v=${version}`).catch(() => null);
      if (!g) return;
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = lighting.setup((m.material as THREE.MeshStandardMaterial).clone(), `pet-${kind}`);
        m.castShadow = true;
        m.frustumCulled = false;
      });
      this.protos.set(kind as PetKind, { scene: g.scene, clips: g.animations });
    }));
  }

  has(kind: PetKind): boolean {
    return this.protos.has(kind);
  }

  make(kind: PetKind, scale: number): Pet | null {
    const proto = this.protos.get(kind);
    if (!proto) return null;
    const root = new THREE.Group(), model = SkeletonUtils.clone(proto.scene);
    root.add(model);
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
    return kind === 'dog' ? dog(root, model, proto.clips) : cat(root, model);
  }
}

function dog(root: THREE.Group, model: THREE.Object3D, clips: THREE.AnimationClip[]): Pet {
  const mixer = new THREE.AnimationMixer(model), act = (n: string) => mixer.clipAction(clips.find((c) => c.name === n) ?? clips[0]);
  const walk = act('walk'), idle = act('idle');
  walk.play();
  idle.play();
  idle.time = Math.random() * 3;
  let blend = 0;
  return {
    kind: 'dog', root,
    update(dt, speed) {
      blend = THREE.MathUtils.damp(blend, speed > 0.15 ? 1 : 0, 6, dt);
      walk.setEffectiveWeight(blend);
      idle.setEffectiveWeight(1 - blend);
      walk.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / DOG_WALK, 0.6, 2.8));
      mixer.update(dt);
    },
  };
}

/** Cat joints: leg bones swing about the body's side axis, tail and head turn about the vertical, expressed in each parent's frame. */
function cat(root: THREE.Group, model: THREE.Object3D): Pet {
  const joints = new Map<string, Joint>(), rootQ = model.getWorldQuaternion(new THREE.Quaternion()).invert();
  model.traverse((o) => {
    const b = o as THREE.Bone;
    if (!b.isBone || !b.parent) return;
    const pq = rootQ.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion())).invert();
    joints.set(b.name, { bone: b, rest: b.quaternion.clone(), swing: SIDE.clone().applyQuaternion(pq).normalize(), turn: UP.clone().applyQuaternion(pq).normalize() });
  });
  const q = new THREE.Quaternion(), legs = ['FL', 'BR', 'FR', 'BL'];
  const set = (name: string, axis: 'swing' | 'turn', a: number) => {
    const j = joints.get(name);
    if (j) j.bone.quaternion.copy(q.setFromAxisAngle(j[axis], a).multiply(j.rest));
  };
  let phase = Math.random() * 6, t = Math.random() * 10;
  return {
    kind: 'cat', root,
    update(dt, speed) {
      t += dt;
      const amp = Math.min(1, speed / 1.2);
      phase += dt * (3 + speed * 4.5);
      legs.forEach((leg, i) => {
        const p = phase + (i < 2 ? 0 : Math.PI), front = leg[0] === 'F';
        set(`Thigh_${leg}`, 'swing', -Math.sin(p) * 0.55 * amp);
        set(`Knee_${leg}`, 'swing', Math.max(0, Math.cos(p)) * (front ? 0.9 : 0.6) * amp);
      });
      set('Tail_1', 'swing', 0.75 + Math.sin(t * 0.9) * 0.12);
      set('Tail_2', 'turn', Math.sin(t * 1.3) * 0.25);
      set('Head', 'turn', Math.sin(t * 0.4) * 0.3 * (1 - amp));
    },
  };
}

export const pets = new PetLibrary();
