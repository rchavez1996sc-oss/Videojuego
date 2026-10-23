import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { fbmField, grainField, paintPixels } from './noiseTex';
import { photo } from './photoTextures';

type Painter = (color: CanvasRenderingContext2D, height: CanvasRenderingContext2D, size: number, rand: () => number, rough: CanvasRenderingContext2D) => void;

export interface PbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** Optional per-texel roughness (white = the material's roughness), e.g. glossy window glass on a matte wall. */
  roughnessMap?: THREE.Texture;
}

function heightToNormal(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const s = src.width;
  const h = src.getContext('2d')!.getImageData(0, 0, s, s).data;
  const out = document.createElement('canvas');
  out.width = out.height = s;
  const ctx = out.getContext('2d')!;
  const img = ctx.createImageData(s, s);
  const at = (x: number, y: number) => h[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * s + x) * 4;
      img.data[o] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[o + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[o + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export function makePbr(size: number, seed: number, strength: number, paint: Painter, withRough = false): PbrSet {
  const c = document.createElement('canvas');
  const hc = document.createElement('canvas');
  const rc = document.createElement('canvas');
  c.width = c.height = hc.width = hc.height = size;
  rc.width = rc.height = withRough ? size : 1;
  const ctx = c.getContext('2d')!, hctx = hc.getContext('2d', { willReadFrequently: true })!, rctx = rc.getContext('2d')!;
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#ffffff';
  rctx.fillRect(0, 0, rc.width, rc.height);
  paint(ctx, hctx, size, mulberry32(seed), rctx);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(heightToNormal(hc, strength));
  const roughnessMap = withRough ? new THREE.CanvasTexture(rc) : undefined;
  for (const t of [map, normalMap, roughnessMap]) {
    if (!t) continue;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
  }
  return { map, normalMap, roughnessMap };
}

function speckle(ctx: CanvasRenderingContext2D, size: number, rand: () => number, n: number, colors: string[], r: [number, number]) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.08 + rand() * 0.25;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r[0] + rand() * (r[1] - r[0]), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export const adobe = (): PbrSet =>
  makePbr(512, 11, 3, (c, h, s, r) => {
    c.fillStyle = '#b39474';
    c.fillRect(0, 0, s, s);
    speckle(c, s, r, 2500, ['#9c7c5e', '#c4a688', '#8a6a4f', '#d0b494'], [2, 18]);
    speckle(h, s, r, 3000, ['#606060', '#a0a0a0', '#909090'], [1, 6]);
    for (let i = 0; i < 6; i++) {
      const x = r() * s, y = r() * s, w = 60 + r() * 120, hh = 40 + r() * 80;
      for (let by = y; by < y + hh; by += 14) {
        for (let bx = x + ((by / 14) % 2) * 14; bx < x + w; bx += 28) {
          c.fillStyle = r() > 0.5 ? '#8b6747' : '#7c5a3d';
          c.fillRect(bx % s, by % s, 26, 12);
          h.fillStyle = '#6a6a6a';
          h.fillRect(bx % s, by % s, 26, 12);
          h.fillStyle = '#3a3a3a';
          h.fillRect(bx % s, (by + 12) % s, 28, 2);
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      c.strokeStyle = 'rgba(60,40,25,0.35)';
      h.strokeStyle = '#303030';
      c.lineWidth = h.lineWidth = 1 + r();
      let x = r() * s, y = r() * s;
      c.beginPath(); h.beginPath();
      c.moveTo(x, y); h.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 30; y += r() * 20;
        c.lineTo(x, y); h.lineTo(x, y);
      }
      c.stroke(); h.stroke();
    }
  });

export const roofTiles = (): PbrSet =>
  photo('roofTiles') ?? makePbr(512, 23, 5, (c, h, s, r) => {
    c.fillStyle = '#7e3b22';
    c.fillRect(0, 0, s, s);
    const rows = 16, cols = 12;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = (x + (y % 2) * 0.5) * (s / cols), py = y * (s / rows);
        const g = c.createLinearGradient(px, 0, px + s / cols, 0);
        const tone = 100 + r() * 50;
        g.addColorStop(0, `rgb(${tone * 0.7},${tone * 0.32},${tone * 0.2})`);
        g.addColorStop(0.5, `rgb(${tone * 1.25},${tone * 0.58},${tone * 0.36})`);
        g.addColorStop(1, `rgb(${tone * 0.7},${tone * 0.32},${tone * 0.2})`);
        c.fillStyle = g;
        c.fillRect(px, py, s / cols - 2, s / rows - 1);
        const hg = h.createLinearGradient(px, 0, px + s / cols, 0);
        hg.addColorStop(0, '#404040'); hg.addColorStop(0.5, '#e0e0e0'); hg.addColorStop(1, '#404040');
        h.fillStyle = hg;
        h.fillRect(px, py, s / cols - 2, s / rows - 1);
      }
    }
    speckle(c, s, r, 900, ['#3b3a2a', '#2d2a22', '#6b6a4a'], [2, 10]);
  });

export const wood = (): PbrSet =>
  makePbr(256, 31, 2, (c, h, s, r) => {
    c.fillStyle = '#5a4330';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) {
      const y = r() * s;
      c.strokeStyle = `rgba(${40 + r() * 40},${28 + r() * 25},${18 + r() * 15},0.6)`;
      h.strokeStyle = r() > 0.5 ? '#606060' : '#a0a0a0';
      c.lineWidth = h.lineWidth = 1 + r() * 2;
      c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(s / 3, y + r() * 6 - 3, (2 * s) / 3, y + r() * 6 - 3, s, y); c.stroke();
      h.beginPath(); h.moveTo(0, y); h.lineTo(s, y); h.stroke();
    }
  });

/** Weathered stone / asphalt base: mottled tone, mid-scale relief and a coarse aggregate of light and dark grains. */
export const rock = (): PbrSet =>
  photo('rock') ?? makePbr(1024, 47, 3, (c, h, s) => {
    const big = fbmField(s, 471, 4, 32), mid = fbmField(s, 472, 16, 128), agg = fbmField(s, 473, 256, 512, 0.7), grain = grainField(s, 474);
    paintPixels(c, h, s, (i) => {
      const light = Math.max(0, agg[i] - 0.3) * 1.6, dark = Math.max(0, -agg[i] - 0.3) * 1.4;
      const v = 0.45 + big[i] * 0.07 + mid[i] * 0.05 + grain[i] * 0.035 + light * 0.25 - dark * 0.2;
      return [v * 1.02, v * 0.98, v * 0.93, 0.5 + mid[i] * 0.3 + (light - dark) * 0.25 + grain[i] * 0.03];
    });
  });

export const soil = (): PbrSet =>
  makePbr(512, 59, 5, (c, h, s, r) => {
    c.fillStyle = '#7a6650';
    c.fillRect(0, 0, s, s);
    speckle(c, s, r, 5000, ['#6a5641', '#8b7660', '#5b4a38', '#9a8670'], [1, 5]);
    speckle(h, s, r, 3000, ['#707070', '#909090'], [1, 4]);
    for (let i = 0; i < 700; i++) {
      const x = r() * s, y = r() * s, rad = 1.5 + r() * 5;
      const tone = 90 + r() * 70;
      c.fillStyle = `rgb(${tone},${tone * 0.92},${tone * 0.82})`;
      c.beginPath(); c.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); c.fill();
      const g = h.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#707070');
      h.fillStyle = g;
      h.beginPath(); h.arc(x, y, rad, 0, Math.PI * 2); h.fill();
    }
  });

/** Road surface (photographic when available, else the stone/aggregate texture). */
export const asphalt = (): PbrSet => photo('asphalt') ?? rock();
/** Timber decking and benches. */
export const deck = (): PbrSet => photo('deck') ?? wood();
/** Herringbone parquet floor. */
export const parquet = (): PbrSet => photo('parquet') ?? wood();
/** Broadleaf tree bark. */
export const bark = (): PbrSet => photo('bark') ?? wood();
/** Palm trunk. */
export const palmBark = (): PbrSet => photo('palmBark') ?? wood();
