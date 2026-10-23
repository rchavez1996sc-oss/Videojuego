import * as THREE from 'three';
import { mulberry32 } from '../../core/rng';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { CoastDef } from '../coast';
import type { StationInfo } from '../station';
import type { MaleconDef } from './layout';
import { diningPavilion, hallDecor, wingHall } from './rosaInterior';
import type { Extra } from './park';

const Q = new THREE.Quaternion();
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

/** Hipped / mansard roof over a w × d footprint: `top` is the flat part's share of the base (0 = pyramid). */
function hip(b: Builder, mat: string, w: number, d: number, h: number, top: number, x: number, y: number, z: number): void {
  const g = new THREE.CylinderGeometry((Math.SQRT2 / 2) * top, Math.SQRT2 / 2, h, 4, 1).rotateY(Math.PI / 4).scale(w, 1, d).translate(0, h / 2, 0);
  b.geometry(mat, g, at(x, y, z));
  if (top > 0) b.box('flatRoof', [w * top, 0.1, d * top], new THREE.Vector3(x, y + h, z), Q, false);
}

/** White lattice railing from (x0, z0) to (x1, z1) at deck height `y`, with an invisible collider. */
function railing(b: Builder, x0: number, z0: number, x1: number, z1: number, y: number): void {
  const len = Math.hypot(x1 - x0, z1 - z0), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-(z1 - z0), x1 - x0));
  const mid = new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2);
  b.box('lattice', [len, 0.85, 0.05], mid.clone().setY(y + 0.5), q, false);
  b.box('lhWhite', [len, 0.08, 0.14], mid.clone().setY(y + 0.97), q, false);
  b.box('none', [len, 1.3, 0.25], mid.clone().setY(y + 0.65), q, true);
}

/** Octagonal pavilion: cream walls, lattice balcony band, striped awning ring and a slate roof with a lantern or spire. */
function pavilion(b: Builder, x: number, y: number, z: number, r: number, floors: number, spire: number): void {
  const h = floors * 3.4;
  b.geometry('creamWall', new THREE.CylinderGeometry(r, r, h, 8).rotateY(Math.PI / 8).translate(0, h / 2, 0), at(x, y, z), { size: [r * 1.5, h, r * 1.5], pos: new THREE.Vector3(x, y + h / 2, z), quat: Q });
  for (let f = 0; f < floors; f++) {
    b.geometry('lobby', new THREE.CylinderGeometry(r + 0.02, r + 0.02, 1.8, 8, 1, true).rotateY(Math.PI / 8).translate(0, f * 3.4 + 1.6, 0), at(x, y, z));
    b.geometry('lattice', new THREE.CylinderGeometry(r + 0.9, r + 0.9, 0.9, 8, 1, true).rotateY(Math.PI / 8).translate(0, f * 3.4 + 0.5, 0), at(x, y, z));
    b.geometry('awningStripe', new THREE.CylinderGeometry(r + 0.2, r + 1.3, 0.9, 8, 1, true).rotateY(Math.PI / 8).translate(0, f * 3.4 + 2.9, 0), at(x, y, z));
  }
  b.geometry('roofSlate', new THREE.CylinderGeometry(spire ? 0.3 : r * 0.45, r + 0.4, spire || 2.4, 8).rotateY(Math.PI / 8).translate(0, (spire || 2.4) / 2, 0), at(x, y + h, z));
  if (!spire) {
    b.geometry('lhWhite', new THREE.CylinderGeometry(r * 0.4, r * 0.4, 1, 8).translate(0, 0.5, 0), at(x, y + h + 2.4, z));
    b.geometry('roofSlate', new THREE.ConeGeometry(r * 0.5, 1.2, 8).translate(0, 0.6, 0), at(x, y + h + 3.4, z));
  }
}

/** Blue lamp post with a pair of white globes. */
function pierLamp(b: Builder, x: number, y: number, z: number): void {
  b.geometry('lampBlue', new THREE.CylinderGeometry(0.07, 0.11, 3.6, 8).translate(0, 1.8, 0), at(x, y, z), { size: [0.2, 3.6, 0.2], pos: new THREE.Vector3(x, y + 1.8, z), quat: Q });
  for (const dy of [3.45, 3.95]) b.geometry('globe', new THREE.SphereGeometry(0.2, 12, 8), at(x, y + dy, z));
}

/** Big white planter with a clipped shrub. */
function pot(b: Builder, x: number, y: number, z: number): void {
  b.geometry('lhWhite', new THREE.CylinderGeometry(0.42, 0.32, 0.8, 12).translate(0, 0.4, 0), at(x, y, z), { size: [0.8, 0.8, 0.8], pos: new THREE.Vector3(x, y + 0.4, z), quat: Q });
  b.geometry('hedge', new THREE.SphereGeometry(0.55, 10, 8).scale(1, 0.9, 1), at(x, y + 1.15, z));
}

/** Open octagonal gazebo you walk through: white posts, a lattice frieze and a white two-tier roof with a finial. */
function gazebo(b: Builder, x: number, y: number, z: number, r: number): void {
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    b.geometry('lhWhite', new THREE.CylinderGeometry(0.09, 0.11, 2.8, 8).translate(0, 1.4, 0), at(px, y, pz), { size: [0.22, 2.8, 0.22], pos: new THREE.Vector3(px, y + 1.4, pz), quat: Q });
  }
  b.geometry('lattice', new THREE.CylinderGeometry(r, r, 0.5, 8, 1, true).rotateY(Math.PI / 8), at(x, y + 2.6, z));
  b.geometry('lhWhite', new THREE.CylinderGeometry(r * 0.45, r + 0.6, 1.2, 8).rotateY(Math.PI / 8).translate(0, 0.6, 0), at(x, y + 2.85, z));
  b.geometry('lattice', new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.6, 8, 1, true).rotateY(Math.PI / 8), at(x, y + 4.35, z));
  b.geometry('lhWhite', new THREE.CylinderGeometry(0.15, r * 0.6, 0.9, 8).rotateY(Math.PI / 8).translate(0, 0.45, 0), at(x, y + 4.65, z));
  b.geometry('lhWhite', new THREE.ConeGeometry(0.1, 0.6, 6).translate(0, 0.3, 0), at(x, y + 5.5, z));
}

/**
 * La Rosa Náutica: a breakwater of dark boulders running out from the beach road, a paved promenade on top with white
 * lattice railings, lamps and blue-roofed kiosks, ending in the cream restaurant whose wing stands on stilts over the
 * sea (dormered slate mansard, spired towers, an octagonal two-storey pavilion). The main hall is the chapter's goal.
 */
export function rosaNautica(b: Builder, hf: Heightfield, def: MaleconDef, c: CoastDef, extras: Extra[]): StationInfo | null {
  const p = def.pier;
  if (!p) return null;
  const X = p.x, D = c.sea + 2.6, z0 = def.beachRoad.z + def.beachRoad.half + 4, zE = c.shore + p.length, r = mulberry32(83);
  const g0 = hf.heightAt(X, z0), walkEnd = zE - 34;
  const steps = Math.max(1, Math.round((D - g0) / 0.17)), rise = (D - g0) / steps;
  for (let i = 0; i < steps; i++) b.box('deckPier', [5.2, rise * (i + 1), 0.32], new THREE.Vector3(X, g0 + rise * (i + 1) / 2, z0 - 1.6 + i * 0.32), Q, true);
  b.box('deckPier', [5.2, 0.5, walkEnd - z0 + 1.6 - steps * 0.32], new THREE.Vector3(X, D - 0.25, (z0 - 1.6 + steps * 0.32 + walkEnd) / 2), Q, true);
  b.box('none', [14, 1.4, zE + 36 - z0], new THREE.Vector3(X, D - 1.5, (z0 + zE + 36) / 2), Q, true);
  const top = D - 0.7, foot = c.sea - 3, slope = (top - foot) / 4.5;
  const mound = new THREE.Shape([new THREE.Vector2(-8, foot), new THREE.Vector2(8, foot), new THREE.Vector2(3.5, top), new THREE.Vector2(-3.5, top)]);
  b.geometry('breakRock', new THREE.ExtrudeGeometry(mound, { depth: zE + 40 - z0 - 6, bevelEnabled: false }), at(X, 0, z0 + 6));
  for (let z = z0 + 6; z < zE + 40; z += 0.9) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const off = 3 + r() * 5, rad = 0.5 + r() * 0.9, y = Math.min(top - Math.max(0, off - 3.5) * slope + rad * 0.2, D - 0.55 - rad * 1.3);
    b.geometry('breakRock', new THREE.DodecahedronGeometry(rad, 0).scale(1.3, 0.75, 1), new THREE.Matrix4().compose(new THREE.Vector3(X + s * off, y, z + r() * 0.9), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(1, 1, 1)));
  }
  for (let k = 0; k < 40; k++) {
    const a = r() * Math.PI, rad = 0.6 + r() * 1;
    b.geometry('breakRock', new THREE.DodecahedronGeometry(rad, 0).scale(1.3, 0.75, 1), new THREE.Matrix4().compose(new THREE.Vector3(X + Math.cos(a) * 6 * r(), top - r() * 3, zE + 40 + Math.sin(a) * 4), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(1, 1, 1)));
  }
  const kiosk0 = walkEnd - 52;
  railing(b, X + 2.6, z0 + 6, X + 2.6, walkEnd, D);
  railing(b, X - 2.6, z0 + 6, X - 2.6, kiosk0, D);
  railing(b, X - 9.2, kiosk0, X - 9.2, walkEnd, D);
  for (let z = z0 + 14; z < walkEnd; z += 16) pierLamp(b, X + 2.15, D, z);
  for (let z = z0 + 18; z < walkEnd - 4; z += 9) pot(b, X + (Math.round((z - z0) / 9) % 2 ? -1.9 : 1.9), D, z);
  gazebo(b, X, D, z0 + 9, 3.2);
  b.box('deckPier', [6.5, 0.5, walkEnd - kiosk0], new THREE.Vector3(X - 5.85, D - 0.25, (kiosk0 + walkEnd) / 2), Q, true);
  for (let z = kiosk0 + 4; z < walkEnd - 2; z += 6.5) {
    b.box('creamWall', [4, 2.8, 5.4], new THREE.Vector3(X - 6.4, D + 1.4, z), Q, true);
    b.box('lobby', [0.05, 1.5, 3.4], new THREE.Vector3(X - 4.37, D + 1.5, z), Q, false);
    hip(b, 'roofSlate', 4.6, 6, 2.2, 0, X - 6.4, D + 2.8, z);
  }
  gazebo(b, X, D, kiosk0 - 6, 3.2);
  // Main hall on the breakwater: two storeys, door facing the promenade.
  const hx0 = X - 8, hx1 = X + 8, hz0 = walkEnd, hz1 = zE + 2, H = 6.4, T = 0.3;
  b.box('parquet', [hx1 - hx0, 0.5, hz1 - hz0], new THREE.Vector3(X, D - 0.24, (hz0 + hz1) / 2), Q, true);
  for (const s of [-1, 1]) b.box('creamWall', [(hx1 - hx0) / 2 - 1.6, H, T], new THREE.Vector3(X + s * ((hx1 - hx0) / 4 + 0.8), D + H / 2, hz0), Q, true);
  b.box('creamWall', [3.2, H - 3, T], new THREE.Vector3(X, D + 3 + (H - 3) / 2, hz0), Q, true);
  b.box('creamWall', [hx1 - hx0, H, T], new THREE.Vector3(X, D + H / 2, hz1), Q, true);
  b.box('creamWall', [T, H, hz1 - hz0], new THREE.Vector3(hx0, D + H / 2, (hz0 + hz1) / 2), Q, true);
  b.box('creamWall', [T, H, 4], new THREE.Vector3(hx1, D + H / 2, hz0 + 2), Q, true);
  b.box('creamWall', [T, H - 3, 4], new THREE.Vector3(hx1, D + 3 + (H - 3) / 2, hz0 + 6), Q, true);
  b.box('creamWall', [T, H, hz1 - hz0 - 8], new THREE.Vector3(hx1, D + H / 2, (hz0 + 8 + hz1) / 2), Q, true);
  b.box('slab', [hx1 - hx0, 0.3, hz1 - hz0], new THREE.Vector3(X, D + H, (hz0 + hz1) / 2), Q, true);
  for (let z = hz0 + 3; z < hz1 - 2; z += 4) b.box('lobby', [0.05, 1.6, 2.4], new THREE.Vector3(hx0 - 0.17, D + 4.4, z), Q, false);
  for (const x of [-5, 5]) b.box('lobby', [2.4, 1.6, 0.05], new THREE.Vector3(X + x, D + 4.4, hz0 - 0.17), Q, false);
  hip(b, 'roofSlate', hx1 - hx0 + 1.4, hz1 - hz0 + 1.4, 2.6, 0.7, X, D + H, (hz0 + hz1) / 2);
  hallDecor(b, hx0, hx1, hz0, hz1, D, H, extras);
  // Wing on stilts out over the sea to the east.
  const wx0 = hx1, wx1 = X + 44, wz0 = walkEnd + 6, wz1 = walkEnd + 24, wz = (wz0 + wz1) / 2;
  b.box('benchWood', [wx1 - wx0 + 6, 0.4, wz1 - wz0 + 4], new THREE.Vector3((wx0 + wx1) / 2 + 3, D - 0.2, wz), Q, true);
  for (let x = wx0 + 2; x <= wx1 + 6; x += 4) for (let z = wz0 - 1; z <= wz1 + 1.5; z += 4) {
    b.geometry('steelDark', new THREE.CylinderGeometry(0.22, 0.26, D - c.sea + 5, 6), at(x, (D + c.sea - 5) / 2, z));
    if ((x + z) % 8 < 4) b.box('steelDark', [0.12, 0.12, 5.6], new THREE.Vector3(x, D - 2.4, z + 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.7), false);
  }
  railing(b, wx0, wz0 - 2, wx1 + 6, wz0 - 2, D);
  railing(b, wx0, wz1 + 2, wx1 + 6, wz1 + 2, D);
  wingHall(b, wx0 + 2, wx1 - 2, wz0 + 2, wz1 - 2, D);
  for (let x = wx0 + 2; x < wx1 - 4; x += 3.2) b.box('awningStripe', [2.6, 0.08, 1.1], new THREE.Vector3(x + 1, D + 3.4, wz - (wz1 - wz0) / 2 + 1.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4), false);
  hip(b, 'roofSlate', wx1 - wx0 - 3, wz1 - wz0 - 3, 2.2, 0.62, (wx0 + wx1) / 2, D + 4.2, wz);
  for (let x = wx0 + 3; x < (wx0 + wx1) / 2; x += 3.4) {
    b.box('creamWall', [1.4, 1.5, 1], new THREE.Vector3(x, D + 5.2, wz0 + 2.3), Q, false);
    b.geometry('roofSlate', new THREE.CylinderGeometry(0.75, 0.75, 1.02, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), at(x, D + 5.95, wz0 + 2.3));
    b.box('lobby', [0.9, 1, 0.05], new THREE.Vector3(x, D + 5.2, wz0 + 1.78), Q, false);
  }
  pavilion(b, (wx0 + wx1) / 2 + 6, D + 4.2, wz, 2.4, 1, 6);
  pavilion(b, wx0 + 5, D + 4.2, wz - 3, 1.8, 0, 2.6);
  diningPavilion(b, wx1 + 2, D, wz, 7.5, [-Math.PI / 2, -Math.PI * 0.75, -Math.PI / 4]);
  const entrance = new THREE.Vector3(X, D, hz0 - 1);
  return { entrance, hall: { x0: hx0 + 0.5, x1: hx1 - 0.5, z0: hz0 + 0.5, z1: hz1 - 0.5, y: D }, cache: new THREE.Vector3(X, D + 0.8, hz1 - 6) };
}
