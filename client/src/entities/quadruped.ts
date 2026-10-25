import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

/** One spine station: z along the body, centre height, half width, half height. */
type Station = [number, number, number, number];

/** Mongrel street dog (Lima "chusco"): deep chest, tucked waist, neck rising to a wedge head with a tapering muzzle. */
const DOG: Station[] = [
  [-0.36, 0.52, 0.07, 0.08], [-0.3, 0.53, 0.12, 0.12], [-0.2, 0.54, 0.13, 0.13], [-0.08, 0.55, 0.115, 0.105], [0.04, 0.53, 0.13, 0.14],
  [0.15, 0.5, 0.14, 0.175], [0.25, 0.51, 0.12, 0.15], [0.31, 0.6, 0.085, 0.095], [0.36, 0.69, 0.07, 0.075], [0.41, 0.75, 0.078, 0.08],
  [0.47, 0.765, 0.08, 0.072], [0.53, 0.75, 0.058, 0.055], [0.59, 0.73, 0.044, 0.04], [0.635, 0.722, 0.03, 0.028], [0.655, 0.72, 0.012, 0.012],
];
/** Street cat: slender, level back, short neck, round head, tiny muzzle. */
const CAT: Station[] = [
  [-0.24, 0.27, 0.05, 0.05], [-0.2, 0.28, 0.075, 0.075], [-0.1, 0.285, 0.08, 0.075], [0.02, 0.28, 0.075, 0.075], [0.12, 0.27, 0.075, 0.085],
  [0.18, 0.28, 0.065, 0.075], [0.22, 0.33, 0.05, 0.055], [0.26, 0.37, 0.06, 0.06], [0.3, 0.38, 0.065, 0.06], [0.34, 0.37, 0.05, 0.045],
  [0.365, 0.36, 0.03, 0.028], [0.378, 0.358, 0.01, 0.01],
];

export type Kind = 'dog' | 'cat';
export interface Leg { upper: THREE.Object3D; lower: THREE.Object3D; front: boolean }
export interface Beast { root: THREE.Group; body: THREE.Object3D; legs: Leg[]; tail: THREE.Object3D; kind: Kind }

/** Smooth elliptical loft through stations (Catmull-Rom between them), u around, v along; poles closed. */
function loft(st: Station[], rings: number, seg = 22, shade?: (a: number, t: number) => number): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(st.map(([z, y]) => new THREE.Vector3(0, y, z)));
  const rx = new THREE.CatmullRomCurve3(st.map(([, , w, h], i) => new THREE.Vector3(w, h, i)));
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings, p = path.getPoint(t), T = path.getTangent(t), N = new THREE.Vector3(0, T.z, -T.y).normalize(), R = rx.getPoint(t);
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      pos.push(p.x + c * R.x, p.y + N.y * sn * R.y, p.z + N.z * sn * R.y);
      uv.push(s / seg, t * 4);
      const k = shade ? shade(sn, t) : 1;
      col.push(k, k, k);
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute, v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let r = 0; r <= rings; r++) {
    const a = r * (seg + 1), b = a + seg;
    v.fromBufferAttribute(n, a).add(w.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

/** Leg segments for a 0.5 m dog (scaled for cats): stations relative to each joint, joint offsets, paw position. */
const HIND = { upper: [[0, 0.07, 0.03, 0.05], [0, 0.0, 0.055, 0.09], [0.04, -0.1, 0.055, 0.08], [0.07, -0.2, 0.035, 0.045], [0.072, -0.215, 0.02, 0.02]] as Station[], knee: [0.07, -0.2],
  lower: [[0, 0.01, 0.03, 0.04], [-0.05, -0.08, 0.026, 0.032], [-0.1, -0.16, 0.022, 0.026], [-0.1, -0.2, 0.02, 0.022], [-0.095, -0.29, 0.018, 0.02], [-0.094, -0.3, 0.01, 0.01]] as Station[], paw: [-0.08, -0.305] };
const FORE = { upper: [[0, 0.07, 0.03, 0.05], [0, 0.0, 0.045, 0.07], [-0.03, -0.1, 0.045, 0.06], [-0.04, -0.19, 0.032, 0.038], [-0.04, -0.2, 0.02, 0.02]] as Station[], knee: [-0.04, -0.19],
  lower: [[0, 0.01, 0.03, 0.034], [0.005, -0.12, 0.024, 0.026], [0.01, -0.22, 0.02, 0.022], [0.025, -0.27, 0.019, 0.02], [0.028, -0.28, 0.01, 0.01]] as Station[], paw: [0.045, -0.29] };
const scaled = (st: Station[], k: number): Station[] => st.map(([z, y, w, h]) => [z * k, y * k, w * k, h * k]);

function tint(g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const a = g.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b);
  return g;
}

/** Short directional fur: streaks along the body with fine grain, used as colour and bump. */
function furTexture(): THREE.CanvasTexture {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S, y = Math.random() * S, l = 4 + Math.random() * 10, v = 150 + Math.random() * 105;
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.globalAlpha = 0.35;
    g.lineWidth = 0.6 + Math.random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 2, y + l);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let shared: { fur: THREE.Material; eye: THREE.Material } | null = null;
function materials(lighting: Lighting): { fur: THREE.Material; eye: THREE.Material } {
  if (shared) return shared;
  const tex = furTexture();
  const fur = lighting.setup(new THREE.MeshPhysicalMaterial({ map: tex, bumpMap: tex, bumpScale: 1.5, vertexColors: true, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color('#a89a88') }), 'fur');
  const eye = lighting.setup(new THREE.MeshStandardMaterial({ color: '#120d0a', roughness: 0.12, metalness: 0.1 }), 'animal-eye');
  return (shared = { fur, eye });
}

/** Builds a dog or cat: one smooth body+head mesh, ears, eyes and nose, articulated legs and a tail. Faces +z. */
export function makeBeast(kind: Kind, coat: string, belly: string, lighting: Lighting, rand: () => number): Beast {
  const { fur, eye } = materials(lighting), cat = kind === 'cat', st = cat ? CAT : DOG, c = new THREE.Color(coat), b = new THREE.Color(belly);
  const s = (cat ? 0.9 : 0.85) + rand() * 0.3, root = new THREE.Group(), body = new THREE.Group();
  root.scale.setScalar(s);
  root.add(body);
  const shade = (sn: number, t: number) => (sn < -0.35 ? -1 : sn > 0.6 ? 0.82 : 1) * (cat ? 1 : 1 - Math.max(0, t - 0.85) * 1.6);
  const torso = loft(st, 64, 26, shade);
  const col = torso.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) {
    const k = col.getX(i), m = k < 0 ? b : c, v = Math.abs(k);
    col.setXYZ(i, m.r * v, m.g * v, m.b * v);
  }
  const head = st[st.length - (cat ? 4 : 6)], tip = st[st.length - 1];
  const parts = [torso];
  for (const side of [-1, 1]) {
    const ear = new THREE.ConeGeometry(cat ? 0.03 : 0.035, cat ? 0.055 : 0.08, 14, 1).scale(1, 1, 0.3);
    const floppy = !cat && rand() < 0.45;
    ear.rotateZ(side * (floppy ? 2.3 : 0.35)).rotateX(floppy ? 0 : -0.25);
    ear.translate(side * head[2] * 0.75, head[1] + head[3] * (floppy ? 0.6 : 0.95), head[0] - 0.01);
    parts.push(tint(withColor(ear), c.clone().multiplyScalar(0.8)));
  }
  body.add(Object.assign(new THREE.Mesh(mergeGeometries(parts), fur), { castShadow: true }));
  const eyeZ = cat ? head[0] + 0.035 : head[0] + 0.055;
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(cat ? 0.011 : 0.012, 10, 8), eye);
    e.position.set(side * (cat ? 0.033 : 0.042), head[1] + (cat ? 0.012 : 0.02), eyeZ);
    body.add(e);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(cat ? 0.008 : 0.02, 12, 10).scale(1.2, 0.8, 0.9), eye);
  nose.position.set(0, tip[1] + (cat ? 0.004 : 0.01), tip[0] - 0.005);
  body.add(nose);

  const k = cat ? 0.54 : 1, legs: Leg[] = [], hip = st[1], chest = st[cat ? 4 : 5];
  const legShade = () => 1;
  for (const front of [true, false]) for (const side of [-1, 1]) {
    const d = front ? FORE : HIND, at = front ? chest : hip, upper = new THREE.Group(), lower = new THREE.Group();
    upper.position.set(side * at[2] * 0.45, at[1], at[0] + (front ? 0.05 : 0.02) * k);
    upper.add(Object.assign(new THREE.Mesh(tint(loft(scaled(d.upper, k), 14, 16, legShade), c), fur), { castShadow: true }));
    lower.position.set(0, d.knee[1] * k, d.knee[0] * k);
    const paw = tint(withColor(new THREE.SphereGeometry(0.033 * k, 14, 10).scale(0.9, 0.65, 1.3).translate(0, d.paw[1] * k, d.paw[0] * k)), b.clone().lerp(c, 0.5));
    lower.add(Object.assign(new THREE.Mesh(mergeGeometries([tint(loft(scaled(d.lower, k), 16, 14, legShade), c), paw]), fur), { castShadow: true }));
    upper.add(lower);
    body.add(upper);
    legs.push({ upper, lower, front });
  }
  const tail = new THREE.Group(), base = st[0];
  tail.position.set(0, base[1], base[0] + 0.02);
  const tl = cat ? 0.26 : 0.24 + rand() * 0.1;
  const curve: Station[] = cat
    ? [[0, 0, 0.022, 0.022], [-0.08, -0.05, 0.02, 0.02], [-0.14, -0.04, 0.018, 0.018], [-0.2, 0.06, 0.016, 0.016], [-0.22, tl * 0.6, 0.012, 0.012], [-0.215, tl * 0.65, 0.004, 0.004]]
    : [[0, 0, 0.035, 0.035], [-tl * 0.35, 0.06, 0.03, 0.03], [-tl * 0.7, 0.08, 0.022, 0.022], [-tl, 0.05, 0.012, 0.012], [-tl * 1.05, 0.04, 0.003, 0.003]];
  tail.add(Object.assign(new THREE.Mesh(tint(loft(curve, 16, 12), c), fur), { castShadow: true }));
  body.add(tail);
  return { root, body, legs, tail, kind };
}

function withColor(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}

/** Gait: legs swing in diagonal pairs, knees fold on the recovery, body bobs; the tail wags. */
export function animateBeast(b: Beast, phase: number, speed: number, wag: number): void {
  const swing = Math.min(1, speed / 2) * (speed > 3 ? 0.75 : 0.5);
  b.legs.forEach((l, i) => {
    const p = phase + (i === 0 || i === 3 ? 0 : Math.PI) + (l.front ? 0 : 0.4);
    l.upper.rotation.x = -Math.sin(p) * swing;
    l.lower.rotation.x = Math.max(0, Math.cos(p)) * swing * (l.front ? 1.1 : -0.9);
  });
  b.body.position.y = Math.abs(Math.sin(phase)) * 0.012 * Math.min(1, speed / 2);
  b.tail.rotation.y = Math.sin(wag) * (b.kind === 'cat' ? 0.15 : 0.45);
  b.tail.rotation.x = b.kind === 'cat' ? 0 : -0.15;
}
