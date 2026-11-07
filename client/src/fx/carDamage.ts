import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { paintHook } from '../render/carModels';

const NOISE = /* glsl */ `
float dmgHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dmgNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dmgHash(i), dmgHash(i + vec3(1, 0, 0)), f.x), mix(dmgHash(i + vec3(0, 1, 0)), dmgHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dmgHash(i + vec3(0, 0, 1)), dmgHash(i + vec3(1, 0, 1)), f.x), mix(dmgHash(i + vec3(0, 1, 1)), dmgHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

/**
 * Crash wear on car paint, driven by the per-vertex `damage` that `dent` writes around each impact (0 on undamaged
 * cars: the attribute is simply absent). Ragged patches where the paint flaked off to grey primer and bare steel,
 * scrape streaks running along the body, dark crumple grime in the worst of it; damaged areas lose the gloss.
 */
export function damageHook(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float damage;\nvarying float vDamage;\nvarying vec3 vDmgP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDamage = damage;\nvDmgP = position * length(modelMatrix[0].xyz);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying float vDamage;\nvarying vec3 vDmgP;\n${NOISE}`)
    .replace('#include <emissivemap_fragment>', `
  if (vDamage > 0.01) {
    float n = dmgNoise(vDmgP * 6.0) * 0.65 + dmgNoise(vDmgP * 19.0) * 0.35;
    float flake = smoothstep(0.62, 0.7, vDamage + (n - 0.5) * 0.8);
    float row = floor(vDmgP.y * 140.0 + dmgNoise(vDmgP * vec3(2.0, 0.0, 2.0)) * 4.0);
    float scrape = step(0.86, dmgHash(vec3(row, 3.1, 7.7))) * smoothstep(0.2, 0.55, vDamage + (dmgNoise(vDmgP * vec3(1.5, 40.0, 1.5)) - 0.5) * 0.5);
    vec3 bare = mix(vec3(0.16, 0.16, 0.155), vec3(0.3, 0.3, 0.31), smoothstep(0.4, 0.7, n));
    float edge = flake * (1.0 - smoothstep(0.66, 0.8, vDamage + (n - 0.5) * 0.8));
    diffuseColor.rgb = mix(diffuseColor.rgb, bare, flake);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.09, 0.04), edge * 0.6 * dmgNoise(vDmgP * 25.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.42, 0.44), scrape * 0.55);
    diffuseColor.rgb *= 1.0 - 0.55 * smoothstep(0.6, 1.0, vDamage) * n;
    diffuseColor.rgb *= 1.0 - 0.2 * smoothstep(0.1, 0.5, vDamage) * dmgNoise(vDmgP * 14.0);
    roughnessFactor = mix(roughnessFactor, 0.72, max(flake, smoothstep(0.3, 0.8, vDamage)));
    metalnessFactor = mix(metalnessFactor, 0.55, scrape * (1.0 - flake));
  }
  #include <emissivemap_fragment>`);
}

let cracked: THREE.Material | null = null, glassLighting: Lighting | null = null;
/** The lighting the shattered-glass material is set up with (set once the car models load). */
export const useGlassLighting = (l: Lighting) => void (glassLighting = l);

/**
 * Shattered safety glass: a spider-web of white cracks (Voronoi cell edges in model space, finer near the impact
 * centre of each pane) over a cloudier, less see-through pane.
 */
export function crackedGlass(lighting: Lighting): THREE.Material {
  return (cracked ??= lighting.setup(new THREE.MeshStandardMaterial({ color: '#2a3036', roughness: 0.25, metalness: 0, transparent: true, opacity: 0.9, envMapIntensity: 1.6, side: THREE.DoubleSide }), 'car-glass-cracked', (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlassP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlassP = position * length(modelMatrix[0].xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vGlassP;\n${NOISE}`)
      .replace('#include <emissivemap_fragment>', `
  {
    vec3 p = vGlassP * 11.0 + dmgNoise(vGlassP * 14.0) * 0.4;
    vec3 c = floor(p);
    float d1 = 9.0, d2 = 9.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 cell = c + vec3(x, y, z), q = cell + vec3(dmgHash(cell), dmgHash(cell + 5.3), dmgHash(cell + 9.1));
      float d = length(q - p);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    float crack = (1.0 - smoothstep(0.0, 0.05, d2 - d1)) * smoothstep(0.3, 0.6, dmgNoise(vGlassP * 3.0) + 0.15);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.87, 0.88), crack * 0.85);
    diffuseColor.a = max(diffuseColor.a, crack);
    roughnessFactor = mix(roughnessFactor, 0.6, crack);
  }
  #include <emissivemap_fragment>`);
  }));
}

/** Writes crash damage into the `damage` attribute of a dented (float, own copy) geometry around point `p` (mesh space). */
export function markDamage(geo: THREE.BufferGeometry, p: THREE.Vector3, radius: number, amount: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  let dmg = geo.attributes.damage as THREE.BufferAttribute | undefined;
  if (!dmg) geo.setAttribute('damage', (dmg = new THREE.BufferAttribute(new Float32Array(pos.count), 1)));
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const d = v.fromBufferAttribute(pos, i).distanceTo(p);
    if (d < radius) dmg.setX(i, Math.min(1, dmg.getX(i) + (1 - d / radius) * amount));
  }
  dmg.needsUpdate = true;
}

const damaged = new Map<THREE.Material, THREE.Material>();

/**
 * The crash-wear twin of a paint material (shared by every damaged car; only dented meshes, which carry the `damage`
 * attribute, use it — an absent attribute would read whatever generic value the GL state holds). Others pass through.
 */
function damagedTwin(m: THREE.Material): THREE.Material {
  const model = m.name === 'car-model-paint';
  if (!glassLighting || !(model || m.name === 'carpaint-baked')) return m;
  if (!damaged.has(m)) damaged.set(m, glassLighting.setup(Object.assign(m.clone(), { name: `${m.name}-dmg` }), `${m.name}-dmg`, (sh) => (model && paintHook(sh), damageHook(sh))));
  return damaged.get(m)!;
}

/** Swaps a mesh's paint to its damage twin (once) and writes the damage around `p` (mesh space). */
export function damageMesh(m: THREE.Mesh, p: THREE.Vector3, radius: number, amount: number): void {
  m.material = Array.isArray(m.material) ? m.material.map(damagedTwin) : damagedTwin(m.material);
  markDamage(m.geometry, p, radius, amount);
}

/** Cracks the glass of a vehicle near an impact (strong hits only): those panes swap to the shattered material. */
export function crackGlass(group: THREE.Object3D, at: THREE.Vector3, reach: number): void {
  if (!glassLighting) return;
  const box = new THREE.Box3(), glass = crackedGlass(glassLighting);
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o.name === 'rider') return;
    const mats = ([] as THREE.Material[]).concat(m.material);
    if (!mats.some((x) => /glass/i.test(x.name) && x !== glass)) return;
    if (box.setFromObject(m).distanceToPoint(at) > reach) return;
    m.material = Array.isArray(m.material) ? m.material.map((x) => (/glass/i.test(x.name) ? glass : x)) : glass;
  });
}
