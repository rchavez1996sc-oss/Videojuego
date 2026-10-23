import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Lighting } from '../../render/lighting';
import { edgeZ, type CoastDef } from '../coast';
import type { MaleconDef } from './layout';
import { chatGroup, railing, type Plants } from './park';
import { canvasTexture } from './textures';

const Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
const SHOPS: [string, string, string][] = [
  ['BANANO REPÚBLICA', '#f4f1ea', '#1b1b1b'], ["CHILLY'S", '#1c1c1c', '#e8392a'], ['TANTO', '#f6f2e8', '#e2452b'], ['STARBOCKS', '#0f5e3c', '#ffffff'],
  ['JUAN BALDEZ', '#1e1e1e', '#f2f2f2'], ['CINEPLANETA', '#16306b', '#ffffff'], ['ZURA', '#111111', '#ffffff'], ['PARDOS', '#f2c230', '#5a1c10'],
  ['MANGOS', '#ffffff', '#222222'], ['LA ROSA NÁUTICA', '#ffffff', '#1d4f7a'], ['ADIDOS', '#111111', '#ffffff'], ['BEMBAS', '#e3262c', '#ffffff'],
];

/** Mall cut into the cliff: sunken confetti-tiled plaza, shopfronts under a white lattice band, stairs and escalators down from the park. */
export function buildLarcomar(b: Builder, def: MaleconDef, c: CoastDef, lighting: Lighting, plants: Plants, rand: () => number): THREE.Group {
  const signs = new THREE.Group(), l = def.larcomar, y0 = l.y, H = -y0;
  const cx = (l.x0 + l.x1) / 2, zEdge = Math.min(edgeZ(c, l.x0 + 8), edgeZ(c, l.x1 - 8), edgeZ(c, cx)) - 0.8;
  const side = 12, zFoot = Math.max(...(c.carves ?? []).filter((k) => k.x0 <= l.x0 + 1 && k.x1 >= l.x1 - 1).map((k) => k.z1), zEdge + 1);
  const sign = (text: string, bg: string, fg: string, pos: THREE.Vector3, yaw: number, w: number, lit = false) => {
    const tex = canvasTexture((ctx, cw, ch) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = fg;
      ctx.font = `600 ${Math.floor(ch * 0.5)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cw / 2, ch / 2 + 2, cw * 0.9);
    });
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: lit ? '#ffffff' : '#000000', emissiveMap: lit ? tex : null, emissiveIntensity: lit ? 0.8 : 0 }), `lc-${text}`);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
    m.position.copy(pos);
    m.rotation.y = yaw;
    signs.add(m);
  };
  b.box('confetti', [l.x1 - l.x0, 0.3, zEdge - l.z0 + 1], new THREE.Vector3(cx, y0 - 0.15, (l.z0 + zEdge) / 2), Q, true);
  b.box('lattice', [l.x1 - l.x0 + 2, H, 12], new THREE.Vector3(cx, y0 + H / 2, l.z0 - 6), Q, true);
  for (const s of [-1, 1]) {
    const wx = s < 0 ? l.x0 : l.x1, gap = Array.from({ length: 5 }, (_, k) => wx - s * (8 - k * 2));
    railing(b, gap.map((x) => new THREE.Vector3(x, 0, edgeZ(c, x) - 1.2)).concat(new THREE.Vector3(wx, 0, edgeZ(c, wx) - 1.2)));
  }
  for (const s of [-1, 1]) {
    const x = s < 0 ? l.x0 + side / 2 : l.x1 - side / 2;
    b.box('mallWhite', [side, H + 0.1, zEdge - l.z0], new THREE.Vector3(x, y0 + H / 2, (l.z0 + zEdge) / 2), Q, true);
    b.box('mallWhite', [1.2, H + 0.1, zFoot - zEdge + 0.5], new THREE.Vector3(s < 0 ? l.x0 + 0.6 : l.x1 - 0.6, y0 + H / 2, (zEdge + zFoot) / 2), Q, true);
    b.box('mallWhite', [side + 1, 0.1, zEdge - l.z0 + 1], new THREE.Vector3(x, 0.03, (l.z0 + zEdge) / 2), Q, false);
    const face = x - s * (side / 2 + 0.02), yaw = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let z = l.z0 + 4, k = 0; z < zEdge - 4; z += 8, k++) {
      b.box('shopGlass', [0.06, 3.6, 6.8], new THREE.Vector3(face, y0 + 1.9, z + 0.5), Q, false);
      b.box('shopLit', [0.04, 3.2, 6.2], new THREE.Vector3(face + s * 0.12, y0 + 1.8, z + 0.5), Q, false);
      const awning = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * 0.35);
      if (k % 2 === 0) b.box(rand() < 0.5 ? 'awningRed' : 'stripe', [2.4, 0.06, 6.6], new THREE.Vector3(face - s * 1.1, y0 + 4.1, z + 0.5), awning, false);
      const [t, bg, fg] = SHOPS[(k * 2 + (s > 0 ? 1 : 0)) % SHOPS.length];
      sign(t, bg, fg, new THREE.Vector3(face - s * 0.05, y0 + 5.0, z + 0.5), yaw, 4.8);
      plaza(b, new THREE.Vector3(face - s * 5, y0, z + 0.5), rand, plants.seats);
    }
    for (let z = l.z0; z < zEdge; z += 2.5) b.box('railGlass', [0.05, 1.1, 2.5], new THREE.Vector3(face + s * 0.3, 0.6, z + 1.25), Q, false);
    b.box('none', [0.3, 1.4, zEdge - l.z0], new THREE.Vector3(face + s * 0.3, 0.7, (l.z0 + zEdge) / 2), Q, true);
  }
  const inner = [l.x0 + side, l.x1 - side], wallZ = l.z0 + 0.02;
  for (let x = inner[0] + 1; x < inner[1] - 8; x += 9) {
    if (Math.abs(x + 4 - cx) < 9) continue;
    b.box('shopGlass', [8, 3.8, 0.06], new THREE.Vector3(x + 4, y0 + 2, wallZ), Q, false);
    b.box('shopLit', [7.4, 3.4, 0.04], new THREE.Vector3(x + 4, y0 + 1.9, wallZ - 0.12), Q, false);
    const [t, bg, fg] = SHOPS[Math.floor(rand() * SHOPS.length)];
    sign(t, bg, fg, new THREE.Vector3(x + 4, y0 + 4.6, wallZ + 0.05), 0, 6);
  }
  const screen = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#1b26c9';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${h * 0.3}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    for (let k = 0; k < 3; k++) ctx.fillText('28.07.36', w / 2, h * (0.3 + k * 0.25));
  }, 256, 256);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: screen, color: new THREE.Color(1.4, 1.4, 1.4), fog: true }));
  scr.position.set(cx + 18, y0 + 5.2, wallZ + 0.1);
  signs.add(scr);
  sign('LARCOMAR', '#f4f1ea', '#1b1b1b', new THREE.Vector3(cx - 16, y0 + 5.6, wallZ + 0.06), 0, 9);
  stairs(b, cx, l.z0, y0);
  for (let x = inner[0]; x < inner[1]; x += 2.5) {
    if (Math.abs(x + 1.25 - cx) < 4) continue;
    b.box('railGlass', [2.5, 1.1, 0.05], new THREE.Vector3(x + 1.25, 0.6, l.z0 + 0.2), Q, false);
    b.box('none', [2.5, 1.4, 0.3], new THREE.Vector3(x + 1.25, 0.7, l.z0 + 0.2), Q, true);
  }
  for (let x = l.x0; x < l.x1; x += 2.5) {
    b.box('railGlass', [2.5, 1.1, 0.05], new THREE.Vector3(x + 1.25, y0 + 0.6, zEdge), Q, false);
    b.box('alu', [2.5, 0.07, 0.08], new THREE.Vector3(x + 1.25, y0 + 1.15, zEdge), Q, false);
  }
  b.box('none', [l.x1 - l.x0, 1.6, 0.4], new THREE.Vector3(cx, y0 + 0.8, zEdge), Q, true);
  kiosk(b, new THREE.Vector3(cx - 12, y0, (l.z0 + zEdge) / 2 + 3));
  for (const [dx, dz] of [[-26, 12], [-4, 27], [10, 14]]) chatGroup(plants.standing, new THREE.Vector3(cx + dx, y0, l.z0 + dz), rand);
  for (let x = cx + 4; x < inner[1] - 5; x += 4.5) for (let z = l.z0 + 17; z < zEdge - 4; z += 4.5) plaza(b, new THREE.Vector3(x + (rand() - 0.5), y0, z + (rand() - 0.5)), rand, plants.seats);
  for (let x = inner[0] + 4; x < cx - 20; x += 5) plaza(b, new THREE.Vector3(x, y0, zEdge - 3.5), rand, plants.seats);
  for (let k = 0; k < 4; k++) sail(b, new THREE.Vector3(cx + 6 + k * 6, y0, l.z0 + 12 + (k % 2) * 7), k);
  for (const [dx, dz] of [[-24, 8], [-2, 20], [14, 24], [26, 10], [-28, 22]]) {
    const p = new THREE.Vector3(cx + dx, y0, l.z0 + dz);
    if (p.z > zEdge - 3) continue;
    b.box('planter', [2.2, 0.8, 2.2], p.clone().setY(y0 + 0.4), Q, true);
    plants.palms.push(p.clone().setY(y0 + 0.8));
  }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = cx + s * (9 + k * 9), m = new THREE.Matrix4().makeTranslation(x, 0, l.z0 - 0.9);
    b.geometry('greenGlass', new THREE.CylinderGeometry(0.55, 0.55, 4.2, 16).translate(0, 2.1, 0), m);
    b.geometry('lampPole', new THREE.CylinderGeometry(0.6, 0.6, 0.2, 16).translate(0, 4.25, 0), m);
    b.box('none', [1.1, 4.2, 1.1], new THREE.Vector3(x, 2.1, l.z0 - 0.9), Q, true);
  }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) pergola(b, new THREE.Vector3(cx + s * (8 + k * 9), 0, l.z0 - 16 - (k % 2) * 6));
  return signs;
}

/** Concrete stair beside a pair of escalators, from the park edge down to the plaza along the north wall. */
function stairs(b: Builder, cx: number, z0: number, y0: number): void {
  const steps = Math.ceil(-y0 / 0.25), tread = 0.4;
  for (let i = 0; i < steps; i++) {
    const top = -(i + 1) * (-y0 / steps), z = z0 + 0.6 + i * tread;
    b.box('pavement', [3.2, top - y0 + 0.05, tread + 0.02], new THREE.Vector3(cx - 2, (top + y0) / 2, z + tread / 2), Q, true);
  }
  const len = steps * tread, mid = z0 + 0.6 + len / 2, slope = Math.atan2(-y0, len);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), slope);
  for (const x of [cx + 0.6, cx + 2.2]) {
    b.box('alu', [1.3, 0.25, Math.hypot(len, y0)], new THREE.Vector3(x, y0 / 2 + 0.3, mid), q, true);
    b.box('railGlass', [0.05, 1.0, Math.hypot(len, y0)], new THREE.Vector3(x + 0.7, y0 / 2 + 0.9, mid), q, false);
  }
  b.box('railGlass', [0.05, 1.0, Math.hypot(len, y0)], new THREE.Vector3(cx - 3.65, y0 / 2 + 0.7, mid), q, false);
  b.box('none', [0.2, 1.4, Math.hypot(len, y0)], new THREE.Vector3(cx - 3.75, y0 / 2 + 0.7, mid), q, true);
}

function plaza(b: Builder, at: THREE.Vector3, rand: () => number, seats: Plants['seats']): void {
  if (rand() < 0.4) return;
  const m = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z);
  b.geometry('lampPole', new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0), m);
  b.geometry('umbrella', new THREE.ConeGeometry(1.5, 0.5, 10, 1, true).translate(0, 2.5, 0), m);
  b.geometry('benchWood', new THREE.CylinderGeometry(0.45, 0.45, 0.05, 12).translate(0, 0.74, 0), m);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const yaw = Math.atan2(-Math.cos(a), -Math.sin(a)), q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    const p = new THREE.Vector3(at.x + Math.cos(a) * 0.95, at.y, at.z + Math.sin(a) * 0.95);
    b.box('chair', [0.44, 0.45, 0.42], p.clone().setY(at.y + 0.225), q, false);
    b.box('chair', [0.44, 0.5, 0.05], p.clone().add(new THREE.Vector3(0, 0.7, -0.2).applyQuaternion(q)), q, false);
    if (rand() < 0.35) seats.push({ pos: p.clone().add(new THREE.Vector3(0, 0, 0.05).applyQuaternion(q)), yaw });
  }
  b.box('none', [1.2, 0.8, 1.2], at.clone().setY(at.y + 0.4), Q, true);
}

/** Small brick restaurant with a slanted lawn roof and a striped awning. */
function kiosk(b: Builder, at: THREE.Vector3): void {
  b.box('brick', [10, 4, 7], at.clone().setY(at.y + 2), Q, true);
  b.box('lawnRoof', [11, 0.4, 8.5], at.clone().setY(at.y + 4.6), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.18), false);
  b.box('stripe', [6, 0.06, 1.6], new THREE.Vector3(at.x, at.y + 3.1, at.z + 4.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3), false);
  b.box('shopGlass', [5, 2.4, 0.06], new THREE.Vector3(at.x, at.y + 1.4, at.z + 3.53), Q, false);
}

/** Triangular shade sail stretched between three masts. */
function sail(b: Builder, at: THREE.Vector3, k: number): void {
  const pts = [new THREE.Vector3(-4, 4.2, -3), new THREE.Vector3(4, 3.4, -2), new THREE.Vector3((k % 2 ? 1 : -1) * 1, 4.8, 4)];
  for (const p of pts) b.box('alu', [0.12, p.y, 0.12], new THREE.Vector3(at.x + p.x, at.y + p.y / 2, at.z + p.z), Q, true);
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  b.geometry('sail', g, new THREE.Matrix4().makeTranslation(at.x, at.y, at.z));
}

function pergola(b: Builder, at: THREE.Vector3): void {
  for (const [x, z] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) b.box('benchWood', [0.3, 3.2, 0.3], new THREE.Vector3(at.x + x, at.y + 1.6, at.z + z), Q, true);
  for (let x = -3.4; x <= 3.4; x += 0.6) b.box('benchWood', [0.12, 0.2, 5], new THREE.Vector3(at.x + x, at.y + 3.3, at.z), Q, false);
  b.box('sail', [7.4, 0.04, 5.2], new THREE.Vector3(at.x, at.y + 3.45, at.z), Q, false);
}
