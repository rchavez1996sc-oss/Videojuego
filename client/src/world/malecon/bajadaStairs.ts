import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { RAVINE, edgeZ, ravineCentre, ravineFloor, type CoastDef } from '../coast';

type Ravine = NonNullable<CoastDef['ravines']>[number];
export interface Flight { z0: number; z1: number; side: 1 | -1 }

/** Where the ravine bank starts at z (just outside the top retaining wall), measured from the centre line. */
function topOffset(f: number): number {
  const R = RAVINE;
  return R.floor + R.lipRun + Math.max(0, R.top - f - R.lip) / R.slope + R.topRun + 0.6;
}

/**
 * Plans straight stair flights down the grass banks, alternating sides: each starts at street level just outside the
 * retaining wall at `z0` and lands on the verge above the stone wall further down at `z1`, at a walkable ~33° pitch.
 */
export function planFlights(c: CoastDef, r: Ravine): Flight[] {
  const mouth = edgeZ(c, r.x) + c.run;
  return [10, 34, 46, 58].map((k) => r.head + k).filter((z) => z < mouth - 30).map((z0, i) => {
    let z1 = z0 + 4;
    while (z1 < z0 + 80) {
      const f = ravineFloor(c, r, z1), rise = -(f + RAVINE.lip), run = Math.hypot(z1 - z0, topOffset(ravineFloor(c, r, z0)) - RAVINE.floor - RAVINE.lipRun);
      if (run * 0.65 >= rise) break;
      z1 += 1;
    }
    return { z0, z1, side: i % 2 ? -1 : 1 };
  });
}

/** Concrete stair flight with black railings and a ramp collider (the steps are visual). */
export function buildFlight(b: Builder, c: CoastDef, r: Ravine, fl: Flight): void {
  const f0 = ravineFloor(c, r, fl.z0), f1 = ravineFloor(c, r, fl.z1), s = fl.side;
  const a = new THREE.Vector3(ravineCentre(r, fl.z0) + s * topOffset(f0), 0, fl.z0);
  const e = new THREE.Vector3(ravineCentre(r, fl.z1) + s * (RAVINE.floor + RAVINE.lipRun + 0.3), f1 + RAVINE.lip, fl.z1);
  const d = e.clone().sub(a), flat = Math.hypot(d.x, d.z), yaw = Math.atan2(d.x, d.z), len = d.length();
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const n = Math.ceil(-d.y / 0.18), tread = flat / n, rise = -d.y / n;
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    const p = a.clone().addScaledVector(new THREE.Vector3(d.x, 0, d.z).normalize(), tread * (i + 0.5));
    const top = a.y - rise * (i + 1);
    b.box('concrete', [1.8, rise + 0.6, tread + 0.02], new THREE.Vector3(p.x, top - (rise + 0.6) / 2 + rise, p.z), qYaw, false);
  }
  const pitch = Math.atan2(-d.y, flat), q = qYaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch));
  b.box('none', [1.8, 0.2, len], a.clone().lerp(e, 0.5).add(new THREE.Vector3(0, -0.05, 0)), q, true);
  for (const k of [-1, 1]) {
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(k * 0.95);
    for (let t = 0; t <= 1.001; t += 2 / len) {
      const p = a.clone().lerp(e, t).add(side);
      b.box('lhBlack', [0.05, 1, 0.05], p.clone().setY(p.y + 0.5), qYaw, false);
    }
    b.box('lhBlack', [0.06, 0.06, len], a.clone().lerp(e, 0.5).add(side).setY((a.y + e.y) / 2 + 1), q, false);
  }
}
