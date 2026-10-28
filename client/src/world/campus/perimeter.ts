import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Lighting } from '../../render/lighting';
import { pavilion } from './pavilion';
import { northAt, type CampusDef } from './layout';

type Design = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** Mural motifs drawn small, then laid as tesserae: Inti over the Andes, the open book of 1551, raised hands. */
const DESIGNS: Design[] = [
  (g, w, h) => {
    g.fillStyle = '#2f6fb0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2b632'; g.beginPath(); g.arc(w * 0.5, h * 0.42, h * 0.2, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.fillRect(w * 0.5 + Math.cos(a) * h * 0.28 - 1, h * 0.42 + Math.sin(a) * h * 0.28 - 1, 3, 3); }
    g.fillStyle = '#6b4a2e'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.22, h * 0.5); g.lineTo(w * 0.42, h * 0.8); g.lineTo(w * 0.62, h * 0.45); g.lineTo(w * 0.85, h * 0.75); g.lineTo(w, h * 0.55); g.lineTo(w, h); g.fill();
    g.fillStyle = '#b8322a'; g.fillRect(0, h * 0.88, w, h * 0.12);
    g.fillStyle = '#e9e4d6'; for (let x = 2; x < w; x += 10) g.fillRect(x, h * 0.91, 5, 2);
  },
  (g, w, h) => {
    g.fillStyle = '#7a1c16'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#efe6cf'; g.beginPath(); g.moveTo(w * 0.2, h * 0.25); g.lineTo(w * 0.5, h * 0.32); g.lineTo(w * 0.8, h * 0.25); g.lineTo(w * 0.8, h * 0.78); g.lineTo(w * 0.5, h * 0.85); g.lineTo(w * 0.2, h * 0.78); g.fill();
    g.fillStyle = '#2b2b2b'; g.fillRect(w * 0.495, h * 0.32, 2, h * 0.53);
    for (let y = 0.42; y < 0.75; y += 0.08) { g.fillRect(w * 0.26, h * y, w * 0.18, 1); g.fillRect(w * 0.56, h * y, w * 0.18, 1); }
    g.fillStyle = '#e0b84a'; g.font = `bold ${Math.round(h * 0.16)}px serif`; g.textAlign = 'center'; g.fillText('1551', w * 0.5, h * 0.18);
    g.fillStyle = '#3f7a34'; for (let i = 0; i < 7; i++) { g.fillRect(w * 0.08, h * (0.3 + i * 0.08), 4, 2); g.fillRect(w * 0.88, h * (0.3 + i * 0.08), 4, 2); }
  },
  (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#f0c040'); sky.addColorStop(1, '#d8602a'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const tones = ['#5a3a24', '#7a4e30', '#3d2a1c', '#8a5a36'];
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + i * 0.105), top = h * (0.25 + (i % 3) * 0.06);
      g.fillStyle = tones[i % 4];
      g.fillRect(x - 3, top, 6, h - top);
      g.beginPath(); g.arc(x, top - 4, 4, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 2, top - 14, 2, 14);
    }
    g.fillStyle = '#b8322a'; g.fillRect(0, h * 0.1, w, 4);
  },
];

function mosaic(design: Design): THREE.CanvasTexture {
  const W = 128, H = 48, T = 6, small = document.createElement('canvas');
  small.width = W; small.height = H;
  design(small.getContext('2d')!, W, H);
  const px = small.getContext('2d')!.getImageData(0, 0, W, H).data, c = document.createElement('canvas');
  c.width = W * T; c.height = H * T;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cfcac0';
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4, j = 0.88 + Math.random() * 0.2;
    g.fillStyle = `rgb(${px[k] * j},${px[k + 1] * j},${px[k + 2] * j})`;
    g.fillRect(x * T + 0.6, y * T + 0.6, T - 1.2, T - 1.2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Closes the sector's north and east edges (the Huaca side stays open): stretches of generic faculty backs, white
 * walls carrying mosaic murals, and railings on a low wall. `inward` is the unit vector into the campus.
 */
export function perimeter(b: Builder, def: CampusDef, rand: () => number, group: THREE.Group, lighting: Lighting): void {
  const B = def.bounds, side = def.venezuela.z - def.venezuela.half - def.venezuela.sidewalk - 0.5;
  const mats = DESIGNS.map((d) => lighting.setup(new THREE.MeshStandardMaterial({ map: mosaic(d), roughness: 0.35, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2 }), 'mosaic'));
  const V = (x: number, z: number) => new THREE.Vector2(x, z), edges: { a: THREE.Vector2; c: THREE.Vector2; inward: THREE.Vector2 }[] = [];
  const cuts = [...new Set([B.west, B.x, ...(B.bulges ?? []).flatMap((k) => [k.x0, k.x1])])].filter((x) => x >= B.west && x <= B.x).sort((p, q) => p - q);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const z = northAt(B, (cuts[i] + cuts[i + 1]) / 2), prev = i ? northAt(B, (cuts[i - 1] + cuts[i]) / 2) : z;
    if (prev !== z) edges.push(prev > z ? { a: V(cuts[i], prev), c: V(cuts[i], z), inward: V(1, 0) } : { a: V(cuts[i], prev), c: V(cuts[i], z), inward: V(-1, 0) });
    edges.push({ a: V(cuts[i], z), c: V(cuts[i + 1], z), inward: V(0, 1) });
  }
  const east = northAt(B, B.x - 0.1);
  edges.push({ a: V(B.x, east), c: V(B.x, side), inward: V(-1, 0) });
  let mural = 0;
  for (const e of edges) {
    const len = e.a.distanceTo(e.c), dir = e.c.clone().sub(e.a).normalize(), yaw = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dir.y, dir.x));
    const face = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(e.inward.x, e.inward.y));
    for (let s = 0; s < len - 0.5; ) {
      const l = Math.min(len - s, 24 + rand() * 18), mid = e.a.clone().addScaledVector(dir, s + l / 2), kind = rand();
      const at = (out: number, y: number) => new THREE.Vector3(mid.x - e.inward.x * out, y, mid.y - e.inward.y * out);
      if (kind < 0.4) {
        const d = 11 + rand() * 4, o = at(d / 2 + 0.2, 0);
        pavilion(b, { x: o.x, z: o.z, w: l + 0.4, d, yaw, floors: 2 + Math.floor(rand() * 2), style: 'single', skin: 'punched', color: ['grey', 'cream', 'white'][Math.floor(rand() * 3)] }, rand);
      } else if (kind < 0.7) {
        b.box('uniWhite', [l + 0.4, 3.2, 0.4], at(0, 1.6), q, true);
        b.box('uniRed', [l + 0.5, 0.25, 0.5], at(0, 3.3), q, false);
        for (let p = -l / 2 + 7; p <= l / 2 - 7; p += 14) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4), mats[mural++ % mats.length]);
          m.position.copy(at(0, 1.65)).add(new THREE.Vector3(dir.x * p, 0, dir.y * p)).add(new THREE.Vector3(e.inward.x * 0.21, 0, e.inward.y * 0.21));
          m.quaternion.copy(face);
          group.add(m);
        }
      } else {
        b.box('uniGrey', [l + 0.4, 0.6, 0.35], at(0, 0.3), q, false);
        b.box('fenceBars', [l, 2.0, 0.02], at(0, 1.6), q, false);
        for (const y of [0.7, 2.6]) b.box('fenceIron', [l, 0.06, 0.05], at(0, y), q, false);
        for (let p = -l / 2; p <= l / 2 + 0.01; p += l / Math.max(1, Math.round(l / 2.6))) b.box('fenceIron', [0.08, 2.1, 0.08], at(0, 1.65).add(new THREE.Vector3(dir.x * p, 0, dir.y * p)), q, false);
        b.box('grate', [l, 2.8, 0.4], at(0, 1.4), q, true);
      }
      s += l;
    }
  }
}
