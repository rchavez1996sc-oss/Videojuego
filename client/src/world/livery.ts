import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

/** Bus-company liveries seen on Lima Norte routes (fictional companies): base, swoosh, letter, route. */
const COMPANIES = [
  { base: '#b8231d', swoosh: ['#1f4fa8', '#f2f2ee'], letter: 'T', route: 'COLLIQUE · TÚPAC AMARU · CENTRO', ink: '#f2f2ee' },
  { base: '#efe9da', swoosh: ['#1c7a3a', '#e3b51c'], letter: 'R', route: 'COMAS · PANAMERICANA · NARANJAL', ink: '#1c3a20' },
  { base: '#e7b81e', swoosh: ['#1d1d1f', '#c62a20'], letter: 'E', route: 'PUENTE PIEDRA · ZAPALLAL · BELAÚNDE', ink: '#1d1d1f' },
  { base: '#2b5fa8', swoosh: ['#f2f2ee', '#d23a2a'], letter: 'S', route: 'SAN FELIPE · CARABAYLLO · UNI', ink: '#f2f2ee' },
  { base: '#e8e0c4', swoosh: ['#8a1c1c', '#c9a227'], letter: '', route: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#6a1a16' },
];
/** Route companies (traffic, parked combis); the last livery is the university's own bus. */
const ROUTES = 4;
export const UNMSM_BUS = 4;
const PLACARDS = ['SAN FELIPE', 'COLLIQUE', 'NARANJAL', 'UNI', 'UNMSM'];
const ROWS = COMPANIES.length + 1, N = PLACARDS.length;
const W = 512, H = 128;
let mat: THREE.Material | null = null;

function atlas(): THREE.CanvasTexture {
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H * ROWS }), g = cv.getContext('2d')!;
  COMPANIES.forEach((c, i) => {
    const y = i * H;
    g.fillStyle = c.base; g.fillRect(0, y, W, H);
    for (const [k, col] of c.swoosh.entries()) {
      g.fillStyle = col; g.beginPath();
      g.moveTo(0, y + H * (0.95 - k * 0.12));
      g.bezierCurveTo(W * 0.35, y + H * (0.95 - k * 0.12), W * 0.55, y + H * (0.35 - k * 0.12), W, y + H * (0.25 - k * 0.12));
      g.lineTo(W, y + H * (0.45 - k * 0.12)); g.bezierCurveTo(W * 0.6, y + H * (0.55 - k * 0.12), W * 0.4, y + H, 0, y + H);
      g.fill();
    }
    if (c.letter) g.fillStyle = '#f2f2ee', g.beginPath(), g.arc(W - 62, y + 46, 34, 0, 6.28), g.fill();
    g.fillStyle = c.base; g.font = '900 52px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.letter, W - 62, y + 48);
    g.fillStyle = c.ink; g.font = c.letter ? '700 22px "Barlow Condensed", Arial' : '700 34px Georgia, serif'; g.textAlign = 'left'; g.fillText(c.route, 18, y + (c.letter ? 26 : 40), W - 36);
    g.fillStyle = 'rgba(30,24,20,0.25)';
    for (let k = 0; k < 40; k++) g.fillRect(Math.random() * W, y + H * 0.7 + Math.random() * H * 0.3, 2 + Math.random() * 18, 1 + Math.random() * 3);
  });
  PLACARDS.forEach((t, i) => {
    const x = i * (W / N), y = H * (ROWS - 1);
    g.fillStyle = '#ece6d4'; g.fillRect(x + 4, y + 30, W / N - 8, 68);
    g.fillStyle = i % 2 ? '#1f3f8a' : '#b8231d'; g.font = '900 30px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, x + W / N / 2, y + 64, W / N - 16);
  });
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
}

function quad(w: number, h: number, u0: number, v0: number, u1: number, v1: number, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  return g.applyMatrix4(m);
}

/**
 * Company livery on a combi's flanks (readable from both sides) and a cardboard route
 * placard behind the windscreen; one merged mesh per vehicle. Body is 1.8 × 4.8 m, front along +z.
 */
export function combiLivery(lighting: Lighting, company: number, micro = false): THREE.Mesh {
  return new THREE.Mesh(liveryGeometry(company, micro ? MICRO : COMBI), liveryMaterial(lighting));
}

/** All parked combis' liveries merged into one mesh (static: one draw for the whole level). */
export function parkedLiveries(lighting: Lighting, spots: { pos: THREE.Vector3; yaw: number; company?: number; micro?: boolean }[]): THREE.Mesh | null {
  if (!spots.length) return null;
  const geos = spots.map((s, i) => liveryGeometry(s.company ?? i + 1, s.micro ? MICRO : COMBI).applyMatrix4(new THREE.Matrix4().compose(s.pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw), new THREE.Vector3(1, 1, 1))));
  return new THREE.Mesh(mergeGeometries(geos)!, liveryMaterial(lighting));
}

function liveryMaterial(lighting: Lighting): THREE.Material {
  return (mat ??= lighting.setup(new THREE.MeshStandardMaterial({ map: atlas(), roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }), 'livery'));
}

interface Fit { len: number; half: number; y: number; h: number; card: [number, number, number] }
const COMBI: Fit = { len: 4.2, half: 0.912, y: 0.93, h: 0.52, card: [0.35, 1.32, 2.12] };
const MICRO: Fit = { len: 7.6, half: 1.162, y: 1.1, h: 0.6, card: [0.5, 1.55, 4.1] };

function liveryGeometry(company: number, fit: Fit = COMBI): THREE.BufferGeometry {
  const k = company === UNMSM_BUS ? UNMSM_BUS : company % ROUTES, v1 = 1 - k / ROWS, v0 = v1 - 1 / ROWS, half = fit.half;
  const rot = (a: number, x: number, y: number, z: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1));
  const right = quad(fit.len, fit.h, 0, v0, 1, v1, rot(Math.PI / 2, half, fit.y, -0.1));
  const left = quad(fit.len, fit.h, 0, v0, 1, v1, rot(-Math.PI / 2, -half, fit.y, -0.1));
  const p = k, pv1 = (1 / ROWS) * 0.85, pv0 = (1 / ROWS) * 0.2;
  const card = quad(0.6, 0.27, p / N, pv0, (p + 1) / N, pv1, rot(0, ...fit.card));
  return mergeGeometries([right, left, card])!;
}
