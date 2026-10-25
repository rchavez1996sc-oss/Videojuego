import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { framer, yawQ, type CampusDef } from './layout';
import type { Paths } from './greens';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Comedor patio details from the user's photos: the curving walks edged with low golden hedges, red and purple
 * flowerbeds, plain concrete block benches, black wayfinding signs, a green kiosk, crooked shade trees, and students
 * sitting, lying and talking on the grass.
 */
export function patioDetail(b: Builder, def: CampusDef, paths: Paths, plants: Plants, rand: () => number): void {
  const p = def.park, at = framer(p), q = yawQ(p.yaw), W = p.w / 2, D = p.d / 2;
  for (const line of paths.lines) {
    const pts = line.pts;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], c = pts[i + 1], len = a.distanceTo(c);
      if (len < 0.3) continue;
      const dir = c.clone().sub(a).normalize(), side = new THREE.Vector2(-dir.y, dir.x), rot = new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(dir.x, dir.y));
      for (const s of [-1, 1]) {
        if ((i + (s > 0 ? 3 : 0)) % 9 === 0) continue;
        const m = a.clone().lerp(c, 0.5).addScaledVector(side, s * (line.w / 2 + 0.45));
        b.box('hedgeGold', [0.6, 0.5 + rand() * 0.15, len + 0.15], new THREE.Vector3(m.x, 0.27, m.y), rot, false);
      }
    }
  }
  for (const [x, z, w, d] of [[-W * 0.7, D * 0.3, 7, 2.2], [W * 0.15, D * 0.55, 6, 1.8], [W * 0.62, -D * 0.25, 5, 2]]) {
    b.box('lawnBed', [w + 0.3, 0.18, d + 0.3], at(x, 0.09, z), q, false);
    for (let k = 0; k < Math.round(w / 0.9); k++) b.box(k % 3 ? 'flowerRed' : 'flowerPurple', [0.8, 0.35 + rand() * 0.2, d * 0.8], at(x - w / 2 + 0.45 + k * 0.9, 0.3, z), q, false);
  }
  for (const [x, z, yaw] of [[-W * 0.35, D * 0.75, 0], [W * 0.38, D * 0.1, 1.2], [-W * 0.9, -D * 0.1, 0.4], [W * 0.82, D * 0.6, 2]]) {
    const r = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    b.box('concrete', [2.2, 0.45, 0.6], at(x, 0.225, z), r, true);
    plants.seats.push({ pos: at(x, 0, z).add(new THREE.Vector3(0, 0, 0.1).applyQuaternion(r)), yaw: Math.atan2(...((v) => [v.x, v.z] as [number, number])(new THREE.Vector3(0, 0, 1).applyQuaternion(r))) });
  }
  for (const [x, z] of [[-W * 0.55, -D + 6], [W * 0.3, D - 3]]) {
    const pos = at(x, 0, z);
    b.box('lampPole', [0.1, 2.6, 0.1], pos.clone().setY(1.3), q, true);
    b.box('lampPole', [1.4, 0.32, 0.04], pos.clone().add(new THREE.Vector3(0.6, 2.35, 0).applyQuaternion(q)), q, false);
    b.box('lampPole', [1.1, 0.28, 0.04], pos.clone().add(new THREE.Vector3(-0.5, 1.95, 0).applyQuaternion(q)), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, 0.6)), false);
  }
  const k = at(-W - 3, 0, D * 0.2);
  b.box('kioskGreen', [2.6, 2.5, 2], k.clone().setY(1.25), q, true);
  b.box('kioskGreen', [3, 0.12, 2.4], k.clone().setY(2.56), q, false);
  b.box('darkGlass', [1.6, 0.9, 0.04], at(-W - 3, 1.5, D * 0.2 + 1.02), q, false);
  for (let i = 0; i < 14; i++) {
    const pos = at((rand() - 0.5) * W * 1.7, 0, (rand() - 0.5) * D * 1.5);
    if (paths.lines.some((l) => l.pts.some((pt) => pt.distanceTo(new THREE.Vector2(pos.x, pos.z)) < 3))) continue;
    plants.trees.push(pos);
  }
  for (let i = 0; i < 6; i++) {
    const pos = at((rand() - 0.5) * W * 1.5, 0.02, (rand() - 0.5) * D * 1.2);
    plants.standing.push({ pos, yaw: rand() * 6.28, key: rand() < 0.5 ? 'texting' : 'look_around' });
  }
}
