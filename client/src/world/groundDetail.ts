import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import type { StreetGraph } from './barrio';
import { mulberry32 } from '../core/rng';
import { stripAt, surfaceTop } from './groundStrips';
import { surfaceOf } from './surfaces';

type Draw = (g: CanvasRenderingContext2D, r: () => number) => void;
const C = 256;

/** Cast-iron and concrete street fittings, cut out of the atlas (alpha-tested): [draw, width m, depth m]. */
const FITTINGS: [Draw, number, number][] = [
  [(g, r) => {
    g.fillStyle = '#5d5a55'; g.beginPath(); g.arc(128, 128, 124, 0, 6.28); g.fill();
    g.fillStyle = '#2f2d2b'; g.beginPath(); g.arc(128, 128, 112, 0, 6.28); g.fill();
    g.strokeStyle = '#4a4744'; g.lineWidth = 5;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(128, 128, k * 24, 0, 6.28); g.stroke(); }
    for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.28; g.beginPath(); g.moveTo(128 + Math.cos(a) * 24, 128 + Math.sin(a) * 24); g.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); g.stroke(); }
    g.fillStyle = '#3a3836'; g.fillRect(70, 112, 116, 32);
    g.fillStyle = '#6b6761'; g.font = '700 26px Arial'; g.textAlign = 'center'; g.fillText('SEDAPAL', 128, 137);
    rust(g, r, 128, 128, 110);
  }, 0.78, 0.78],
  [(g, r) => {
    g.fillStyle = '#8f8a80'; g.fillRect(40, 8, 176, 240);
    g.fillStyle = '#3b4f63'; g.fillRect(56, 24, 144, 208);
    g.strokeStyle = '#2c3b4a'; g.lineWidth = 4; for (let y = 44; y < 220; y += 16) { g.beginPath(); g.moveTo(64, y); g.lineTo(192, y); g.stroke(); }
    g.fillStyle = '#c9d1d8'; g.font = '700 30px Arial'; g.textAlign = 'center'; g.fillText('AGUA', 128, 136);
    rust(g, r, 128, 128, 90);
  }, 0.36, 0.52],
  [(g, r) => {
    g.fillStyle = '#4b4945'; g.fillRect(8, 60, 240, 136);
    g.fillStyle = '#121110';
    for (let x = 22; x < 236; x += 18) g.fillRect(x, 74, 9, 108);
    rust(g, r, 128, 128, 120);
  }, 0.95, 0.5],
];

/** Soft marks blended over the paving: [draw, size m]. */
const MARKS: [Draw, number][] = [
  [(g, r) => { for (let k = 0; k < 7; k++) blot(g, 128 + (r() - 0.5) * 90, 128 + (r() - 0.5) * 90, 30 + r() * 50, 'rgba(18,16,14,0.32)'); }, 1.5],
  [(g, r) => {
    g.strokeStyle = 'rgba(25,22,20,0.75)'; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      let x = 20 + r() * 40, y = 30 + r() * 196; g.lineWidth = 3 + r() * 2; g.beginPath(); g.moveTo(x, y);
      while (x < 236) { x += 12 + r() * 22; y += (r() - 0.5) * 34; g.lineTo(x, y); if (r() < 0.2) g.lineWidth *= 0.8; }
      g.stroke();
    }
  }, 1.8],
  [(g, r) => { g.fillStyle = 'rgba(28,27,26,0.55)'; g.fillRect(28 + r() * 20, 40 + r() * 20, 170, 150); g.strokeStyle = 'rgba(10,10,10,0.5)'; g.lineWidth = 4; g.strokeRect(30, 44, 168, 146); }, 1.6],
];

function blot(g: CanvasRenderingContext2D, x: number, y: number, rad: number, c: string): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

function rust(g: CanvasRenderingContext2D, r: () => number, x: number, y: number, rad: number): void {
  g.save(); g.globalCompositeOperation = 'source-atop';
  for (let k = 0; k < 10; k++) blot(g, x + (r() - 0.5) * rad * 1.6, y + (r() - 0.5) * rad * 1.6, 12 + r() * 30, `rgba(${110 + r() * 40},${60 + r() * 20},30,0.35)`);
  g.restore();
}

function atlas(draws: Draw[], seed: number): THREE.CanvasTexture {
  const cv = Object.assign(document.createElement('canvas'), { width: C * draws.length, height: C }), g = cv.getContext('2d')!, r = mulberry32(seed);
  draws.forEach((d, i) => { g.save(); g.translate(i * C, 0); g.beginPath(); g.rect(0, 0, C, C); g.clip(); d(g, r); g.restore(); });
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
}

/**
 * Street fittings and wear along the pedestrian graph, only on hard paving (pavements, roads): manhole covers, water
 * meter lids, kerb drain grates (cut-out iron) and oil stains, cracks and tar patches (blended). `perTen` = pieces
 * per 10 m of street. One instanced mesh per kind.
 */
export function groundDetail(graph: StreetGraph, world: RAPIER.World, perTen: number, lighting: Lighting, paved: (x: number, z: number) => boolean): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(9191);
  const iron = lighting.setup(new THREE.MeshStandardMaterial({ map: atlas(FITTINGS.map((f) => f[0]), 3), alphaTest: 0.5, roughness: 0.7, metalness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }), 'fittings');
  const wear = lighting.setup(new THREE.MeshStandardMaterial({ map: atlas(MARKS.map((m) => m[0]), 4), transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }), 'road-wear');
  const kinds = FITTINGS.length + MARKS.length, spots: { p: THREE.Vector3; k: number; a: number }[][] = Array.from({ length: kinds }, () => []);
  for (const [a, b] of graph.edges) {
    const A = graph.nodes[a], B = graph.nodes[b], len = A.distanceTo(B), n = Math.round((len / 10) * perTen * (0.5 + r()));
    const side = new THREE.Vector3(-(B.z - A.z), 0, B.x - A.x).normalize(), along = Math.atan2(B.x - A.x, B.z - A.z);
    for (let i = 0; i < n; i++) {
      const p = A.clone().lerp(B, r()).addScaledVector(side, (r() < 0.5 ? -1 : 1) * (1 + r() * 6));
      const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 3, z: p.z }, { x: 0, y: -1, z: 0 }), 6, true);
      if (!hit) continue;
      const y = p.y + 3 - hit.timeOfImpact;
      const surf = surfaceOf(hit.collider.handle), strip = stripAt(p.x, surfaceTop(p.x, y, p.z), p.z);
      const hard = strip ? strip === 'hard' : surf === 'dirt' ? paved(p.x, p.z) : surf !== 'grass' && surf !== 'wood' && surf !== 'metal';
      if (Math.abs(y - p.y) > 0.6 || !hard) continue;
      p.y = surfaceTop(p.x, y, p.z) + 0.012;
      const k = r() < 0.35 ? Math.floor(r() * FITTINGS.length) : FITTINGS.length + Math.floor(r() * MARKS.length);
      spots[k].push({ p, k, a: k < FITTINGS.length ? along + (r() < 0.5 ? 0 : Math.PI / 2) : r() * 6.28 });
    }
  }
  const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  spots.forEach((list, k) => {
    if (!list.length) return;
    const fit = k < FITTINGS.length, n = fit ? FITTINGS.length : MARKS.length, j = fit ? k : k - FITTINGS.length;
    const [w, d] = fit ? [FITTINGS[j][1], FITTINGS[j][2]] : [MARKS[j][1], MARKS[j][1]];
    const geo = new THREE.PlaneGeometry(w, d), uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (j + uv.getX(i)) / n);
    const inst = new THREE.InstancedMesh(geo, fit ? iron : wear, list.length);
    list.forEach((s, i) => inst.setMatrixAt(i, m.compose(s.p, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.a).multiply(flat), new THREE.Vector3(1, 1, 1))));
    inst.receiveShadow = true;
    inst.renderOrder = fit ? 0 : 1;
    g.add(inst);
  });
  return g;
}
