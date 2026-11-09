import { rideBike } from '../entities/bikePose';
import * as THREE from 'three';
import type { CarKind } from '../world/urbanProps';
import { vehicleLook, bikeLook } from '../systems/vehicleLook';
import { carModels } from '../render/carModels';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import { seatsOf, seatedRig } from '../entities/occupants';

const COLORS: Record<string, string> = {
  car0: '#c9c6bf', car1: '#2a2c30', car2: '#7a1d1a', car3: '#e2c22e', car4: '#2b4c7a', car5: '#eeeeea', moto0: '#b3221d',
  glass: '#20272d', tire: '#151515', rim: '#9a9ea3', plastic: '#1d1e20', plate: '#e8e4d2', light: '#f4efe0', tail: '#9c1a14',
  deliv0: '#f26b1d', deliv1: '#e3262f', deliv2: '#f5c518', bars: '#202224', stripe: '#b8261b', checker: '#111111', seat: '#2a2a2a', canopy: '#2b2f6b', none: '#000000',
};

/** Debug: one of each vehicle look in a row from (x, z) along +x (modelled variants included), with occupants. */
export function carShowcase(scene: THREE.Scene, hf: Heightfield, x: number, z: number, lighting?: Lighting): number[][] {
  if (!lighting) return [];
  const mats = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })]));
  const list: [CarKind | 'moto' | 'delivery', number][] = [['delivery', 0], ['delivery', 1], ['tico', 1], ['tico', 0], ['combi', 1], ['combi', 3], ['micro', 0], ['micro', 1], ['moto', 0], ['beetle', 0]], at: number[][] = [];
  let cx = x;
  list.forEach(([k, n], i) => {
    const len = k === 'micro' ? 9 : k === 'delivery' ? 2.5 : 5, p = new THREE.Vector3(cx + len / 2, hf.heightAt(cx + len / 2, z), z);
    cx += len + 1.5;
    const g = k === 'delivery' ? bikeLook(lighting, { materials: mats, bake: [] }, n) : vehicleLook(lighting, { materials: mats, bake: [] }, k, k === 'moto' ? 'moto0' : `car${i % 6}`, carModels.pick(k, n), n + 1);
    g.position.copy(p);
    g.rotation.y = Math.PI / 2;
    for (const [j, [sx, sy, sz]] of seatsOf(g, k).entries()) {
      const r = seatedRig(lighting, Math.random, k !== 'moto' && k !== 'delivery', undefined, j === 0);
      if (!r) continue;
      if (k === 'delivery') rideBike(r, sy);
      r.position.set(sx, sy, sz);
      g.add(r);
    }
    g.traverse((o) => ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    scene.add(g);
    at.push([p.x, p.y, p.z]);
  });
  return at;
}
