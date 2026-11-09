import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Lighting } from '../render/lighting';

/** A static model placed in a level (key in `manifest.models`): ground position, yaw, optional height and scale. */
export interface ModelSpot { key: string; x: number; z: number; yaw?: number; y?: number; scale?: number; solid?: boolean }

const spots: ModelSpot[] = [];
if (location.search.includes('shot')) (window as unknown as { __models: unknown }).__models = spots;

/** Registers a model while the level is built (from code or from the chapter's `models` list). */
export function addModel(s: ModelSpot): void {
  spots.push(s);
}

/**
 * Places every registered model once the manifest's glbs load: one instanced mesh per part and key, sat on the
 * ground (`hf`) unless `y` is given, with a fixed box collider over the footprint for solid ones (statues, booths,
 * walls). Photogrammetry scans keep their own ground patch, sunk 3 cm so it blends into the street.
 */
export async function placeModels(scene: THREE.Object3D, lighting: Lighting, world: RAPIER.World, hf: { heightAt(x: number, z: number): number }): Promise<void> {
  if (!spots.length) return;
  const base = `${import.meta.env.BASE_URL}assets/`;
  const manifest = await fetch(`${base}manifest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  const urls: Record<string, string> = manifest?.models ?? {};
  const loader = new GLTFLoader(), body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s3 = new THREE.Vector3();
  for (const key of new Set(spots.map((s) => s.key))) {
    if (!urls[key]) continue;
    const gltf = await loader.loadAsync(`${base}${urls[key]}?v=${manifest.version}`).catch(() => null);
    if (!gltf) continue;
    gltf.scene.updateMatrixWorld(true);
    const mine = spots.filter((s) => s.key === key), box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3());
    const place = mine.map((s) => m4.clone().compose(new THREE.Vector3(s.x, (s.y ??= hf.heightAt(s.x, s.z)) - 0.03 - box.min.y * (s.scale ?? 1), s.z), q.clone().setFromAxisAngle(up, s.yaw ?? 0), s3.setScalar(s.scale ?? 1)));
    gltf.scene.traverse((o) => {
      const part = o as THREE.Mesh;
      if (!part.isMesh) return;
      const src = part.material as THREE.MeshStandardMaterial;
      const mat = lighting.setup(Object.assign(src.clone(), { roughness: Math.max(0.7, src.roughness), metalness: 0 }), `model-${key}`);
      const im = new THREE.InstancedMesh(part.geometry.clone().applyMatrix4(part.matrixWorld), mat, mine.length);
      place.forEach((p, i) => im.setMatrixAt(i, p));
      im.castShadow = im.receiveShadow = true;
      im.frustumCulled = false;
      im.name = `model-${key}`;
      scene.add(im);
    });
    mine.forEach((s, i) => {
      if (s.solid === false) return;
      const k = s.scale ?? 1, c = box.getCenter(new THREE.Vector3()).multiplyScalar(k).applyQuaternion(q.setFromAxisAngle(up, s.yaw ?? 0)).add(new THREE.Vector3().setFromMatrixPosition(place[i]));
      world.createCollider(RAPIER.ColliderDesc.cuboid((size.x * k) / 2 * 0.8, (size.y * k) / 2, (size.z * k) / 2 * 0.8).setTranslation(c.x, c.y, c.z).setRotation(q), body);
    });
  }
}

/** Scatter rule: `count` copies of `key` beside the walkable graph, inside `area` [x0, z0, x1, z1] when given. */
export interface ModelScatter { key: string; count: number; area?: [number, number, number, number]; spacing?: number; side?: number; solid?: boolean; clear?: number; offRoad?: boolean }

/**
 * Spots beside the pedestrian graph (an edge's midpoint pushed `side` m off its line, facing it), on free ground —
 * no collider within the footprint (`clear` m around) — and at least `spacing` m from any earlier spot of the same key.
 */
export function scatterModels(graph: { nodes: THREE.Vector3[]; edges: [number, number][] }, world: RAPIER.World, rules: ModelScatter[], rand: () => number, ground: (x: number, z: number) => number, road?: (x: number, z: number) => boolean): void {
  const rot = { x: 0, y: 0, z: 0, w: 1 };
  for (const r of rules) {
    const c = r.clear ?? 0.6, shape = new RAPIER.Cuboid(c, 0.9, c);
    const taken: THREE.Vector3[] = [];
    for (let tries = 0; taken.length < r.count && tries < r.count * 40; tries++) {
      const [a, b] = graph.edges[Math.floor(rand() * graph.edges.length)], A = graph.nodes[a], B = graph.nodes[b];
      const t = 0.2 + rand() * 0.6, x0 = A.x + (B.x - A.x) * t, z0 = A.z + (B.z - A.z) * t, len = Math.hypot(B.x - A.x, B.z - A.z);
      if (len < 4) continue;
      const nx = -(B.z - A.z) / len, nz = (B.x - A.x) / len, s = rand() < 0.5 ? 1 : -1, off = r.side ?? 1.6;
      const x = x0 + nx * s * off, z = z0 + nz * s * off;
      if (r.area && (x < r.area[0] || z < r.area[1] || x > r.area[2] || z > r.area[3])) continue;
      if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < (r.spacing ?? 25))) continue;
      const k = r.clear ?? 0.6;
      if (r.offRoad && road && [[0, 0], [k, k], [-k, k], [k, -k], [-k, -k]].some(([a, b]) => road(x + a, z + b))) continue;
      const y = ground(x, z);
      let hit = false;
      world.intersectionsWithShape({ x, y: y + 1.0, z }, rot, shape, () => ((hit = true), false));
      if (hit) continue;
      taken.push(new THREE.Vector3(x, y, z));
      addModel({ key: r.key, x, z, y, yaw: Math.atan2(-nx * s, -nz * s), solid: r.solid });
    }
  }
}
