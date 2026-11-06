import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxProjectUV, type Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import { photo } from '../render/photoTextures';
import { buildVegetation } from './malecon/vegetation';
import { mulberry32 } from '../core/rng';

const HALF = 1.2, KERB = 0.2, SEG = 2;

/**
 * Central berm of a Lima Este avenue (Huaycán, Av. 15 de Julio): kerbs painted in yellow and black blocks, a strip of
 * worn lawn and a row of trees and palms, broken at each cross street. Kerbs collide; everything is one draw per material.
 */
export function avenueMedian(b: Builder, hf: Heightfield, lighting: Lighting, x0: number, x1: number, crossX: number[]): THREE.Group {
  const r = mulberry32(415), geo: Record<'yellow' | 'black' | 'lawn', THREE.BufferGeometry[]> = { yellow: [], black: [], lawn: [] };
  const q = new THREE.Quaternion(), trees: THREE.Vector3[] = [], palms: THREE.Vector3[] = [];
  const box = (k: keyof typeof geo, w: number, h: number, d: number, x: number, y: number, z: number) => geo[k].push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  for (let x = x0; x < x1; x += SEG) {
    if (crossX.some((cx) => Math.abs(cx - x - SEG / 2) < 9)) continue;
    const y = Math.min(hf.heightAt(x, 0), hf.heightAt(x + SEG, 0)), cx = x + SEG / 2;
    const paint: keyof typeof geo = Math.round(x / SEG) % 2 ? 'yellow' : 'black';
    for (const s of [-1, 1]) {
      box(paint, SEG, KERB + 0.12, 0.16, cx, y + (KERB - 0.12) / 2, s * (HALF - 0.08));
      b.box('none', [SEG, KERB + 0.1, 0.16], new THREE.Vector3(cx, y + KERB / 2, s * (HALF - 0.08)), q, true);
    }
    box('lawn', SEG, KERB + 0.1, HALF * 2 - 0.32, cx, y + (KERB - 0.1) / 2, 0);
    b.box('none', [SEG, 0.04, HALF * 2 - 0.32], new THREE.Vector3(cx, y + KERB - 0.02, 0), q, true);
    if (Math.round(x / SEG) % 7 === 0 && r() < 0.85) (r() < 0.3 ? palms : trees).push(new THREE.Vector3(cx + (r() - 0.5), y + KERB - 0.05, (r() - 0.5) * 0.4));
  }
  const lawn = photo('lawn');
  const mats = {
    yellow: lighting.setup(new THREE.MeshStandardMaterial({ color: '#d8b42a', roughness: 0.75 }), 'median-yellow'),
    black: lighting.setup(new THREE.MeshStandardMaterial({ color: '#1d1d1d', roughness: 0.8 }), 'median-black'),
    lawn: lighting.setup(new THREE.MeshStandardMaterial({ map: lawn?.map ?? null, normalMap: lawn?.normalMap ?? null, color: lawn ? '#8f9a66' : '#6f7a45', roughness: 0.95 }), 'median-lawn'),
  };
  const g = new THREE.Group();
  for (const k of Object.keys(geo) as (keyof typeof geo)[]) {
    if (!geo[k].length) continue;
    const m = mergeGeometries(geo[k])!;
    boxProjectUV(m, k === 'lawn' ? 0.35 : 0.5);
    g.add(Object.assign(new THREE.Mesh(m, mats[k]), { castShadow: k !== 'lawn', receiveShadow: true }));
  }
  g.add(buildVegetation(b, { palms, phoenix: [], trees, bent: [], pines: [], seats: [], standing: [], arch: [] }, [], lighting));
  return g;
}
