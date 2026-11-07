import * as THREE from 'three';
import { doorsOf } from '../systems/carDoors';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Lighting } from './lighting';
import { useGlassLighting } from '../fx/carDamage';

const BASE = `${import.meta.env.BASE_URL}assets/`;

/** Which modelled cars stand in for each game kind (a seed picks one), and the game length each is fitted to (m). */
const MODELS: Record<string, string[]> = {
  sedan: ['sedan', 'sedan', 'coupe', 'hatchback', 'lowA', 'lowC', 'camry'], tico: ['compact'], wagon: ['wagon', 'suv', 'minivan', 'lowD'], pickup: ['pickup', 'pickup', 'offroad', 'lowB'],
  combi: ['van'], micro: ['ussr', 'nagoya'], beetle: ['beetle'], moto: ['tuktuk'], delivery: ['motorbike'],
};
const LENGTH: Record<string, number> = { sedan: 4.3, tico: 3.3, wagon: 4.6, pickup: 5.0, combi: 4.8, micro: 8.6, beetle: 4.0, moto: 2.6, delivery: 2.05 };
/** Kinds whose model is also fitted to a width (buses and mototaxis come in other proportions; height follows the mean). */
const WIDTH: Record<string, number> = { combi: 1.85, micro: 2.35, moto: 1.4 };

/** Paint of the old procedural keys, so parked and traffic cars keep their palette (dusty Lima colours). */
export const PAINT: Record<string, string> = { car0: '#c9c6bf', car1: '#2a2c30', car2: '#7a1d1a', car3: '#e2c22e', car4: '#2b4c7a', car5: '#eeeeea', moto0: '#b8231d', moto1: '#1f4fa8', moto2: '#d9a21c' };

/**
 * Bodywork repaint: the packed map's red channel marks paint (the body texture holds it in grey), which takes the
 * instance colour (parked, instanced) or the material colour (traffic and driven cars; no custom uniform, so the
 * shared program keeps working for every paint); trims, tyres and lights keep their texture. Roughness and metalness
 * come from the same map's green and blue.
 */
export function paintHook(shader: THREE.WebGLProgramParametersWithUniforms): void {
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
    useGlassLighting(lighting);
    const manifest = await fetch(`${BASE}manifest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    const urls = [manifest?.cars, manifest?.vehicles].filter(Boolean) as string[];
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const g of await Promise.all(urls.map((u) => loader.loadAsync(`${BASE}${u}?v=${manifest.version ?? 0}`).catch(() => null)))) if (g) this.add(g.scene, lighting);
  }

  private add(scene: THREE.Object3D, lighting: Lighting): void {
    const shared = new Map<string, THREE.Material>();
    const setup = (m: THREE.MeshStandardMaterial) => {
      if (/-body$/.test(m.name)) return m;
      if (!shared.has(m.name)) {
        if (m.name === 'car-glass') Object.assign(m, { roughness: 0.04, metalness: 0, envMapIntensity: 2.2, transparent: true, opacity: 0.82 });
        shared.set(m.name, lighting.setup(m, m.name === 'car-glass' ? 'carglass-model' : m.name));
      }
      return shared.get(m.name)!;
    };
    const top = scene.children.length === 1 && !scene.children[0].name ? scene.children[0] : scene;
    for (const car of [...top.children]) {
      car.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material) ? m.material.map((x) => setup(x as THREE.MeshStandardMaterial)) : setup(m.material as THREE.MeshStandardMaterial);
        m.castShadow = m.receiveShadow = true;
      });
      pivotWheels(car);
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

  /** Scale that fits the model to the game's length (and width, for some kinds) of `kind`. */
  scale(key: string, kind: string): THREE.Vector3 {
    const s = new THREE.Box3().setFromObject(this.protos.get(key)!).getSize(new THREE.Vector3()), z = (LENGTH[kind] ?? 4.4) / s.z;
    const x = WIDTH[kind] ? WIDTH[kind] / s.x : z;
    return new THREE.Vector3(x, (x + z) / 2, z);
  }

  /** Size of the painted bodywork once fitted (mirrors and bumpers left out): where liveries go. */
  bodySize(key: string, kind: string): THREE.Box3 {
    const box = new THREE.Box3();
    this.protos.get(key)!.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /-body$/.test((m.material as THREE.Material).name)) box.expandByObject(m);
    });
    const k = this.scale(key, kind);
    return new THREE.Box3(box.min.multiply(k), box.max.multiply(k));
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
    return new THREE.Box3().setFromObject(this.protos.get(key)!).getSize(new THREE.Vector3()).multiply(this.scale(key, kind));
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
    root.scale.multiply(k);
    root.position.multiply(k);
    g.add(root);
    g.userData.wheels = wheels;
    g.userData.doors = doorsOf(g);
    g.userData.body = this.bodySize(key, kind);
    if (g.userData.doors.length) root.traverse((o) => (o as THREE.Mesh).isMesh && (((o as THREE.Mesh).material as THREE.Material).side = THREE.DoubleSide));
    g.userData.modelled = true;
    const wb = wheels[0] ? new THREE.Box3().setFromObject(wheels[0]) : null;
    g.userData.spinAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion.clone().invert());
    g.userData.wheelR = wb ? ((wb.max.y - wb.min.y) / 2) * k.y : 0.3;
    return g;
  }

  /** Meshes of a model in car space (scaled to `kind`), with the instanced body material: for parked-car instancing. */
  parts(key: string, kind: string): CarPart[] {
    const root = this.protos.get(key)!, s = this.scale(key, kind), out: CarPart[] = [], body = this.bodyMaterial(key, null);
    root.updateMatrixWorld(true);
    const scale = new THREE.Matrix4().makeScale(s.x, s.y, s.z);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      out.push({ geometry: m.geometry, material: this.swapBody(m.material as THREE.Material, body), matrix: scale.clone().multiply(m.matrixWorld), wheel: /_wheel\d$/.test(m.name) || /_wheel\d$/.test(m.parent?.name ?? '') });
    });
    return out;
  }
}

export const carModels = new CarModels();

/**
 * gltfpack moves a wheel's centring into its mesh, leaving the named node at the car origin: spun or steered about
 * that, the wheel swings round the car (onto the roof). Each such wheel gets a pivot node at its hub, under the name.
 */
function pivotWheels(car: THREE.Object3D): void {
  car.updateMatrixWorld(true);
  const wheels: THREE.Object3D[] = [];
  car.traverse((o) => /_wheel\d$/.test(o.name) && wheels.push(o));
  for (const w of wheels) {
    const parent = w.parent!, hub = parent.worldToLocal(new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3()));
    if (hub.distanceTo(w.position) < 0.02 / (parent.getWorldScale(new THREE.Vector3()).y || 1)) continue;
    const pivot = new THREE.Group();
    pivot.name = w.name;
    w.name += '_mesh';
    pivot.position.copy(hub);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(w);
  }
}
