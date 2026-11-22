import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxProjectUV, type Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import { photo } from '../render/photoTextures';
import { buildVegetation } from './malecon/vegetation';
import { mulberry32 } from '../core/rng';
import { addBreakable } from './breakables';

const HALF = 1.2, KERB = 0.2, SEG = 2;

/**
 * Central berm of a Lima Este avenue (Huaycán, Av. 15 de Julio): kerbs painted in yellow and black blocks, a strip of
 * worn lawn and a row of trees and palms, broken at each cross street. Kerbs collide; everything is one draw per material.
 */
export function avenueMedian(b: Builder, hf: Heightfield, lighting: Lighting, x0: number, x1: number, crossX: number[]): THREE.Group {
  const r = mulberry32(415), geo: Record<'yellow' | 'black' | 'lawn' | 'rail' | 'bush', THREE.BufferGeometry[]> = { yellow: [], black: [], lawn: [], rail: [], bush: [] };
  const rails: { at: THREE.Vector3; col: ReturnType<Builder['box']> }[] = [];
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
    const foot = new THREE.Vector3(cx, y + KERB, HALF - 0.08);
    rails.push({ at: foot, col: b.box('grate', [SEG, 0.9, 0.08], new THREE.Vector3(cx, y + KERB + 0.45, HALF - 0.08), q, true) });
    if (r() < 0.45) {
      const bx = cx + (r() - 0.5) * 1.2, bz = (r() - 0.5) * 0.9, s0 = 0.35 + r() * 0.3;
      for (let k = 0; k < 14; k++) {
        const lump = new THREE.IcosahedronGeometry(s0 * (0.22 + r() * 0.22), 1), p = lump.attributes.position;
        for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.75 + r() * 0.5), p.getY(i) * (0.7 + r() * 0.5), p.getZ(i) * (0.75 + r() * 0.5));
        lump.computeVertexNormals();
        const a = r() * 6.28, d = r() * s0 * 0.75;
        geo.bush.push(lump.translate(bx + Math.cos(a) * d, y + KERB + 0.1 + r() * s0 * 0.8, bz + Math.sin(a) * d * 0.6));
      }
    }
    if (Math.round(x / SEG) % 7 === 0 && r() < 0.85) (r() < 0.3 ? palms : trees).push(new THREE.Vector3(cx + (r() - 0.5), y + KERB - 0.05, (r() - 0.5) * 0.4));
  }
  const lawn = photo('lawn');
  const mats = {
    yellow: lighting.setup(new THREE.MeshStandardMaterial({ color: '#d8b42a', roughness: 0.75 }), 'median-yellow'),
    black: lighting.setup(new THREE.MeshStandardMaterial({ color: '#1d1d1d', roughness: 0.8 }), 'median-black'),
    rail: lighting.setup(new THREE.MeshStandardMaterial({ color: '#2f6b3a', roughness: 0.55, metalness: 0.5 }), 'median-rail'),
    bush: lighting.setup(new THREE.MeshStandardMaterial({ color: '#4a6530', roughness: 0.9, flatShading: true }), 'median-bush'),
    lawn: lighting.setup(new THREE.MeshStandardMaterial({ map: lawn?.map ?? null, normalMap: lawn?.normalMap ?? null, color: lawn ? '#8f9a66' : '#6f7a45', roughness: 0.95 }), 'median-lawn'),
  };
  const g = new THREE.Group();
  for (const k of Object.keys(geo) as (keyof typeof geo)[]) {
    if (!geo[k].length) continue;
    const m = mergeGeometries(geo[k])!;
    boxProjectUV(m, k === 'lawn' ? 0.35 : 0.5);
    g.add(Object.assign(new THREE.Mesh(m, mats[k]), { castShadow: k !== 'lawn', receiveShadow: true }));
  }
  const railGeo = mergeGeometries([new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6).translate(-SEG / 2, 0.4, 0), ...[0.45, 0.85].map((h) => new THREE.CylinderGeometry(0.022, 0.022, SEG, 6).rotateZ(Math.PI / 2).translate(0, h, 0))])!;
  const rail = Object.assign(new THREE.InstancedMesh(railGeo, mats.rail, rails.length), { castShadow: true, receiveShadow: true });
  rails.forEach((r, i) => (rail.setMatrixAt(i, new THREE.Matrix4().makeTranslation(r.at.x, r.at.y, r.at.z)), addBreakable(r.col, r.at, 0.9, 'rail', [{ mesh: rail, index: i }])));
  rail.computeBoundingSphere();
  g.add(rail);
  g.add(buildVegetation(b, { palms, phoenix: [], trees, bent: [], pines: [], seats: [], standing: [], arch: [] }, [], lighting));
  return g;
}
