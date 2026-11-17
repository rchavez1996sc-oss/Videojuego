import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { car, type CarKind } from '../urbanProps';
import { ravineCentre, ravineHalf, type CoastDef } from '../coast';
import type { StationInfo } from '../station';
import type { Plants } from '../malecon/park';
import { casona } from './casona';
import { globeLamp } from './bridge';
import { blockedForBuilding, muralSpan, overRavine, ravineOf, SIDEWALK, type BarrancoDef } from './layout';
import { CASONA_PAINTS } from './materials';

const Q = new THREE.Quaternion();
type Rect = [number, number, number, number];

/** Road slab along x or z, split where it would hang over the bajada. */
function road(b: Builder, c: CoastDef, alongX: boolean, at: number, half: number, from: number, to: number, skip?: [number, number]): void {
  let run0 = from;
  const flush = (end: number) => {
    if (end - run0 < 1) return;
    const mid = (run0 + end) / 2, len = end - run0;
    b.box('asphalt', alongX ? [len, 0.08, half * 2] : [half * 2, 0.08, len], alongX ? new THREE.Vector3(mid, 0.0, at) : new THREE.Vector3(at, 0.0, mid), Q, false);
    for (const s of [-1, 1]) {
      const kerb = at + s * (half + 0.1), side = at + s * (half + SIDEWALK / 2 + 0.1);
      b.box('kerbYellow', alongX ? [len, 0.18, 0.2] : [0.2, 0.18, len], alongX ? new THREE.Vector3(mid, 0.02, kerb) : new THREE.Vector3(kerb, 0.02, mid), Q, false);
      b.box('pavement', alongX ? [len, 0.16, SIDEWALK - 0.2] : [SIDEWALK - 0.2, 0.16, len], alongX ? new THREE.Vector3(mid, 0.0, side) : new THREE.Vector3(side, 0.0, mid), Q, false);
    }
    if (half > 4.5) for (let k = run0 + 2; k < end - 2; k += 6) b.box('roadWhite', alongX ? [3, 0.02, 0.14] : [0.14, 0.02, 3], alongX ? new THREE.Vector3(k + 1.5, 0.05, at) : new THREE.Vector3(at, 0.05, k + 1.5), Q, false);
  };
  for (let t = from; t <= to; t += 1) {
    const cut = (alongX ? overRavine(c, t, at, 0.5) : overRavine(c, at, t, 0.5)) || (skip && t > skip[0] && t < skip[1]);
    if (cut) { flush(t - 1); run0 = t + 1; }
  }
  flush(to);
}

/** Plain massing for the hidden middle of a block: painted walls, flat roof, a water tank. */
function backlot(b: Builder, x: number, z: number, w: number, d: number, h: number, paint: string): void {
  b.box(paint, [w, h, d], new THREE.Vector3(x, h / 2 - 0.5, z), Q);
  b.box('roofSlab', [w + 0.1, 0.2, d + 0.1], new THREE.Vector3(x, h - 0.4, z), Q, false);
  b.box(paint, [w, 0.8, 0.2], new THREE.Vector3(x, h + 0.1, z - d / 2 + 0.1), Q, false);
}

export interface Streets { station: StationInfo | null; trees: THREE.Vector3[] }

/**
 * Streets with yellow kerbs and slab pavements, rows of casonas along every frontage and along both lips of the
 * bajada (facing the cut), plainer massing filling the middle of blocks, globe lamps and parked cars; the casona on
 * `def.prison` is the Junta's detention house (walk-in hall, cells, detainees) and becomes the objective.
 */
export function buildStreets(b: Builder, def: BarrancoDef, c: CoastDef, plants: Plants, rand: () => number): Streets {
  const E = def.extent, taken: Rect[] = [], trees: THREE.Vector3[] = [], m = muralSpan(c, def);
  for (const a of def.avenues) road(b, c, true, a.z, a.half, Math.max(-E - 20, a.x0 ?? -1e9), Math.min(E + 20, a.x1 ?? 1e9));
  road(b, c, true, def.mural.z, def.mural.half, -E - 20, E + 20, [m.x0, m.x1]);
  for (const s of def.streets) road(b, c, false, s.x, s.half, s.z0, s.z1);
  const free = (r: Rect) => {
    if (taken.some((t) => r[0] < t[1] && r[1] > t[0] && r[2] < t[3] && r[3] > t[2])) return false;
    for (let i = 0; i <= 2; i++) for (let k = 0; k <= 2; k++) if (blockedForBuilding(def, c, r[0] + 0.6 + (r[1] - r[0] - 1.2) * i / 2, r[2] + 0.6 + (r[3] - r[2] - 1.2) * k / 2, 0)) return false;
    return true;
  };
  let station: StationInfo | null = null;
  const place = (fx: number, fz: number, facing: number, w: number, d: number, extra: Partial<Parameters<typeof casona>[1]> = {}, force = false) => {
    const dx = Math.round(Math.sin(facing)), dz = Math.round(Math.cos(facing));
    const r: Rect = dx ? [Math.min(fx, fx - dx * d), Math.max(fx, fx - dx * d), fz - w / 2, fz + w / 2] : [fx - w / 2, fx + w / 2, Math.min(fz, fz - dz * d), Math.max(fz, fz - dz * d)];
    if (!force && !free(r)) return null;
    taken.push([r[0] - 0.2, r[1] + 0.2, r[2] - 0.2, r[3] + 0.2]);
    return casona(b, { x: fx, z: fz, y: 0, facing, w, d, ...extra }, rand);
  };
  const r = ravineOf(c), p = def.prison, pc = ravineCentre(r, p.z), px = pc + p.side * (ravineHalf(c, r, p.z) + 4.5);
  const jail = place(px, p.z, p.side > 0 ? -Math.PI / 2 : Math.PI / 2, 16, 18, { floors: 2, paint: 'paint-oxblood', style: 'cajon', open: true }, true)!;
  station = detention(b, jail, p.side, plants);
  for (const a of [...def.avenues, { z: def.mural.z, half: def.mural.half, x0: undefined, x1: undefined }]) for (const s of [-1, 1]) {
    const fz = a.z + s * (a.half + SIDEWALK + 0.3), facing = s < 0 ? 0 : Math.PI;
    for (let x = Math.max(-E + 4, a.x0 ?? -1e9); x < Math.min(E - 4, (a.x1 ?? 1e9) - 6);) {
      const w = 9 + rand() * 7, d = 14 + rand() * 9;
      x += place(x + w / 2, fz, facing, w, d) ? w + (rand() < 0.25 ? 1.5 : 0.2) : 3;
    }
  }
  for (const st of def.streets) for (const s of [-1, 1]) {
    const fx = st.x + s * (st.half + SIDEWALK + 0.3), facing = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let z = st.z0; z < st.z1;) {
      const w = 9 + rand() * 7, d = 14 + rand() * 9;
      z += place(fx, z + w / 2, facing, w, d) ? w + 0.2 : 3;
    }
  }
  for (const s of [-1, 1]) for (let z = r.head + 6; z < def.mirador.z - 10;) {
    const w = 10 + rand() * 6, zc = z + w / 2, fx = ravineCentre(r, zc) + s * (ravineHalf(c, r, zc) + 4.5);
    z += place(fx, zc, s > 0 ? -Math.PI / 2 : Math.PI / 2, w, 15 + rand() * 6, { floors: rand() < 0.6 ? 2 : 1 }) ? w + 0.3 : 3;
  }
  for (let x = -E + 8; x < E - 8; x += 13) for (let z = -E + 8; z < 115; z += 13) {
    const w = 11 + rand() * 1.5, d = 11 + rand() * 1.5, rr: Rect = [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
    if (!free(rr) || [[x, z], [rr[0], rr[2]], [rr[1], rr[3]], [rr[0], rr[3]], [rr[1], rr[2]]].some(([px, pz]) => blockedForBuilding(def, c, px, pz, 7))) continue;
    taken.push(rr);
    backlot(b, x, z, w, d, 4.2 + Math.floor(rand() * 2) * 3.9, CASONA_PAINTS[Math.floor(rand() * CASONA_PAINTS.length)][0]);
  }
  streetKit(b, def, c, plants, trees, rand);
  return { station, trees };
}

/** The detention house: walk-in hall with barred cells along the back, a desk and the seized files (the cache). */
function detention(b: Builder, jail: ReturnType<typeof casona>, side: number, plants: Plants): StationInfo {
  const [a, e] = jail.hall, y = a.y + 0.02, x0 = Math.min(a.x, e.x), x1 = Math.max(a.x, e.x), z0 = Math.min(a.z, e.z), z1 = Math.max(a.z, e.z);
  const backX = side > 0 ? x1 : x0, inward = -side;
  for (let z = z0 + 0.5; z < z1 - 0.5; z += 0.16) b.box('fenceIron', [0.035, 2.6, 0.035], new THREE.Vector3(backX + inward * 3, y + 1.3, z), Q, false);
  b.box('grate', [0.1, 2.6, z1 - z0 - 1], new THREE.Vector3(backX + inward * 3, y + 1.3, (z0 + z1) / 2), Q, true);
  for (const zz of [z0 + (z1 - z0) / 3, z0 + (2 * (z1 - z0)) / 3]) b.box('paint-limewhite', [3, 2.8, 0.15], new THREE.Vector3(backX + inward * 1.5, y + 1.4, zz), Q);
  for (let k = 0; k < 5; k++) plants.standing.push({ pos: new THREE.Vector3(backX + inward * 1.4, y, z0 + 1.5 + k * ((z1 - z0 - 3) / 4)), yaw: inward > 0 ? Math.PI / 2 : -Math.PI / 2, key: 'terrified' });
  const mid = new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), w = x1 - x0, d = z1 - z0;
  b.box('floorTile', [w + 0.9, 0.03, d + 1.2], mid.clone().setY(y + 0.005), Q, false);
  b.box('paint-limewhite', [w + 0.9, 0.05, d + 1.2], mid.clone().setY(y + 3.75), Q, false);
  for (const s of [-1, 1]) {
    b.box('paint-limewhite', [w + 0.9, 3.8, 0.04], new THREE.Vector3(mid.x, y + 1.9, mid.z + s * (d / 2 + 0.58)), Q, false);
    b.box('trimBrown', [w + 0.9, 0.9, 0.05], new THREE.Vector3(mid.x, y + 0.45, mid.z + s * (d / 2 + 0.55)), Q, false);
  }
  b.box('paint-limewhite', [0.04, 3.8, d + 1.2], new THREE.Vector3(backX - inward * 0.38, y + 1.9, mid.z), Q, false);
  b.box('lampShade', [1.2, 0.08, 0.3], mid.clone().setY(y + 3.65), Q, false);
  b.box('desk', [1.6, 0.78, 0.8], mid.clone().add(new THREE.Vector3(-inward * 2, 0.39, -2)), Q);
  b.box('armsCrate', [1.2, 0.6, 0.8], mid.clone().add(new THREE.Vector3(-inward * 1, 0.3, 2.5)), Q);
  b.box('cardboard', [0.6, 0.45, 0.45], mid.clone().add(new THREE.Vector3(-inward * 1.6, 0.85, 2.5)), Q, false);
  return { entrance: jail.door, hall: { x0, x1, z0, z1, y }, cache: mid.clone().add(new THREE.Vector3(-inward * 1, 0.6, 2.5)) };
}

/** Globe lamps and trees along the pavements, parked cars at the kerb. */
function streetKit(b: Builder, def: BarrancoDef, c: CoastDef, plants: Plants, trees: THREE.Vector3[], rand: () => number): void {
  const E = def.extent - 6, kinds: CarKind[] = ['sedan', 'sedan', 'wagon', 'beetle', 'tico', 'pickup', 'sedan'];
  const crossX = def.streets.map((s) => s.x), crossZ = [...def.avenues.map((a) => a.z), def.mural.z];
  const rows = [...def.avenues, { z: def.mural.z, half: def.mural.half, x0: undefined, x1: undefined }];
  for (const a of rows) for (const s of [-1, 1]) for (let x = -E, i = 0; x < E; x += 18, i++) {
    const z = a.z + s * (a.half + 0.7);
    if (overRavine(c, x, z, 3) || crossX.some((cx) => Math.abs(cx - x) < 8) || x < (a.x0 ?? -1e9) || x > (a.x1 ?? 1e9)) continue;
    if (i % 2 === 0) globeLamp(b, new THREE.Vector3(x, 0.08, z), false);
    else if (rand() < 0.6) trees.push(new THREE.Vector3(x, 0.08, z + s * 0.4));
    if (rand() < 0.35) car(b, new THREE.Vector3(x + 9, 0.03, a.z + s * (a.half - 1.2)), s > 0 ? -Math.PI / 2 : Math.PI / 2, `car${Math.floor(rand() * 6)}`, kinds[Math.floor(rand() * kinds.length)]);
  }
  for (const st of def.streets) for (const s of [-1, 1]) for (let z = st.z0 + 6; z < st.z1 - 6; z += 18) {
    const x = st.x + s * (st.half + 0.7);
    if (crossZ.some((cz) => Math.abs(cz - z) < 8)) continue;
    if (Math.round(z / 18) % 2 === 0) globeLamp(b, new THREE.Vector3(x, 0.08, z), false);
    if (rand() < 0.3) car(b, new THREE.Vector3(st.x + s * (st.half - 1.2), 0.03, z + 9), s > 0 ? Math.PI : 0, `car${Math.floor(rand() * 6)}`, kinds[Math.floor(rand() * kinds.length)]);
  }
  for (let k = 0; k < 24; k++) {
    const a = rows[k % rows.length], x = Math.max(a.x0 ?? -1e9, Math.min(a.x1 ?? 1e9, (rand() * 2 - 1) * E)), z = a.z + (k % 2 ? 1 : -1) * (a.half + 1.4);
    if (!overRavine(c, x, z, 3)) plants.standing.push({ pos: new THREE.Vector3(x, 0.16, z), yaw: rand() * 6.28, key: ['civ_idle', 'texting', 'look_around'][k % 3] });
  }
}
