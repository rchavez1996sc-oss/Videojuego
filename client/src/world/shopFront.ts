import * as THREE from 'three';
import type { Builder, Opening } from './buildingKit';
import type { SignDef, SignKind } from './signs';

export type Sign = (at: THREE.Vector3, q: THREE.Quaternion, w: number, kind?: SignKind) => SignDef | void;
type At = (x: number, y: number, z: number) => THREE.Vector3;

const TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
const GOODS = ['fruit0', 'fruit1', 'fruit2', 'cardboard', 'cloth2', 'cloth3'];

/**
 * Ground-floor shop in a wide opening: closed shutter, or open with the shutter rolled up, a lit back,
 * a counter with goods and a striped awning. Restaurants also chalk their menu beside the door.
 */
export function shopFront(b: Builder, at: At, q: THREE.Quaternion, o: Opening, y0: number, doorEdge: number, rand: () => number, sign: Sign): void {
  const floor = y0 + o.y, top = floor + o.h;
  const open = rand() < 0.6;
  if (!open) b.box('shutter', [o.w, o.h, 0.06], at(o.x, floor + o.h / 2, -0.12), q, false);
  else {
    b.box('shutter', [o.w, 0.32, 0.26], at(o.x, top - 0.16, -0.14), q, false);
    b.box('shopLit', [o.w - 0.05, o.h - 0.3, 0.04], at(o.x, floor + (o.h - 0.3) / 2, -0.27), q, false);
    b.box('crate', [o.w - 0.3, 0.95, 0.42], at(o.x, floor + 0.475, -0.04), q, false);
    for (let x = -o.w / 2 + 0.4; x < o.w / 2 - 0.35; x += 0.3 + rand() * 0.25) {
      const s = 0.14 + rand() * 0.12;
      b.box(GOODS[Math.floor(rand() * GOODS.length)], [s, s * (0.6 + rand()), s], at(o.x + x, floor + 0.95 + s * 0.4, -0.05 + (rand() - 0.5) * 0.15), q, false);
    }
  }
  const def = rand() < 0.85 ? sign(at(o.x, top + 0.35, 0.03), q, o.w + 0.6) : undefined;
  if (open && rand() < 0.75) b.box(`umbrella${Math.floor(rand() * 4)}`, [o.w + 0.4, 0.04, 1.0], at(o.x, top - 0.25, 0.48), q.clone().multiply(TILT), false);
  if (def?.food) {
    const l = doorEdge, r = o.x - o.w / 2 - 0.15, gw = Math.min(r - l, 1.9);
    if (gw >= 0.9) sign(at((l + r) / 2, floor + 1.45, 0.03), q, gw, 'menu');
    else sign(at(o.x, floor + 1.55, 0.25), q, Math.min(o.w - 0.4, 1.6), 'menu');
  }
}
