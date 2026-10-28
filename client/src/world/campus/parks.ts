import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { bench, chatGroup, ribbon, type Plants } from '../malecon/park';
import { framer, type CampusDef } from './layout';
import { campusLamp } from './roads';
import type { Paths } from './greens';

/**
 * Faculty lawns from the user's Google Maps plan (Parque Facultad de Letras): a lawn crossed corner to corner by
 * paving with a third walk from the south edge, benches and lamps along the diagonals, students on the grass.
 */
export function facultyParks(b: Builder, hf: Heightfield, def: CampusDef, paths: Paths, plants: Plants, rand: () => number): void {
  for (const p of def.parks ?? []) {
    const at = framer(p), W = p.w / 2, D = p.d / 2, yaw = (-p.yaw * Math.PI) / 180;
    const c = [at(-W, 0, -D), at(W, 0, -D), at(W, 0, D), at(-W, 0, D)].map((v) => new THREE.Vector2(v.x, v.z));
    const mid = at(-W * 0.2, 0, D), m2 = new THREE.Vector2(mid.x, mid.z);
    for (const [a, e] of [[c[0], c[2]], [c[1], c[3]], [m2, c[1]]] as const) {
      const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => a.clone().lerp(e, t));
      ribbon(b, hf, pts, 2.6, 'parkPath', 0.1);
      paths.lines.push({ pts, w: 2.6 });
      for (const t of [0.3, 0.7]) {
        const q = a.clone().lerp(e, t), dir = e.clone().sub(a).normalize(), side = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(2.4);
        const pos = new THREE.Vector3(q.x + side.x, 0.08, q.y + side.y);
        bench(b, pos, Math.atan2(-side.x, -side.y));
        if (rand() < 0.6) plants.seats.push({ pos, yaw: Math.atan2(-side.x, -side.y) });
      }
    }
    for (const k of [0.2, 0.8]) campusLamp(b, at(-W + k * 2 * W, 0, 0), yaw);
    for (let i = 0; i < 6; i++) chatGroup(plants.standing, at((rand() - 0.5) * W * 1.6, 0.02, (rand() - 0.5) * D * 1.6), rand);
  }
}
