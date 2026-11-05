import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { PAINTS } from './houses';
import { STREET_COLORS } from './streetLife';
import { plaster } from '../render/urbanTextures';

/** Road markings: their own group so the weathering pass can fade and chip them. */
const ROAD_PAINT = ['roadWhite', 'roadFaded', 'paintYellow'];
const CAR_PAINT = ['car0', 'car1', 'car2', 'car3', 'car4', 'car5', 'moto0', 'moto1', 'moto2'];

/** Plain-coloured keys folded into vertex-coloured materials (painted plaster, road markings, everything else). */
export function bakeGroups(lighting: Lighting, extra: string[] = []): { material: THREE.Material; keys: string[] }[] {
  const pl = plaster();
  return [
    { material: lighting.setup(new THREE.MeshStandardMaterial({ map: pl.map, normalMap: pl.normalMap, roughness: 0.9, vertexColors: true }), 'paint-baked'), keys: PAINTS },
    { material: lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true }), 'road-paint'), keys: ROAD_PAINT },
    { material: lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.24, metalness: 0.5, envMapIntensity: 1.5, vertexColors: true }), 'carpaint-baked'), keys: CAR_PAINT },
    { material: lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.04, metalness: 0, envMapIntensity: 2.2, vertexColors: true }), 'carglass-baked'), keys: ['glass'] },
    { material: lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, vertexColors: true }), 'plain-baked'),
      keys: ['tankBlack', 'tankBlue', 'stripe', 'checker', 'canopy', 'seat', 'tire', 'bars', 'rebar', 'cable', 'light', 'rim', 'plate', 'tail', 'plastic', ...Object.keys(STREET_COLORS), ...extra].filter((k) => !ROAD_PAINT.includes(k) && !CAR_PAINT.includes(k) && k !== 'glass') },
  ];
}

/**
 * Every other material that differs from another only in colour (same maps, finish (roughness to the nearest 0.1), side, no emission or
 * transparency, plain weathering shader) folds into one vertex-coloured material per look: same picture, far
 * fewer draw calls. `taken` = keys already baked; roads and special shaders keep their own material.
 */
export function autoBake(lighting: Lighting, materials: Record<string, THREE.Material>, taken: { keys: string[] }[]): { material: THREE.Material; keys: string[] }[] {
  const used = new Set(taken.flatMap((g) => g.keys)), looks = new Map<string, string[]>();
  for (const [key, m] of Object.entries(materials)) {
    if (used.has(key) || !(m instanceof THREE.MeshStandardMaterial) || m instanceof THREE.MeshPhysicalMaterial || m.customProgramCacheKey() !== 'wear') continue;
    if (m.vertexColors || m.transparent || m.alphaTest > 0 || m.alphaMap || m.emissiveMap || m.emissive.getHex() !== 0 || m.lightMap || m.aoMap || m.displacementMap || m.envMap) continue;
    const look = [m.map?.uuid, m.normalMap?.uuid, m.roughnessMap?.uuid, m.metalnessMap?.uuid, m.bumpMap?.uuid, Math.round(m.roughness * 10), Math.round(m.metalness * 10), m.side, m.envMapIntensity, m.normalScale.x, m.normalScale.y, m.flatShading, m.depthWrite, m.polygonOffset, m.polygonOffsetFactor].join('|');
    (looks.get(look) ?? looks.set(look, []).get(look)!).push(key);
  }

  return [...looks.values()].filter((keys) => keys.length > 1).map((keys, i) => {
    const m = materials[keys[0]] as THREE.MeshStandardMaterial;
    const avg = (ks: string[], p: 'roughness' | 'metalness') => ks.reduce((t, k) => t + (materials[k] as THREE.MeshStandardMaterial)[p], 0) / ks.length;
    const mat = new THREE.MeshStandardMaterial({
      map: m.map, normalMap: m.normalMap, normalScale: m.normalScale.clone(), roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, bumpMap: m.bumpMap,
      roughness: avg(keys, 'roughness'), metalness: avg(keys, 'metalness'), side: m.side, envMapIntensity: m.envMapIntensity, flatShading: m.flatShading, depthWrite: m.depthWrite,
      polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, vertexColors: true,
    });
    return { material: lighting.setup(mat, `auto-${i}`), keys };
  });
}
