import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Lighting } from './lighting';

const BASE = `${import.meta.env.BASE_URL}assets/`;

/** Which modelled cars stand in for each game kind (a seed picks one), and the game length each is fitted to (m). */
const MODELS: Record<string, string[]> = { sedan: ['sedan', 'sedan', 'coupe', 'hatchback', 'lowA', 'lowC'], tico: ['compact'], wagon: ['wagon', 'suv', 'minivan', 'lowD'], pickup: ['pickup', 'pickup', 'offroad', 'lowB'] };
const LENGTH: Record<string, number> = { sedan: 4.3, tico: 3.3, wagon: 4.6, pickup: 5.0 };

/** Paint of the old procedural keys, so parked and traffic cars keep their palette (dusty Lima colours). */
export const PAINT: Record<string, string> = { car0: '#c9c6bf', car1: '#2a2c30', car2: '#7a1d1a', car3: '#e2c22e', car4: '#2b4c7a', car5: '#eeeeea' };

/**
 * Bodywork repaint: the packed map's red channel marks paint (the body texture holds it in grey), which takes the
 * instance colour (parked, instanced) or the material colour (traffic and driven cars; no custom uniform, so the
 * shared program keeps working for every paint); trims, tyres and lights keep their texture. Roughness and metalness
 * come from the same map's green and blue.
 */
function paintHook(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <color_fragment>', '')
    .replace('#include <map_fragment>', `diffuseColor.rgb = vec3(1.0);
#include <map_fragment>
  {
    float paintMask = texture2D(roughnessMap, vRoughnessMapUv).r;
    #ifdef USE_COLOR
      vec3 paintTint = vColor;
    #else
      vec3 paintTint = diffuse;
    #endif
    diffuseColor.rgb *= mix(vec3(1.0), paintTint * 1.15, paintMask);
  }`);
}

export interface CarPart { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4; wheel: boolean }

class CarModels {
  private protos = new Map<string, THREE.Object3D>();
  private paints = new Map<string, THREE.Material>();
  private instanced = new Map<string, THREE.Material>();
  private lighting!: Lighting;

  async load(lighting: Lighting): Promise<void> {
    this.lighting = lighting;
    const manifest = await fetch(`${BASE}manifest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    const url = manifest?.cars as string | undefined;
    if (!url) return;
    const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`${BASE}${url}?v=${manifest.version ?? 0}`).catch(() => null);
    if (!g) return;
    const shared = new Map<string, THREE.Material>();
    const setup = (m: THREE.MeshStandardMaterial) => {
      if (/-body$/.test(m.name)) return m;
      if (!shared.has(m.name)) {
        if (m.name === 'car-glass') Object.assign(m, { roughness: 0.04, metalness: 0, envMapIntensity: 2.2, transparent: true, opacity: 0.82 });
        shared.set(m.name, lighting.setup(m, m.name === 'car-glass' ? 'carglass-model' : m.name));
      }
      return shared.get(m.name)!;
    };
    const top = g.scene.children.length === 1 && !g.scene.children[0].name ? g.scene.children[0] : g.scene;
    for (const car of [...top.children]) {
      car.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material) ? m.material.map((x) => setup(x as THREE.MeshStandardMaterial)) : setup(m.material as THREE.MeshStandardMaterial);
        m.castShadow = m.receiveShadow = true;
      });
      this.protos.set(car.name, car);
    }
  }

  has(kind: string): boolean {
    return !!MODELS[kind] && MODELS[kind].some((k) => this.protos.has(k));
  }

  /** The model standing in for `kind` (seeded), or null. */
  pick(kind: string, seed: number): string | null {
    const list = (MODELS[kind] ?? []).filter((k) => this.protos.has(k));
    return list.length ? list[Math.abs(Math.floor(seed)) % list.length] : null;
  }

  /** Uniform scale that fits the model to the game's length for `kind`. */
  scale(key: string, kind: string): number {
    const box = new THREE.Box3().setFromObject(this.protos.get(key)!);
    return (LENGTH[kind] ?? 4.4) / (box.max.z - box.min.z);
  }

  private bodyMaterial(key: string, paint: string | null): THREE.Material | null {
    const src = this.findBody(key);
    if (!src) return null;
    const id = `${key}|${paint ?? 'inst'}`, cache = paint ? this.paints : this.instanced;
    if (!cache.has(id)) {
      const m = src.clone();
      m.color.set(PAINT[paint ?? ''] ?? paint ?? '#ffffff');
      m.name = 'car-model-paint';
      cache.set(id, this.lighting.setup(m, 'car-model-paint', paintHook));
    }
    return cache.get(id)!;
  }

  /** Model size (m) once fitted to `kind`. */
  size(key: string, kind: string): THREE.Vector3 {
    return new THREE.Box3().setFromObject(this.protos.get(key)!).getSize(new THREE.Vector3()).multiplyScalar(this.scale(key, kind));
  }

  private findBody(key: string): THREE.MeshStandardMaterial | null {
    let body: THREE.MeshStandardMaterial | null = null;
    this.protos.get(key)!.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      for (const x of ([] as THREE.Material[]).concat(m ?? [])) if (/-body$/.test(x.name)) body = x as THREE.MeshStandardMaterial;
    });
    return body;
  }

  private swapBody(mat: THREE.Material | THREE.Material[], body: THREE.Material | null): THREE.Material | THREE.Material[] {
    if (!body) return mat;
    return Array.isArray(mat) ? mat.map((x) => (/-body$/.test(x.name) ? body : x)) : /-body$/.test(mat.name) ? body : mat;
  }

  /** A car to place in the scene (+z forward, wheels as `userData.wheels` to spin), painted with `paint` (key or colour). */
  make(key: string, kind: string, paint: string | null): THREE.Group {
    const root = this.protos.get(key)!.clone(true), body = this.bodyMaterial(key, paint), wheels: THREE.Object3D[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (/_wheel\d$/.test(o.name)) wheels.push(o);
      if (m.isMesh) m.material = this.swapBody(m.material as THREE.Material, body);
    });
    const g = new THREE.Group();
    const k = this.scale(key, kind);
    root.scale.multiplyScalar(k);
    root.position.multiplyScalar(k);
    g.add(root);
    g.userData.wheels = wheels;
    const wb = wheels[0] ? new THREE.Box3().setFromObject(wheels[0]) : null;
    g.userData.spinAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion.clone().invert());
    g.userData.wheelR = wb ? ((wb.max.y - wb.min.y) / 2) * k : 0.3;
    return g;
  }

  /** Meshes of a model in car space (scaled to `kind`), with the instanced body material: for parked-car instancing. */
  parts(key: string, kind: string): CarPart[] {
    const root = this.protos.get(key)!, s = this.scale(key, kind), out: CarPart[] = [], body = this.bodyMaterial(key, null);
    root.updateMatrixWorld(true);
    const scale = new THREE.Matrix4().makeScale(s, s, s);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      out.push({ geometry: m.geometry, material: this.swapBody(m.material as THREE.Material, body), matrix: scale.clone().multiply(m.matrixWorld), wheel: /_wheel\d$/.test(m.name) || /_wheel\d$/.test(m.parent?.name ?? '') });
    });
    return out;
  }
}

export const carModels = new CarModels();
