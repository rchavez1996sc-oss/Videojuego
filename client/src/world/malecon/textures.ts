import * as THREE from 'three';
import { makePbr, type PbrSet } from '../../render/textures';

/** Apartment facade, 2 bays × 2 floors (6 m): slab bands, recessed windows with blinds and sky glints. Pale for tinting. */
export const apartment = (): PbrSet =>
  makePbr(512, 211, 3, (c, h, s, r) => {
    c.fillStyle = '#ecebe6';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,116,108'},${0.04 + r() * 0.06})`;
      c.fillRect(r() * s, r() * s, 1 + r() * 4, 1 + r() * 4);
    }
    const cell = s / 2;
    for (let fy = 0; fy < 2; fy++) {
      const y0 = fy * cell;
      c.fillStyle = '#c9c6bf';
      c.fillRect(0, y0 + cell - 18, s, 18);
      h.fillStyle = '#a0a0a0';
      h.fillRect(0, y0 + cell - 18, s, 18);
      for (let bx = 0; bx < 2; bx++) {
        const x0 = bx * cell + 22, w = cell - 44, wy = y0 + 30, wh = cell - 70;
        const g = c.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, '#8fa3b0');
        g.addColorStop(0.45, '#33424c');
        g.addColorStop(1, '#1d252b');
        c.fillStyle = g;
        c.fillRect(x0, wy, w, wh);
        const blind = r();
        if (blind < 0.55) {
          c.fillStyle = ['#d8d0c0', '#bfb6a6', '#e6e1d6', '#9a8f80'][Math.floor(r() * 4)];
          c.globalAlpha = 0.85;
          c.fillRect(x0 + 4, wy + 4, w - 8, wh * (0.2 + r() * 0.6));
          c.globalAlpha = 1;
        }
        c.fillStyle = '#5d6266';
        c.fillRect(x0 + w / 2 - 3, wy, 6, wh);
        c.fillRect(x0, wy + wh * 0.62, w, 5);
        c.strokeStyle = '#7b7f82';
        c.lineWidth = 6;
        c.strokeRect(x0, wy, w, wh);
        h.fillStyle = '#404040';
        h.fillRect(x0, wy, w, wh);
      }
    }
  });

/** Curtain wall: blue-green glass between aluminium mullions with a spandrel band every floor (3 m × 3 m). */
export const curtain = (): PbrSet =>
  makePbr(256, 223, 2, (c, h, s, r) => {
    const g = c.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#7fa6b3');
    g.addColorStop(0.5, '#3d6170');
    g.addColorStop(1, '#5a8191');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = `rgba(255,255,255,${r() * 0.12})`;
      c.fillRect(r() * s, 0, 8 + r() * 30, s);
    }
    c.fillStyle = '#2c3f48';
    c.fillRect(0, s - 34, s, 34);
    c.fillStyle = '#b8bec2';
    for (const x of [0, s / 2]) c.fillRect(x, 0, 5, s);
    c.fillRect(0, s - 36, s, 4);
    h.fillStyle = '#b0b0b0';
    for (const x of [0, s / 2]) h.fillRect(x, 0, 5, s);
  });

/** Irregular grey flagstones with mortar joints (park paths). */
export const flagstone = (): PbrSet =>
  makePbr(512, 233, 3, (c, h, s, r) => {
    c.fillStyle = '#7d7a73';
    c.fillRect(0, 0, s, s);
    h.fillStyle = '#404040';
    h.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = r() * s, y = r() * s, rad = 26 + r() * 30, sides = 5 + Math.floor(r() * 3), v = 128 + r() * 26;
      for (const [ctx, col] of [[c, `rgb(${v},${v * 0.98},${v * 0.94})`], [h, '#a8a8a8']] as const) {
        ctx.fillStyle = col;
        for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
          ctx.beginPath();
          for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2 + r() * 0.4, rr = rad * (0.75 + r() * 0.3);
            ctx.lineTo(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr);
          }
          ctx.fill();
        }
      }
    }
  });

/** Broken-tile mosaic in warm Mediterranean colours (the Parque del Amor benches). */
export const mosaic = (): PbrSet =>
  makePbr(512, 241, 4, (c, h, s, r) => {
    c.fillStyle = '#e9e1cf';
    c.fillRect(0, 0, s, s);
    const cols = ['#e2572b', '#f0a12c', '#2f6db3', '#3aa0c9', '#5fa340', '#d8322b', '#f4d25a', '#ffffff', '#8a3a8c'];
    const band = (y: number) => cols[Math.floor((Math.sin(y / 40) * 0.5 + 0.5) * 4 + r() * 5) % cols.length];
    for (let i = 0; i < 1600; i++) {
      const x = r() * s, y = r() * s, w = 8 + r() * 14;
      c.fillStyle = band(y + Math.sin(x / 30) * 40);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w, y + r() * 6);
      c.lineTo(x + w * 0.8, y + w * (0.6 + r() * 0.4));
      c.lineTo(x - r() * 4, y + w * 0.7);
      c.fill();
      h.fillStyle = '#b8b8b8';
      h.fillRect(x, y, w * 0.8, w * 0.6);
    }
  });

/** White facade panel with an organic grey lattice (the mall's signature screen). */
export const lattice = (): PbrSet =>
  makePbr(512, 251, 2.5, (c, h, s, r) => {
    c.fillStyle = '#f2f1ec';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#6a6c6e';
    h.strokeStyle = '#404040';
    for (let i = 0; i < 70; i++) {
      const x = r() * s, y = r() * s, a = r() * Math.PI, len = 40 + r() * 90;
      for (const ctx of [c, h]) {
        ctx.lineWidth = 5 + r() * 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.6, y + Math.sin(a + 0.6) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
    }
  });

/** Pale plaza tiles sprinkled with yellow and orange confetti dots. */
export const confetti = (): PbrSet =>
  makePbr(512, 263, 1.5, (c, _h, s, r) => {
    c.fillStyle = '#d9d6cf';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = 'rgba(120,115,105,0.5)';
    c.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      c.beginPath(); c.moveTo(k * s / 4, 0); c.lineTo(k * s / 4, s); c.stroke();
      c.beginPath(); c.moveTo(0, k * s / 4); c.lineTo(s, k * s / 4); c.stroke();
    }
    for (let i = 0; i < 34; i++) {
      c.fillStyle = ['#f2b51d', '#ee8a1f', '#e8642a', '#f7d046'][Math.floor(r() * 4)];
      c.beginPath();
      c.ellipse(r() * s, r() * s, 12 + r() * 14, 8 + r() * 9, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });

/** White and pale-grey checkerboard paving (the malecón's diagonal paths), 4 × 4 tiles. */
export const checker = (): PbrSet =>
  makePbr(256, 281, 2, (c, h, s, r) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = (i + j) % 2 ? 236 : 168 + r() * 10;
      c.fillStyle = `rgb(${v},${v},${v - 4})`;
      c.fillRect((i * s) / 4, (j * s) / 4, s / 4, s / 4);
      h.fillStyle = '#9a9a9a';
      h.fillRect((i * s) / 4 + 2, (j * s) / 4 + 2, s / 4 - 4, s / 4 - 4);
    }
  });

/** Clipped hedge / creeper foliage. */
export const foliage = (): PbrSet =>
  makePbr(256, 271, 5, (c, h, s, r) => {
    c.fillStyle = '#2f4a1e';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = r();
      c.fillStyle = `rgb(${40 + v * 50},${70 + v * 80},${25 + v * 30})`;
      const x = r() * s, y = r() * s;
      c.beginPath();
      c.ellipse(x, y, 2 + r() * 4, 1.5 + r() * 2, r() * 3, 0, Math.PI * 2);
      c.fill();
      h.fillStyle = `rgb(${100 + v * 120},${100 + v * 120},${100 + v * 120})`;
      h.fillRect(x - 2, y - 2, 4, 4);
    }
  });

export function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
