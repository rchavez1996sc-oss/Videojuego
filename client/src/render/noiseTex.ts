import { mulberry32 } from '../core/rng';

/** Tileable value-noise fbm sampled on a size × size grid: octaves from `period` cells across down to `minPeriod`. */
export function fbmField(size: number, seed: number, period: number, minPeriod = size / 2, falloff = 0.55): Float32Array {
  const out = new Float32Array(size * size), r = mulberry32(seed);
  let amp = 1, total = 0;
  for (let cells = period; cells <= minPeriod; cells *= 2) {
    const lat = Float32Array.from({ length: cells * cells }, () => r() * 2 - 1), step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step, y0 = Math.floor(gy), ty = gy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const gx = x / step, x0 = Math.floor(gx), tx = gx - x0, sx = tx * tx * (3 - 2 * tx), c0 = x0 % cells, c1 = (x0 + 1) % cells;
        const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx, b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= falloff;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Per-pixel white noise in −1..1 (film-grain, sand, pores). */
export function grainField(size: number, seed: number): Float32Array {
  const r = mulberry32(seed);
  return Float32Array.from({ length: size * size }, () => r() * 2 - 1);
}

/**
 * Fills a colour and a height canvas pixel by pixel: `pixel(i)` returns linear 0..1 rgb and height for pixel index i.
 */
export function paintPixels(color: CanvasRenderingContext2D, height: CanvasRenderingContext2D, size: number, pixel: (i: number) => [number, number, number, number]): void {
  const ci = color.createImageData(size, size), hi = height.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b, h] = pixel(i), o = i * 4, hv = Math.max(0, Math.min(255, h * 255));
    ci.data[o] = Math.max(0, Math.min(255, r * 255));
    ci.data[o + 1] = Math.max(0, Math.min(255, g * 255));
    ci.data[o + 2] = Math.max(0, Math.min(255, b * 255));
    ci.data[o + 3] = 255;
    hi.data[o] = hi.data[o + 1] = hi.data[o + 2] = hv;
    hi.data[o + 3] = 255;
  }
  color.putImageData(ci, 0, 0);
  height.putImageData(hi, 0, 0);
}

/** Thin wandering cracks drawn into both canvases (dark line, sunken groove). */
export function cracks(color: CanvasRenderingContext2D, height: CanvasRenderingContext2D, size: number, rand: () => number, n: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    let x = rand() * size, y = rand() * size, a = rand() * Math.PI * 2;
    color.strokeStyle = `rgba(40,36,30,${alpha})`;
    height.strokeStyle = '#2a2a2a';
    color.lineWidth = height.lineWidth = 0.8 + rand() * 0.8;
    color.beginPath(); height.beginPath();
    color.moveTo(x, y); height.moveTo(x, y);
    for (let k = 0, len = 6 + rand() * 18; k < len; k++) {
      a += (rand() - 0.5) * 1.1;
      x += Math.cos(a) * (4 + rand() * 6);
      y += Math.sin(a) * (4 + rand() * 6);
      color.lineTo(x, y); height.lineTo(x, y);
    }
    color.stroke(); height.stroke();
  }
}
