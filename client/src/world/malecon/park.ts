import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { edgeZ, type CoastDef } from '../coast';
import { EXTENT, SIDEWALK, inLarcomar, innerPathZ, overRavine, promenadeZ, type MaleconDef } from './layout';

const UP = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion();
/** A standing extra: where, facing, which looping clip. */
export interface Extra { pos: THREE.Vector3; yaw: number; key: string }

/** Two or three people chatting in a ring around `at`. */
export function chatGroup(list: Extra[], at: THREE.Vector3, rand: () => number): void {
  const n = 2 + Math.floor(rand() * 2), a0 = rand() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2, p = at.clone().add(new THREE.Vector3(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75));
    list.push({ pos: p, yaw: Math.atan2(at.x - p.x, at.z - p.z), key: k === 0 || rand() < 0.4 ? 'talk' : rand() < 0.5 ? 'civ_idle' : 'texting' });
  }
}

export interface Plants { palms: THREE.Vector3[]; phoenix: THREE.Vector3[]; trees: THREE.Vector3[]; bent: THREE.Vector3[]; pines: THREE.Vector3[]; seats: { pos: THREE.Vector3; yaw: number }[]; standing: Extra[]; arch: { pos: THREE.Vector3; lean: number }[] }

/** Flat strip following a polyline, a few cm above the ground. */
export function ribbon(b: Builder, hf: Heightfield, pts: THREE.Vector2[], width: number, mat: string, lift = 0.04): void {
  const pos: number[] = [];
  const side = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
    return new THREE.Vector2(-(c.y - a.y), c.x - a.x).normalize().multiplyScalar(width / 2);
  });
  const v = (p: THREE.Vector2) => pos.push(p.x, hf.heightAt(p.x, p.y) + lift, p.y);
  for (let i = 0; i + 1 < pts.length; i++) {
    const l0 = pts[i].clone().add(side[i]), r0 = pts[i].clone().sub(side[i]), l1 = pts[i + 1].clone().add(side[i + 1]), r1 = pts[i + 1].clone().sub(side[i + 1]);
    v(l0); v(l1); v(r0); v(l1); v(r1); v(r0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  b.geometry(mat, geo, new THREE.Matrix4());
}

/** Green tubular railing: posts, two rails and X braces, one collider per bay. */
export function railing(b: Builder, pts: THREE.Vector3[], mat = 'railGreen'): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], c = pts[i + 1], len = a.distanceTo(c);
    if (len < 0.2) continue;
    const mid = a.clone().lerp(c, 0.5), yaw = Math.atan2(c.x - a.x, c.z - a.z);
    const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw), slope = Math.atan2(c.y - a.y, Math.hypot(c.x - a.x, c.z - a.z));
    const qs = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -slope));
    b.box(mat, [0.07, 1.1, 0.07], a.clone().setY(a.y + 0.55), q, false);
    for (const h of [1.05, 0.45]) b.box(mat, [0.06, 0.06, len], mid.clone().setY(mid.y + h), qs, false);
    for (const s of [1, -1]) {
      const qd = qs.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), s * Math.atan2(0.6, len)));
      b.box(mat, [0.04, 0.04, Math.hypot(len, 0.6)], mid.clone().setY(mid.y + 0.75), qd, false);
    }
    b.box('none', [0.1, 1.2, len], mid.clone().setY(mid.y + 0.6), qs, true);
  }
}

/** Brick parapet with a concrete coping, where the park meets the cliff. */
function parapet(b: Builder, hf: Heightfield, a: THREE.Vector3, c: THREE.Vector3): void {
  const mid = a.clone().lerp(c, 0.5), len = a.distanceTo(c) + 0.05, q = new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(c.x - a.x, c.z - a.z));
  b.box('pavement', [0.46, 0.3, len], mid.clone().setY(mid.y + 0.15), q, true);
  b.box('brickRed', [0.4, 0.82, len], mid.clone().setY(mid.y + 0.71), q, true);
  b.box('brickRed', [0.46, 0.07, len], mid.clone().setY(mid.y + 1.15), q, false);
  const inward = new THREE.Vector3(-(c.z - a.z), 0, c.x - a.x).normalize().multiplyScalar(-2.4);
  const p0 = new THREE.Vector2(a.x + inward.x, a.z + inward.z), p1 = new THREE.Vector2(c.x + inward.x, c.z + inward.z);
  ribbon(b, hf, [p0, p1], 4.4, 'pavement', 0.05);
  ribbon(b, hf, [p0.clone().add(new THREE.Vector2(inward.x, inward.z)), p1.clone().add(new THREE.Vector2(inward.x, inward.z))], 0.7, 'brickRed', 0.055);
}

export function lamp(b: Builder, at: THREE.Vector3): void {
  const m = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z);
  b.geometry('lampPole', new THREE.CylinderGeometry(0.06, 0.1, 4.2, 8).translate(0, 2.1, 0), m);
  b.geometry('lampPole', new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10).translate(0, 0.25, 0), m);
  b.geometry('globe', new THREE.SphereGeometry(0.3, 16, 12).translate(0, 4.5, 0), m);
  b.geometry('lampPole', new THREE.CylinderGeometry(0.33, 0.33, 0.04, 16).translate(0, 4.48, 0), m);
  b.box('none', [0.2, 4, 0.2], at.clone().setY(at.y + 2), Q, true);
}

export function bench(b: Builder, at: THREE.Vector3, yaw: number, wood = 'benchWood'): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const p = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(at);
  for (let k = 0; k < 4; k++) b.box(wood, [1.8, 0.04, 0.09], p(0, 0.45, -0.18 + k * 0.12), q, false);
  for (let k = 0; k < 3; k++) b.box(wood, [1.8, 0.09, 0.04], p(0, 0.62 + k * 0.13, -0.27 - k * 0.03), q, false);
  for (const x of [-0.75, 0.75]) b.box('lampPole', [0.06, 0.45, 0.5], p(x, 0.22, -0.02), q, false);
  b.box('none', [1.8, 0.9, 0.6], p(0, 0.45, -0.05), q, true);
}

/** Clifftop park: paths, lawns painted into the terrain mask, railings, lamps, benches, hedges; returns where to plant. */
export function buildPark(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, rand: () => number): Plants {
  const plants: Plants = { palms: [], phoenix: [], trees: [], bent: [], pines: [], seats: [], standing: [], arch: [] };
  const seat = (at: THREE.Vector3, yaw: number) => {
    bench(b, at, yaw);
    if (rand() < 0.4) plants.seats.push({ pos: at, yaw });
  };
  const lh = def.lighthouse;
  const parkStart = def.avenue.z + def.avenue.half + SIDEWALK;
  const blocked = (x: number, z: number, m = 0) => overRavine(c, x, z, m) || inLarcomar(def, c, x, z, m);
  const runs = (fz: (x: number) => number, m: number) => {
    const out: THREE.Vector2[][] = [];
    let cur: THREE.Vector2[] = [];
    for (let x = -EXTENT - 20; x <= EXTENT + 20; x += 2) {
      const z = fz(x);
      if (blocked(x, z, m)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(new THREE.Vector2(x, z));
    }
    if (cur.length > 1) out.push(cur);
    return out;
  };
  const prom = runs((x) => promenadeZ(c, x), 2), inner = runs((x) => innerPathZ(def, x), 2);
  for (const r of prom) ribbon(b, hf, r, 4.2, 'flagstone');
  for (const r of inner) ribbon(b, hf, r, 3, 'paving');
  const links: THREE.Vector2[][] = [];
  for (let x = -EXTENT + 24; x < EXTENT; x += 48) {
    const pts: THREE.Vector2[] = [];
    for (let t = 0; t <= 1.001; t += 0.1) {
      const xx = x + Math.sin(t * Math.PI) * 6, z = THREE.MathUtils.lerp(parkStart, promenadeZ(c, xx), t);
      pts.push(new THREE.Vector2(xx, z));
    }
    if (pts.some((p) => blocked(p.x, p.y, 3) || Math.hypot(p.x - lh.x, p.y - lh.z) < 14)) continue;
    ribbon(b, hf, pts, 2.4, 'paving', 0.035);
    links.push(pts);
  }
  const ring: THREE.Vector2[] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 24) ring.push(new THREE.Vector2(lh.x + Math.cos(a) * 9, lh.z + Math.sin(a) * 9));
  ribbon(b, hf, ring, 3.2, 'flagstone', 0.05);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5, x = lh.x + Math.cos(a) * 12.5, z = lh.z + Math.sin(a) * 12.5;
    if (!blocked(x, z, 2) && z < edgeZ(c, x) - 3) seat(new THREE.Vector3(x, hf.heightAt(x, z), z), Math.atan2(lh.x - x, lh.z - z));
  }
  paintLawns(hf, (x, z) => {
    if (z < parkStart + 0.5 || z > edgeZ(c, x) - 0.6 || blocked(x, z, 1)) return 0;
    if (Math.abs(z - promenadeZ(c, x)) < 3 || Math.abs(z - innerPathZ(def, x)) < 2.4) return 0;
    if (Math.hypot(x - lh.x, z - lh.z) < 11.5) return 0;
    if (def.brickEdge && x > def.brickEdge[0] - 2 && x < def.brickEdge[1] + 2 && z > edgeZ(c, x) - 7.5) return 0;
    for (const l of links) for (const p of l) if (Math.abs(p.x - x) < 2.2 && Math.abs(p.y - z) < 2.2) return 0;
    return 1;
  });

  const edge: THREE.Vector3[][] = [[]];
  for (let x = -EXTENT - 20; x <= EXTENT + 20; x += 2.5) {
    const z = edgeZ(c, x) - 1.2;
    if (blocked(x, z, 4)) { if (edge[edge.length - 1].length) edge.push([]); continue; }
    edge[edge.length - 1].push(new THREE.Vector3(x, hf.heightAt(x, z), z));
  }
  const brick = def.brickEdge ?? [0, 0], onBrick = (p: THREE.Vector3) => p.x >= brick[0] && p.x <= brick[1];
  for (const e of edge) {
    let run: THREE.Vector3[] = [];
    for (let i = 0; i < e.length; i++) {
      run.push(e[i]);
      if (i + 1 < e.length && onBrick(e[i]) && onBrick(e[i + 1])) {
        parapet(b, hf, e[i], e[i + 1]);
        railing(b, run);
        run = [];
      }
    }
    railing(b, run);
  }
  for (const r of c.ravines ?? []) for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let z = r.head - 10; z < edgeZ(c, r.x + s * r.width / 2) - 1; z += 2.5) {
      let x = r.x;
      while (overRavine(c, x, z, 3)) x += s;
      if (Math.abs(z - def.bridge.z) < 3) { if (pts.length) railing(b, pts.splice(0)); continue; }
      pts.push(new THREE.Vector3(x, hf.heightAt(x, z), z));
    }
    railing(b, pts);
  }

  for (const run of prom) for (let i = 0; i < run.length; i += 10) {
    const p = run[i], z = p.y + 2.6, x = p.x;
    if (Math.abs(x - def.amor.x) < def.amor.w / 2 || Math.hypot(x - lh.x, z - lh.z) < 12) continue;
    lamp(b, new THREE.Vector3(x, hf.heightAt(x, z), z));
    for (const dx of [-5, 5]) if (Math.hypot(x + dx - def.lighthouse.x, z - def.lighthouse.z) > 14) seat(new THREE.Vector3(x + dx, hf.heightAt(x + dx, z), z + 0.3), 0);
  }
  for (const run of prom) for (let i = 4; i < run.length; i += 12) {
    const p = run[i], z = edgeZ(c, p.x) - 2.2;
    if (rand() < 0.45 || blocked(p.x, z, 3) || Math.abs(p.x - def.amor.x) < def.amor.w / 2) continue;
    for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) plants.standing.push({ pos: new THREE.Vector3(p.x + k * 0.8, hf.heightAt(p.x, z), z), yaw: (rand() - 0.5) * 0.6, key: rand() < 0.5 ? 'look_around' : rand() < 0.5 ? 'civ_idle' : 'texting' });
  }
  for (const run of inner) for (let i = 0; i < run.length; i++) {
    const p = run[i];
    if (i % 20 === 10 && rand() < 0.7 && !blocked(p.x, p.y + 4.5, 3)) chatGroup(plants.standing, new THREE.Vector3(p.x, hf.heightAt(p.x, p.y + 4.5), p.y + 4.5), rand);
    if (i % 6 === 0) plants.palms.push(new THREE.Vector3(p.x + 1, 0, p.y - 2.8));
    if (i % 6 === 3 && !blocked(p.x, p.y - 2.3, 3)) seat(new THREE.Vector3(p.x, hf.heightAt(p.x, p.y - 2.3), p.y - 2.3), 0);
    if (i % 9 === 4 && rand() < 0.7) {
      const len = 6 + rand() * 8, z = p.y + 2.4;
      if (!blocked(p.x, z, 4)) b.box('hedge', [len, 0.9, 0.9], new THREE.Vector3(p.x + len / 2, hf.heightAt(p.x, z) + 0.45, z), Q, true);
    }
  }
  for (let i = 0; i < 260; i++) {
    const x = (rand() * 2 - 1) * (EXTENT + 10), e = edgeZ(c, x);
    const z = THREE.MathUtils.lerp(parkStart + 4, e - 3, rand());
    if (blocked(x, z, 6) || Math.abs(z - promenadeZ(c, x)) < 4 || Math.abs(z - innerPathZ(def, x)) < 3.5) continue;
    if (Math.hypot(x - lh.x, z - lh.z) < 14 || Math.abs(x - def.launch.x) < def.launch.w / 2 || Math.abs(x - def.amor.x) < def.amor.w / 2 + 4) continue;
    const p = new THREE.Vector3(x, hf.heightAt(x, z), z), k = rand();
    if (e - z < 9) plants.bent.push(p);
    else (k < 0.3 ? plants.phoenix : k < 0.55 ? plants.palms : k < 0.85 ? plants.trees : plants.pines).push(p);
    if (k > 0.55 && k < 0.7) {
      const s = 1 + rand() * 0.8;
      b.geometry('flowers', new THREE.IcosahedronGeometry(1, 1).scale(1.3 * s, 0.8 * s, 1.1 * s), new THREE.Matrix4().makeTranslation(p.x + 2, p.y + 0.5 * s, p.z));
      b.box('none', [2 * s, 1.2 * s, 1.8 * s], new THREE.Vector3(p.x + 2, p.y + 0.5 * s, p.z), Q, true);
    }
  }
  return plants;
}

/** Writes lawn coverage into the terrain mask's grass channel (texture uploads happen at first render). */
export function paintLawns(hf: Heightfield, lawn: (x: number, z: number) => number, zMin = 20, zMax = 140): void {
  for (let zi = 0; zi < hf.n; zi++) for (let xi = 0; xi < hf.n; xi++) {
    const x = -hf.half + xi * hf.step, z = -hf.half + zi * hf.step;
    if (Math.abs(x) > EXTENT + 40 || z < zMin || z > zMax) continue;
    const g = lawn(x, z), k = (zi * hf.n + xi) * 4;
    if (hf.mask[k + 3] === 255) hf.mask[k + 1] = g * 255;
  }
}
