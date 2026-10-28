import * as THREE from 'three';
import { addStrip } from '../groundStrips';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { bench, chatGroup, ribbon, type Plants } from '../malecon/park';
import { framer, inRect, northAt, type CampusDef, type Rect } from './layout';
import { campusLamp } from './roads';

/** Hard ground laid out by the park (path centrelines with widths, round plazas), for the lawn painter. */
export interface Paths { lines: { pts: THREE.Vector2[]; w: number }[]; discs: { x: number; z: number; r: number }[] }

function curve(at: (x: number, y: number, z: number) => THREE.Vector3, pts: [number, number][], n = 40): THREE.Vector2[] {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => at(x, 0, z)));
  return c.getPoints(n).map((p) => new THREE.Vector2(p.x, p.z));
}

/**
 * Parque del Comedor (from the user's photos): straight walk along the dining hall, two curving paths from its
 * stairs to the road, a winding cross path, a round plaza with benches, low hedges, lamps, trees and palms.
 */
export function comedorPark(b: Builder, hf: Heightfield, def: CampusDef, plants: Plants, rand: () => number): Paths {
  const p = def.park, at = framer(p), W = p.w / 2, D = p.d / 2, yaw = (-p.yaw * Math.PI) / 180;
  const paths: Paths = { lines: [], discs: [] };
  const path = (pts: THREE.Vector2[], w: number, lift: number) => {
    ribbon(b, hf, pts, w, 'parkPath', lift);
    paths.lines.push({ pts, w });
  };
  const front = -D + 2.2;
  path([xz(at(-W, 0, front)), xz(at(W, 0, front))], 4, 0.08);
  const stairs = [-W * 0.52, W * 0.46];
  path(curve(at, [[stairs[0], front], [stairs[0] - 6, -2], [-W * 0.86, D + 1]]), 3, 0.11);
  path(curve(at, [[stairs[1], front], [stairs[1] + 7, 2], [W * 0.84, D + 1]]), 3, 0.11);
  const wind = curve(at, [[-W - 1, 6], [-W * 0.5, 9], [-W * 0.18, 1], [W * 0.15, -1.5], [W * 0.5, 7], [W + 1, 3]], 60);
  path(wind, 2.6, 0.14);
  const centre = at(0, 0, 0.5), disc = new THREE.Matrix4().makeTranslation(centre.x, 0.17, centre.z);
  b.geometry('parkPath', new THREE.CylinderGeometry(6, 6, 0.2, 40).translate(0, -0.1, 0), disc);
  b.geometry('kerbYellow', new THREE.TorusGeometry(6, 0.12, 6, 48).rotateX(Math.PI / 2).translate(0, 0.05, 0), disc);
  paths.discs.push({ x: centre.x, z: centre.z, r: 6.2 });
  addStrip([new THREE.Vector2(centre.x, centre.z), new THREE.Vector2(centre.x, centre.z)], 12, 'parkPath');
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, pos = centre.clone().add(new THREE.Vector3(Math.sin(a) * 4.6, 0.17, Math.cos(a) * 4.6));
    bench(b, pos, a);
    if (rand() < 0.6) plants.seats.push({ pos, yaw: a });
  }
  for (let x = -W + 5; x < W - 4; x += 9) {
    if (stairs.some((s) => Math.abs(x - s) < 5)) continue;
    const pos = at(x, 0.08, front + 2.6);
    bench(b, pos, yaw + Math.PI);
    if (rand() < 0.45) plants.seats.push({ pos, yaw: yaw + Math.PI });
  }
  for (let i = 8; i < wind.length - 4; i += 12) campusLamp(b, new THREE.Vector3(wind[i].x + 2, 0, wind[i].y + 1.6), yaw);
  for (let i = 0; i < 4; i++) chatGroup(plants.standing, at((rand() - 0.5) * W * 1.4, 0.06, front + 1.2 + rand() * 0.8), rand);
  return paths;
}

const xz = (v: THREE.Vector3) => new THREE.Vector2(v.x, v.z);

function segDist(x: number, z: number, a: THREE.Vector2, c: THREE.Vector2): number {
  const dx = c.x - a.x, dz = c.y - a.y, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / l2));
  return Math.hypot(x - a.x - dx * t, z - a.y - dz * t);
}

/** True where the ground is built over (buildings, roads with sidewalks, lots, pitch, plaza, park paths), grown by `m`. */
export function campusHard(def: CampusDef, paths: Paths, extra: Rect[]): (x: number, z: number, m?: number) => boolean {
  const v = def.venezuela;
  const roads = [...def.roads.map((r) => ({ pts: r.pts.map(([x, z]) => new THREE.Vector2(x, z)), w: r.w + 5 })), ...paths.lines];
  return (x, z, m = 0) =>
    z > v.z - v.half - v.sidewalk - 1 - m ||
    def.buildings.some((r) => inRect(r, x, z, 1.2 + m)) ||
    def.parkings.some((r) => inRect(r, x, z, 0.4 + m)) ||
    inRect(def.field, x, z, 3.4 + m) ||
    ((x - def.stadium.x) / (def.stadium.rx * 1.3 + m)) ** 2 + ((z - def.stadium.z) / (def.stadium.rz * 1.3 + m)) ** 2 < 1 ||
    extra.some((r) => inRect(r, x, z, m)) ||
    (!!def.gate2 && Math.abs(x - def.gate2.x + 8) < 29 + m && Math.abs(z - def.gate2.z) < 4 + m) ||
    paths.discs.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + m) ||
    roads.some((r) => r.pts.some((a, i) => i + 1 < r.pts.length && segDist(x, z, a, r.pts[i + 1]) < r.w / 2 + 0.3 + m));
}

/** Lawn wherever the campus is not built over (the plain is bare packed earth otherwise); lumpy where trodden. */
export function paintCampusLawns(hf: Heightfield, def: CampusDef, hard: (x: number, z: number) => boolean): void {
  const B = def.bounds;
  for (let zi = 0; zi < hf.n; zi++) for (let xi = 0; xi < hf.n; xi++) {
    const x = -hf.half + xi * hf.step, z = -hf.half + zi * hf.step;
    if (x < B.west || x > B.x || z < northAt(B, x) || z > B.south) continue;
    if (hf.plainOut(x, z) > 0 || hf.heightAt(x, z) > 0.4 || hard(x, z)) continue;
    const k = (zi * hf.n + xi) * 4, worn = Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) * Math.sin(z * 0.17 + Math.sin(x * 0.11) * 2);
    hf.mask[k + 1] = (worn > 0.55 ? 0.45 : 0.95) * 255;
    hf.mask[k + 2] = worn > 0.55 ? 90 : 0;
  }
}

/** Trees, palms and Norfolk pines scattered on the lawns, clear of everything built. */
export function plantCampus(hf: Heightfield, def: CampusDef, hard: (x: number, z: number, m?: number) => boolean, plants: Plants, rand: () => number): void {
  for (const f of def.forests ?? []) for (let z = f.z0; z < f.z1; z += f.gap) for (let x = f.x0; x < f.x1; x += f.gap) {
    const px = x + (rand() - 0.5) * f.gap * 0.9, pz = z + (rand() - 0.5) * f.gap * 0.9;
    if (hf.heightAt(px, pz) < 0.3 && !hard(px, pz, 1.2)) plants.trees.push(new THREE.Vector3(px, 0, pz));
  }
  const B = def.bounds, want: [THREE.Vector3[], number, number][] = [[plants.trees, 150, 4.5], [plants.palms, 40, 3], [plants.pines, 6, 5]];
  for (const [list, count, gap] of want) {
    for (let tries = 0, n = 0; n < count && tries < count * 40; tries++) {
      const x = B.west + 4 + rand() * (B.x - B.west - 8), nz = northAt(B, x), z = nz + 6 + rand() * (B.south - 30 - nz);
      if (hf.heightAt(x, z) > 0.3 || hard(x, z, gap) || [...plants.trees, ...plants.palms, ...plants.pines].some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
      list.push(new THREE.Vector3(x, 0, z));
      n++;
    }
  }
}
