import * as THREE from 'three';
import type { Builder } from '../buildingKit';

const Q = new THREE.Quaternion();
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const yaw = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);

/** Dark green chairs with orange cushions round a white-clothed table (as in the photos). */
export function diningTable(b: Builder, x: number, y: number, z: number, seats: number, turn: number): void {
  b.geometry('linen', new THREE.CylinderGeometry(0.62, 0.66, 0.74, 14).translate(0, 0.37, 0), at(x, y, z), { size: [1.2, 0.8, 1.2], pos: new THREE.Vector3(x, y + 0.4, z), quat: Q });
  b.geometry('lampGold', new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6).translate(0, 0.84, 0), at(x, y, z));
  for (let i = 0; i < seats; i++) {
    const a = turn + (i / seats) * Math.PI * 2, cx = x + Math.sin(a) * 1.05, cz = z + Math.cos(a) * 1.05, q = yaw(a);
    b.box('chairGreen', [0.48, 0.42, 0.46], new THREE.Vector3(cx, y + 0.21, cz), q, false);
    b.box('cushionOrange', [0.5, 0.07, 0.48], new THREE.Vector3(cx, y + 0.45, cz), q, false);
    b.box('chairGreen', [0.48, 0.55, 0.06], new THREE.Vector3(cx + Math.sin(a) * 0.22, y + 0.75, cz + Math.cos(a) * 0.22), q, false);
  }
}

/** Reddish timber column on a dark green plinth with a green capital and two white lamp sconces; collides. */
function column(b: Builder, x: number, y: number, z: number, h: number, turn: number): void {
  b.box('greenTrim', [0.5, 0.95, 0.5], new THREE.Vector3(x, y + 0.48, z), Q, true);
  b.geometry('columnWood', new THREE.CylinderGeometry(0.15, 0.17, h - 1.5, 10).translate(0, (h - 1.5) / 2, 0), at(x, y + 0.95, z), { size: [0.34, h, 0.34], pos: new THREE.Vector3(x, y + h / 2, z), quat: Q });
  b.box('greenTrim', [0.42, 0.55, 0.42], new THREE.Vector3(x, y + h - 0.3, z), Q, false);
  for (const s of [-1, 1]) {
    const dx = Math.cos(turn) * s * 0.45, dz = -Math.sin(turn) * s * 0.45;
    b.box('greenTrim', [0.05, 0.05, 0.05], new THREE.Vector3(x + dx * 0.6, y + h - 0.9, z + dz * 0.6), Q, false);
    b.geometry('lampShade', new THREE.CylinderGeometry(0.12, 0.2, 0.26, 6), at(x + dx, y + h - 0.75, z + dz));
  }
}

/** Cluster of pendant shades, white outside and lit gold inside, hanging from the ceiling at `top`. */
function chandelier(b: Builder, x: number, top: number, z: number, n: number, spread: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = i === 0 ? 0 : spread * (0.6 + (i % 2) * 0.4), px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r, drop = 1.1 + (i % 3) * 0.35;
    b.box('lampPole', [0.02, drop, 0.02], new THREE.Vector3(px, top - drop / 2, pz), Q, false);
    b.geometry('ceilingWhite', new THREE.CylinderGeometry(0.28, 0.42, 0.4, 10, 1, true), at(px, top - drop - 0.15, pz));
    b.geometry('lampGold', new THREE.CylinderGeometry(0.26, 0.4, 0.36, 10, 1, true).scale(-1, 1, -1), at(px, top - drop - 0.15, pz));
  }
}

/**
 * Walkable glazed dining hall between x0..x1, z0..z1 on the deck at `y`: low wall, tall sea windows, white ceiling,
 * a door in the west end and the east end open into the pavilion; tables down both sides and pendant lamps.
 */
export function wingHall(b: Builder, x0: number, x1: number, z0: number, z1: number, y: number): void {
  const h = 4.1, len = x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (const z of [z0, z1]) {
    b.box('creamWall', [len, 0.9, 0.25], new THREE.Vector3(cx, y + 0.45, z), Q, false);
    b.box('glassClear', [len, 2.3, 0.05], new THREE.Vector3(cx, y + 2.05, z), Q, false);
    b.box('creamWall', [len, 0.9, 0.25], new THREE.Vector3(cx, y + 3.65, z), Q, false);
    for (let x = x0; x <= x1; x += 2.4) b.box('lhWhite', [0.12, 2.3, 0.12], new THREE.Vector3(x, y + 2.05, z), Q, false);
    b.box('none', [len, h, 0.3], new THREE.Vector3(cx, y + h / 2, z), Q, true);
  }
  const door = 1.8, side = (z1 - z0 - door) / 2;
  for (const s of [-1, 1]) b.box('creamWall', [0.3, h, side], new THREE.Vector3(x0, y + h / 2, cz + s * (door / 2 + side / 2)), Q, true);
  b.box('creamWall', [0.3, h - 2.5, door], new THREE.Vector3(x0, y + 2.5 + (h - 2.5) / 2, cz), Q, true);
  b.box('ceilingWhite', [len, 0.12, z1 - z0], new THREE.Vector3(cx, y + h, cz), Q, false);
  b.box('parquet', [len, 0.04, z1 - z0], new THREE.Vector3(cx, y + 0.02, cz), Q, false);
  for (let x = x0 + 1.2; x < x1; x += 2.4) b.box('greenTrim', [0.16, 0.22, z1 - z0], new THREE.Vector3(x, y + h - 0.12, cz), Q, false);
  for (let x = x0 + 3; x < x1 - 2; x += 4.2) {
    for (const s of [-1, 1]) diningTable(b, x, y, cz + s * 3.6, 3, s > 0 ? Math.PI / 3 : 0);
    chandelier(b, x + 2.1, y + h, cz, 3, 0.5);
  }
  for (let x = x0 + 5.1; x < x1 - 3; x += 8.4) for (const s of [-1, 1]) column(b, x, y, cz + s * 1.7, h, 0);
}

/**
 * The octagonal pavilion at the end of the pier as a walkable dining room (as in the photos): parquet floor, wooden
 * columns, sea windows above a lattice balustrade, a gold-lit chandelier, tables round the ring; the facets facing
 * `openTo` (angles, 0 = +z) are left open. The upper storey, balconies, awnings and roof are shell only.
 */
export function diningPavilion(b: Builder, x: number, y: number, z: number, r: number, openTo: number[]): void {
  const h = 3.8, ap = r * Math.cos(Math.PI / 8), fw = 2 * r * Math.sin(Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (openTo.some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.3)) continue;
    const q = yaw(a), p = (dy: number, inset = 0) => new THREE.Vector3(x + Math.sin(a) * (ap - inset), y + dy, z + Math.cos(a) * (ap - inset));
    b.box('lattice', [fw, 0.9, 0.08], p(0.45, 0.4), q, false);
    b.box('greenTrim', [fw, 0.08, 0.16], p(0.94, 0.4), q, false);
    b.box('creamWall', [fw, 0.9, 0.2], p(0.45), q, false);
    b.box('glassClear', [fw, 2.4, 0.05], p(2.1), q, false);
    b.box('lhWhite', [0.14, 2.4, 0.14], p(2.1).add(new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(fw / 2)), q, false);
    b.box('creamWall', [fw, 0.5, 0.2], p(3.55), q, false);
    b.box('none', [fw + 0.2, h, 0.3], p(h / 2), q, true);
  }
  b.geometry('parquet', new THREE.CylinderGeometry(r, r, 0.04, 8).rotateY(Math.PI / 8), at(x, y + 0.02, z));
  b.geometry('ceilingWhite', new THREE.CylinderGeometry(r, r, 0.12, 8).rotateY(Math.PI / 8), at(x, y + h, z));
  b.geometry('creamWall', new THREE.CylinderGeometry(r, r, 3.2, 8, 1, true).rotateY(Math.PI / 8).translate(0, 1.6, 0), at(x, y + h, z));
  b.geometry('glassClear', new THREE.CylinderGeometry(r + 0.02, r + 0.02, 1.8, 8, 1, true).rotateY(Math.PI / 8), at(x, y + h + 1.6, z));
  b.geometry('lattice', new THREE.CylinderGeometry(r + 0.9, r + 0.9, 0.9, 8, 1, true).rotateY(Math.PI / 8), at(x, y + h + 0.5, z));
  for (const lvl of [h - 0.6, h + 2.9]) b.geometry('awningStripe', new THREE.CylinderGeometry(r + 0.2, r + 1.3, 0.9, 8, 1, true).rotateY(Math.PI / 8), at(x, y + lvl, z));
  b.geometry('roofSlate', new THREE.CylinderGeometry(r * 0.45, r + 0.4, 2.4, 8).rotateY(Math.PI / 8).translate(0, 1.2, 0), at(x, y + h + 3.2, z));
  b.geometry('lhWhite', new THREE.CylinderGeometry(r * 0.4, r * 0.4, 1, 8).translate(0, 0.5, 0), at(x, y + h + 5.6, z));
  b.geometry('roofSlate', new THREE.ConeGeometry(r * 0.5, 1.2, 8).translate(0, 0.6, 0), at(x, y + h + 6.6, z));
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, cx = x + Math.sin(a) * r * 0.42, cz = z + Math.cos(a) * r * 0.42;
    column(b, cx, y, cz, h, a + Math.PI / 2);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    b.box('greenTrim', [0.16, 0.24, r - 0.3], new THREE.Vector3(x + Math.sin(a) * r * 0.5, y + h - 0.14, z + Math.cos(a) * r * 0.5), yaw(a), false);
  }
  chandelier(b, x, y + h, z, 9, 1.3);
  diningTable(b, x, y, z, 4, Math.PI / 4);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    if (openTo.some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.5)) continue;
    diningTable(b, x + Math.sin(a) * r * 0.68, y, z + Math.cos(a) * r * 0.68, 3, a + Math.PI / 3);
  }
}
