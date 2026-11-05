import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';

type Rand = () => number;

/** Two-sided triangle pennant hanging from `p` (local x along the string, pointing down). */
function pennant(dir: THREE.Vector3, p: THREE.Vector3, size: number): THREE.BufferGeometry {
  const a = p.clone().addScaledVector(dir, -size / 2), c = p.clone().addScaledVector(dir, size / 2), tip = p.clone().add(new THREE.Vector3(0, -size * 1.25, 0));
  const pos = [a, c, tip, c, a, tip].flatMap((v) => [v.x, v.y, v.z]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0, 1, 1, 0, 1, 0.5, 0], 2));
  g.computeVertexNormals();
  return g;
}

/** A sagging string of red-and-white pennants (Fiestas Patrias) from `a` to `c`. */
export function bunting(b: Builder, a: THREE.Vector3, c: THREE.Vector3, rand: Rand): void {
  const len = a.distanceTo(c), sag = 0.25 + len * 0.04 + rand() * 0.3, dir = c.clone().sub(a).setY(0).normalize();
  const at = (t: number) => a.clone().lerp(c, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0));
  const n = Math.max(4, Math.round(len / 0.42));
  for (let i = 0; i < n; i++) {
    const p = at(i / n), q = at((i + 1) / n), mid = p.clone().lerp(q, 0.5), l = p.distanceTo(q);
    b.geometry('cable', new THREE.CylinderGeometry(0.012, 0.012, l, 3).rotateZ(Math.PI / 2).rotateY(-Math.atan2(q.z - p.z, q.x - p.x)), new THREE.Matrix4().makeTranslation(mid.x, mid.y, mid.z));
    b.geometry(i % 2 ? 'plate' : 'stripe', pennant(dir, mid, 0.3), new THREE.Matrix4());
  }
}

/**
 * Pennant strings across the residential streets between block rows (house fronts face each other there):
 * each block stretch gets 2–4 strings at second-floor height with probability `share`.
 */
export function festiveStreets(b: Builder, hf: Heightfield, xs: [number, number][], zMid: number, half: number, share: number, rand: Rand): void {
  for (const s of [1, -1]) for (const [x0, x1] of xs) {
    if (rand() > share) continue;
    const n = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const x = x0 + ((k + 0.5 + (rand() - 0.5) * 0.6) / n) * (x1 - x0), skew = (rand() - 0.5) * 3;
      const za = s * zMid - half, zc = s * zMid + half, h = 4.4 + rand() * 0.8;
      bunting(b, new THREE.Vector3(x, hf.heightAt(x, za) + h, za), new THREE.Vector3(x + skew, hf.heightAt(x + skew, zc) + h, zc), rand);
    }
  }
}
