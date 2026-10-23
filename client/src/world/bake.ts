import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { PAINTS } from './houses';
import { STREET_COLORS } from './streetLife';
import { plaster } from '../render/urbanTextures';

/** Road markings: their own group so the weathering pass can fade and chip them. */
const ROAD_PAINT = ['roadWhite', 'roadFaded', 'paintYellow'];

/** Plain-coloured keys folded into vertex-coloured materials (painted plaster, road markings, everything else). */
export function bakeGroups(lighting: Lighting, extra: string[] = []): { material: THREE.Material; keys: string[] }[] {
  const pl = plaster();
  return [
    { material: lighting.setup(new THREE.MeshStandardMaterial({ map: pl.map, normalMap: pl.normalMap, roughness: 0.9, vertexColors: true }), 'paint-baked'), keys: PAINTS },
    { material: lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true }), 'road-paint'), keys: ROAD_PAINT },
    { material: lighting.setup(new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, vertexColors: true }), 'plain-baked'),
      keys: ['car0', 'car1', 'car2', 'car3', 'car4', 'car5', 'moto0', 'moto1', 'moto2', 'tankBlack', 'tankBlue', 'stripe', 'checker', 'canopy', 'seat', 'tire', 'bars', 'rebar', 'cable', 'light', 'glass', 'rim', 'plate', 'tail', 'plastic', ...Object.keys(STREET_COLORS), ...extra].filter((k) => !ROAD_PAINT.includes(k)) },
  ];
}
