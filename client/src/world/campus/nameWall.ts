import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { NameSign } from './pavilion';

export interface NameWallDef { x: number; z: number; yaw: number; len: number }

const H = 2.7, T = 0.45;

/**
 * The long white name wall on Av. Venezuela (user photos): rendered plaster, blue skirting, dark relief serif
 * «UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS» over «— Universidad del Perú, DECANA DE AMÉRICA», the coat of arms at
 * its left end, a coping and a clipped hedge along the front on a strip of paving. Faces +z of its own frame.
 */
export function nameWall(b: Builder, hf: Heightfield, w: NameWallDef): { signs: NameSign[]; seal: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } } {
  const yaw = (w.yaw * Math.PI) / 180, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const y0 = hf.heightAt(w.x, w.z);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(new THREE.Vector3(w.x, y0, w.z));
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = true) => b.box(mat, size, at(x, y, z), q, collide);
  box('uniWhite', [w.len, H, T], 0, H / 2, 0);
  box('roofWhite', [w.len + 0.2, 0.12, T + 0.14], 0, H + 0.06, 0, false);
  box('uniBlue', [w.len + 0.04, 0.32, T + 0.04], 0, 0.16, 0, false);
  box('plazaStone', [w.len + 2, 0.1, 3.4], 0, 0.05, T / 2 + 1.7, false);
  box('hedge', [w.len - 1.5, 0.75, 0.9], 0.75, 0.47, T / 2 + 0.75);
  box('kerbYellow', [w.len - 1.3, 0.14, 0.08], 0.75, 0.07, T / 2 + 1.24, false);
  const face = T / 2 + 0.03, left = -w.len / 2;
  const signs: NameSign[] = [
    { pos: at(1.2, 1.95, face), q, w: w.len * 0.78, text: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#2f2f33', font: 'serif' },
    { pos: at(1.2, 1.2, face), q, w: w.len * 0.6, text: '— Universidad del Perú, DECANA DE AMÉRICA', ink: '#3a3a3e', font: 'serif' },
  ];
  return { signs, seal: { pos: at(left + 2.1, 1.55, face + 0.02), q, size: 2.3 } };
}
