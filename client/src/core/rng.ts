import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Noise {
  private n: NoiseFunction2D;
  constructor(seed: number) {
    this.n = createNoise2D(mulberry32(seed));
  }
  at(x: number, z: number): number {
    return this.n(x, z);
  }
  fbm(x: number, z: number, freq: number, octaves: number): number {
    let sum = 0, amp = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.n(x * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }
  ridged(x: number, z: number, freq: number, octaves: number): number {
    let sum = 0, amp = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const v = 1 - Math.abs(this.n(x * freq, z * freq));
      sum += v * v * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return sum / norm;
  }
}

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
