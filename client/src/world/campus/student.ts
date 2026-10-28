import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { chatGroup, ribbon, type Plants } from '../malecon/park';
import { bust } from '../malecon/monuments';
import { framer, inRect, yawQ, type CampusDef, type Rect } from './layout';
import { onCarriageway } from './roads';
import { FLOOR } from './pavilion';
import type { Paths } from './greens';
import { Atlas, bannerDraw, graffitiDraw, muralDraw, posterDraw, type PoliticsDef } from './propaganda';

const UP = new THREE.Vector3(0, 1, 0);
const big = (r: CampusDef['buildings'][number]) => r.w * r.d > 300;
const front = (r: CampusDef['buildings'][number], ahead: number) => framer(r)(0, 0, r.d / 2 + ahead);

/** Footpaths over the lawns: from each building's door to the nearest road, and short desire lines between neighbouring doors. */
export function studentWalks(b: Builder, hf: Heightfield, def: CampusDef, paths: Paths): [number, number][][] {
  const walks: [number, number][][] = [], blocked = (x: number, z: number) => def.buildings.some((r) => inRect(r, x, z, 0.8)) || def.parkings.some((r) => inRect(r, x, z, 0.5)) || inRect(def.field, x, z, 3.5);
  const clear = (a: THREE.Vector3, c: THREE.Vector3, skipRoads: boolean) => {
    for (let t = 0.04; t < 0.96; t += 0.02) {
      const x = a.x + (c.x - a.x) * t, z = a.z + (c.z - a.z) * t;
      if (blocked(x, z) || (skipRoads && onCarriageway(def, x, z, 1.5))) return false;
    }
    return true;
  };
  const doors = def.buildings.filter(big).map((r) => front(r, 1.2));
  for (const d of doors) {
    let best: THREE.Vector3 | null = null;
    for (const r of def.roads) for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = new THREE.Vector3(r.pts[i][0], 0, r.pts[i][1]), c = new THREE.Vector3(r.pts[i + 1][0], 0, r.pts[i + 1][1]);
      const line = new THREE.Line3(a, c), p = line.closestPointToPoint(d, true, new THREE.Vector3()), out = d.clone().sub(p).setY(0);
      if (out.lengthSq() < 1) continue;
      const end = p.add(out.normalize().multiplyScalar(r.w / 2 + 2.2));
      if ((!best || end.distanceTo(d) < best.distanceTo(d)) && clear(d, end, false)) best = end;
    }
    if (best && best.distanceTo(d) > 2.5) walks.push([[d.x, d.z], [best.x, best.z]]);
  }
  doors.forEach((d, i) => {
    let n = 0;
    doors.forEach((e, j) => {
      if (j <= i || n >= 2 || d.distanceTo(e) > 85 || d.distanceTo(e) < 12 || !clear(d, e, true)) return;
      walks.push([[d.x, d.z], [e.x, e.z]]);
      n++;
    });
  });
  walks.forEach((w, k) => {
    const pts = w.map(([x, z]) => new THREE.Vector2(x, z));
    ribbon(b, hf, pts, 2.2, 'parkPath', 0.08 + (k % 12) * 0.006);
    paths.lines.push({ pts, w: 2.2 });
  });
  return walks;
}

/**
 * Student life and politics: notice boards plastered with posters beside the footpaths, freestanding walls with
 * murals (quotes over the Andes) on one face and graffiti on the other, painted banners hung from the faculties,
 * busts of Peruvian thinkers round the entrance plaza, and knots of students talking. Footprints go into `taken`.
 */
export function studentLife(b: Builder, def: CampusDef, p: PoliticsDef, walks: [number, number][][], hard: (x: number, z: number, m?: number) => boolean, taken: Rect[], plants: Plants, lighting: Lighting, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const posters = new Atlas(lighting, 'posters', 6, 4, [256, 352], posterDraw(p));
  const graffiti = new Atlas(lighting, 'graffiti', 4, 6, [512, 160], graffitiDraw(p), { transparent: true, alphaTest: 0.2, roughness: 0.9 });
  const banners = new Atlas(lighting, 'banners', 2, 6, [1024, 256], bannerDraw(p), { side: THREE.DoubleSide, roughness: 0.97 });
  const murals = new Atlas(lighting, 'murals', 2, 3, [1024, 320], muralDraw(p), { roughness: 0.8 });
  const place = (x: number, z: number, w: number, d: number, yaw: number) => taken.push({ x, z, w, d, yaw: (-yaw * 180) / Math.PI });

  walks.forEach((w, k) => {
    if (k % 3 === 2) return;
    const a = new THREE.Vector3(w[0][0], 0, w[0][1]), c = new THREE.Vector3(w[1][0], 0, w[1][1]), len = a.distanceTo(c);
    if (len < 10) return;
    const dir = c.clone().sub(a).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x), s = rand() < 0.5 ? 1 : -1;
    const pos = a.clone().lerp(c, 0.35 + rand() * 0.3).addScaledVector(side, s * 2.6), facing = side.clone().multiplyScalar(-s);
    if (hard(pos.x, pos.z, 0.4)) return;
    const yaw = Math.atan2(facing.x, facing.z), q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(pos);
    b.box('benchWood', [2.8, 1.7, 0.08], at(0, 1.55, 0), q, true);
    b.box('lampPole', [2.95, 0.08, 0.14], at(0, 2.44, 0), q, false);
    for (const x of [-1.3, 1.3]) b.box('lampPole', [0.07, 2.4, 0.07], at(x, 1.2, -0.06), q, false);
    for (let i = 0; i < 7; i++) posters.add(Math.floor(rand() * posters.count), at(-1.05 + (i % 4) * 0.7 + (rand() - 0.5) * 0.12, 1.98 - Math.floor(i / 4) * 0.82 + (rand() - 0.5) * 0.08, 0.05), q, 0.56, 0.77, (rand() - 0.5) * 0.12);
    graffiti.add(Math.floor(rand() * graffiti.count), at(0, 1.4, -0.05), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI)), 2.6, 0.8);
    place(pos.x, pos.z, 3.2, 0.6, yaw);
    if (rand() < 0.7) chatGroup(plants.standing, at((rand() - 0.5) * 2, 0.02, 2), rand);
    if (rand() < 0.5) plants.standing.push({ pos: at(0.4, 0.02, 1), yaw: yaw + Math.PI, key: 'look_around' });
  });

  for (let n = 0, tries = 0; n < 6 && tries < 400; tries++) {
    const B = def.bounds, x = B.west + 20 + rand() * (B.x - B.west - 40), z = B.north + 20 + rand() * (def.venezuela.z - B.north - 50);
    const yaw = rand() < 0.5 ? 0 : Math.PI / 2, q = new THREE.Quaternion().setFromAxisAngle(UP, yaw), L = 14;
    if (hard(x, z, 8) || taken.some((r) => inRect(r, x, z, 12))) continue;
    const at = (u: number, y: number, v: number) => new THREE.Vector3(u, y, v).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
    b.box('uniWhite', [L, 3.4, 0.35], at(0, 1.7, 0), q, true);
    b.box('uniRed', [L + 0.1, 0.2, 0.45], at(0, 3.45, 0), q, true);
    murals.add(n % murals.count, at(0, 1.75, 0.18), q, L - 0.6, 3);
    for (const u of [-3.6, 3.6]) graffiti.add(Math.floor(rand() * graffiti.count), at(u, 1.6, -0.18), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI)), 6.2, 1.9);
    place(x, z, L, 1, yaw);
    chatGroup(plants.standing, at(rand() * 6 - 3, 0.02, 3), rand);
    n++;
  }

  def.buildings.forEach((r, i) => {
    if (!big(r) || r.key === 'comedor' || r.key === 'industrial' || i % 2) return;
    const H = r.floors * FLOOR, w = Math.min(10, r.w * 0.35), at = framer(r);
    banners.add((i / 2) % banners.count, at((rand() - 0.5) * (r.w - w - 4), H - 1.6, r.d / 2 + (r.skin === 'grid' ? 0.85 : 0.36)), yawQ(r.yaw), w * 0.75, w * 0.1875, (rand() - 0.5) * 0.05);
  });

  const busts = p.busts, pl = def.plazuela;
  busts.forEach((d, k) => {
    let pos: THREE.Vector3, look: THREE.Vector3;
    if (d.at) {
      pos = new THREE.Vector3(d.at[0], 0, d.at[1]);
      look = pos.clone().add(new THREE.Vector3(-Math.sin(d.at[2]), 0, -Math.cos(d.at[2])));
    } else if (pl && k < 6) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      pos = new THREE.Vector3(pl.x + Math.sin(a) * (pl.r + 6.5), 0, pl.z + Math.cos(a) * (pl.r + 6.5));
      look = new THREE.Vector3(pl.x, 0, pl.z);
    } else {
      const w = walks[(k * 5) % walks.length], a = new THREE.Vector3(w[0][0], 0, w[0][1]), c = new THREE.Vector3(w[1][0], 0, w[1][1]);
      const mid = a.clone().lerp(c, 0.5), dir = c.clone().sub(a).normalize();
      pos = mid.clone().add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(3));
      look = mid;
    }
    const to = look.clone().sub(pos);
    bust(b, pos, d, group, lighting, Math.atan2(-to.x, -to.z));
    place(pos.x, pos.z, 1.4, 1.4, 0);
  });

  for (const a of [posters, graffiti, banners, murals]) {
    const m = a.mesh();
    if (m) group.add(m);
  }
  return group;
}
