import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { car, type CarKind } from '../urbanProps';
import type { CoastDef } from '../coast';
import { EXTENT, SIDEWALK, northZ, streetHalf, type MaleconDef } from './layout';

const Q = new THREE.Quaternion();
const L = EXTENT + 30;

/** Asphalt draped over the ground along x (used for the beach road, whose ground is not perfectly flat). */
function drape(b: Builder, hf: Heightfield, z: number, half: number, mat: string, lift: number): void {
  const pos: number[] = [];
  const v = (x: number, zz: number) => pos.push(x, hf.heightAt(x, zz) + lift, zz);
  const rows = Math.max(1, Math.ceil(half)), dz = (half * 2) / rows;
  for (let x = -L; x < L; x += 2) for (let k = 0; k < rows; k++) {
    const a = z - half + k * dz, c = a + dz;
    v(x, a); v(x, c); v(x + 2, a);
    v(x + 2, a); v(x, c); v(x + 2, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  b.geometry(mat, geo, new THREE.Matrix4());
}

function laneLines(b: Builder, y: (x: number, z: number) => number, z: number, half: number, gaps: number[], double: boolean): void {
  for (let x = -L; x < L; x += 2) {
    if (gaps.some((g) => Math.abs(g - x) < 9)) continue;
    for (const s of [-1, 1]) b.box('roadWhite', [2, 0.02, 0.14], new THREE.Vector3(x + 1, y(x, z) + 0.05, z + s * (half - 0.5)), Q, false);
    if (double) for (const s of [-0.12, 0.12]) b.box('paintYellow', [2, 0.02, 0.1], new THREE.Vector3(x + 1, y(x, z) + 0.05, z + s), Q, false);
    else if (Math.round(x / 2) % 3 === 0) b.box('roadWhite', [3, 0.02, 0.14], new THREE.Vector3(x + 1, y(x, z) + 0.05, z), Q, false);
  }
}

function zebra(b: Builder, x: number, z: number, half: number, alongZ: boolean): void {
  for (let k = -half + 0.6; k < half - 0.4; k += 1.0) {
    b.box('roadWhite', alongZ ? [0.5, 0.02, 3.2] : [3.2, 0.02, 0.5], new THREE.Vector3(alongZ ? x + k : x, 0.05, alongZ ? z : z + k), Q, false);
  }
}

/** Pavement slab with a kerb on its road side. */
function pavement(b: Builder, x0: number, x1: number, z0: number, z1: number): void {
  b.box('pavement', [x1 - x0, 0.16, z1 - z0], new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), Q, false);
}

/** Avenue on the clifftop, grid streets, pavements, zebras; the beach road below with its jetties; parked cars. */
export function buildRoads(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, rand: () => number): THREE.Vector3[] {
  const av = def.avenue, sh = def.streets.half, trees: THREE.Vector3[] = [];
  const flat = () => 0;
  b.box('asphalt', [L * 2, 0.1, av.half * 2], new THREE.Vector3(0, -0.02, av.z), Q, false);
  laneLines(b, flat, av.z, av.half, def.streets.x, true);
  for (const s of [-1, 1]) pavement(b, -L, L, av.z + s * av.half + (s < 0 ? -SIDEWALK : 0), av.z + s * av.half + (s > 0 ? SIDEWALK : 0));
  for (const z of def.streets.z) {
    const h = streetHalf(def, z);
    if (def.boulevard?.z !== z) {
      b.box('asphalt', [L * 2, 0.1, sh * 2], new THREE.Vector3(0, -0.03, z), Q, false);
      laneLines(b, flat, z, sh, def.streets.x, true);
    }
    for (const s of [-1, 1]) pavement(b, -L, L, z + (s < 0 ? -h - SIDEWALK : h), z + (s < 0 ? -h : h + SIDEWALK));
  }
  const zMax = av.z - av.half, nz = northZ(def);
  for (const x of def.streets.x) {
    b.box('asphalt', [sh * 2, 0.1, zMax - nz], new THREE.Vector3(x, -0.025, (zMax + nz) / 2), Q, false);
    for (const s of [-1, 1]) pavement(b, x + (s < 0 ? -sh - SIDEWALK : sh), x + (s < 0 ? -sh : sh + SIDEWALK), nz, zMax - SIDEWALK);
    for (const z of [...def.streets.z, av.z]) {
      const h = z === av.z ? av.half : streetHalf(def, z);
      zebra(b, x, z + (z === av.z ? -av.half - 2 : h + 2), sh, true);
      for (const s of def.boulevard?.z === z ? [-1, 1] : [0]) zebra(b, x + sh + 2, z + s * (h - 3.5), s ? 3.5 : h, false);
    }
    for (let z = zMax - 10; z > nz + 3; z -= 9) if (!def.streets.z.some((sz) => Math.abs(sz - z) < streetHalf(def, sz) + 6)) trees.push(new THREE.Vector3(x + (rand() < 0.5 ? -1 : 1) * (sh + 1.2), 0, z));
  }
  for (let x = -L + 4; x < L; x += 11) {
    if (def.streets.x.some((sx) => Math.abs(sx - x) < sh + 6)) continue;
    for (const z of def.streets.z) trees.push(new THREE.Vector3(x, 0, z + (rand() < 0.5 ? -1 : 1) * (streetHalf(def, z) + 1.2)));
    trees.push(new THREE.Vector3(x + 5, 0, av.z - av.half - 1.4));
  }
  const br = def.beachRoad, beachY = (x: number, z: number) => hf.heightAt(x, z);
  drape(b, hf, br.z, br.half, 'asphalt', 0.08);
  drape(b, hf, br.z - br.half - 1.6, 1.6, 'pavement', 0.15);
  laneLines(b, beachY, br.z, br.half, [], true);
  for (let x = -L; x < L; x += 3) b.box('concrete', [3, 0.8, 0.5], new THREE.Vector3(x + 1.5, beachY(x, br.z + br.half + 0.6) + 0.3, br.z + br.half + 0.6), Q, true);
  for (const jx of [-170, -40, 95, 205]) {
    for (let z = br.z + br.half + 3; z < c.shore + 55; z += 2.2) {
      for (const s of [-1, 0, 1]) {
        const x = jx + s * 2.4 + (rand() - 0.5) * 1.2, size = 1.6 + rand() * 1.4, y = Math.max(hf.heightAt(x, z), c.sea - 1.5);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 0.6, rand() * 3, rand() * 0.6));
        b.box('boulder', [size, size * 0.8, size * 1.1], new THREE.Vector3(x, y + size * 0.25, z), q, z < c.shore + 2);
      }
    }
  }
  b.box('none', [L * 2, 6, 1], new THREE.Vector3(0, c.sea + 1, c.shore + 1.5), Q, true);
  if (def.north !== undefined) b.box('none', [L * 2, 12, 1], new THREE.Vector3(0, 5, nz - 0.5), Q, true);
  parkedCars(b, def, rand);
  return trees;
}

function parkedCars(b: Builder, def: MaleconDef, rand: () => number): void {
  const kinds: CarKind[] = ['sedan', 'sedan', 'wagon', 'pickup', 'sedan', 'tico', 'beetle'];
  const paints = ['car0', 'car1', 'car2', 'car4', 'car5', 'car0', 'car1'];
  const sh = def.streets.half;
  for (let i = 0; i < def.parkedCars; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)], paint = kind === 'tico' ? 'car3' : paints[Math.floor(rand() * paints.length)];
    const s = rand() < 0.5 ? 1 : -1;
    if (rand() < 0.55) {
      const sz = def.streets.z[Math.floor(rand() * def.streets.z.length)], z = sz + s * (streetHalf(def, sz) - 1.2), x = (rand() * 2 - 1) * (EXTENT - 5);
      if (def.streets.x.some((sx) => Math.abs(sx - x) < sh + 7)) continue;
      car(b, new THREE.Vector3(x, 0.03, z), (s > 0 ? -1 : 1) * Math.PI / 2, paint, kind);
    } else {
      const x = def.streets.x[Math.floor(rand() * def.streets.x.length)] + s * (sh - 1.2), nz = northZ(def), z = nz + 5 + rand() * (def.avenue.z - def.avenue.half - 12 - nz);
      if (def.streets.z.some((sz) => Math.abs(sz - z) < streetHalf(def, sz) + 7)) continue;
      car(b, new THREE.Vector3(x, 0.03, z), s > 0 ? 0 : Math.PI, paint, kind);
    }
  }
}
