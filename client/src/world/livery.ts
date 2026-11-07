import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

/**
 * Route companies out of Huaycán (fictional), painted like Lima's combis in the photos: white or cream body,
 * long stripes along the flank, the two termini in big italic letters, a yellow route-code plate. The last one is
 * the university bus (swoosh, serif name).
 */
const COMPANIES = [
  { base: '#ecebe6', bands: ['#c22a20', '#e8b51c', '#22489a'], ends: ['STA. ANITA', 'HUAYCÁN'], code: 'IO-47', name: 'E.T. SANTA ANITA S.A.', ink: '#b8231d' },
  { base: '#e9e2cc', bands: ['#1d7a3a', '#e7bd22', '#c22a20'], ends: ['LA MOLINA', 'ZONA R'], code: 'EO-101', name: 'ETSACASA', ink: '#1a5e2c' },
  { base: '#eeeeea', bands: ['#22489a', '#c22a20', '#22489a'], ends: ['ÑAÑA', 'CHOSICA'], code: 'CR-12', name: 'METRO', ink: '#22489a' },
  { base: '#e6e5df', bands: ['#2c5d9e', '#2c5d9e', '#f0f0ea'], ends: ['VITARTE', '15 DE JULIO'], code: 'SA-23', name: 'LOS ÁNGELES', ink: '#1f3f78', low: true },
  { base: '#a8231e', bands: ['#f0ece0', '#e8b51c', '#f0ece0'], ends: ['CENTRO', 'HUAYCÁN'], code: 'CL-54', name: 'NUEVA ESPERANZA', ink: '#f2efe4' },
  { base: '#e8e0c4', swoosh: ['#8a1c1c', '#c9a227'], route: 'UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS', ink: '#6a1a16' },
];
/** Body colour of a company's buses (the modelled combis and micros are painted with it). */
export function companyColor(company: number): string {
  return COMPANIES[company === UNMSM_BUS ? UNMSM_BUS : company % ROUTES].base;
}
/** Route companies (traffic, parked combis); the last livery is the university's own bus. */
const ROUTES = 5;
export const UNMSM_BUS = 5;
const PLACARDS = [['STA. ANITA', 'HUAYCÁN'], ['LA MOLINA', 'ZONA R'], ['ÑAÑA', 'CHOSICA'], ['VITARTE', '15 JULIO'], ['CENTRO', 'HUAYCÁN'], ['CIUDAD', 'UNMSM']];
const ROWS = COMPANIES.length + 1, N = PLACARDS.length;
const W = 512, H = 128;
let mat: THREE.Material | null = null;

function atlas(): THREE.CanvasTexture {
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H * ROWS }), g = cv.getContext('2d')!;
  COMPANIES.forEach((c, i) => {
    const y = i * H;
    g.fillStyle = c.base; g.fillRect(0, y, W, H);
    if (c.bands) {
      if (c.low) g.fillStyle = c.bands[0], g.fillRect(0, y + H * 0.5, W, H * 0.5);
      [[0.5, 0.16], [0.7, 0.07], [0.81, 0.05]].forEach(([t, h], k) => (g.fillStyle = c.bands![k], g.fillRect(0, y + H * t, W, H * h)));
      g.fillStyle = c.ink; g.font = 'italic 900 34px "Barlow Condensed", Arial'; g.textBaseline = 'middle';
      g.textAlign = 'left'; g.fillText(c.ends![0], 14, y + 30, W * 0.4);
      g.textAlign = 'right'; g.fillText(c.ends![1], W - 14, y + 30, W * 0.4);
      g.font = 'italic 700 15px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.fillText(c.name!, W / 2, y + 30);
      g.fillStyle = '#e9bd1f'; g.fillRect(W - 92, y + H - 30, 70, 22);
      g.fillStyle = '#121212'; g.font = '800 17px "Barlow Condensed", Arial'; g.fillText(c.code!, W - 57, y + H - 18);
    } else {
      for (const [k, col] of c.swoosh!.entries()) {
        g.fillStyle = col; g.beginPath();
        g.moveTo(0, y + H * (0.95 - k * 0.12));
        g.bezierCurveTo(W * 0.35, y + H * (0.95 - k * 0.12), W * 0.55, y + H * (0.35 - k * 0.12), W, y + H * (0.25 - k * 0.12));
        g.lineTo(W, y + H * (0.45 - k * 0.12)); g.bezierCurveTo(W * 0.6, y + H * (0.55 - k * 0.12), W * 0.4, y + H, 0, y + H);
        g.fill();
      }
      g.fillStyle = c.ink; g.font = '700 34px Georgia, serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(c.route!, 18, y + 40, W - 36);
    }
    g.fillStyle = 'rgba(30,24,20,0.22)';
    for (let k = 0; k < 50; k++) g.fillRect(Math.random() * W, y + H * 0.72 + Math.random() * H * 0.28, 2 + Math.random() * 18, 1 + Math.random() * 3);
  });
  PLACARDS.forEach(([t0, t1], i) => {
    const x = i * (W / N), y = H * (ROWS - 1), w = W / N - 8;
    g.fillStyle = '#f1ede2'; g.fillRect(x + 4, y + 26, w, 76);
    g.fillStyle = '#e9bd1f'; g.fillRect(x + 4, y + 26, w, 8);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 900 27px "Barlow Condensed", Arial';
    g.fillStyle = '#b8231d'; g.fillText(t0, x + 4 + w / 2, y + 52, w - 6);
    g.fillStyle = '#1f3f8a'; g.fillText(t1, x + 4 + w / 2, y + 82, w - 6);
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
export function combiLivery(lighting: Lighting, company: number, micro = false, fit?: Fit): THREE.Mesh {
  return new THREE.Mesh(liveryGeometry(company, fit ?? (micro ? MICRO : COMBI)), liveryMaterial(lighting));
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

export interface Fit { len: number; half: number; y: number; h: number; card: [number, number, number] }
const COMBI: Fit = { len: 4.2, half: 0.912, y: 0.93, h: 0.52, card: [0.35, 1.32, 2.12] };
const MICRO: Fit = { len: 7.6, half: 1.162, y: 1.1, h: 0.6, card: [0.5, 1.55, 4.1] };

function liveryGeometry(company: number, fit: Fit = COMBI): THREE.BufferGeometry {
  const k = company === UNMSM_BUS ? UNMSM_BUS : company % ROUTES, v1 = 1 - k / ROWS, v0 = v1 - 1 / ROWS, half = fit.half;
  const rot = (a: number, x: number, y: number, z: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1));
  const right = quad(fit.len, fit.h, 0, v0, 1, v1, rot(Math.PI / 2, half, fit.y, -0.1));
  const left = quad(fit.len, fit.h, 0, v0, 1, v1, rot(-Math.PI / 2, -half, fit.y, -0.1));
  const p = k, pv1 = (1 / ROWS) * 0.85, pv0 = (1 / ROWS) * 0.2;
  const card = quad(0.62, 0.36, p / N, pv0, (p + 1) / N, pv1, rot(0, ...fit.card));
  return mergeGeometries([right, left, card])!;
}
