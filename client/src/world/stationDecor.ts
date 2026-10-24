import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Lighting } from '../render/lighting';

type At = (x: number, y: number, z: number) => THREE.Vector3;
const UP = new THREE.Vector3(0, 1, 0);

/** Inner face of the lobby's side walls (local x = ±SIDE). */
export const SIDE = 15.7;

/**
 * Lobby furniture (local station space, +z towards the street, back wall's inner face at `back`): an office with
 * desks and computers on the left under the flag, reception PCs on the counter, files and a holding cell on the right.
 */
export function furnishStation(b: Builder, at: At, q: THREE.Quaternion, back: number, rand: () => number): void {
  const turn = (a: number) => q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, a));
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false, a = 0) => b.box(mat, size, at(x, y, z), turn(a), collide);

  const desk = (x: number, z: number, a: number, pc: boolean) => {
    box('wood', [1.6, 0.05, 0.8], x, 0.76, z, true, a);
    for (const [dx, dz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) {
      const c = Math.cos(a), s = Math.sin(a);
      box('bars', [0.05, 0.74, 0.05], x + dx * c + dz * s, 0.37, z - dx * s + dz * c, false, a);
    }
    const off = (dx: number, dz: number): [number, number] => [x + dx * Math.cos(a) + dz * Math.sin(a), z - dx * Math.sin(a) + dz * Math.cos(a)];
    if (pc) {
      const [mx, mz] = off(0.1, -0.22), [kx, kz] = off(0.05, 0.12), [tx, tz] = off(0.6, -0.15);
      box('plastic', [0.5, 0.34, 0.05], mx, 1.02, mz, false, a);
      const [sx, sz] = off(0.1, -0.19);
      box('screen', [0.45, 0.28, 0.01], sx, 1.02, sz, false, a);
      box('plastic', [0.08, 0.14, 0.08], mx, 0.85, mz - 0.01, false, a);
      box('plastic', [0.44, 0.02, 0.15], kx, 0.79, kz, false, a);
      box('plastic', [0.2, 0.42, 0.45], tx, 0.99, tz, false, a);
    }
    for (let i = 0; i < 3 + Math.floor(rand() * 4); i++) {
      const [px, pz] = off((rand() - 0.5) * 1.3, (rand() - 0.3) * 0.6);
      box('paper', [0.21, 0.004, 0.297], px, 0.79 + i * 0.004, pz, false, a + (rand() - 0.5) * 0.8);
    }
    const [cx, cz] = off(0, 0.75);
    box('seat', [0.48, 0.08, 0.48], cx, 0.48, cz, true, a + (rand() - 0.5) * 0.6);
    const [bx, bz] = off(0, 1.0);
    box('seat', [0.48, 0.5, 0.06], bx, 0.78, bz, false, a);
    box('bars', [0.05, 0.44, 0.05], cx, 0.22, cz);
  };
  for (const [x, z, pc] of [[-13.2, -8.4, true], [-10.0, -8.4, true], [-13.2, -11.2, true], [-10.0, -11.2, false], [9.6, -9.2, true]] as const) desk(x, z, 0, pc);
  for (const x of [-1.6, 1.6]) {
    box('plastic', [0.5, 0.34, 0.05], x, 1.55, -9.0, false, Math.PI);
    box('screen', [0.45, 0.28, 0.01], x, 1.55, -9.03, false, Math.PI);
    box('plastic', [0.44, 0.02, 0.15], x, 1.32, -9.4, false, Math.PI);
  }

  for (let i = 0; i < 4; i++) {
    const z = -6.9 - i * 0.66;
    box('shutter', [0.5, 1.35, 0.62], SIDE - 0.3, 0.675, z, true);
    for (const y of [0.35, 0.8, 1.2]) box('bars', [0.02, 0.03, 0.2], SIDE - 0.57, y, z);
  }

  const cellX = 11.4, cellZ = back + 3.6;
  b.box('grate', [0.1, 2.6, cellZ - back], at(cellX, 1.3, (cellZ + back) / 2), q, true);
  b.box('grate', [SIDE - cellX - 1.1, 2.6, 0.1], at((cellX + SIDE - 1.1) / 2, 1.3, cellZ), q, true);
  for (let z = back + 0.12; z < cellZ; z += 0.14) box('bars', [0.035, 2.6, 0.035], cellX, 1.3, z);
  for (let x = cellX; x < SIDE - 1.1; x += 0.14) box('bars', [0.035, 2.6, 0.035], x, 1.3, cellZ);
  for (const y of [0.1, 1.3, 2.55]) {
    box('bars', [0.05, 0.06, cellZ - back], cellX, y, (cellZ + back) / 2);
    box('bars', [SIDE - cellX - 1.1, 0.06, 0.05], (cellX + SIDE - 1.1) / 2, y, cellZ);
  }
  box('concrete', [3.6, 0.45, 0.6], (cellX + SIDE) / 2, 0.42, back + 0.35, true);

  const crate = (x: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const s = 0.42 + rand() * 0.12;
      box('cardboard', [s * 1.3, s * 0.8, s], x + (rand() - 0.5) * 0.1, s * 0.4 + i * s * 0.8, z + (rand() - 0.5) * 0.1, i === 0, (rand() - 0.5) * 0.4);
    }
  };
  crate(-SIDE + 0.6, back + 0.6, 3);
  crate(-SIDE + 1.4, back + 0.7, 2);
  crate(-SIDE + 0.6, back + 1.5, 2);
  crate(SIDE - 0.6, -10.6, 3);
  crate(SIDE - 0.7, -11.4, 2);
  crate(-6.2, -7.0, 2);
  crate(6.4, -7.1, 1);
  crate(-11.6, -12.8, 1);
  for (let i = 0; i < 16; i++) box('paper', [0.21, 0.004, 0.297], (rand() - 0.5) * 2 * (SIDE - 1), 0.205, -7 - rand() * 8.5, false, rand() * Math.PI);
  for (let i = 0; i < 5; i++) box('paper', [0.21, 0.004, 0.297], -2.8 + rand() * 5.6, 1.31 + i * 0.005, -9.2 + (rand() - 0.5) * 0.4, false, rand() * Math.PI);

  const flagX = -SIDE + 0.04;
  for (const [i, mat] of ['stripe', 'car5', 'stripe'].entries()) box(mat, [0.02, 1.8, 0.9], flagX, 2.2, -14.4 + i * 0.9);
  box('brass', [0.03, 0.5, 0.42], flagX + 0.01, 2.2, -13.5);
  box('bars', [0.04, 0.04, 2.9], flagX + 0.04, 3.13, -13.5);

  box('cork', [0.03, 0.9, 1.4], -SIDE + 0.04, 1.7, -6.9);
  for (let i = 0; i < 7; i++) box('paper', [0.01, 0.28, 0.21], -SIDE + 0.07, 1.4 + (i % 2) * 0.38 + rand() * 0.06, -7.45 + i * 0.17, false, (rand() - 0.5) * 0.2);
  box('plastic', [0.06, 0.32, 0.32], 0, 3.0, back + 0.04);
}

/** Lettering for the commemorative plaques on the lobby walls. */
const PLAQUES = [
  ['COMISARÍA SECTORIAL', 'INAUGURADA EL 28 DE JULIO DE 2019', 'POLICÍA NACIONAL DEL PERÚ'],
  ['A NUESTROS HÉROES', 'CAÍDOS EN EL CUMPLIMIENTO', 'DEL DEBER · 2034'],
  ['RECONOCIMIENTO', 'AL MÉRITO POLICIAL', 'JUNTA DE GOBIERNO NACIONAL'],
  ['ORDEN · DISCIPLINA', 'PATRIA', 'GRAL. PNP · 2036'],
];

function plaqueTexture(lines: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 340;
  const ctx = c.getContext('2d')!, g = ctx.createLinearGradient(0, 0, 512, 340);
  g.addColorStop(0, '#d9b45a');
  g.addColorStop(0.5, '#f0d78a');
  g.addColorStop(1, '#a98232');
  ctx.fillStyle = '#3b2414';
  ctx.fillRect(0, 0, 512, 340);
  ctx.fillStyle = g;
  ctx.fillRect(26, 26, 460, 288);
  ctx.strokeStyle = '#7a5a20';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 432, 260);
  ctx.fillStyle = '#4a3410';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => {
    ctx.font = `${i === 0 ? 700 : 500} ${i === 0 ? 34 : 24}px Georgia, serif`;
    ctx.fillText(l, 256, 120 + i * 62, 400);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The general's framed portrait (from `manifest.art.general`) over the arms cache and brass plaques on the walls. */
export function stationArt(lighting: Lighting, at: At, q: THREE.Quaternion, back: number): THREE.Group {
  const g = new THREE.Group();
  const face = (yaw: number) => q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
  const plane = (mat: THREE.Material, w: number, h: number, pos: THREE.Vector3, rot: THREE.Quaternion) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(pos);
    m.quaternion.copy(rot);
    g.add(m);
    return m;
  };
  const frame = lighting.setup(new THREE.MeshStandardMaterial({ color: '#8a6420', roughness: 0.4, metalness: 0.6 }), 'portrait-frame');
  const canvas = lighting.setup(new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6 }), 'portrait-canvas');
  const z = back + 0.02;
  plane(frame, 1.5, 1.95, at(0, 2.35, z), face(0));
  plane(canvas, 1.26, 1.7, at(0, 2.35, z + 0.01), face(0));
  const base = `${import.meta.env.BASE_URL}assets/`;
  void fetch(`${base}manifest.json`, { cache: 'no-cache' }).then((r) => r.json()).then((m) => {
    const path = m.art?.general;
    if (!path) return;
    new THREE.TextureLoader().load(`${base}${path}?v=${m.version ?? 0}`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const aspect = tex.image.width / tex.image.height, want = 1.26 / 1.7;
      tex.repeat.set(Math.min(1, want / aspect) * (aspect > 1 ? 0.5 : 1), 1);
      tex.offset.set(aspect > 1 ? 0.5 : (1 - tex.repeat.x) / 2, 0);
      canvas.map = tex;
      canvas.color.set('#ffffff');
      canvas.needsUpdate = true;
    });
  }).catch(() => {});

  const spots: [number, number, number, number][] = [[SIDE - 0.02, 2.0, -7.6, -Math.PI / 2], [SIDE - 0.02, 2.0, -9.4, -Math.PI / 2], [-3.2, 1.9, z, 0], [3.2, 1.9, z, 0]];
  spots.forEach(([x, y, zz, yaw], i) => {
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: plaqueTexture(PLAQUES[i]), roughness: 0.35, metalness: 0.55 }), `plaque-${i}`);
    plane(mat, 0.6, 0.4, at(x - (yaw ? 0.02 : 0), y, zz + (yaw ? 0 : 0.01)), face(yaw));
  });
  return g;
}
