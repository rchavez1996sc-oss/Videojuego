import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { addSpan } from '../cables';
import type { CoastDef } from '../coast';
import { overRavine, SIDEWALK, type BarrancoDef } from './layout';
import type { Front } from './streets';

const Q = new THREE.Quaternion(), ARM = 8.3;
const mat = (x: number, y: number, z: number, yaw = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));

/** Tapered concrete pole with a steel crossarm, three insulators, a telephone bracket and (some) a transformer drum. */
function pole(b: Builder, at: THREE.Vector3, yaw: number, transformer: boolean): THREE.Vector3[] {
  b.geometry('concretePole', new THREE.CylinderGeometry(0.12, 0.2, 9, 10).translate(0, 4.5, 0), mat(at.x, at.y, at.z));
  b.box('none', [0.4, 9, 0.4], at.clone().setY(at.y + 4.5), Q, true);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  b.box('steelDark', [1.7, 0.1, 0.1], at.clone().setY(at.y + ARM), q, false);
  const tops = [-0.75, 0, 0.75].map((k) => at.clone().addScaledVector(side, k).setY(at.y + ARM + 0.18));
  for (const t of tops) b.geometry('insulator', new THREE.CylinderGeometry(0.05, 0.07, 0.18, 8), mat(t.x, t.y - 0.09, t.z));
  b.box('steelDark', [0.5, 0.06, 0.06], at.clone().setY(at.y + 6.6), q, false);
  if (transformer) {
    const d = at.clone().addScaledVector(side, -0.42).setY(at.y + 6.9);
    b.geometry('steelDark', new THREE.CylinderGeometry(0.32, 0.32, 0.95, 12), mat(d.x, d.y, d.z));
    b.geometry('concretePole', new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), mat(d.x, d.y + 0.5, d.z));
  }
  b.box('kerbYellow', [0.42, 1.2, 0.42], at.clone().setY(at.y + 0.6), q, false);
  return [...tops, at.clone().setY(at.y + 6.6)];
}

/** Blue newspaper kiosk of Barranco: metal box with a hinged awning, racks of papers and magazines, a vendor. */
function kiosk(b: Builder, at: THREE.Vector3, yaw: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), p = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(at);
  b.box('kioskBlue', [2.2, 2.3, 1.5], p(0, 1.15, 0), q);
  b.box('kioskBlue', [2.5, 0.08, 1.2], p(0, 2.45, 1.05), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.35)), false);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) b.box(['trimWhite', 'awningRed', 'kerbYellow', 'paint-cobalt'][(i + k) % 4], [0.3, 0.38, 0.02], p(-0.85 + i * 0.34, 0.75 + k * 0.48, 0.77), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.12)), false);
  b.box('lhBlack', [0.9, 0.12, 0.25], p(0, 2.05, 0.77), q, false);
}

/** Public litter bin (green steel on a post) and a yellow fire hydrant. */
function bin(b: Builder, at: THREE.Vector3): void {
  b.geometry('lampPole', new THREE.CylinderGeometry(0.24, 0.21, 0.6, 12, 1, true), mat(at.x, at.y + 0.75, at.z));
  b.geometry('lampPole', new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), mat(at.x, at.y + 0.35, at.z));
  b.box('none', [0.5, 1.1, 0.5], at.clone().setY(at.y + 0.55), Q, true);
}
function hydrant(b: Builder, at: THREE.Vector3): void {
  b.geometry('kerbYellow', new THREE.CylinderGeometry(0.13, 0.15, 0.75, 10), mat(at.x, at.y + 0.37, at.z));
  b.geometry('kerbYellow', new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(at.x, at.y + 0.75, at.z));
  b.geometry('kerbYellow', new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8).rotateZ(Math.PI / 2), mat(at.x, at.y + 0.5, at.z));
}

/**
 * Street layer over the casonas: concrete poles on one pavement of every street with power and phone lines strung
 * pole to pole (they sway; bullets spark and cut them) and service drops to the nearest house fronts; newspaper
 * kiosks at corners, litter bins and hydrants.
 */
export function streetLayer(b: Builder, def: BarrancoDef, c: CoastDef, fronts: Front[], rand: () => number): void {
  const E = def.extent - 6, rows: { pts: THREE.Vector3[]; yaw: number }[] = [];
  const crossX = def.streets.map((s) => s.x), crossZ = [...def.avenues.map((a) => a.z), def.mural.z];
  for (const a of [...def.avenues, { z: def.mural.z, half: def.mural.half, x0: undefined, x1: undefined }]) {
    const pts: THREE.Vector3[] = [], z = a.z + a.half + 0.45;
    for (let x = -E + 9; x < E; x += 34) if (x > (a.x0 ?? -1e9) && x < (a.x1 ?? 1e9) && !overRavine(c, x, z, 4) && !crossX.some((cx) => Math.abs(cx - x) < 7)) pts.push(new THREE.Vector3(x, 0.08, z));
    rows.push({ pts, yaw: 0 });
  }
  for (const st of def.streets) {
    const pts: THREE.Vector3[] = [], x = st.x + st.half + 0.45;
    for (let z = st.z0 + 12; z < st.z1 - 4; z += 34) if (!crossZ.some((cz) => Math.abs(cz - z) < 7)) pts.push(new THREE.Vector3(x, 0.08, z));
    rows.push({ pts, yaw: Math.PI / 2 });
  }
  for (const row of rows) {
    let prev: THREE.Vector3[] | null = null, prevAt: THREE.Vector3 | null = null;
    for (const at of row.pts) {
      const ends = pole(b, at, row.yaw, rand() < 0.2);
      if (prev && prevAt && prevAt.distanceTo(at) < 40) ends.forEach((e, k) => addSpan(prev![k], e, 0.45 + k * 0.08 + rand() * 0.25));
      const near = fronts.map((f) => ({ f, d: f.at.distanceTo(at) })).filter((n) => n.d < 15).sort((x, y) => x.d - y.d).slice(0, 2);
      for (const { f } of near) {
        const along = new THREE.Vector3(-f.out.z, 0, f.out.x), t = THREE.MathUtils.clamp(along.dot(at.clone().sub(f.at)), -f.w / 2 + 0.6, f.w / 2 - 0.6);
        addSpan(ends[3], f.at.clone().addScaledVector(along, t).addScaledVector(f.out, 0.12).setY(4.3), 0.35 + rand() * 0.3);
      }
      prev = ends;
      prevAt = at;
    }
  }
  for (const a of def.avenues) for (const x of crossX) {
    if (x < (a.x0 ?? -1e9) || x > (a.x1 ?? 1e9)) continue;
    const corner = new THREE.Vector3(x - a.half - 3.4, 0.16, a.z - a.half - SIDEWALK / 2 - 0.1);
    if (rand() < 0.35) kiosk(b, corner.clone().setZ(corner.z + 0.2), Math.PI);
    else hydrant(b, corner.clone().setX(x - 5.2));
    bin(b, new THREE.Vector3(x + 5.5, 0.16, a.z + a.half + 0.6));
  }
}
