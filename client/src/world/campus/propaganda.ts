import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../../render/lighting';

/** Campus politics from the chapter JSON: slogans (graffiti and banners), student organisations, quotes, event posters. */
export interface PoliticsDef {
  slogans: string[];
  orgs: string[];
  quotes: { text: string; author: string }[];
  posters: string[];
  busts: { name: string; years: string; look: 'beard' | 'kepi' | 'woman' | 'plain' }[];
}

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, i: number) => void;
const SANS = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif';

/** Word-wraps `text` into the box and draws it centred, shrinking the size until it fits. */
export function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, weight = 800, family = SANS, maxPx = 200): void {
  for (let px = maxPx; px > 8; px *= 0.92) {
    g.font = `${weight} ${px}px ${family}`;
    const lines: string[] = [];
    for (const word of text.split(' ')) {
      const last = lines[lines.length - 1];
      if (last !== undefined && g.measureText(`${last} ${word}`).width <= w) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    if (lines.some((l) => g.measureText(l).width > w) || lines.length * px * 1.05 > h) continue;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, k) => g.fillText(l, x + w / 2, y + h / 2 + (k - (lines.length - 1) / 2) * px * 1.05));
    return;
  }
}

/** A texture of `cols × rows` cells and a builder that lays quads showing one cell each; one draw call for all of them. */
export class Atlas {
  readonly material: THREE.MeshStandardMaterial;
  private geos: THREE.BufferGeometry[] = [];

  constructor(lighting: Lighting, key: string, private cols: number, private rows: number, cell: [number, number], draw: Draw, params: THREE.MeshStandardMaterialParameters = {}) {
    const c = document.createElement('canvas');
    c.width = cols * cell[0];
    c.height = rows * cell[1];
    const g = c.getContext('2d')!;
    for (let i = 0; i < cols * rows; i++) {
      g.save();
      g.translate((i % cols) * cell[0], Math.floor(i / cols) * cell[1]);
      g.beginPath();
      g.rect(0, 0, cell[0], cell[1]);
      g.clip();
      draw(g, cell[0], cell[1], i);
      g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    this.material = lighting.setup(new THREE.MeshStandardMaterial({ name: key, map: t, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, ...params }), key) as THREE.MeshStandardMaterial;
  }

  get count(): number {
    return this.cols * this.rows;
  }

  add(cell: number, pos: THREE.Vector3, q: THREE.Quaternion, w: number, h: number, tilt = 0): void {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, cx = cell % this.cols, cy = Math.floor(cell / this.cols);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + uv.getX(k)) / this.cols, 1 - (cy + 1 - uv.getY(k)) / this.rows);
    g.applyMatrix4(new THREE.Matrix4().compose(pos, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt)), new THREE.Vector3(1, 1, 1)));
    this.geos.push(g);
  }

  mesh(): THREE.Mesh | null {
    if (!this.geos.length) return null;
    return Object.assign(new THREE.Mesh(mergeGeometries(this.geos), this.material), { receiveShadow: true });
  }
}

const PAPER = ['#f1ece0', '#e8d94a', '#e6e2d6', '#d8342b', '#f2a33a', '#1d1d1d', '#9fd1e8'];

/** Photocopied and screen-printed posters: headline, a woodcut-style motif, small print. */
export function posterDraw(p: PoliticsDef): Draw {
  return (g, w, h, i) => {
    const bg = PAPER[i % PAPER.length], dark = bg === '#1d1d1d' || bg === '#d8342b', ink = dark ? '#f4efe2' : i % 3 ? '#b51d1d' : '#151515';
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = ink;
    const motif = i % 4;
    if (motif === 0) {
      g.fillRect(w * 0.38, h * 0.36, w * 0.24, h * 0.26);
      for (let k = 0; k < 4; k++) g.fillRect(w * (0.38 + k * 0.06), h * 0.28, w * 0.05, h * 0.1);
      g.fillRect(w * 0.44, h * 0.62, w * 0.12, h * 0.08);
    } else if (motif === 1) {
      g.beginPath();
      g.arc(w / 2, h * 0.48, w * 0.16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = bg;
      g.fillRect(w * 0.49, h * 0.3, w * 0.02, h * 0.36);
    } else if (motif === 2) {
      for (let k = 0; k < 7; k++) g.fillRect(w * (0.2 + k * 0.09), h * (0.62 - (k % 3) * 0.06 - 0.12), w * 0.05, h * 0.2 + (k % 3) * h * 0.06);
    } else {
      g.beginPath();
      g.moveTo(w * 0.15, h * 0.68);
      for (let k = 0; k <= 6; k++) g.lineTo(w * (0.15 + k * 0.117), h * (k % 2 ? 0.4 : 0.55));
      g.lineTo(w * 0.85, h * 0.68);
      g.fill();
    }
    g.fillStyle = ink;
    fitText(g, p.posters[i % p.posters.length], w * 0.06, h * 0.02, w * 0.88, h * 0.26);
    g.globalAlpha = 0.85;
    fitText(g, p.orgs[i % p.orgs.length], w * 0.06, h * 0.74, w * 0.88, h * 0.1, 700);
    g.globalAlpha = 0.5;
    for (let k = 0; k < 5; k++) g.fillRect(w * 0.12, h * (0.86 + k * 0.025), w * (0.5 + ((k * 37) % 30) / 100), 2);
    g.globalAlpha = 1;
  };
}

/** Spray-painted slogans with drips, red or black, on transparent ground. */
export function graffitiDraw(p: PoliticsDef): Draw {
  return (g, w, h, i) => {
    const text = i % 5 === 4 ? p.orgs[i % p.orgs.length] : p.slogans[i % p.slogans.length];
    g.fillStyle = i % 3 === 2 ? '#141414' : '#b3161a';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 3;
    fitText(g, text, w * 0.04, h * 0.08, w * 0.92, h * 0.78, 800, SANS, 140);
    g.shadowBlur = 0;
    for (let k = 0; k < 14; k++) {
      const x = w * (0.08 + ((k * 0.0731 + i * 0.13) % 0.84)), y = h * (0.45 + ((k * 7) % 5) * 0.06);
      g.fillRect(x, y, 2.5, h * (0.08 + ((k * 13) % 7) * 0.03));
    }
  };
}

/** Painted cloth banners: red on white or white on red, with the organisation in small letters. */
export function bannerDraw(p: PoliticsDef): Draw {
  return (g, w, h, i) => {
    const red = i % 2 === 0;
    g.fillStyle = red ? '#b7231d' : '#efe9dc';
    g.fillRect(0, 0, w, h);
    g.fillStyle = red ? '#f6f1e6' : '#a3161a';
    fitText(g, p.slogans[(i * 3 + 1) % p.slogans.length], w * 0.04, h * 0.06, w * 0.92, h * 0.62);
    g.fillStyle = red ? '#f6d65c' : '#1a1a1a';
    fitText(g, p.orgs[i % p.orgs.length], w * 0.1, h * 0.7, w * 0.8, h * 0.24, 700);
  };
}

/** Wall murals: a quote with its author over an Andean landscape, a raised fist or open book, in flat poster colours. */
export function muralDraw(p: PoliticsDef): Draw {
  return (g, w, h, i) => {
    const sky = ['#e8b23a', '#2f6fb0', '#c8452c', '#3b7a4a'][i % 4];
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f3d36a';
    g.beginPath();
    g.arc(w * 0.18, h * 0.42, h * 0.22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a3b26';
    g.beginPath();
    g.moveTo(0, h);
    for (let k = 0; k <= 8; k++) g.lineTo((w * k) / 8, h * (k % 2 ? 0.55 : 0.75));
    g.lineTo(w, h);
    g.fill();
    g.fillStyle = '#1b1b1b';
    if (i % 2) {
      g.fillRect(w * 0.12, h * 0.3, w * 0.07, h * 0.4);
      for (let k = 0; k < 4; k++) g.fillRect(w * (0.12 + k * 0.018), h * 0.22, w * 0.016, h * 0.12);
    } else {
      g.beginPath();
      g.moveTo(w * 0.08, h * 0.35);
      g.lineTo(w * 0.18, h * 0.4);
      g.lineTo(w * 0.28, h * 0.35);
      g.lineTo(w * 0.28, h * 0.7);
      g.lineTo(w * 0.18, h * 0.75);
      g.lineTo(w * 0.08, h * 0.7);
      g.fill();
    }
    const q = p.quotes[i % p.quotes.length];
    g.fillStyle = '#fbf6ea';
    fitText(g, `«${q.text}»`, w * 0.33, h * 0.06, w * 0.62, h * 0.66, 700, 'Georgia, "Times New Roman", serif', 90);
    g.fillStyle = '#ffe08a';
    fitText(g, `— ${q.author}`, w * 0.45, h * 0.74, w * 0.5, h * 0.16, 800);
  };
}
