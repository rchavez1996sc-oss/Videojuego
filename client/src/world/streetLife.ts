import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';

const UP = new THREE.Vector3(0, 1, 0);
export const CLOTHES = ['cloth0', 'cloth1', 'cloth2', 'cloth3', 'cloth4', 'cloth5'];
export const STREET_COLORS: Record<string, string> = {
  cloth0: '#c23b30', cloth1: '#2f62a8', cloth2: '#e8e2d2', cloth3: '#e3b630', cloth4: '#3d7a45', cloth5: '#8a4f9e',
  chairRed: '#c22a22', chairBlue: '#2a54a8', umbrella0: '#d83a2c', umbrella1: '#2e7bc4', umbrella2: '#e8c12e', umbrella3: '#3e9a4a',
  trashBag: '#1b1c1e', cardboard: '#a5845a', fruit0: '#e07a1f', fruit1: '#c9b62a', fruit2: '#7a2a1c', lampHead: '#5c6066',
  roadWhite: '#e6e4dc', crate: '#8a6a3a',
};

type Rand = () => number;
const pick = <T>(arr: T[], r: Rand) => arr[Math.floor(r() * arr.length)];

/** Clothes line between two points with shirts and trousers hanging from it. */
export function laundry(b: Builder, a: THREE.Vector3, c: THREE.Vector3, rand: Rand): void {
  const dir = c.clone().sub(a), len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().setY(0).normalize());
  b.box('cable', [len, 0.012, 0.012], a.clone().lerp(c, 0.5), q, false);
  for (let t = 0.12; t < 0.9; t += 0.12 + rand() * 0.08) {
    const p = a.clone().lerp(c, t).add(new THREE.Vector3(0, -0.04 * Math.sin(t * Math.PI), 0));
    const big = rand() < 0.4;
    const h = big ? 0.8 : 0.5, w = big ? 0.35 : 0.5;
    b.box(pick(CLOTHES, rand), [w, h, 0.02], p.clone().add(new THREE.Vector3(0, -h / 2, 0)), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, (rand() - 0.5) * 0.3)), false);
  }
}

/** Plastic chairs and a beer crate outside a bodega. */
export function sidewalkChairs(b: Builder, at: THREE.Vector3, q: THREE.Quaternion, rand: Rand): void {
  const color = rand() < 0.5 ? 'chairRed' : 'chairBlue';
  for (const dx of [-0.6, 0.6]) {
    const p = new THREE.Vector3(dx, 0, 0).applyQuaternion(q).add(at);
    const cq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, (rand() - 0.5) * 0.8));
    b.box(color, [0.45, 0.05, 0.45], p.clone().setY(p.y + 0.45), cq, false);
    b.box(color, [0.45, 0.45, 0.05], p.clone().add(new THREE.Vector3(0, 0.7, -0.2).applyQuaternion(cq)), cq, false);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.box(color, [0.04, 0.45, 0.04], p.clone().add(new THREE.Vector3(x, 0.22, z).applyQuaternion(cq)), cq, false);
  }
  b.box('crate', [0.45, 0.3, 0.32], new THREE.Vector3(0, 0.15, 0.45).applyQuaternion(q).add(at), q, false);
}

/** Street vendor cart with goods and a big colourful umbrella. Low cover. */
export function stall(b: Builder, pos: THREE.Vector3, yaw: number, rand: Rand): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(pos);
  b.box('crate', [1.7, 0.08, 0.9], at(0, 0.85, 0), q);
  b.box('cardboard', [1.6, 0.75, 0.8], at(0, 0.42, 0), q, false);
  for (let i = 0; i < 9; i++) b.box(pick(['fruit0', 'fruit1', 'fruit2'], rand), [0.16, 0.16, 0.16], at(-0.65 + (i % 5) * 0.32, 0.97, -0.2 + Math.floor(i / 5) * 0.35), q, false);
  b.box('bars', [0.04, 2.1, 0.04], at(0, 1.05, 0.5), q, false);
  b.geometry(pick(['umbrella0', 'umbrella1', 'umbrella2', 'umbrella3'], rand), new THREE.ConeGeometry(1.25, 0.45, 10, 1, true), new THREE.Matrix4().compose(at(0, 2.25, 0.5), q, new THREE.Vector3(1, 1, 1)));
}

export function trashPile(b: Builder, pos: THREE.Vector3, rand: Rand): void {
  for (let i = 0; i < 3 + Math.floor(rand() * 4); i++) {
    const p = pos.clone().add(new THREE.Vector3((rand() - 0.5) * 1.4, 0.18, (rand() - 0.5) * 1.0));
    if (rand() < 0.6) b.geometry('trashBag', new THREE.SphereGeometry(0.28, 8, 6).scale(1, 0.75, 0.9), new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
    else b.box('cardboard', [0.5, 0.35, 0.4], p, new THREE.Quaternion().setFromAxisAngle(UP, rand() * 3), false);
  }
}

export function tire(b: Builder, pos: THREE.Vector3, rand: Rand): void {
  b.geometry('tire', new THREE.TorusGeometry(0.3, 0.11, 6, 14).rotateX(Math.PI / 2), new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(UP, rand() * 3), new THREE.Vector3(1, 1, 1)));
}

/** Dashed centre line, zebra crossings at each cross street and yellow kerb paint on the avenue. */
export function roadMarkings(b: Builder, hf: Heightfield, x0: number, x1: number, crossX: number[], halfWidth: number): void {
  const q = new THREE.Quaternion();
  for (let x = x0; x < x1; x += 6) {
    if (crossX.some((cx) => Math.abs(cx - x) < 4)) continue;
    b.box('roadWhite', [3, 0.03, 0.15], new THREE.Vector3(x, hf.heightAt(x, 0) + 0.02, 0), q, false);
  }
  for (const cx of crossX) {
    for (let x = cx - 2.4; x <= cx + 2.4; x += 0.9) b.box('roadWhite', [0.45, 0.03, halfWidth * 2 - 1], new THREE.Vector3(x, hf.heightAt(x, 0) + 0.02, 0), q, false);
  }
  for (const s of [1, -1]) {
    for (let x = x0; x < x1; x += 2) {
      if (Math.round(x / 2) % 2) b.box('paintYellow', [2, 0.19, 0.12], new THREE.Vector3(x, hf.heightAt(x, s * 8.2) + 0.065, s * 8.15), q, false);
    }
  }
}
