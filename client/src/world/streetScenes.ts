import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import type { Extra } from './malecon/park';

const UP = new THREE.Vector3(0, 1, 0);
const WAITING = ['civ_idle', 'civ_idle', 'texting', 'look_around'];
const WORKERS = { helmet: 1, vest: 1 };

/** People the street scenes put on the pavement (fed to the shootable crowd) and the plates they hang. */
export interface SceneLife { seats: { pos: THREE.Vector3; yaw: number }[]; standing: Extra[] }
const plates: THREE.BufferGeometry[] = [];

/** A painted plate (`cell` of the sign atlas) of `w` × `h` m at `p` facing yaw `y`, double sided. */
function plate(cell: number, p: THREE.Vector3, yaw: number, w: number, h: number): void {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + cell) / CELLS);
  const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1));
  plates.push(g.clone().applyMatrix4(m), g.applyMatrix4(m.multiply(new THREE.Matrix4().makeRotationY(Math.PI))));
}

const CELLS = 3;
function atlas(): THREE.CanvasTexture {
  const W = 512, H = 256, cv = Object.assign(document.createElement('canvas'), { width: W, height: H * CELLS }), g = cv.getContext('2d')!;
  const row = (i: number) => (CELLS - 1 - i) * H;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let y = row(0);
  g.fillStyle = '#1d4f9c'; g.fillRect(0, y, W, H);
  g.strokeStyle = '#f2f2ee'; g.lineWidth = 10; g.strokeRect(14, y + 14, W - 28, H - 28);
  g.fillStyle = '#f2f2ee'; g.font = '800 92px "Barlow Condensed", Arial'; g.fillText('PARADERO', W / 2, y + 100);
  g.font = '600 38px "Barlow Condensed", Arial'; g.fillText('MUNICIPALIDAD DE ATE', W / 2, y + 178);
  y = row(1);
  g.fillStyle = '#f4f2ec'; g.fillRect(0, y, W, H);
  g.fillStyle = '#0a5fa8'; g.fillRect(0, y, W, 70);
  g.fillStyle = '#ffffff'; g.font = '800 54px "Barlow Condensed", Arial'; g.fillText('SEDAPAL', W / 2, y + 37);
  g.fillStyle = '#1b1b1b'; g.font = '700 34px "Barlow Condensed", Arial'; g.fillText('RENOVACIÓN DE REDES DE AGUA', W / 2, y + 112);
  g.font = '600 28px "Barlow Condensed", Arial'; g.fillText('Y ALCANTARILLADO · HUAYCÁN', W / 2, y + 150);
  g.fillStyle = '#d6201a'; g.font = '800 36px "Barlow Condensed", Arial'; g.fillText('DISCULPE LAS MOLESTIAS', W / 2, y + 205);
  y = row(2);
  for (let k = -H; k < W + H; k += 64) {
    g.fillStyle = (k / 64) % 2 ? '#f26b12' : '#f4f2ec';
    g.beginPath(); g.moveTo(k, y); g.lineTo(k + 64, y); g.lineTo(k + 64 - H, y + H); g.lineTo(k - H, y + H); g.closePath(); g.fill();
  }
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
}

/** The scenes' plates (paradero signs, works notices, barrier stripes) as one mesh; null when none were placed. */
export function scenePlates(lighting: Lighting): THREE.Mesh | null {
  if (!plates.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(plates.splice(0)), lighting.setup(new THREE.MeshStandardMaterial({ map: atlas(), roughness: 0.6 }), 'scene-plates'));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * A Lima paradero on the sidewalk: blue PARADERO plate on a pole, a small steel shelter with a bench, and a short
 * queue of people waiting along the kerb (some on their phones, some looking up the road for their combi).
 * `at` is on the sidewalk, `yaw` faces the road; the queue runs along the kerb towards `up` (where buses come from).
 */
export function busStop(b: Builder, hf: Heightfield, at: THREE.Vector3, yaw: number, up: number, rand: () => number, life: SceneLife): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const p = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(at);
  for (const x of [-1.5, 1.5]) b.box('bars', [0.08, 2.4, 0.08], p(x, 1.2, -0.45), q, true);
  b.box('bars', [3.4, 0.08, 1.1], p(0, 2.42, -0.1), q, false);
  b.box('glass', [3.1, 1.6, 0.03], p(0, 1.2, -0.5), q, false);
  b.box('desk', [2.4, 0.05, 0.36], p(0, 0.46, -0.28), q, false);
  for (const x of [-1.1, 1.1]) b.box('bars', [0.05, 0.44, 0.3], p(x, 0.22, -0.28), q, false);
  const pole = p(up * 2.4, 0, 0.45);
  b.box('bars', [0.07, 2.9, 0.07], pole.clone().setY(at.y + 1.45), q, true);
  plate(0, pole.clone().setY(at.y + 2.55), yaw, 0.95, 0.48);
  const along = new THREE.Vector3(up, 0, 0).applyQuaternion(q), out = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const n = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const s = 2.9 + i * (0.72 + rand() * 0.25), pos = at.clone().addScaledVector(along, s).addScaledVector(out, 0.25 + (rand() - 0.5) * 0.3);
    pos.y = hf.heightAt(pos.x, pos.z) + 0.15;
    life.standing.push({ pos, yaw: yaw + (rand() < 0.5 ? up * 0.9 : (rand() - 0.5) * 0.6), key: WAITING[Math.floor(rand() * WAITING.length)] });
  }
  for (let i = 0; i < 2; i++) if (rand() < 0.5) life.seats.push({ pos: p(-0.6 + i * 1.2, 0, -0.26).setY(at.y + 0.46), yaw });
}

/**
 * SEDAPAL works on a side street: a trench of dug-up earth fenced by striped barriers, a spoil heap, stacked blue PVC
 * pipes, cones, a notice board and a crew in hard hats and vests. `at` is the middle of the trench, `yaw` its length axis.
 */
export function roadWorks(b: Builder, hf: Heightfield, at: THREE.Vector3, yaw: number, rand: () => number, life: SceneLife): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw), L = 6 + rand() * 4, W = 1.6;
  const p = (x: number, z: number, dy = 0) => {
    const v = new THREE.Vector3(x, 0, z).applyQuaternion(q).add(at);
    return v.setY(hf.heightAt(v.x, v.z) + dy);
  };
  b.box('pitDirt', [W + 0.5, 0.05, L + 0.5], p(0, 0, 0.03), q, false);
  b.box('pothole', [W, 0.06, L], p(0, 0, 0.04), q, false);
  for (let k = 0; k < 3; k++) b.geometry('soilPile', new THREE.ConeGeometry(0.9 + rand() * 0.4, 0.7 + rand() * 0.3, 9).scale(1, 1, 1.6), new THREE.Matrix4().compose(p(W / 2 + 1.1, -L / 3 + k * (L / 3), 0.3), q, new THREE.Vector3(1, 1, 1)));
  for (let k = 0; k < 4; k++) b.geometry('pipeBlue', new THREE.CylinderGeometry(0.11, 0.11, 5.8, 10).rotateX(Math.PI / 2), new THREE.Matrix4().compose(p(-W / 2 - 1.0 - (k % 2) * 0.22, 0, 0.11 + Math.floor(k / 2) * 0.2), q, new THREE.Vector3(1, 1, 1)));
  for (const s of [-1, 1]) {
    for (let z = -L / 2; z <= L / 2 + 0.01; z += L / 2) barrier(b, p(s * (W / 2 + 0.35), z), yaw);
    barrier(b, p(0, s * (L / 2 + 0.45)), yaw + Math.PI / 2);
    for (let k = 0; k < 3; k++) cone(b, p(s * (W / 2 + 0.9) + (rand() - 0.5) * 0.4, s * (L / 2 + 1.6 + k * 1.3)));
  }
  const board = p(-W / 2 - 0.4, L / 2 + 1.2);
  b.box('bars', [0.06, 1.7, 0.06], board.clone().setY(board.y + 0.85), q, false);
  plate(1, board.clone().setY(board.y + 1.55), yaw + Math.PI / 2, 1.2, 0.6);
  const crew = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < crew; i++) {
    const side = i % 2 ? 1 : -1, pos = p(side * (W / 2 + 0.7), (rand() - 0.5) * L * 0.8, 0.05);
    life.standing.push({ pos, yaw: yaw + side * Math.PI / 2 + Math.PI + (rand() - 0.5) * 0.8, key: rand() < 0.5 ? 'look_around' : 'civ_idle', kit: WORKERS });
  }
}

/** Saw-horse barrier with orange/white stripes (solid: it stops people and stray bullets mark it). */
function barrier(b: Builder, foot: THREE.Vector3, yaw: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  for (const s of [-0.55, 0.55]) b.box('bars', [0.05, 0.95, 0.05], new THREE.Vector3(s, 0.47, 0).applyQuaternion(q).add(foot), q, false);
  b.box('none', [1.3, 1.0, 0.1], foot.clone().setY(foot.y + 0.5), q, true);
  plate(2, foot.clone().setY(foot.y + 0.82), yaw, 1.3, 0.22);
  plate(2, foot.clone().setY(foot.y + 0.42), yaw, 1.3, 0.16);
}

/** Traffic cone with its square base and a white reflective band. */
function cone(b: Builder, foot: THREE.Vector3): void {
  b.box('coneOrange', [0.36, 0.03, 0.36], foot.clone().setY(foot.y + 0.015), new THREE.Quaternion(), false);
  b.geometry('coneOrange', new THREE.ConeGeometry(0.13, 0.6, 10, 1, true), new THREE.Matrix4().makeTranslation(foot.x, foot.y + 0.33, foot.z));
  b.geometry('roadWhite', new THREE.CylinderGeometry(0.075, 0.095, 0.1, 10, 1, true), new THREE.Matrix4().makeTranslation(foot.x, foot.y + 0.4, foot.z));
}
