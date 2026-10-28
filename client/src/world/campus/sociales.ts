import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { chatGroup, type Plants } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import { FLOOR, wing, type NameSign, type Skin } from './pavilion';

const SKIN: Skin = { kind: 'frame', wall: 'socBeige', spandrel: 'socBeige', base: 'socBeige', plain: true };

/**
 * Facultad de Ciencias Sociales (from the user's photos): beige four-storey blocks with red-curtained window bands
 * round a front garden; at the north-east corner an open frame whose floors sweep out as long white cantilevered
 * bands with rounded ends, the name in raised letters on its top edge. The garden: lawn behind low clipped hedges,
 * topiary balls in white-stone rings, "FCCSS" laid in white stones, a graffiti mural wall, a red-tiled kiosk with a
 * red timber pergola, terracotta brick-capped walls flanking the entrance steps, students about.
 */
export function sociales(b: Builder, def: CampusBuilding, plants: Plants, rand: () => number): NameSign[] {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, D = def.d / 2;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const T = 12, frameW = 40, H = 4 * FLOOR;
  wing(b, at, q, -frameW / 2, -D + T / 2, def.w - frameW, T, 4, SKIN, rand);
  wing(b, at, q, -W + T / 2, T / 2, T, def.d - T, 3, SKIN, rand);
  for (let f = 0; f < 4; f++) for (let k = 0; k < 6; k++) if (rand() < 0.6) box('curtainRed', [2.2, FLOOR - 1.4, 0.05], -W + 4 + k * 8, f * FLOOR + 1.6, -D + T + 0.02);

  const fx = W - frameW / 2, fz = -D + T / 2;
  box('socBeige', [frameW, H, 4], fx, H / 2, fz - 4, true);
  for (let f = 1; f <= 4; f++) {
    const y = f * FLOOR;
    box('terrazzo', [frameW, 0.3, 3.2], fx, y - 0.15, fz - 0.4, true);
    box('socBeige', [frameW, 0.3, 3.2], fx, y - 0.45, fz - 0.4);
    if (f < 4) box('socBeige', [frameW - 4, 1.05, 0.2], fx + 2, y + 0.5, fz + 1.1, true);
  }
  for (const u of [-13, -4.5, 4.5, 13]) box('uniTaupe', [0.6, H, 0.6], fx + u, H / 2, fz + 1.2, true);
  const slope = Math.atan2(FLOOR, frameW), len = Math.hypot(frameW, FLOOR);
  const tilt = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -slope));
  for (let k = 1; k <= 3; k++) {
    const y = (k - 0.5) * FLOOR;
    b.box('terrazzo', [len, 0.25, 2.6], at(fx, y - 0.12, fz + 2.6), tilt, true);
    b.box('socBeige', [len, 0.5, 2.8], at(fx, y - 0.5, fz + 2.6), tilt);
    b.box('socBeige', [len, 1.1, 0.22], at(fx, y + 0.5, fz + 3.95), tilt, true);
    b.box('tileCream', [len, 0.9, 0.12], at(fx, y + 0.45, fz + 1.35), tilt);
  }
  box('socBeige', [frameW + 2, 0.9, 7], fx, H + 0.45, fz - 1.5);

  const gx = (-W + T + W) / 2, gw = W * 2 - T - 2, gz = (-D + T + D) / 2 + 1, gd = def.d - T - 4;
  box('lawnBed', [gw, 0.12, gd], gx, 0.08, gz);
  for (const s of [-1, 1]) box('hedge', [gw, 0.6, 0.7], gx, 0.3, gz + s * gd / 2);
  box('hedge', [0.7, 0.6, gd], gx + gw / 2, 0.3, gz);
  for (let i = 0; i < 7; i++) {
    const u = gx - gw / 2 + 4 + rand() * (gw - 8), v = gz - gd / 2 + 3 + rand() * (gd - 6);
    if (Math.abs(u - gx - 6) < 6 && Math.abs(v - gz - 3) < 3) continue;
    const p = at(u, 0, v);
    const lolly = i % 2 === 0, r = 0.5 + rand() * 0.25;
    if (lolly) b.box('wood', [0.12, 1.2, 0.12], new THREE.Vector3(p.x, 0.6, p.z), q);
    b.geometry('hedge', lolly ? new THREE.SphereGeometry(r, 12, 8) : new THREE.ConeGeometry(r, r * 2.4, 10), new THREE.Matrix4().makeTranslation(p.x, lolly ? 1.2 + r * 0.7 : 0.16 + r * 1.2, p.z));
    b.geometry('uniWhite', new THREE.TorusGeometry(0.9, 0.12, 6, 20).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(p.x, 0.16, p.z));
  }
  box('muralWall', [gw * 0.6, 1.3, 0.3], gx - gw * 0.15, 0.65, gz - 2, true);
  box('brickRed', [gw * 0.6 + 0.2, 0.12, 0.4], gx - gw * 0.15, 1.36, gz - 2);
  const kx = gx + gw / 2 - 6, kz = gz + gd / 2 - 4;
  for (const [u, v] of [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) box('woodRed', [0.25, 2.8, 0.25], kx + u, 1.4, kz + v, true);
  b.gable('roofTileRed', 6.4, 1.2, 5, at(kx, 2.8, kz), q, true);
  box('terrazzo', [6, 0.12, 4.6], kx, 0.06, kz);
  for (const v of [-4, 3]) for (const u of [-7, -3.5]) box('woodRed', [0.2, 2.75, 0.2], kx + u, 1.37, kz + v, true);
  for (let k = 0; k < 6; k++) box('woodRed', [0.18, 0.18, 7], kx - 7 + k * 1.2, 2.75, kz - 0.5);
  for (const s of [-1, 1]) {
    box('uniTerracotta', [0.5, 1.1, 7], gx + s * 4, 0.55, D - 1.5, true);
    box('brickRed', [0.6, 0.12, 7.1], gx + s * 4, 1.16, D - 1.5);
  }
  for (let k = 0; k < 4; k++) box('concrete', [7.5, 0.14 * (k + 1), 1], gx, 0.07 * (k + 1), D - 4.5 + k);
  for (let i = 0; i < 4; i++) chatGroup(plants.standing, at(gx - gw / 2 + 6 + i * gw / 4, 0.02, gz + gd / 2 - 1.5), rand);
  plants.palms.push(at(gx - gw / 2 + 2, 0, gz + 2), at(gx + gw / 2 - 2, 0, gz - gd / 2 + 2));
  plants.trees.push(at(W + 4, 0, D - 4), at(gx, 0, D + 3));
  const flat = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  return [
    { pos: at(fx, H + 0.45, fz + 2.03), q, w: 24, text: 'FACULTAD DE CIENCIAS SOCIALES', ink: '#2a2622' },
    { pos: at(gx + 6, 0.16, gz + 3), q: flat, w: 7, text: 'FCCSS', ink: '#f4f2ec', font: 'sans' },
  ];
}
