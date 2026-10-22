import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { powerLine } from '../urbanProps';
import { EXTENT, SIDEWALK, streetHalf, type MaleconDef } from './layout';
import { bin } from './boulevard';

const Q = new THREE.Quaternion(), L = EXTENT + 30;

/** White lane arrow painted on the asphalt, pointing along `dir` (+1/−1 in x, or in z when `alongZ`). */
function arrow(b: Builder, x: number, z: number, dir: number, alongZ: boolean): void {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), alongZ ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
  const p = (u: number, v: number) => new THREE.Vector3(u, 0.045, v).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
  b.box('roadWhite', [0.18, 0.02, 2.2], p(0, -0.6), q, false);
  for (const s of [-1, 1]) b.box('roadWhite', [0.18, 0.02, 0.9], p(s * 0.28, 0.75), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s * 0.7)), false);
}

/**
 * Miraflores street dressing: yellow-painted kerbs, lane arrows near the corners, timber poles with cables
 * on the inland streets, a brick planter wall along the park and a bollard-lined bike lane on the seafront avenue.
 */
export function streetDetail(b: Builder, hf: Heightfield, def: MaleconDef, rand: () => number): void {
  const sh = def.streets.half, av = def.avenue, xs = def.streets.x;
  const near = (x: number, gap: number) => xs.some((sx) => Math.abs(sx - x) < gap);
  const kerbX = (z: number) => {
    let a = -L;
    for (const sx of [...xs, L + sh + 4]) {
      const e = sx - sh - SIDEWALK;
      if (e > a) b.box('kerbYellow', [e - a, 0.18, 0.16], new THREE.Vector3((a + e) / 2, 0.05, z), Q, false);
      a = sx + sh + SIDEWALK;
    }
  };
  for (const z of def.streets.z) for (const s of [-1, 1]) kerbX(z + s * (streetHalf(def, z) + 0.08));
  kerbX(av.z - av.half - 0.08);
  b.box('kerbYellow', [L * 2, 0.18, 0.16], new THREE.Vector3(0, 0.05, av.z + av.half + 0.08), Q, false);
  const zMax = av.z - av.half - SIDEWALK;
  for (const x of xs) for (const s of [-1, 1]) b.box('kerbYellow', [0.16, 0.18, zMax + L], new THREE.Vector3(x + s * (sh + 0.08), 0.05, (zMax - L) / 2), Q, false);

  for (const z of def.streets.z) {
    if (def.boulevard?.z === z) continue;
    for (const x of xs) for (const s of [-1, 1]) arrow(b, x + s * 14, z - s * sh / 2, -s, false);
  }
  for (const x of xs) for (const z of def.streets.z) for (const s of [-1, 1]) arrow(b, x - s * sh / 2, z + streetHalf(def, z) + 14, -s, true);

  const lineZ = Math.min(...def.streets.z);
  for (const s of [-1, 1]) {
    const poles: THREE.Vector3[] = [];
    for (let x = -L; x < L; x += 28 + rand() * 6) if (!near(x, sh + 3)) poles.push(new THREE.Vector3(x, 0, lineZ + s * (streetHalf(def, lineZ) + 0.6)));
    powerLine(b, hf, poles, rand);
  }
  for (const x of xs) {
    const poles: THREE.Vector3[] = [];
    for (let z = zMax - 8; z > -L; z -= 30) if (!def.streets.z.some((sz) => Math.abs(sz - z) < streetHalf(def, sz) + 5)) poles.push(new THREE.Vector3(x + sh + 0.6, 0, z));
    powerLine(b, hf, poles, rand);
  }

  const wallZ = av.z + av.half + SIDEWALK + 0.2;
  for (let x = -L; x < L; x += 4) {
    const gap = ((x + EXTENT - 24) % 48 + 48) % 48;
    if (gap < 3 || gap > 45) continue;
    b.box('brickRed', [4, 0.75, 0.35], new THREE.Vector3(x + 2, 0.37, wallZ), Q, true);
    b.box('pavement', [4, 0.06, 0.45], new THREE.Vector3(x + 2, 0.77, wallZ), Q, false);
  }
  for (let x = -L; x < L; x += 4) {
    if (near(x, sh + 4)) continue;
    const m = new THREE.Matrix4().makeTranslation(x, 0, av.z + av.half - 1.5);
    b.geometry('bollardGreen', new THREE.CylinderGeometry(0.07, 0.08, 0.9, 10).translate(0, 0.45, 0), m);
    b.geometry('tail', new THREE.CylinderGeometry(0.075, 0.075, 0.08, 10).translate(0, 0.8, 0), m);
  }
  for (let x = -L; x < L; x += 3) if (!near(x, sh + 4)) b.box('roadWhite', [2, 0.02, 0.12], new THREE.Vector3(x + 1, 0.04, av.z + av.half - 1.95), Q, false);
  for (let x = -L + 20; x < L; x += 36) bin(b, new THREE.Vector3(x, 0.08, av.z - av.half - SIDEWALK + 0.6));
}
