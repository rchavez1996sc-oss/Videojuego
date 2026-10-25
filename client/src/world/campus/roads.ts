import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { UP, offset, sample, type CampusDef, type CampusRoad } from './layout';

const Q = new THREE.Quaternion();
const ASPHALT = 0.06, WALK = 0.17;

/** A flat strip between two points (thickness down to the ground). */
function strip(b: Builder, mat: string, a: THREE.Vector2, c: THREE.Vector2, width: number, top: number, collide = false): void {
  const len = a.distanceTo(c), mid = a.clone().lerp(c, 0.5), q = new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(c.x - a.x, c.y - a.y));
  if (len > 0.01) b.box(mat, [width, top + 0.2, len], new THREE.Vector3(mid.x, (top - 0.2) / 2, mid.y), q, collide);
}

/** Black campus lamp post with two globe lanterns on a crossbar (as at Puerta 1). */
export function campusLamp(b: Builder, at: THREE.Vector3, yaw = 0): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw), m = new THREE.Matrix4().compose(at, q, new THREE.Vector3(1, 1, 1));
  b.geometry('lampPole', new THREE.CylinderGeometry(0.07, 0.11, 4.6, 8).translate(0, 2.3, 0), m);
  b.geometry('lampPole', new THREE.CylinderGeometry(0.17, 0.2, 0.6, 10).translate(0, 0.3, 0), m);
  b.geometry('lampPole', new THREE.BoxGeometry(1.3, 0.07, 0.07).translate(0, 4.55, 0), m);
  b.geometry('lampPole', new THREE.BoxGeometry(0.9, 0.03, 0.5).translate(0, 4.62, 0), m);
  for (const s of [-1, 1]) b.geometry('globe', new THREE.SphereGeometry(0.2, 14, 10).translate(s * 0.58, 4.35, 0), m);
  b.box('none', [0.24, 4.4, 0.24], at.clone().setY(at.y + 2.2), Q, true);
}

/** True when (x, z) is on the carriageway of a road other than `skip` (or of Av. Venezuela). */
export function onCarriageway(def: CampusDef, x: number, z: number, margin: number, skip?: CampusRoad): boolean {
  const v = def.venezuela;
  if (Math.abs(z - v.z) < v.half + margin) return true;
  return def.roads.some((r) => r !== skip && r.pts.some((p, i) => {
    if (i + 1 >= r.pts.length) return false;
    const q = r.pts[i + 1], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / l2));
    return Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t) < r.w / 2 + margin;
  }));
}

/** Av. Venezuela (two carriageways, planted median, lane marks), campus roads with kerbed sidewalks cut at junctions, lamps, bus stops. */
export function buildCampusRoads(b: Builder, def: CampusDef, rand: () => number): void {
  const v = def.venezuela, X = Math.max(-def.bounds.west, def.bounds.x) + 80, inner = v.median / 2, cw = v.half - inner;
  const entries = def.roads.filter((r) => r.pts[r.pts.length - 1][1] > v.z - v.half - v.sidewalk - 3).map((r) => {
    const x = r.pts[r.pts.length - 1][0];
    return [x - r.w / 2 - 0.4, x + r.w / 2 + 0.4] as [number, number];
  });
  const crossings = entries.map(([a, c]) => (a + c) / 2);
  for (const x of crossings) {
    for (let z = v.z - v.half + 0.6; z < v.z + v.half - 0.4; z += 1.1) if (Math.abs(z - v.z) > inner + 0.3) b.box('roadWhite', [3.2, 0.012, 0.55], new THREE.Vector3(x, ASPHALT + 0.007, z), Q, false);
  }
  for (const s of [-1, 1]) {
    const zc = v.z + s * (inner + cw / 2);
    strip(b, 'asphalt', new THREE.Vector2(-X, zc), new THREE.Vector2(X, zc), cw, ASPHALT);
    for (const lane of [1 / 3, 2 / 3]) {
      const zl = v.z + s * (inner + cw * lane);
      for (let x = -X; x < X; x += 9) if (!crossings.some((c) => Math.abs(c - x) < 4.5)) b.box('roadWhite', [4.5, 0.012, 0.13], new THREE.Vector3(x, ASPHALT + 0.006, zl), Q, false);
    }
    const zs = v.z + s * (v.half + v.sidewalk / 2), cuts = s < 0 ? entries : [];
    for (const [a, c] of spans(-X, X, cuts)) {
      b.box('concrete', [c - a, WALK + 0.2, v.sidewalk], new THREE.Vector3((a + c) / 2, (WALK - 0.2) / 2, zs), Q, true);
      b.box('kerbYellow', [c - a, WALK + 0.02, 0.18], new THREE.Vector3((a + c) / 2, WALK / 2, v.z + s * (v.half + 0.09)), Q, true);
    }
    for (const [x0, x1] of cuts) strip(b, 'asphalt', new THREE.Vector2(x0, zs), new THREE.Vector2(x1, zs), v.sidewalk + 0.4, ASPHALT, false);
  }
  b.box('kerbYellow', [2 * X, 0.32, v.median], new THREE.Vector3(0, 0.16, v.z), Q, true);
  b.box('hedge', [2 * X, 0.05, v.median - 0.3], new THREE.Vector3(0, 0.33, v.z), Q, false);

  const kerbLine = v.z - v.half - v.sidewalk - 1.3;
  def.roads.forEach((r, ri) => {
    const pts = sample(r.pts, 2), lift = ri * 0.003;
    for (let i = 0; i + 1 < pts.length; i++) strip(b, 'asphalt', pts[i], pts[i + 1], r.w, ASPHALT + 0.001 + lift);
    for (const s of [-1, 1]) {
      const side = sample(offset(r.pts, s * (r.w / 2 + 1.2)), 2);
      for (let i = 0; i + 1 < side.length; i++) {
        const m = side[i].clone().lerp(side[i + 1], 0.5);
        if (m.y > kerbLine || onCarriageway(def, m.x, m.y, 1.4, r)) continue;
        strip(b, 'concrete', side[i], side[i + 1], 2.4, WALK + lift, true);
        if (i % 13 === 6 && rand() < 0.85) campusLamp(b, new THREE.Vector3(m.x, WALK, m.y), Math.atan2(side[i + 1].x - side[i].x, side[i + 1].y - side[i].y));
      }
    }
  });
  const zn = v.z - v.half - v.sidewalk / 2;
  for (let x = -def.bounds.x; x < def.bounds.x; x += 24) campusLamp(b, new THREE.Vector3(x + 6, WALK, zn - 1), Math.PI / 2);
  for (const x of [-180, 96]) busStop(b, new THREE.Vector3(x, WALK, zn + 0.6));
}

/** [a, b] minus the cut intervals. */
function spans(a: number, b: number, cuts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let x = a;
  for (const [c0, c1] of [...cuts].sort((p, q) => p[0] - q[0])) {
    if (c0 > x) out.push([x, c0]);
    x = Math.max(x, c1);
  }
  if (x < b) out.push([x, b]);
  return out;
}

/** Bus shelter on the sidewalk: roof, back glass, bench, route sign. */
function busStop(b: Builder, at: THREE.Vector3): void {
  const p = (x: number, y: number, z: number) => at.clone().add(new THREE.Vector3(x, y, z));
  for (const x of [-2.6, 2.6]) b.box('lampPole', [0.1, 2.5, 0.1], p(x, 1.25, -0.9), Q, true);
  b.box('lampPole', [5.6, 0.1, 1.9], p(0, 2.55, -0.3), Q, false);
  b.box('glassClear', [5.2, 1.9, 0.04], p(0, 1.35, -0.95), Q, true);
  b.box('benchWood', [3.6, 0.06, 0.4], p(0, 0.46, -0.7), Q, false);
  b.box('lampPole', [0.08, 2.9, 0.08], p(3.4, 1.45, 0.4), Q, false);
  b.box('facadeBlue', [0.6, 0.6, 0.04], p(3.4, 2.7, 0.4), Q, false);
}
