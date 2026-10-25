import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import { framer, yawQ, type CampusBuilding } from './layout';
import { campusLamp } from './roads';
import type { NameSign } from './pavilion';

const G = 3.6, TOP = 8;

/**
 * CIE San Marcos, Centro de Innovación y Emprendimiento (from the user's photos), in the mouth of Industrial's old U:
 * a mirrored glass box with a rounded corner and a grey fascia, cantilevered on round cream columns over an open
 * porch; cream ground floor with roll-up shutters and a bar counter with stools; a curved grey steel stair up to the
 * east landing; a red-brick patio with concrete planters and double lamps. The footprint (local +z = south) holds
 * the building in its back half and the patio in its front half.
 */
export function cie(b: Builder, def: CampusBuilding): NameSign {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, back = -def.d / 2, front = 0;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const x0 = -W + 2, x1 = W - 5, xs = 6;
  box('uniCream', [x1 - (x0 + 8), G, front - 2 - back], (x0 + 8 + x1) / 2, G / 2, (back + front - 2) / 2, true);
  for (let i = 0; i < 3; i++) {
    const x = x0 + 10.5 + i * 4.3;
    box('shutter', [3.8, 2.9, 0.08], x, 1.45, front - 1.96);
  }
  box('darkGlass', [1.6, 2.6, 0.06], x0 + 9, 1.3, front - 1.97);
  box('lampPole', [4.2, 1.05, 0.55], x0 + 14.8, 0.52, front - 1.6, true);
  for (let k = 0; k < 6; k++) b.geometry('lampPole', new THREE.CylinderGeometry(0.17, 0.17, 0.75, 10).translate(0, 0.37, 0), new THREE.Matrix4().compose(at(x0 + 13 + k * 0.72, 0, front - 0.9), q, new THREE.Vector3(1, 1, 1)));
  for (const z of [front - 0.9, back + 1.5]) for (let x = x0 + 0.6; x < x0 + 8; x += 3.6)
    b.geometry('uniCream', new THREE.CylinderGeometry(0.3, 0.3, G, 16).translate(0, G / 2, 0), new THREE.Matrix4().compose(at(x, 0, z), q, new THREE.Vector3(1, 1, 1)));
  for (const z of [front - 0.9, back + 1.5]) for (let x = x0 + 0.6; x < x0 + 8; x += 3.6) box('none', [0.6, G, 0.6], x, G / 2, z, true);
  box('uniCream', [x1 - x0 + 0.6, 0.55, front - back + 0.6], (x0 + x1) / 2, G + 0.27, (back + front) / 2, true);

  const r = 3.2, outline: THREE.Vector2[] = [new THREE.Vector2(xs, front), new THREE.Vector2(x0 + r, front)];
  for (let k = 1; k < 8; k++) {
    const a = (k / 8) * (Math.PI / 2);
    outline.push(new THREE.Vector2(x0 + r - Math.sin(a) * r, front - r + Math.cos(a) * r));
  }
  outline.push(new THREE.Vector2(x0, front - r), new THREE.Vector2(x0, back));
  for (let i = 0; i + 1 < outline.length; i++) {
    const a = outline[i], c = outline[i + 1], len = a.distanceTo(c), mid = a.clone().lerp(c, 0.5);
    const sq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(c.y - a.y, -(c.x - a.x)) + Math.PI));
    const seg = (mat: string, h: number, y: number, t: number) => b.box(mat, [len + 0.04, h, t], at(mid.x, y, mid.y), sq, false);
    seg('darkGlass', TOP - G - 0.6, G + 0.55 + (TOP - G - 0.6) / 2, 0.08);
    seg('uniCream', 0.6, G + 0.25, 0.5);
    seg('uniGrey', 1.1, TOP + 0.5, 0.45);
    for (let k = 0; k <= Math.floor(len / 1.6); k++) {
      const p = a.clone().lerp(c, Math.min(1, (k * 1.6) / len));
      b.box('mullion', [0.06, TOP - G - 0.6, 0.12], at(p.x, G + 0.55 + (TOP - G - 0.6) / 2, p.y), sq, false);
    }
    seg('mullion', 0.06, G + 2.6, 0.12);
  }
  box('none', [xs - x0, TOP - G, front - back], (x0 + xs) / 2, (G + TOP) / 2 + 0.3, (back + front) / 2, true);
  box('uniGrey', [xs - x0, 0.3, front - back], (x0 + xs) / 2, TOP + 0.9, (back + front) / 2);
  box('uniCream', [x1 - xs, TOP - G + 0.4, front - back], (xs + x1) / 2, G + (TOP - G + 0.4) / 2 + 0.3, (back + front) / 2, true);
  box('darkGlass', [1.4, 2.4, 0.06], x1 - 2, G + 1.75, front + 0.04);
  box('uniCream', [0.5, 1.6, 0.5], x1 - 0.2, TOP + 0.5, front - 0.3);

  const land = new THREE.Vector3(x1 + 1.3, G + 0.55, front - 2.5);
  box('steelGrey', [2.6, 0.12, 5], land.x, land.y, land.z, true);
  for (const s of [-1, 1]) box('steelGrey', [0.05, 1, 5], land.x + s * 1.25, land.y + 0.5, land.z);
  box('steelGrey', [2.6, 0.05, 0.05], land.x, land.y + 1, land.z - 2.5);
  const steps = 20, rise = land.y / steps, cx = land.x - 3.6, cz = front, R = 3.6;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * (Math.PI / 2), y = land.y - (i + 1) * rise;
    const p = new THREE.Vector2(cx + Math.cos(a) * R, cz + Math.sin(a) * R);
    const sq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a));
    b.box('steelGrey', [1.2, 0.06, 0.34], at(p.x, y + 0.03, p.y), sq, false);
    b.box('none', [1.2, y + 0.06, 0.34], at(p.x, (y + 0.06) / 2, p.y), sq, true);
    const o = new THREE.Vector2(cx + Math.cos(a) * (R + 0.62), cz + Math.sin(a) * (R + 0.62));
    if (i % 2 === 0) b.box('steelGrey', [0.04, 1, 0.04], at(o.x, y + 0.53, o.y), q, false);
    b.box('steelGrey', [0.05, 0.05, 0.4], at(o.x, y + 1.05, o.y), sq, false);
  }

  box('pavRed', [def.w - 1, 0.2, def.d / 2 - 0.5], 0, -0.02, front + def.d / 4 - 0.25, true);
  box('parkPath', [2.6, 0.22, def.d / 2 - 0.5], W - 2, -0.01, front + def.d / 4 - 0.25, true);
  for (const [x, z] of [[x0 + 1, 3], [x0 + 5, 5.5], [-1, 9], [x0 + 2, 11]]) {
    box('concrete', [1.3, 0.7, 1.3], x, 0.35, front + z, true);
    box('hedge', [1.1, 0.3, 1.1], x, 0.8, front + z);
  }
  for (const [x, z] of [[x0 + 3, 7.5], [x1 - 6, 12]]) campusLamp(b, at(x, 0.08, front + z), (-def.yaw * Math.PI) / 180);
  return { pos: at((xs + x1) / 2, G + 2.9, front + 0.03), q, w: 3.4, text: 'CIE\nSAN MARCOS', ink: '#2a2a2a', font: 'sans' };
}
