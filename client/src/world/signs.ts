import * as THREE from 'three';
import { signTexture } from '../render/urbanTextures';

export type SignKind = 'shop' | 'graffiti' | 'poster' | 'hill' | 'concert' | 'emblem' | 'red' | 'station' | 'stencil' | 'flag';

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
  { text: 'LOS GENIALES DEL CONO', kind: 'concert', bg: '#ff2d8a', fg: '#111111', sub: 'SÁB 14 · CAMPO FERIAL', accent: '#fff200' },
  { text: 'FUEGO ANDINO', kind: 'concert', bg: '#fff200', fg: '#d0021b', sub: 'DOM 15 · LOCAL LA CHOZA', accent: '#00d65a' },
  { text: 'LA SONORA DEL CERRO', kind: 'concert', bg: '#00e05a', fg: '#111111', sub: 'VIE 20 · ENTRADA S/ 15', accent: '#ff7a00' },
  { text: 'DINASTÍA DEL SUR', kind: 'concert', bg: '#ff7a00', fg: '#111111', sub: 'SÁB 21 · CHOLO PARTY', accent: '#ff2d8a' },
  { text: '', kind: 'emblem', bg: null, fg: '#f4f2ec' },
  { text: 'COMISARÍA SECTORIAL', kind: 'station', bg: '#1f3d2c', fg: '#f2f0e6' },
  { text: '', kind: 'stencil', bg: null, fg: '#a3161b' },
  { text: '', kind: 'flag', bg: '#b3121b', fg: '#f2c230' },
  { text: '¡VIVA LA CLASE OBRERA!', kind: 'red', bg: '#b3121b', fg: '#ffffff', sub: 'SINDICATO UNIFICADO DE TRABAJADORES DEL CONO', accent: '#f2c230' },
  { text: '1° DE MAYO', kind: 'red', bg: '#c8102e', fg: '#f2c230', sub: 'TODOS A LA PLAZA · MARCHA OBRERA', accent: '#111111' },
  { text: 'PAN Y TRABAJO', kind: 'red', bg: '#a50f19', fg: '#ffffff', sub: 'FEDERACIÓN DE CONSTRUCCIÓN CIVIL', accent: '#ffffff' },
  { text: '¡HUELGA GENERAL!', kind: 'red', bg: '#d0141f', fg: '#ffffff', sub: 'NI UN SOL MÁS PARA LA JUNTA', accent: '#111111' },
  { text: 'EL CONO SE ORGANIZA', kind: 'poster', bg: '#b3121b', fg: '#ffffff', sub: 'ASAMBLEA POPULAR · SÁBADO 6 PM', accent: '#f2c230' },
  { text: 'SALARIO DIGNO YA', kind: 'poster', bg: '#c8102e', fg: '#ffffff', sub: 'CENTRAL OBRERA DEL PERÚ', accent: '#111111' },
];

/** A row of four identical fluorescent concert bills, Lima "chicha" style. */
function concert(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const pw = w / 4;
  for (let k = 0; k < 4; k++) {
    const x0 = k * pw + 2;
    ctx.fillStyle = d.bg!;
    ctx.fillRect(x0, 2 + (k % 2), pw - 4, h - 4);
    ctx.fillStyle = d.accent!;
    ctx.fillRect(x0, h * 0.68, pw - 4, h * 0.24);
    ctx.fillStyle = d.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = d.text.split(' ');
    const half = Math.ceil(words.length / 2);
    ctx.font = `bold ${Math.floor(h * 0.24)}px Impact, "Arial Black", sans-serif`;
    ctx.fillText(words.slice(0, half).join(' '), x0 + pw / 2, h * 0.3, pw - 12);
    ctx.fillText(words.slice(half).join(' '), x0 + pw / 2, h * 0.52, pw - 12);
    ctx.font = `bold ${Math.floor(h * 0.1)}px Arial, sans-serif`;
    ctx.fillText(d.sub ?? '', x0 + pw / 2, h * 0.8, pw - 10);
    ctx.fillText('★ EN CONCIERTO ★', x0 + pw / 2, h * 0.1, pw - 10);
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 18, 1 + Math.random() * 5);
  }
  return c;
}

/** Red cloth square (centre of a 4:1 cell) carrying a yellow hammer and sickle. */
function flag(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = emblem(d, w, h), ctx = c.getContext('2d')!;
  const sym = document.createElement('canvas');
  sym.width = w;
  sym.height = h;
  sym.getContext('2d')!.drawImage(c, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = d.bg!;
  ctx.fillRect(w / 2 - h / 2, 0, h, h);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    ctx.fillRect(w / 2 - h / 2, Math.random() * h, h, 2 + Math.random() * 4);
  }
  ctx.drawImage(sym, w / 2 - h / 2, 0, h, h, w / 2 - h * 0.35, h * 0.15, h * 0.7, h * 0.7);
  return c;
}

/** Whitewashed hammer and sickle painted on a hillside, centred in a 4:1 cell. */
function emblem(d: SignDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.translate(w / 2, h / 2);
  ctx.scale(h, h);
  ctx.fillStyle = ctx.strokeStyle = d.fg;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(0, 0, 0.36, rad(-125), rad(128));
  ctx.arc(-0.05, -0.05, 0.27, rad(128), rad(-125), true);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.085;
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.26);
  ctx.lineTo(-0.36, 0.42);
  ctx.stroke();
  ctx.save();
  ctx.rotate(rad(-45));
  ctx.fillRect(-0.04, -0.22, 0.08, 0.66);
  ctx.fillRect(-0.2, -0.34, 0.33, 0.13);
  ctx.restore();
  return c;
}

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
  private static ROWS = 20;

  constructor() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 2560;
    const ctx = c.getContext('2d')!;
    SIGNS.forEach((d, i) => {
      const img = d.kind === 'poster' || d.kind === 'red' ? poster(d, 512, 128) : d.kind === 'concert' ? concert(d, 512, 128) : d.kind === 'emblem' || d.kind === 'stencil' ? emblem(d, 512, 128) : d.kind === 'flag' ? flag(d, 512, 128) : signTexture(d.text, d.bg, d.fg, 512, 128);
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
