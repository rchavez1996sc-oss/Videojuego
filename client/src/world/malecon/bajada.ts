import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { RAVINE, edgeZ, ravineCentre, ravineFloor, type CoastDef } from '../coast';
import type { MaleconDef } from './layout';
import { ribbon } from './park';
import type { Plants } from './park';

const UP = new THREE.Vector3(0, 1, 0);

/** Black cast-iron street lamp with a four-sided glass lantern (the bajada's colonial lamps). */
function colonialLamp(b: Builder, at: THREE.Vector3): void {
  const m = (y: number) => new THREE.Matrix4().makeTranslation(at.x, at.y + y, at.z);
  b.geometry('lhBlack', new THREE.CylinderGeometry(0.2, 0.26, 0.6, 8), m(0.3));
  b.geometry('lhBlack', new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8), m(2.4));
  b.geometry('lanternGlass', new THREE.CylinderGeometry(0.22, 0.14, 0.55, 4).rotateY(Math.PI / 4), m(4.5));
  b.geometry('lhBlack', new THREE.ConeGeometry(0.3, 0.3, 4).rotateY(Math.PI / 4), m(4.92));
  b.box('none', [0.25, 4, 0.25], at.clone().setY(at.y + 2), new THREE.Quaternion(), true);
}

/** Box from a to c (centres), `size` = [width, height], aligned with the slope between them. */
function run(b: Builder, mat: string, a: THREE.Vector3, c: THREE.Vector3, w: number, h: number, collide: boolean): void {
  const d = c.clone().sub(a), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  b.box(mat, [w, h, len + 0.05], a.clone().lerp(c, 0.5), q, collide);
}

/**
 * Bajada Balta (from the user's photos): a cobbled road down the ravine floor from the avenue to the beach road,
 * yellow kerbs, grass verges with tall fan palms, black colonial lamps and benches, river-stone walls at the foot of
 * the grass banks and a tan retaining wall where the banks meet the street above.
 */
export function buildBajada(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, plants: Plants): void {
  const R = RAVINE, road = 3.6;
  for (const r of c.ravines ?? []) {
    const z0 = def.avenue.z + def.avenue.half, z1 = def.beachRoad.z - def.beachRoad.half, mouth = edgeZ(c, r.x) + c.run;
    const centre: THREE.Vector2[] = [];
    for (let z = z0; z <= z1; z += 1.5) centre.push(new THREE.Vector2(ravineCentre(r, Math.min(z, mouth)) + Math.max(0, z - mouth) * (r.skew ?? 0) + Math.max(0, z - mouth + 6) ** 2 * 0.045, z));
    ribbon(b, hf, centre, road * 2, 'cobble', 0.1);
    for (let z = r.head + 6; z < mouth - 2; z += 3.2) {
      const x = ravineCentre(r, z), f = ravineFloor(c, r, z), q = new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(r.skew ?? 0, 1));
      b.box('pirca', [road * 2 - 0.1, 0.16, 0.32], new THREE.Vector3(x, f + 0.12, z), q, false);
    }
    for (const s of [-1, 1]) ribbon(b, hf, centre.map((p) => new THREE.Vector2(p.x + s * (road + 0.12), p.y)), 0.25, 'kerbYellow', 0.16);
    for (let z = r.head + 2, i = 0; z < mouth - 2; z += 4, i++) {
      const x = ravineCentre(r, z), f = ravineFloor(c, r, z), zn = z + 4, fn = ravineFloor(c, r, zn), xn = ravineCentre(r, zn);
      for (const s of [-1, 1]) {
        const off = R.floor + R.lipRun / 2;
        run(b, 'pirca', new THREE.Vector3(x + s * off, f + R.lip / 2, z), new THREE.Vector3(xn + s * off, fn + R.lip / 2, zn), 1.0, R.lip + 0.4, true);
        const top = R.floor + R.lipRun + Math.max(0, R.top - f - R.lip) / R.slope + R.topRun * 0.5;
        const street = Math.min(hf.heightAt(x + s * (top + 2), z), hf.heightAt(xn + s * (top + 2), zn));
        if (f + R.lip < R.top - 0.5 && street > -0.6 && Math.abs(z + 2 - def.bridge.z) > def.bridge.width / 2 + 3) {
          const topN = R.floor + R.lipRun + Math.max(0, R.top - fn - R.lip) / R.slope + R.topRun * 0.5;
          run(b, 'stoneWall', new THREE.Vector3(x + s * top, R.top + 1.5, z), new THREE.Vector3(xn + s * topN, R.top + 1.5, zn), 0.7, 4.2, true);
        }
      }
      if (i % 2 === 0) for (const s of [-1, 1]) plants.palms.push(new THREE.Vector3(x + s * (road + 2.6), f, z));
      if (i % 5 === 1) plants.trees.push(new THREE.Vector3(x + (i % 10 === 1 ? 1 : -1) * (road + 3.4), f, z + 2));
      if (i % 4 === 3) colonialLamp(b, new THREE.Vector3(x + (i % 8 === 3 ? 1 : -1) * (road + 1.2), f, z));
      if (i % 6 === 4) for (const s of [-1, 1]) {
        const at = new THREE.Vector3(x + s * (R.floor - 0.9), f, z), q = new THREE.Quaternion().setFromAxisAngle(UP, s > 0 ? -Math.PI / 2 : Math.PI / 2);
        b.box('benchWood', [1.8, 0.08, 0.5], at.clone().setY(f + 0.45), q, false);
        b.box('lhBlack', [1.8, 0.45, 0.06], at.clone().add(new THREE.Vector3(s * 0.25, 0.68, 0)), q, false);
        b.box('none', [1.8, 0.9, 0.6], at.clone().setY(f + 0.45), q, true);
      }
    }
  }
}
