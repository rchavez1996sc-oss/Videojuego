import * as THREE from 'three';
import { chatGroup, type Plants } from '../malecon/park';
import { framer, inRect, northAt, type CampusDef } from './layout';

const LONE = ['texting', 'look_around', 'civ_idle'];

/** Distance from (x, z) to segment a–c. */
function seg(x: number, z: number, a: number[], c: number[]): number {
  const dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

/**
 * Student crowds raising the campus extras to `factor` times what the faculties, boards and stalls already placed:
 * knots of students and loners outside every faculty's front, then groups scattered over the lawns, clear of
 * buildings, car parks, roads and the stadium.
 */
export function moreStudents(def: CampusDef, plants: Plants, rand: () => number, factor: number): void {
  const s = def.stadium, B = def.bounds, want = (plants.standing.length + plants.seats.length) * factor;
  const free = (x: number, z: number) =>
    !def.buildings.some((r) => inRect(r, x, z, 0.9)) && !def.parkings.some((r) => inRect(r, x, z, 0.5)) && !inRect(def.field, x, z, 3) &&
    ((x - s.x) / (s.rx * 1.3)) ** 2 + ((z - s.z) / (s.rz * 1.3)) ** 2 > 1 && !def.roads.some((r) => r.pts.some((a, i) => i + 1 < r.pts.length && seg(x, z, a, r.pts[i + 1]) < r.w / 2 + 0.6)) &&
    z < def.venezuela.z - def.venezuela.half - def.venezuela.sidewalk - 1 && x > B.west + 3 && x < B.x - 3 && z > northAt(B, x) + 3;
  const lone = (p: THREE.Vector3) => plants.standing.push({ pos: p, yaw: rand() * Math.PI * 2, key: LONE[Math.floor(rand() * LONE.length)] });
  for (const bd of def.buildings) {
    if (bd.floors < 2 || bd.key === 'comedor') continue;
    const at = framer(bd);
    for (let k = 0; k < 4; k++) {
      const p = at((rand() - 0.5) * bd.w * 0.8, 0.02, bd.d / 2 + 3 + rand() * 6);
      if (!free(p.x, p.z)) continue;
      if (k < 2) chatGroup(plants.standing, p, rand);
      else lone(p);
    }
  }
  for (let tries = 0; plants.standing.length + plants.seats.length < want && tries < 30000; tries++) {
    const x = B.west + 6 + rand() * (B.x - B.west - 12), n = northAt(B, x), z = n + 6 + rand() * (def.venezuela.z - n - 30);
    if (!free(x, z)) continue;
    if (rand() < 0.7) chatGroup(plants.standing, new THREE.Vector3(x, 0.02, z), rand);
    else lone(new THREE.Vector3(x, 0.02, z));
  }
}
