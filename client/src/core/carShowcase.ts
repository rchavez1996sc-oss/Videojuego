import * as THREE from 'three';
import { Builder } from '../world/buildingKit';
import { car, mototaxi, type CarKind } from '../world/urbanProps';
import type { Heightfield } from '../world/heightfield';

const COLORS: Record<string, string> = {
  car0: '#c9c6bf', car1: '#2a2c30', car2: '#7a1d1a', car3: '#e2c22e', car4: '#2b4c7a', car5: '#eeeeea', moto0: '#b3221d',
  glass: '#20272d', tire: '#151515', rim: '#9a9ea3', plastic: '#1d1e20', plate: '#e8e4d2', light: '#f4efe0', tail: '#9c1a14',
  bars: '#202224', stripe: '#b8261b', checker: '#111111', seat: '#2a2a2a', canopy: '#2b2f6b', none: '#000000',
};

/** Debug: one of each vehicle in a row from (x, z) along +x, on the terrain, for close-up review. */
export function carShowcase(scene: THREE.Scene, hf: Heightfield, x: number, z: number): number[][] {
  const b = new Builder(null, null), kinds: (CarKind | 'moto')[] = ['sedan', 'tico', 'wagon', 'pickup', 'combi', 'beetle', 'moto'], at: number[][] = [];
  kinds.forEach((k, i) => {
    const p = new THREE.Vector3(x + i * 6, hf.heightAt(x + i * 6, z), z);
    if (k === 'moto') mototaxi(b, p, Math.PI / 2, 'moto0');
    else car(b, p, Math.PI / 2, `car${i % 6}`, k);
    at.push([p.x, p.y, p.z]);
  });
  const mats = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: k === 'glass' ? 0.05 : k.startsWith('car') || k === 'moto0' ? 0.3 : 0.6, metalness: k === 'rim' ? 0.8 : k.startsWith('car') ? 0.4 : 0 })]));
  for (const m of b.build(mats, 0.5)) { m.castShadow = true; scene.add(m); }
  return at;
}
