import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import { signTexture } from '../render/urbanTextures';

const UP = new THREE.Vector3(0, 1, 0);

/** Wooden/concrete poles with sagging cables between consecutive poles (catenary-ish curves). */
export function powerLine(b: Builder, hf: Heightfield, points: THREE.Vector3[], rand: () => number): void {
  const tops: THREE.Vector3[] = [];
  for (const p of points) {
    const y = hf.heightAt(p.x, p.z);
    const h = 7.5 + rand() * 1.2;
    b.geometry('pole', new THREE.CylinderGeometry(0.11, 0.15, h, 8), new THREE.Matrix4().makeTranslation(p.x, y + h / 2 - 0.2, p.z),
      { size: [0.28, h, 0.28], pos: new THREE.Vector3(p.x, y + h / 2, p.z), quat: new THREE.Quaternion() });
    b.box('pole', [1.4, 0.1, 0.1], new THREE.Vector3(p.x, y + h - 0.6, p.z), new THREE.Quaternion().setFromAxisAngle(UP, rand() * 0.2 + Math.PI / 2), false);
    tops.push(new THREE.Vector3(p.x, y + h - 0.55, p.z));
  }
  for (let i = 0; i < tops.length - 1; i++) {
    for (const off of [-0.6, -0.2, 0.25, 0.6]) {
      const a = tops[i].clone().add(new THREE.Vector3(0, 0, off)), c = tops[i + 1].clone().add(new THREE.Vector3(0, 0, off));
      cable(b, a, c, 0.6 + rand() * 0.9);
    }
  }
}

export function cable(b: Builder, a: THREE.Vector3, c: THREE.Vector3, sag: number): void {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    pts.push(a.clone().lerp(c, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
  }
  b.geometry('cable', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.012, 4), new THREE.Matrix4());
}

/** Parked three-wheeled mototaxi: rough box body, canopy and wheels. Acts as low cover. */
export function mototaxi(b: Builder, pos: THREE.Vector3, yaw: number, paint: string): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(pos);
  b.box(paint, [1.25, 0.55, 1.4], at(0, 0.6, -0.35), q, false);
  b.box(paint, [0.5, 0.6, 0.9], at(0, 0.75, 0.75), q, false);
  b.box('bars', [0.05, 0.9, 0.05], at(0, 1.3, 1.0), q, false);
  b.box('bars', [0.7, 0.05, 0.05], at(0, 1.55, 1.0), q, false);
  b.box('canopy', [1.3, 0.06, 2.1], at(0, 1.85, -0.05), q, false);
  for (const [x, z] of [[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.35], [0.6, 0.35]]) b.box('bars', [0.04, 1.0, 0.04], at(x, 1.35, z), q, false);
  b.box('seat', [1.1, 0.25, 0.5], at(0, 1.0, -0.7), q, false);
  for (const [x, z] of [[-0.62, -0.7], [0.62, -0.7], [0, 1.15]]) {
    b.geometry('tire', new THREE.CylinderGeometry(0.25, 0.25, 0.14, 12).rotateZ(Math.PI / 2), new THREE.Matrix4().compose(at(x, 0.25, z), q, new THREE.Vector3(1, 1, 1)));
  }
  b.box('none', [1.3, 1.2, 2.3], at(0, 0.6, 0), q, true);
}

/** Sandbag wall section used for GNO checkpoints. */
export function sandbags(b: Builder, hf: Heightfield, x: number, z: number, yaw: number, len: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const y = hf.heightAt(x, z);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < Math.round(len / 0.55); i++) {
      const lx = -len / 2 + (i + 0.5 + (row % 2) * 0.5) * 0.55;
      if (lx > len / 2) continue;
      const p = new THREE.Vector3(lx, y + 0.13 + row * 0.24, 0).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
      b.geometry('sandbag', new THREE.CapsuleGeometry(0.13, 0.32, 3, 8).rotateZ(Math.PI / 2).scale(1, 0.85, 1.3), new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
    }
  }
  b.box('none', [len, 0.75, 0.45], new THREE.Vector3(x, y + 0.37, z), q, true);
}

/** Concrete stairway climbing the hill with painted step edges and a pipe handrail. */
export function stairway(b: Builder, hf: Heightfield, x: number, z0: number, z1: number): void {
  const dir = Math.sign(z1 - z0), q = new THREE.Quaternion();
  let prevTop = hf.heightAt(x, z0);
  for (let z = z0; dir * (z1 - z) > 0; z += dir * 0.32) {
    const ground = hf.heightAt(x, z);
    const top = Math.max(ground + 0.05, Math.min(prevTop + 0.38, ground + 0.6));
    const base = Math.min(ground, prevTop) - 0.6;
    b.box('concrete', [1.8, top - base, 0.34], new THREE.Vector3(x, (top + base) / 2, z), q);
    b.box('paintYellow', [1.8, 0.03, 0.06], new THREE.Vector3(x, top + 0.005, z - dir * 0.14), q, false);
    if (Math.round(z * 3) % 6 === 0) b.box('bars', [0.05, 0.95, 0.05], new THREE.Vector3(x + 1.0, top + 0.47, z), q, false);
    prevTop = top;
  }
}

const SIGNS: [string, string | null, string][] = [
  ['BODEGA DON LUCHO', '#f2f0e6', '#1f4d8f'], ['SE ALQUILA CUARTO', null, '#1c1c1c'], ['LIBRERÍA EL ESTUDIANTE', '#f5d24a', '#1c1c1c'],
  ['FERRETERÍA', '#c3362b', '#ffffff'], ['POLLERÍA', '#e8b13a', '#7a1f12'], ['CABINAS INTERNET', '#2f6ea8', '#ffffff'],
  ['LA SIERRA NO SE VENDE', null, '#a3241c'], ['FUERA LA JUNTA', null, '#16161a'], ['AGUA PARA TODOS', null, '#1e4f9c'],
  ['FLS VIVE', null, '#a3241c'], ['SE VENDE ESTE TERRENO', null, '#1c1c1c'], ['TAPICERÍA', '#e6e1d3', '#2b2b2b'],
  ['NI JUNTA NI MINERA', null, '#16161a'], ['MENÚ S/ 8', '#ffffff', '#b8261b'], ['VULCANIZADORA', '#202020', '#f2c230'], ['ABARROTES', '#d7e3c7', '#2f5c25'],
];

/** One atlas texture for every painted sign so all of them merge into a single draw call. */
export class SignAtlas {
  readonly texture: THREE.CanvasTexture;
  private geos: THREE.BufferGeometry[] = [];

  constructor() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d')!;
    SIGNS.forEach(([text, bg, fg], i) => ctx.drawImage(signTexture(text, bg, fg, 512, 128), (i % 2) * 512, Math.floor(i / 2) * 128));
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  /** `kind`: 'shop' picks a business name, 'graffiti' a slogan. */
  add(pos: THREE.Vector3, q: THREE.Quaternion, w: number, kind: 'shop' | 'graffiti', rand: () => number): void {
    const pool = SIGNS.map((s, i) => [s, i] as const).filter(([s]) => (kind === 'shop') === (s[1] !== null) || (kind === 'graffiti' && s[0] === 'SE ALQUILA CUARTO'));
    const [, i] = pool[Math.floor(rand() * pool.length)];
    const g = new THREE.PlaneGeometry(w, w / 4);
    const u0 = (i % 2) * 0.5, v0 = 1 - (Math.floor(i / 2) + 1) / 8;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) / 8);
    g.applyMatrix4(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
    this.geos.push(g);
  }

  get geometries(): THREE.BufferGeometry[] {
    return this.geos;
  }
}
