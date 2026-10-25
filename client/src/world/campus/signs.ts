import * as THREE from 'three';
import type { Lighting } from '../../render/lighting';
import type { NameSign } from './pavilion';

const PX = 96;

/** Building lettering: one alpha-tested plane per sign, text (lines split on \n) drawn to fit its width. */
function lettering(s: NameSign, lighting: Lighting): THREE.Mesh {
  const lines = s.text.split('\n'), c = document.createElement('canvas'), g = c.getContext('2d')!;
  const font = (px: number) => (s.font === 'sans' ? `700 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif` : `700 ${px}px "Times New Roman", Georgia, serif`);
  g.font = font(PX);
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  c.width = Math.ceil(widest + PX * 0.6);
  c.height = Math.ceil(PX * 1.25 * lines.length + PX * 0.3);
  if (s.plate) {
    g.fillStyle = s.plate;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.font = font(PX);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowOffsetY = PX * 0.04;
  g.fillStyle = s.ink;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, PX * 0.15 + PX * 1.25 * (i + 0.5)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const h = (s.w * c.height) / c.width;
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: t, transparent: !s.plate, alphaTest: 0.25, roughness: 0.45, metalness: s.ink.startsWith('#e') ? 0.5 : 0, polygonOffset: true, polygonOffsetFactor: -2 }), 'campus-sign');
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, h), mat);
  mesh.position.copy(s.pos);
  mesh.quaternion.copy(s.q);
  return mesh;
}

/** San Marcos coat of arms: baroque gold frame round an oval; left the evangelist in red with his book and lion, right a tower over the sea. */
function crest(size: number, lighting: Lighting, silver = false): THREE.Mesh {
  const N = 512, c = document.createElement('canvas'), g = c.getContext('2d')!, cx = N / 2, cy = N / 2;
  c.width = c.height = N;
  const gold = g.createRadialGradient(cx - 60, cy - 80, 20, cx, cy, 260);
  gold.addColorStop(0, '#fbe6a0'); gold.addColorStop(0.6, '#d6a940'); gold.addColorStop(1, '#8a6420');
  g.fillStyle = gold;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, rx = 205, ry = 235;
    g.beginPath(); g.ellipse(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 34, 30, a, 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.ellipse(cx, cy, 214, 244, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a5418'; g.lineWidth = 5;
  g.beginPath(); g.ellipse(cx, cy, 168, 198, 0, 0, Math.PI * 2); g.stroke();
  g.save();
  g.beginPath(); g.ellipse(cx, cy, 165, 195, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#efe6cf'; g.fillRect(0, 0, cx, N);
  const sky = g.createLinearGradient(0, cy - 200, 0, cy + 100); sky.addColorStop(0, '#5f9fd8'); sky.addColorStop(1, '#a8cdec');
  g.fillStyle = sky; g.fillRect(cx, 0, cx, N);
  g.fillStyle = '#23201d';
  g.fillRect(cx + 50, cy - 40, 60, 120);
  for (let k = 0; k < 4; k++) g.fillRect(cx + 48 + k * 18, cy - 60, 11, 22);
  g.fillStyle = '#1d4f8f'; g.fillRect(cx, cy + 70, cx, 200);
  g.strokeStyle = '#e8f2fb'; g.lineWidth = 6;
  for (let y = cy + 90; y < cy + 200; y += 26) { g.beginPath(); for (let x = cx; x < N; x += 4) g.lineTo(x, y + Math.sin(x * 0.08) * 6); g.stroke(); }
  g.fillStyle = '#b42a20'; g.beginPath(); g.ellipse(cx - 70, cy + 40, 52, 105, 0.05, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e2b48c'; g.beginPath(); g.arc(cx - 68, cy - 80, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4a3020'; g.beginPath(); g.arc(cx - 68, cy - 92, 24, Math.PI, 0); g.fill();
  g.fillStyle = '#f7f3e8'; g.fillRect(cx - 38, cy - 10, 44, 30);
  g.fillStyle = '#d9822e'; g.beginPath(); g.ellipse(cx - 70, cy + 150, 60, 26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5a2e14'; g.font = '700 30px "Times New Roman", serif'; g.textAlign = 'center'; g.fillText('S.M', cx - 95, cy - 140);
  g.restore();
  g.strokeStyle = '#c99a32'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx, cy - 195); g.lineTo(cx, cy + 195); g.stroke();
  if (silver) {
    const img = g.getImageData(0, 0, N, N), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.min(255, (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * 1.15 + 30);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.3, roughness: 0.4, metalness: silver ? 0.75 : 0.25, polygonOffset: true, polygonOffsetFactor: -2 }), 'campus-crest');
  return new THREE.Mesh(new THREE.PlaneGeometry(size * 0.88, size), mat);
}

type Seal = { pos: THREE.Vector3; q: THREE.Quaternion; size: number; silver?: boolean };
export function campusSigns(signs: NameSign[], seals: Seal[], lighting: Lighting): THREE.Group {
  const g = new THREE.Group();
  for (const s of signs) g.add(lettering(s, lighting));
  for (const seal of seals) {
    const m = crest(seal.size, lighting, seal.silver);
    m.position.copy(seal.pos);
    m.quaternion.copy(seal.q);
    g.add(m);
  }
  return g;
}
