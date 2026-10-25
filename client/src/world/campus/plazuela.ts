import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import { bench, ribbon, type Plants } from '../malecon/park';
import { campusLamp } from './roads';
import type { Paths } from './greens';

/** Entrance plaza on the campus side of Puerta 2: lawn crossed by straight walks from its corners to a ring walk round a central bed. */
export interface PlazuelaDef { x: number; z: number; r: number; corners: [number, number][]; edges?: [number, number][][] }

export function plazuela(b: Builder, hf: Heightfield, p: PlazuelaDef, plants: Plants, paths: Paths, rand: () => number): void {
  const c = new THREE.Vector2(p.x, p.z), ring = p.r + 1.5;
  b.geometry('parkPath', new THREE.RingGeometry(p.r - 1.5, ring, 64).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(p.x, 0.14, p.z));
  b.geometry('kerbYellow', new THREE.CylinderGeometry(p.r - 1.5, p.r - 1.5, 0.3, 48, 1, true), new THREE.Matrix4().makeTranslation(p.x, 0.1, p.z));
  paths.discs.push({ x: p.x, z: p.z, r: ring + 0.2 });
  plants.palms.push(new THREE.Vector3(p.x, 0, p.z), new THREE.Vector3(p.x + 3, 0, p.z - 2), new THREE.Vector3(p.x - 2.6, 0, p.z + 2.4));
  for (const [x, z] of p.corners) {
    const end = new THREE.Vector2(x, z), dir = end.clone().sub(c).normalize(), start = c.clone().addScaledVector(dir, ring - 0.4);
    const pts = [start, end];
    ribbon(b, hf, pts, 3, 'parkPath', 0.1);
    paths.lines.push({ pts, w: 3 });
    const len = start.distanceTo(end), side = new THREE.Vector2(-dir.y, dir.x);
    for (let d = 8; d < len - 4; d += 14) {
      const at = start.clone().addScaledVector(dir, d).addScaledVector(side, 2.6);
      campusLamp(b, new THREE.Vector3(at.x, 0, at.y), Math.atan2(dir.x, dir.y));
      const seat = start.clone().addScaledVector(dir, d + 6).addScaledVector(side, -2.4), yaw = Math.atan2(side.x, side.y);
      bench(b, new THREE.Vector3(seat.x, 0.02, seat.y), yaw);
      if (rand() < 0.4) plants.seats.push({ pos: new THREE.Vector3(seat.x, 0.02, seat.y), yaw });
    }
  }
  for (const edge of p.edges ?? []) {
    const pts = edge.map(([x, z]) => new THREE.Vector2(x, z));
    ribbon(b, hf, pts, 2.6, 'parkPath', 0.06);
    paths.lines.push({ pts, w: 2.6 });
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, pos = new THREE.Vector3(p.x + Math.sin(a) * (ring + 1.6), 0.02, p.z + Math.cos(a) * (ring + 1.6));
    if (k % 2) bench(b, pos, a + Math.PI);
    else campusLamp(b, pos, a);
  }
}
