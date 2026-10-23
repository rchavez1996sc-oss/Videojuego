import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { EXTENT, type MaleconDef } from './layout';
import { bench, lamp, paintLawns, ribbon, type Plants } from './park';

const Q = new THREE.Quaternion(), L = EXTENT + 30;

/** Litter bin: green steel drum on a post. */
export function bin(b: Builder, at: THREE.Vector3): void {
  const m = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z);
  b.geometry('benchGreen', new THREE.CylinderGeometry(0.26, 0.24, 0.7, 12).translate(0, 0.55, 0), m);
  b.geometry('lampPole', new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).translate(0, 0.15, 0), m);
}

/**
 * Dual carriageway with a berma: paved promenade with a bike lane down the middle, lawn strips either side,
 * old crooked trees leaning in to form a tunnel, green benches, globe lamps and bins. Gaps at the crossings.
 */
export function buildBoulevard(b: Builder, hf: Heightfield, def: MaleconDef, plants: Plants, rand: () => number): void {
  const bv = def.boulevard;
  if (!bv) return;
  const z = bv.z, m = bv.median / 2, crossing = (x: number) => def.streets.x.some((sx) => Math.abs(sx - x) < def.streets.half + 3);
  for (const s of [-1, 1]) {
    const cz = z + s * (m + 3.5);
    b.box('asphalt', [L * 2, 0.1, 7], new THREE.Vector3(0, -0.03, cz), Q, false);
    for (let x = -L; x < L; x += 2) {
      if (crossing(x)) continue;
      if (Math.round(x / 2) % 3 === 0) b.box('roadWhite', [3, 0.02, 0.13], new THREE.Vector3(x + 1, 0.04, cz), Q, false);
      b.box('roadWhite', [2, 0.02, 0.13], new THREE.Vector3(x + 1, 0.04, cz + s * 3.1), Q, false);
    }
  }
  const runs: [number, number][] = [];
  let start: number | null = null;
  for (let x = -L; x <= L; x += 1) {
    if (!crossing(x) && start === null) start = x;
    if ((crossing(x) || x === L) && start !== null) {
      runs.push([start, x - 1]);
      start = null;
    }
  }
  for (const [x0, x1] of runs) {
    const len = x1 - x0, cx = (x0 + x1) / 2;
    for (const s of [-1, 1]) b.box('kerbYellow', [len, 0.18, 0.18], new THREE.Vector3(cx, 0.05, z + s * (m - 0.09)), Q, false);
    ribbon(b, hf, [new THREE.Vector2(x0, z), new THREE.Vector2(x1, z)], 5, 'pavement', 0.1);
    for (const s of [-1, 1]) b.box('paintYellow', [len, 0.02, 0.1], new THREE.Vector3(cx, 0.075, z + s * 1.2), Q, false);
    for (let x = x0 + 1; x < x1 - 1; x += 4) b.box('roadWhite', [2, 0.02, 0.08], new THREE.Vector3(x + 1, 0.075, z + 0.1), Q, false);
    for (let x = x0 + 3; x < x1 - 2; x += 8 + rand() * 2) for (const s of [-1, 1]) {
      plants.arch.push({ pos: new THREE.Vector3(x + rand() * 2, 0, z + s * (m - 1.2)), lean: -s * (0.16 + rand() * 0.12) });
    }
    for (let x = x0 + 6, k = 0; x < x1 - 4; x += 11, k++) {
      const s = k % 2 ? 1 : -1;
      bench(b, new THREE.Vector3(x, 0, z + s * 3.1), s > 0 ? Math.PI : 0, 'benchGreen');
      if (k % 2) lamp(b, new THREE.Vector3(x + 5, 0, z - s * 2.9));
      if (k % 3 === 1) bin(b, new THREE.Vector3(x + 1.6, 0, z + s * 3));
    }
  }
  paintLawns(hf, (x, zz) => (!crossing(x) && Math.abs(zz - z) > 3 && Math.abs(zz - z) < m - 0.4 ? 1 : 0), z - m - 2, z + m + 2);
}
