import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { mulberry32 } from '../core/rng';
import PARTIES from '../data/pintas.json';

type Party = (typeof PARTIES)[number];
const W = 1024, H = 384;
const spots: { pos: THREE.Vector3; quat: THREE.Quaternion; w: number }[] = [];

/** Queues a campaign painting on a blank wall (centre, facing, width in metres; height is a third of it). */
export function pintaWall(pos: THREE.Vector3, quat: THREE.Quaternion, w: number): void {
  spots.push({ pos, quat, w });
}

function symbol(g: CanvasRenderingContext2D, kind: string, x: number, y: number, r: number, ink: string): void {
  g.save(); g.translate(x, y); g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = r * 0.14; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, r, 0, 6.28); g.stroke();
  g.beginPath();
  if (kind === 'estrella') for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, l = k % 2 ? r * 0.32 : r * 0.78; g.lineTo(Math.cos(a) * l, Math.sin(a) * l); }
  else if (kind === 'sol') { g.arc(0, 0, r * 0.36, 0, 6.28); g.fill(); g.beginPath(); for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28; g.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); g.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); } g.stroke(); }
  else if (kind === 'casa') { g.moveTo(-r * 0.6, 0); g.lineTo(0, -r * 0.6); g.lineTo(r * 0.6, 0); g.lineTo(r * 0.42, 0); g.lineTo(r * 0.42, r * 0.55); g.lineTo(-r * 0.42, r * 0.55); g.lineTo(-r * 0.42, 0); }
  else if (kind === 'lampa') { g.moveTo(-r * 0.1, -r * 0.7); g.lineTo(r * 0.1, -r * 0.7); g.lineTo(r * 0.1, r * 0.1); g.lineTo(r * 0.5, r * 0.15); g.lineTo(r * 0.4, r * 0.6); g.lineTo(-r * 0.4, r * 0.6); g.lineTo(-r * 0.5, r * 0.15); g.lineTo(-r * 0.1, r * 0.1); }
  else if (kind === 'choclo') { g.ellipse(0, 0, r * 0.28, r * 0.68, 0.3, 0, 6.28); g.fill(); g.fillStyle = '#ece8de'; g.beginPath(); for (let k = -3; k <= 3; k++) for (const s of [-1, 1]) g.rect(s * r * 0.08 + k * r * 0.03 - 3, k * r * 0.17 - 3, 6, 6); }
  else { g.roundRect(-r * 0.35, -r * 0.2, r * 0.7, r * 0.75, r * 0.15); for (let k = 0; k < 4; k++) g.roundRect(-r * 0.35 + k * r * 0.18, -r * 0.65, r * 0.14, r * 0.5, r * 0.07); g.roundRect(-r * 0.62, -r * 0.05, r * 0.3, r * 0.14, r * 0.07); }
  g.fill(); g.restore();
}

/** One hand-painted electoral sign on lime wash: symbol in a circle, call, party in big letters, candidate and list number; `erased` = Junta whitewash over part of it. */
function paint(g: CanvasRenderingContext2D, p: Party, erased: boolean, r: () => number): void {
  g.fillStyle = '#ebe6da';
  g.beginPath();
  for (let x = 0; x <= W; x += 16) g.lineTo(x, 10 + r() * 14);
  for (let x = W; x >= 0; x -= 16) g.lineTo(x, H - 10 - r() * 14);
  g.fill();
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${120 + r() * 60},${110 + r() * 50},${90 + r() * 40},${r() * 0.12})`; g.fillRect(r() * W, r() * H, 2 + r() * 14, 1 + r() * 6); }
  symbol(g, p.symbol, 150, 192, 118, p.accent);
  const text = (t: string, x: number, y: number, size: number, color: string, max: number) => {
    let s = size; do g.font = `900 ${s--}px "Barlow Condensed", Impact, Arial`; while (g.measureText(t).width > max && s > 20);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y);
  };
  text(p.call, 600, 70, 54, p.accent, 600);
  text(p.party, 600, 175, 150, p.ink, 620);
  text(p.name, 600, 290, 70, p.accent, 600);
  g.fillStyle = p.ink; g.fillRect(912, 120, 96, 150);
  text(p.num, 960, 197, 120, '#ebe6da', 86);
  for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(70,62,52,${0.1 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * W, r() * H, 2 + r() * 12, 1 + r() * 5, r() * 3, 0, 6.28); g.fill(); }
  g.fillStyle = 'rgba(80,60,40,0.18)';
  for (let k = 0; k < 14; k++) g.fillRect(r() * W, H * 0.5 + r() * H * 0.4, 3 + r() * 5, H);
  if (!erased) return;
  g.fillStyle = r() < 0.5 ? '#d9d4c8' : '#a9a7a2';
  g.beginPath(); const x0 = 200 + r() * 300;
  for (let y = 0; y <= H; y += 24) g.lineTo(x0 + r() * 60 + y * 0.3, y);
  for (let y = H; y >= 0; y -= 24) g.lineTo(W - r() * 40, y);
  g.fill();
}

/**
 * Old campaign paintings on blank side walls (a Lima street staple): fictional parties from `data/pintas.json`,
 * half of them roller-whitewashed by the Junta. One atlas, one merged mesh for the whole level.
 */
export function buildPintas(lighting: Lighting): THREE.Mesh | null {
  if (!spots.length) return null;
  const n = PARTIES.length * 2, cv = Object.assign(document.createElement('canvas'), { width: W * 2, height: H * PARTIES.length }), g = cv.getContext('2d')!, r = mulberry32(77);
  for (let i = 0; i < n; i++) { g.save(); g.translate((i % 2) * W, Math.floor(i / 2) * H); g.beginPath(); g.rect(0, 0, W, H); g.clip(); paint(g, PARTIES[Math.floor(i / 2)], i % 2 === 1, r); g.restore(); }
  const tex = Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), 'pintas');
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
  spots.forEach((s) => {
    const cell = Math.floor(r() * n), u0 = (cell % 2) / 2, v1 = 1 - Math.floor(cell / 2) / PARTIES.length, v0 = v1 - 1 / PARTIES.length, h = s.w * (H / W);
    const nz = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat), base = pos.length / 3;
    for (const [x, y, u, v] of [[-1, -1, u0, v0], [1, -1, u0 + 0.5, v0], [1, 1, u0 + 0.5, v1], [-1, 1, u0, v1]]) {
      const p = new THREE.Vector3((x * s.w) / 2, (y * h) / 2, 0).applyQuaternion(s.quat).add(s.pos);
      pos.push(p.x, p.y, p.z); uv.push(u, v); nrm.push(nz.x, nz.y, nz.z);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  spots.length = 0;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
