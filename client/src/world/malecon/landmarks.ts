import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { edgeZ, type CoastDef } from '../coast';
import { bridgeSpan, type MaleconDef } from './layout';
import { bench, lamp, ribbon } from './park';

const Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

/** Striped lighthouse on a brick-red base with gallery, lantern and dome. */
function lighthouse(b: Builder, hf: Heightfield, x: number, z: number): void {
  const y = hf.heightAt(x, z), m = at(x, y, z);
  const cyl = (mat: string, r0: number, r1: number, h: number, y0: number, seg = 24) => b.geometry(mat, new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, y0 + h / 2, 0), m);
  cyl('lhRed', 3.4, 3.4, 0.5, 0);
  cyl('lhRed', 3.0, 2.8, 2.6, 0.5, 12);
  const bands: [string, number][] = [['lhBlack', 1.6], ['lhWhite', 10.5], ['lhBlack', 1.4]];
  let h0 = 3.1, r = 2.1;
  for (const [mat, h] of bands) {
    cyl(mat, r, r - h * 0.035, h, h0);
    r -= h * 0.035;
    h0 += h;
  }
  cyl('lhBlack', 2.4, 2.4, 0.25, h0);
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    b.box('lhBlack', [0.05, 0.9, 0.05], new THREE.Vector3(x + Math.cos(a) * 2.3, y + h0 + 0.7, z + Math.sin(a) * 2.3), Q, false);
  }
  b.geometry('lhBlack', new THREE.TorusGeometry(2.3, 0.04, 6, 32).rotateX(Math.PI / 2).translate(0, h0 + 1.15, 0), m);
  cyl('lhBlack', 1.3, 1.3, 0.6, h0 + 0.25, 12);
  cyl('lanternGlass', 1.1, 1.1, 1.8, h0 + 0.85, 12);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.box('lhBlack', [0.08, 1.8, 0.08], new THREE.Vector3(x + Math.cos(a) * 1.12, y + h0 + 1.75, z + Math.sin(a) * 1.12), Q, false);
  }
  b.geometry('lhBlack', new THREE.SphereGeometry(1.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h0 + 2.65, 0), m);
  cyl('lhBlack', 0.06, 0.02, 1.6, h0 + 3.7, 6);
  b.box('door', [1.0, 2.0, 0.2], new THREE.Vector3(x, y + 1.5, z - 2.9), Q, false);
  b.box('none', [5.6, 18, 5.6], new THREE.Vector3(x, y + 9, z), Q, true);
}

/** Serpentine mosaic bench wall with a wavy backrest along the cliff, and the reclining lovers on a tiled plinth. */
function amorPark(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef): void {
  const x0 = def.amor.x - def.amor.w / 2, x1 = def.amor.x + def.amor.w / 2;
  const pos: number[] = [];
  const quad = (a: THREE.Vector3, bb: THREE.Vector3, cc: THREE.Vector3, d: THREE.Vector3) => pos.push(...a.toArray(), ...bb.toArray(), ...cc.toArray(), ...a.toArray(), ...cc.toArray(), ...d.toArray());
  let prev: THREE.Vector3[] | null = null;
  for (let x = x0; x <= x1; x += 1) {
    const z = edgeZ(c, x) - 2.6 - Math.sin(x / 6) * 1.2, y = hf.heightAt(x, z), top = y + 1.15 + Math.sin(x / 3.1) * 0.35;
    const cur = [new THREE.Vector3(x, y, z - 0.15), new THREE.Vector3(x, top, z - 0.15), new THREE.Vector3(x, top, z + 0.15), new THREE.Vector3(x, y, z + 0.15)];
    if (prev) {
      quad(prev[0], cur[0], cur[1], prev[1]);
      quad(prev[1], cur[1], cur[2], prev[2]);
      quad(prev[2], cur[2], cur[3], prev[3]);
      const zs = (z + prev[0].z) / 2 - 0.55;
      b.box('mosaic', [1.02, 0.46, 0.8], new THREE.Vector3(x - 0.5, y + 0.23, zs), new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(cur[0].z - prev[0].z, 1) * -1), true);
      b.box('none', [1, top - y, 0.4], new THREE.Vector3(x - 0.5, (y + top) / 2, z), Q, true);
    }
    prev = cur;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  b.geometry('mosaic', geo, new THREE.Matrix4());

  const sx = def.amor.x, sz = edgeZ(c, sx) - 15, sy = hf.heightAt(sx, sz);
  b.box('poolRim', [11, 0.6, 9], new THREE.Vector3(sx, sy + 0.3, sz), Q, true);
  b.box('poolWater', [10.2, 0.05, 8.2], new THREE.Vector3(sx, sy + 0.55, sz), Q, false);
  b.box('lhBlack', [3.4, 3.2, 3.4], new THREE.Vector3(sx, sy + 1.6, sz), Q, true);
  b.box('lhBlack', [4.4, 0.35, 4.4], new THREE.Vector3(sx, sy + 3.35, sz), Q, false);
  const m = at(sx, sy + 3.5, sz);
  const limb = (r: number, len: number, x: number, y: number, z: number, rz: number, ry = 0) =>
    b.geometry('terracotta', new THREE.CapsuleGeometry(r, len, 6, 14).rotateZ(Math.PI / 2 + rz).rotateY(ry).translate(x, y, z), m);
  const head = (r: number, x: number, y: number, z: number) => b.geometry('terracotta', new THREE.SphereGeometry(r, 18, 14).scale(1, 1.15, 0.95).translate(x, y, z), m);
  limb(0.62, 2.6, 0.2, 0.62, 0.35, 0.05, 0.08);
  limb(0.58, 2.4, 0.3, 1.25, -0.3, -0.12, -0.1);
  head(0.48, -1.85, 1.0, 0.4);
  head(0.46, -1.7, 1.75, -0.15);
  limb(0.32, 2.4, 2.6, 0.38, 0.55, 0.12, 0.25);
  limb(0.3, 2.2, 2.7, 0.5, 0.0, -0.08, 0.1);
  limb(0.3, 2.3, 2.4, 0.95, -0.55, 0.3, -0.35);
  limb(0.24, 1.6, -1.2, 2.2, 0.1, -1.0, 0.3);
  limb(0.24, 1.4, -0.9, 1.6, 0.75, 0.6, -0.6);
  for (let k = 0; k < 4; k++) bench(b, new THREE.Vector3(sx - 15 + k * 10, hf.heightAt(sx - 15 + k * 10, sz - 9), sz - 9), 0);
}

/** Arched concrete bridge over the ravine with curved glass parapets. */
function bridge(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef): void {
  const { x0, x1 } = bridgeSpan(c, def), z = def.bridge.z, w = def.bridge.width;
  const a = x0 - 3, e = x1 + 3, len = e - a, mid = (a + e) / 2;
  b.box('bridgeConcrete', [len, 1.1, w], new THREE.Vector3(mid, -0.25, z), Q, true);
  b.box('paving', [len, 0.05, w - 1.2], new THREE.Vector3(mid, 0.32, z), Q, false);
  for (const s of [-1, 1]) {
    const zr = z + s * (w / 2 - 0.25);
    b.box('bridgeConcrete', [len, 0.5, 0.5], new THREE.Vector3(mid, 0.5, zr), Q, false);
    b.box('railGlass', [len, 2.0, 0.05], new THREE.Vector3(mid, 1.75, zr), Q, false);
    b.box('none', [len, 2.6, 0.4], new THREE.Vector3(mid, 1.5, zr), Q, true);
    for (let x = a; x <= e; x += 2) {
      b.box('alu', [0.08, 2.2, 0.08], new THREE.Vector3(x, 1.85, zr), Q, false);
      b.box('alu', [0.08, 0.08, 1.0], new THREE.Vector3(x, 2.95, zr - s * 0.4), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), s * 0.5), false);
    }
    for (const yy of [1.0, 2.75]) b.box('alu', [len, 0.07, 0.07], new THREE.Vector3(mid, yy, zr), Q, false);
  }
  const span = x1 - x0 + 4, ax = (x0 + x1) / 2, foot = Math.min(hf.heightAt(x0 - 1, z), hf.heightAt(x1 + 1, z)) - 1;
  for (const s of [-1, 1]) for (const [cx, sp] of [[ax, span], [x0 + span * 0.12, span * 0.3], [x1 - span * 0.12, span * 0.3]] as const) {
    const zz = z + s * (w / 2 - 1.2), steps = 16, rise = -0.8 - foot;
    let p = new THREE.Vector3(cx - sp / 2, Math.max(foot, hf.heightAt(cx - sp / 2, zz)), zz);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, x = cx - sp / 2 + sp * t;
      const y = Math.max(hf.heightAt(x, zz) - 0.5, foot + rise * (1 - (2 * t - 1) ** 2) * (sp === span ? 1 : 0.35));
      const n = new THREE.Vector3(x, y, zz), d = n.clone().sub(p), l = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
      b.box('bridgeConcrete', [l + 0.3, 1.3, 1.6], p.clone().lerp(n, 0.5), q, false);
      if (sp === span && k % 3 === 0 && y < -1.5) b.box('bridgeConcrete', [0.7, -1 - y, 0.7], new THREE.Vector3(x, (y - 0.8) / 2, zz), Q, false);
      p = n;
    }
  }
}

/** Road winding down the ravine floor under the bridge to the beach, lined with palms and lamps. */
function bajada(b: Builder, hf: Heightfield, c: CoastDef, palms: THREE.Vector3[]): void {
  for (const r of c.ravines ?? []) {
    const pts: THREE.Vector2[] = [], mouth = edgeZ(c, r.x) + c.run + 6;
    for (let z = r.head + 4; z <= mouth; z += 3) pts.push(new THREE.Vector2(r.x + Math.sin(z / 14) * 1.2, z));
    ribbon(b, hf, pts, 5.5, 'asphalt', 0.1);
    pts.forEach((p, i) => {
      if (i % 4 !== 2) return;
      for (const s of [-1, 1]) palms.push(new THREE.Vector3(p.x + s * 4.2, hf.heightAt(p.x + s * 4.2, p.y), p.y));
      if (i % 8 === 2) lamp(b, new THREE.Vector3(p.x + 3.3, hf.heightAt(p.x + 3.3, p.y), p.y));
    });
  }
}

export function buildLandmarks(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, palms: THREE.Vector3[]): void {
  lighthouse(b, hf, def.lighthouse.x, def.lighthouse.z);
  amorPark(b, hf, def, c);
  bridge(b, hf, def, c);
  bajada(b, hf, c, palms);
}
