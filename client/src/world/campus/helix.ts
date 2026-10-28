import * as THREE from 'three';
import type { Builder } from '../buildingKit';

const UP = new THREE.Vector3(0, 1, 0), N = 24, IN = 1.15;

/**
 * Walkable helical stair (Química's courtyard, from the user's photo): a ramp of tilted treads winding round a yellow
 * core, one turn per `rise`, `turns` turns starting at angle 0 (local +x) on the ground; yellow soffit and outer
 * stringer, steel railing with gaps where it lands on each floor (angle 0), round canopy on top of the core.
 */
export function helix(b: Builder, at: (x: number, y: number, z: number) => THREE.Vector3, q: THREE.Quaternion, cx: number, cz: number, R: number, rise: number, turns: number): void {
  const dA = (Math.PI * 2) / N, mid = (IN + R) / 2, width = R - IN, basis = new THREE.Matrix4(), local = new THREE.Quaternion();
  for (let i = 0; i < N * turns; i++) {
    const a = (i + 0.5) * dA, y0 = (i / N) * rise, y1 = ((i + 1) / N) * rise, len = mid * dA, slope = Math.atan2(y1 - y0, len);
    const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), tang = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const zA = tang.clone().multiplyScalar(Math.cos(slope)).addScaledVector(UP, Math.sin(slope)), yA = UP.clone().multiplyScalar(Math.cos(slope)).addScaledVector(tang, -Math.sin(slope));
    local.setFromRotationMatrix(basis.makeBasis(radial, yA, zA));
    const rq = q.clone().multiply(local), ym = (y0 + y1) / 2, put = (mat: string, size: [number, number, number], r: number, dy: number, collide = false) =>
      b.box(mat, size, at(cx + Math.cos(a) * r, ym + dy, cz + Math.sin(a) * r), rq, collide);
    put('tileCream', [width, 0.14, len * (R / mid) * 1.04], mid, -0.07, true);
    put('uniYellow', [width, 0.32, len * 1.06], mid, -0.32);
    put('uniYellow', [0.16, 0.95, len * (R / mid) * 1.06], R - 0.08, -0.1);
    const landing = i > 0 && (i % N === N - 1 || i % N === 0);
    if (landing) continue;
    put('alu', [0.05, 0.05, len * (R / mid) * 1.06], R - 0.06, 1.0);
    put('none', [0.12, 1.2, len * (R / mid)], R - 0.06, 0.55, true);
  }
  const top = turns * rise;
  b.geometry('uniYellow', new THREE.CylinderGeometry(IN, IN, top + 3, 20), new THREE.Matrix4().compose(at(cx, (top + 3) / 2, cz), q, new THREE.Vector3(1, 1, 1)), { size: [IN * 1.6, top + 3, IN * 1.6], pos: at(cx, (top + 3) / 2, cz), quat: q });
  b.geometry('uniYellow', new THREE.CylinderGeometry(R + 1.2, R + 1.2, 0.4, 40), new THREE.Matrix4().compose(at(cx, top + 3.1, cz), q, new THREE.Vector3(1, 1, 1)));
  b.geometry('uniWhite', new THREE.CylinderGeometry(R + 1.1, R + 1.1, 0.05, 40), new THREE.Matrix4().compose(at(cx, top + 2.88, cz), q, new THREE.Vector3(1, 1, 1)));
}
