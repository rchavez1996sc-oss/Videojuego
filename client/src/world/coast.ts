import { smoothstep, lerp, type Noise } from '../core/rng';

/** Sea cliff along x (sea towards +z): flat plateau at y 0, cliff, beach at -drop, water at `sea`. */
export interface CoastDef {
  edge: number;
  drop: number;
  run: number;
  shore: number;
  sea: number;
  /** Stretches where the edge juts out to sea: centre x, half width, extra z. */
  bulges?: { x: number; w: number; dz: number }[];
  /** Green ravines cutting the plateau down to the beach: centre x, head z, mouth width. */
  ravines?: { x: number; head: number; width: number }[];
  /** Sunken floors (plazas cut into the cliff top); they only ever lower the ground. */
  carves?: { x0: number; x1: number; z0: number; z1: number; y: number }[];
}

/** z of the cliff top at x. */
export function edgeZ(c: CoastDef, x: number): number {
  let z = c.edge + 6 * Math.sin(x / 47 + 1) + 3.5 * Math.sin(x / 19 + 2);
  for (const b of c.bulges ?? []) z += b.dz * smoothstep(b.w + 25, b.w, Math.abs(x - b.x));
  return z;
}

/** 1 where the cliff face is covered by creepers instead of bare conglomerate. */
export function greenCliff(x: number, noise: Noise): number {
  return smoothstep(-0.05, 0.12, noise.fbm(x, 0, 1 / 70, 3) + 0.08);
}

function ravineCut(c: CoastDef, r: NonNullable<CoastDef['ravines']>[number], x: number, z: number, h: number): number {
  const mouth = edgeZ(c, r.x) + c.run;
  if (z < r.head - 12) return h;
  const t = smoothstep(r.head, mouth, z);
  const half = r.width / 2 * (0.32 + 0.68 * t);
  const floor = lerp(-5, -c.drop, Math.pow(t, 0.85));
  const k = Math.abs(x - r.x) / half;
  const headFade = smoothstep(r.head - 12, r.head + 6, z);
  if (k >= 1) return h;
  return Math.min(h, lerp(0, floor + (0 - floor) * smoothstep(0.18, 1, k), headFade));
}

export function coastHeight(c: CoastDef, x: number, z: number, noise: Noise): number {
  const e = edgeZ(c, x), green = greenCliff(x, noise);
  const t = (z - e) / c.run;
  let h: number;
  if (t <= 0) h = 0;
  else if (t < 1) {
    const steep = Math.pow(t, lerp(0.55, 1.0, green));
    const shelf = Math.sin(t * Math.PI) * noise.fbm(x, z, 1 / 18, 3) * lerp(1.6, 0.8, green);
    h = -c.drop * smoothstep(0, 1, steep) + shelf;
  } else {
    const beach = z - e - c.run;
    h = -c.drop - beach * 0.012;
    const toShore = (z - c.shore) / 20;
    h = Math.min(h, lerp(-c.drop - 0.3, c.sea - 0.6, smoothstep(-1.2, 0, toShore)));
    if (z > c.shore) h = Math.min(h, c.sea - 0.6 - (z - c.shore) * 0.12);
  }
  if (t > 1 && z < c.shore) h += noise.fbm(x, z, 1 / 9, 2) * 0.15;
  for (const r of c.ravines ?? []) h = ravineCut(c, r, x, z, h);
  for (const k of c.carves ?? []) {
    const d = Math.max(k.x0 - x, x - k.x1, k.z0 - z, z - k.z1);
    if (d < 1.5) h = lerp(h, Math.min(h, k.y), smoothstep(1.5, 0, d));
  }
  return h;
}

/** Mask for the coast: [road, grass, packed, rockAllowed] in 0..1. Lawns are painted later by the park. */
export function coastMask(c: CoastDef, x: number, z: number, noise: Noise): [number, number, number, number] {
  const e = edgeZ(c, x), t = (z - e) / c.run;
  let ivy = t > 0 && t < 1.05 ? Math.max(greenCliff(x, noise), smoothstep(0.3, 0.05, t)) : 0;
  for (const r of c.ravines ?? []) {
    const mouth = edgeZ(c, r.x) + c.run;
    if (z > r.head - 14 && z < mouth && Math.abs(x - r.x) < r.width / 2 + 4) ivy = 1;
  }
  const beach = t >= 1 ? 1 : 0;
  return [0, ivy, beach, 1 - ivy];
}
