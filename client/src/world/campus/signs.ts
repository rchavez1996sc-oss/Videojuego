import * as THREE from 'three';
import type { Lighting } from '../../render/lighting';
import type { NameSign } from './pavilion';

const PX = 96;

/** Building lettering: one alpha-tested plane per sign, text (lines split on \n) drawn to fit its width. */
function lettering(s: NameSign, lighting: Lighting): THREE.Mesh {
  const lines = s.text.split('\n'), c = document.createElement('canvas'), g = c.getContext('2d')!;
  const font = (px: number) => `700 ${px}px "Times New Roman", Georgia, serif`;
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

/** San Marcos seal: gold ring with the university's name around a shield and the founding year. */
function crest(size: number, lighting: Lighting): THREE.Mesh {
  const N = 512, c = document.createElement('canvas'), g = c.getContext('2d')!;
  c.width = c.height = N;
  const gold = '#d9b45a', r = N / 2 - 6;
  g.fillStyle = '#efe9da';
  g.beginPath();
  g.arc(N / 2, N / 2, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = gold;
  for (const rr of [r - 6, r - 74]) {
    g.beginPath();
    g.arc(N / 2, N / 2, rr, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#6b1a14';
  g.font = '700 34px "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS · ';
  [...text].forEach((ch, i) => {
    const a = (i / text.length) * Math.PI * 2 - Math.PI / 2;
    g.save();
    g.translate(N / 2 + Math.cos(a) * (r - 40), N / 2 + Math.sin(a) * (r - 40));
    g.rotate(a + Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
  });
  const cx = N / 2, top = N / 2 - 120;
  g.fillStyle = '#7a1c16';
  g.beginPath();
  g.moveTo(cx - 90, top);
  g.lineTo(cx + 90, top);
  g.lineTo(cx + 90, top + 120);
  g.quadraticCurveTo(cx + 80, top + 200, cx, top + 230);
  g.quadraticCurveTo(cx - 80, top + 200, cx - 90, top + 120);
  g.closePath();
  g.fill();
  g.strokeStyle = gold;
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = gold;
  g.font = '700 54px "Times New Roman", serif';
  g.fillText('1551', cx, top + 90);
  g.fillRect(cx - 4, top + 120, 8, 80);
  g.fillRect(cx - 40, top + 140, 80, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.3, roughness: 0.4, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }), 'campus-crest');
  return new THREE.Mesh(new THREE.CircleGeometry(size / 2, 48), mat);
}

export function campusSigns(signs: NameSign[], seal: { pos: THREE.Vector3; q: THREE.Quaternion; size: number } | null, lighting: Lighting): THREE.Group {
  const g = new THREE.Group();
  for (const s of signs) g.add(lettering(s, lighting));
  if (seal) {
    const m = crest(seal.size, lighting);
    m.position.copy(seal.pos);
    m.quaternion.copy(seal.q);
    g.add(m);
  }
  return g;
}
