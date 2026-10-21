import { LookupTexture } from 'postprocessing';

const toDisplay = (x: number) => Math.pow(Math.max(0, x), 1 / 2.2);
const toLinear = (x: number) => Math.pow(Math.max(0, x), 2.2);

/**
 * Cinematic grade baked into a 32³ LUT (one texture fetch per pixel): filmic S-curve with deeper shadows,
 * cool teal shadows, warm highlights and a touch more saturation in the mid-tones.
 */
export function cinematicLut(size = 32): LookupTexture {
  const lut = LookupTexture.createNeutral(size);
  const d = lut.image.data as unknown as Float32Array;
  for (let i = 0; i < d.length; i += 4) {
    let r = toDisplay(d[i]), g = toDisplay(d[i + 1]), b = toDisplay(d[i + 2]);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const curve = (x: number) => Math.pow(Math.min(1, Math.max(0, x + (x * x * (3 - 2 * x) - x) * 0.85)), 1.12);
    const sat = 1.24 - 0.16 * l * l;
    r = l + (r - l) * sat;
    g = l + (g - l) * sat;
    b = l + (b - l) * sat;
    const shadow = (1 - l) * (1 - l) * 0.045, light = l * l * 0.035;
    r = curve(r - shadow * 0.8 + light);
    g = curve(g + shadow * 0.15 + light * 0.35);
    b = curve(b + shadow - light * 0.9);
    d[i] = toLinear(r);
    d[i + 1] = toLinear(g);
    d[i + 2] = toLinear(b);
  }
  lut.needsUpdate = true;
  return lut;
}
