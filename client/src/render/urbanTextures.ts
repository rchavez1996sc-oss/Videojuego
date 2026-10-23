import { makePbr, type PbrSet } from './textures';
import { photo } from './photoTextures';
import { cracks, fbmField, grainField, paintPixels } from './noiseTex';

/** Exposed clay brick with mortar lines, the typical unplastered wall of a Lima settlement. */
export const brick = (): PbrSet =>
  photo('brick') ?? makePbr(512, 71, 4, (c, h, s, r) => {
    c.fillStyle = '#8f8576';
    c.fillRect(0, 0, s, s);
    h.fillStyle = '#404040';
    h.fillRect(0, 0, s, s);
    const bh = 16, bw = 46;
    for (let y = 0, row = 0; y < s; y += bh, row++) {
      for (let x = row % 2 ? -bw / 2 : 0; x < s; x += bw) {
        const t = 0.75 + r() * 0.35, burnt = r() < 0.12 ? 0.7 : 1;
        c.fillStyle = `rgb(${158 * t * burnt},${78 * t * burnt},${52 * t * burnt})`;
        c.fillRect(x + 2, y + 2, bw - 3, bh - 3);
        for (let k = 0; k < 6; k++) {
          c.fillStyle = `rgba(${r() < 0.5 ? '60,30,20' : '200,140,110'},0.25)`;
          c.fillRect(x + 2 + r() * (bw - 6), y + 2 + r() * (bh - 6), 2 + r() * 4, 1 + r() * 2);
        }
        h.fillStyle = `rgb(${150 + r() * 40},${150 + r() * 40},${150 + r() * 40})`;
        h.fillRect(x + 2, y + 2, bw - 3, bh - 3);
      }
    }
    for (let i = 0; i < 30; i++) {
      c.fillStyle = 'rgba(120,115,105,0.55)';
      c.beginPath();
      c.ellipse(r() * s, r() * s, 6 + r() * 20, 3 + r() * 8, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });

const ss = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));

/** Cast concrete for columns, slabs, stairs and sidewalks: cloudy tone, sand grain, exposed aggregate, pores, hairline cracks. */
export const concrete = (): PbrSet =>
  photo('concrete') ?? makePbr(1024, 83, 2.2, (c, h, s, r) => {
    const big = fbmField(s, 831, 4, 64), stain = fbmField(s, 832, 2, 16, 0.7), agg = fbmField(s, 833, 128, 512, 0.6), grain = grainField(s, 834);
    paintPixels(c, h, s, (i) => {
      const peb = ss(0.28, 0.42, agg[i]), pore = grain[i] > 0.994 ? 1 : 0;
      const v = 0.53 + big[i] * 0.07 + Math.min(0, stain[i]) * 0.09 + grain[i] * 0.03 + peb * 0.07 - pore * 0.22;
      return [v, v * 0.975, v * 0.93, 0.5 + big[i] * 0.06 + peb * 0.22 + grain[i] * 0.025 - pore * 0.3];
    });
    cracks(c, h, s, r, 7, 0.35);
  });

/** Plastered wall, pale so material colour can tint it into blues, yellows and pinks: trowel waves, sand grain, cracks, patches of brick. */
export const plaster = (): PbrSet =>
  photo('plaster') ?? makePbr(1024, 97, 1.6, (c, h, s, r) => {
    const big = fbmField(s, 971, 3, 32), trowel = fbmField(s, 972, 32, 256, 0.6), grain = grainField(s, 973);
    paintPixels(c, h, s, (i) => {
      const v = 0.9 + big[i] * 0.05 + trowel[i] * 0.025 + grain[i] * 0.014;
      return [v * 1.0, v * 0.985, v * 0.955, 0.5 + trowel[i] * 0.18 + grain[i] * 0.03];
    });
    cracks(c, h, s, r, 5, 0.25);
    for (let i = 0; i < 4; i++) {
      const x = r() * s, y = r() * s, w = 40 + r() * 110, hh = 20 + r() * 70;
      c.fillStyle = 'rgba(150,80,55,0.55)';
      c.fillRect(x, y, w, hh);
      h.fillStyle = '#4a4a4a';
      h.fillRect(x, y, w, hh);
    }
  });

/** Corrugated metal sheet (calamina). */
export const corrugated = (): PbrSet =>
  makePbr(256, 109, 6, (c, h, s, r) => {
    for (let x = 0; x < s; x++) {
      const v = 0.5 + 0.5 * Math.sin((x / s) * Math.PI * 24);
      c.fillStyle = `rgb(${110 + v * 50},${108 + v * 48},${102 + v * 45})`;
      c.fillRect(x, 0, 1, s);
      h.fillStyle = `rgb(${v * 255},${v * 255},${v * 255})`;
      h.fillRect(x, 0, 1, s);
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(${120 + r() * 40},${60 + r() * 20},30,${0.2 + r() * 0.3})`;
      c.beginPath();
      c.ellipse(r() * s, r() * s, 4 + r() * 18, 3 + r() * 10, 0, 0, Math.PI * 2);
      c.fill();
    }
  });

/** Woven reed mat (estera) walls of the poorest hillside homes. */
export const estera = (): PbrSet =>
  makePbr(256, 113, 3, (c, h, s, r) => {
    c.fillStyle = '#9b8455';
    c.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      for (let x = 0; x < s; x += 8) {
        const over = ((x + y) / 8) % 2 === 0;
        const t = 0.8 + r() * 0.3;
        c.fillStyle = `rgb(${(over ? 175 : 140) * t},${(over ? 150 : 118) * t},${(over ? 98 : 78) * t})`;
        c.fillRect(x, y, 8, 8);
        h.fillStyle = over ? '#b0b0b0' : '#505050';
        h.fillRect(x, y, 8, 8);
      }
    }
  });

/** Painted sign / graffiti texture with text. */
export function signTexture(text: string, bg: string | null, fg: string, w = 512, h = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.floor(h * 0.55)}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2, w * 0.92);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 3);
  }
  return c;
}

/** Scored concrete pavement slabs for sidewalks. */
export const slabs = (): PbrSet => photo('slabs') ?? concrete();
