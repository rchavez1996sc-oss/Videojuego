import { lampSpots } from '../../render/nightLights';
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
  lampSpots.push(at.clone().setY(at.y + 4.5));
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
 * The bottom bend where the bajada meets the beach road (Street View, 2025): a steel W-beam guardrail on the outside
 * of the curve, black-and-yellow chevron signs and rock fall from the bare cliff piled against a gabion wall.
 */
function curveKit(b: Builder, hf: Heightfield, pts: THREE.Vector2[], half: number): void {
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], c = pts[k], dir = c.clone().sub(a).normalize(), out = new THREE.Vector2(dir.y, -dir.x);
    const p = a.clone().lerp(c, 0.5).addScaledVector(out, half + 0.9), y = hf.heightAt(p.x, p.y), len = a.distanceTo(c) + 0.1;
    const q = new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(dir.x, dir.y));
    b.box('alu', [0.08, 0.32, len], new THREE.Vector3(p.x, y + 0.6, p.y), q, true);
    if (k % 2 === 0) b.box('steelDark', [0.1, 0.75, 0.1], new THREE.Vector3(p.x, y + 0.37, p.y), q, false);
    if (k % 5 === 2) {
      const s = p.clone().addScaledVector(out, 0.5), sy = hf.heightAt(s.x, s.y);
      b.box('lhWhite', [0.06, 1.3, 0.06], new THREE.Vector3(s.x, sy + 0.65, s.y), q, false);
      b.box('lhBlack', [0.05, 0.6, 0.45], new THREE.Vector3(s.x, sy + 1.45, s.y), q, false);
      for (const t of [-1, 1]) b.box('kerbYellow', [0.06, 0.07, 0.3], new THREE.Vector3(s.x, sy + 1.45 + t * 0.1, s.y).add(new THREE.Vector3(dir.x, 0, dir.y).multiplyScalar(0.02)), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), t * 0.6)), false);
    }
    const g = a.clone().addScaledVector(out, -(half + 3.2)), gy = hf.heightAt(g.x, g.y);
    for (let j = 0; j < 3; j++) b.box('pirca', [0.6 + Math.random() * 0.4, 0.3 + Math.random() * 0.3, 0.5], new THREE.Vector3(g.x + (Math.random() - 0.5) * 2, gy + 0.15, g.y + (Math.random() - 0.5) * 1.5), new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * 3), false);
  }
}

/**
 * Bajada Balta (from the user's photos): a cobbled road down the ravine floor from the avenue to the beach road,
 * yellow kerbs, grass verges with tall fan palms, black colonial lamps and benches, river-stone walls at the foot of
 * the grass banks and a tan retaining wall where the banks meet the street above.
 */
export function buildBajada(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, plants: Plants): void {
  const R = RAVINE, road = 4.9;
  for (const r of c.ravines ?? []) {
    const z0 = def.avenue.z + def.avenue.half, z1 = def.beachRoad.z - def.beachRoad.half, mouth = edgeZ(c, r.x) + c.run;
    const centre: THREE.Vector2[] = [];
    for (let z = z0; z <= z1 - road; z += 1.5) centre.push(new THREE.Vector2(ravineCentre(r, Math.min(z, mouth)) + Math.max(0, z - mouth) * (r.skew ?? 0) + Math.max(0, z - mouth + 6) ** 2 * 0.045, z));
    const median = centre.filter((p) => p.y < z1 - 14), M = 1.2, lane = 3.7;
    for (const s of [-1, 1]) {
      ribbon(b, hf, centre.map((p) => new THREE.Vector2(p.x + s * (M + lane / 2), p.y)), lane, 'cobble', 0.1);
      ribbon(b, hf, centre.map((p) => new THREE.Vector2(p.x + s * (M + lane + 0.12), p.y)), 0.25, 'kerbYellow', 0.16);
      ribbon(b, hf, median.map((p) => new THREE.Vector2(p.x + s * (M - 0.12), p.y)), 0.25, 'kerbYellow', 0.2);
    }
    ribbon(b, hf, centre.filter((p) => p.y >= z1 - 14.5), M * 2, 'cobble', 0.1);
    ribbon(b, hf, median, M * 2 - 0.5, 'hedge', 0.18);
    median.forEach((p, k) => {
      const y = hf.heightAt(p.x, p.y);
      if (k % 6 === 3) plants.palms.push(new THREE.Vector3(p.x, y + 0.18, p.y));
      if (k % 12 === 9) colonialLamp(b, new THREE.Vector3(p.x, y + 0.18, p.y));
    });
    curveKit(b, hf, centre.slice(-22), M + lane);
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
      if (i % 6 === 4) for (const s of [-1, 1]) {
        const at = new THREE.Vector3(x + s * (R.floor - 0.9), f, z), q = new THREE.Quaternion().setFromAxisAngle(UP, s > 0 ? -Math.PI / 2 : Math.PI / 2);
        b.box('benchWood', [1.8, 0.08, 0.5], at.clone().setY(f + 0.45), q, false);
        b.box('lhBlack', [1.8, 0.45, 0.06], at.clone().add(new THREE.Vector3(s * 0.25, 0.68, 0)), q, false);
        b.box('none', [1.8, 0.9, 0.6], at.clone().setY(f + 0.45), q, true);
      }
    }
  }
}
