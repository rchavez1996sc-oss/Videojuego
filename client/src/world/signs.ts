import * as THREE from 'three';
import { signTexture } from '../render/urbanTextures';

export type SignKind = 'shop' | 'graffiti' | 'poster' | 'hill';

interface SignDef { text: string; kind: SignKind; bg: string | null; fg: string; sub?: string; accent?: string }

const SIGNS: SignDef[] = [
  { text: 'BODEGA DON LUCHO', kind: 'shop', bg: '#f2f0e6', fg: '#1f4d8f' },
  { text: 'LIBRERÍA EL ESTUDIANTE', kind: 'shop', bg: '#f5d24a', fg: '#1c1c1c' },
  { text: 'FERRETERÍA', kind: 'shop', bg: '#c3362b', fg: '#ffffff' },
  { text: 'POLLERÍA', kind: 'shop', bg: '#e8b13a', fg: '#7a1f12' },
  { text: 'CABINAS INTERNET', kind: 'shop', bg: '#2f6ea8', fg: '#ffffff' },
  { text: 'TAPICERÍA', kind: 'shop', bg: '#e6e1d3', fg: '#2b2b2b' },
  { text: 'MENÚ S/ 8', kind: 'shop', bg: '#ffffff', fg: '#b8261b' },
  { text: 'VULCANIZADORA', kind: 'shop', bg: '#202020', fg: '#f2c230' },
  { text: 'ABARROTES', kind: 'shop', bg: '#d7e3c7', fg: '#2f5c25' },
  { text: 'SE ALQUILA CUARTO', kind: 'graffiti', bg: null, fg: '#1c1c1c' },
  { text: 'LA SIERRA NO SE VENDE', kind: 'graffiti', bg: null, fg: '#a3241c' },
  { text: 'FUERA LA JUNTA', kind: 'graffiti', bg: null, fg: '#16161a' },
  { text: 'AGUA PARA TODOS', kind: 'graffiti', bg: null, fg: '#1e4f9c' },
  { text: 'FLS VIVE', kind: 'graffiti', bg: null, fg: '#a3241c' },
  { text: 'NI JUNTA NI MINERA', kind: 'graffiti', bg: null, fg: '#16161a' },
  { text: 'VOTA LISTA 7 ✓', kind: 'graffiti', bg: '#f4f1ea', fg: '#c22f22' },
  { text: 'UNIDOS POR EL CONO', kind: 'graffiti', bg: '#f4f1ea', fg: '#1f6b3a' },
  { text: 'ORDEN Y PROGRESO', kind: 'poster', bg: '#14284d', fg: '#ffffff', sub: 'GRAL. A. CASTAÑEDA · JUNTA DE GOBIERNO', accent: '#c8102e' },
  { text: 'LA GNO TE PROTEGE', kind: 'poster', bg: '#1f2a33', fg: '#f2d03b', sub: 'DENUNCIA LA SUBVERSIÓN · LLAMA AL 105', accent: '#f2d03b' },
  { text: 'FERRUM ANDES', kind: 'poster', bg: '#e9e6df', fg: '#2a3f55', sub: 'MINERÍA RESPONSABLE PARA EL PERÚ', accent: '#d47a1c' },
  { text: '¡NO A LA MINA!', kind: 'poster', bg: '#c8102e', fg: '#ffffff', sub: 'FRENTE DE DEFENSA DE LA SIERRA', accent: '#111111' },
  { text: 'MOVIMIENTO ORDEN NACIONAL', kind: 'poster', bg: '#f0f0f0', fg: '#0e3d8c', sub: 'LISTA 7 · MANO DURA', accent: '#0e3d8c' },
  { text: 'TOQUE DE QUEDA 20:00', kind: 'poster', bg: '#111111', fg: '#ffffff', sub: 'POR ORDEN DE LA JUNTA DE GOBIERNO', accent: '#c8102e' },
  { text: 'NUEVA ESPERANZA', kind: 'hill', bg: null, fg: '#f4f2ec' },
  { text: 'PATRIA LIBRE', kind: 'hill', bg: null, fg: '#f4f2ec' },
];

function poster(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = d.bg!;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = d.accent!;
  ctx.fillRect(0, h * 0.84, w, h * 0.16);
  ctx.beginPath();
  ctx.arc(h * 0.45, h * 0.42, h * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.bg!;
  ctx.font = `bold ${Math.floor(h * 0.32)}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', h * 0.45, h * 0.44);
  ctx.fillStyle = d.fg;
  ctx.textAlign = 'left';
  ctx.font = `bold ${Math.floor(h * 0.38)}px "Arial Black", Impact, sans-serif`;
  ctx.fillText(d.text, h * 0.9, h * 0.4, w - h * 1.0);
  ctx.font = `bold ${Math.floor(h * 0.12)}px Arial, sans-serif`;
  ctx.fillStyle = d.bg === '#e9e6df' || d.bg === '#f0f0f0' ? '#ffffff' : d.fg;
  ctx.fillText(d.sub ?? '', h * 0.9, h * 0.92, w - h * 1.0);
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 20, 1 + Math.random() * 6);
  }
  return c;
}

/** One 4:1-cell atlas for every sign, mural and poster so they merge into a single draw call. */
export class SignAtlas {
  readonly texture: THREE.CanvasTexture;
  private geos: THREE.BufferGeometry[] = [];
  private static ROWS = 16;

  constructor() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 2048;
    const ctx = c.getContext('2d')!;
    SIGNS.forEach((d, i) => {
      const img = d.kind === 'poster' ? poster(d, 512, 128) : signTexture(d.text, d.bg, d.fg, 512, 128);
      ctx.drawImage(img, (i % 2) * 512, Math.floor(i / 2) * 128);
    });
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  add(pos: THREE.Vector3, q: THREE.Quaternion, w: number, kind: SignKind, rand: () => number): void {
    const pool = SIGNS.map((s, i) => [s, i] as const).filter(([s]) => s.kind === kind);
    const [, i] = pool[Math.floor(rand() * pool.length)];
    const g = new THREE.PlaneGeometry(w, w / 4);
    const u0 = (i % 2) * 0.5, v0 = 1 - (Math.floor(i / 2) + 1) / SignAtlas.ROWS;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) / SignAtlas.ROWS);
    g.applyMatrix4(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
    this.geos.push(g);
  }

  get geometries(): THREE.BufferGeometry[] {
    return this.geos;
  }
}
