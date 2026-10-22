import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import { stall, trashPile } from './streetLife';
import { mototaxi } from './urbanProps';

/** A narrower paved street along x: centre `z`, `half` width of the asphalt. */
export interface RoadDef { z: number; half: number }

/** Worn asphalt draped over the ground (patches, potholes, faded broken centre line and zebras), stalls/mototaxis on the pavements. */
export function secondRoad(b: Builder, hf: Heightfield, x0: number, x1: number, road: RoadDef, crossX: number[], rand: () => number): void {
  const pos: number[] = [], uv: number[] = [];
  const v = (x: number, z: number) => {
    pos.push(x, hf.heightAt(x, z) + 0.035, z);
    uv.push(x / 6, z / 6);
  };
  for (let x = x0; x < x1; x += 2) {
    const a = road.z - road.half, c = road.z + road.half;
    v(x, a); v(x, c); v(x + 2, a);
    v(x + 2, a); v(x, c); v(x + 2, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  b.geometry('asphalt', geo, new THREE.Matrix4());
  const flat = (mat: string, size: [number, number, number], x: number, z: number, lift = 0.05) => b.box(mat, size, new THREE.Vector3(x, hf.heightAt(x, z) + lift, z), new THREE.Quaternion(), false);
  const nearCross = (x: number, gap: number) => crossX.some((cx) => Math.abs(cx - x) < gap);
  for (let x = x0 + 2; x < x1; x += 6) if (!nearCross(x, 6) && rand() < 0.7) flat('roadFaded', [1.2 + rand() * 1.8, 0.02, 0.12], x + rand() * 0.6, road.z + (rand() - 0.5) * 0.1);
  for (const cx of crossX) for (const side of [-1, 1]) for (let k = -3; k <= 3; k++) if (rand() < 0.6) flat('roadFaded', [0.5, 0.02, 0.6 + rand() * 0.5], cx + side * 5.6, road.z + k * 1.1);
  for (let i = 0; i < (x1 - x0) / 9; i++) {
    const x = x0 + rand() * (x1 - x0), z = road.z + (rand() - 0.5) * road.half * 1.6, big = rand() < 0.35;
    flat(big ? 'asphaltPatch' : 'pothole', big ? [2 + rand() * 4, 0.02, 1 + rand() * 2] : [0.4 + rand() * 0.8, 0.02, 0.3 + rand() * 0.6], x, z, big ? 0.04 : 0.045);
  }
  for (let x = x0 + 10; x < x1 - 10; x += 14 + rand() * 18) {
    if (nearCross(x, 7)) continue;
    const s = rand() < 0.5 ? 1 : -1, z = road.z + s * (road.half - 0.4);
    const r = rand();
    if (r < 0.4) stall(b, new THREE.Vector3(x, hf.heightAt(x, z) + 0.1, z), s > 0 ? Math.PI : 0, rand);
    else if (r < 0.65) mototaxi(b, new THREE.Vector3(x, hf.heightAt(x, z), z), Math.PI / 2 + (rand() < 0.5 ? 0 : Math.PI), `moto${Math.floor(rand() * 3)}`);
    else trashPile(b, new THREE.Vector3(x, hf.heightAt(x, z), z), rand);
  }
}
