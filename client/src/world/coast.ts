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
  ravines?: { x: number; head: number; width: number; skew?: number }[];
  /** Sunken floors (plazas cut into the cliff top); they only ever lower the ground. */
  carves?: { x0: number; x1: number; z0: number; z1: number; y: number }[];
}

/** z of the cliff top at x. */
export function edgeZ(c: CoastDef, x: number): number {
  let z = c.edge + 6 * Math.sin(x / 47 + 1) + 3.5 * Math.sin(x / 19 + 2);
  for (const b of c.bulges ?? []) z += b.dz * smoothstep(b.w + 25, b.w, Math.abs(x - b.x));
  return z;
}

/** 1 where the cliff face is covered by creepers instead of bare conglomerate (patchy; bare below sunken plazas). */
export function greenCliff(x: number, noise: Noise, c?: CoastDef): number {
  const bare = Math.max(0, ...(c?.carves ?? []).map((k) => smoothstep(30, 5, Math.max(k.x0 - x, x - k.x1))));
  return smoothstep(0.02, 0.16, noise.fbm(x, 0, 1 / 70, 3) - 0.04) * (1 - bare);
}

/** Vertical erosion furrows of the conglomerate face: ridged noise along the cliff, 0 at top and toe. */
function gullies(x: number, t: number, noise: Noise): number {
  const ridge = 1 - Math.abs(noise.fbm(x, 3, 1 / 9, 2)) * 2;
  return (ridge - 0.4) * 4.5 * Math.sin(t * Math.PI);
}

type Ravine = NonNullable<CoastDef['ravines']>[number];

/** Ravine cross-section: flat road floor, a 1.3 m stone wall, a 46° grass bank, a 2.5 m retaining wall at the top. */
export const RAVINE = { floor: 8, lip: 1.3, lipRun: 0.8, slope: 1.05, top: -2.5, topRun: 1.5 };

/** Centre line of the ravine at z (it can run askew to the coast). */
export function ravineCentre(r: Ravine, z: number): number {
  return r.x + (z - r.head) * (r.skew ?? 0);
}

/** Height of the road on the ravine floor at z: street level at the head, beach level at the mouth. */
export function ravineFloor(c: CoastDef, r: Ravine, z: number): number {
  const mouth = edgeZ(c, r.x) + c.run;
  return z <= r.head ? 0 : lerp(0, -c.drop, Math.pow(smoothstep(r.head, mouth, z), 0.85));
}

/** Half width of the cut at z, from the centre line to the top of the retaining wall. */
export function ravineHalf(c: CoastDef, r: Ravine, z: number): number {
  const f = ravineFloor(c, r, z), R = RAVINE;
  if (z < r.head) return 0;
  return R.floor + R.lipRun + Math.max(0, R.top - f - R.lip) / R.slope + R.topRun;
}

function ravineCut(c: CoastDef, r: Ravine, x: number, z: number, h: number): number {
  if (z < r.head - 1) return h;
  const R = RAVINE, f = ravineFloor(c, r, z), d = Math.abs(x - ravineCentre(r, z));
  const dTop = R.floor + R.lipRun + Math.max(0, R.top - f - R.lip) / R.slope;
  let v: number;
  if (d <= R.floor) v = f;
  else if (d <= R.floor + R.lipRun) v = f + R.lip * (d - R.floor) / R.lipRun;
  else if (d <= dTop) v = f + R.lip + (d - R.floor - R.lipRun) * R.slope;
  else v = lerp(Math.max(R.top, f + R.lip), 0, smoothstep(dTop, dTop + R.topRun, d));
  return Math.min(h, v);
}

export function coastHeight(c: CoastDef, x: number, z: number, noise: Noise): number {
  const e = edgeZ(c, x), green = greenCliff(x, noise, c);
  const t = (z - e) / c.run;
  let h: number;
  if (t <= 0) h = 0;
  else if (t < 1) {
    const steep = Math.pow(t, lerp(0.55, 1.0, green));
    const shelf = Math.sin(t * Math.PI) * noise.fbm(x, z, 1 / 18, 3) * lerp(1.6, 0.8, green);
    h = -c.drop * smoothstep(0, 1, steep) + shelf + gullies(x, t, noise) * (1 - green * 0.7);
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
    const d = Math.max(k.x0 + 2.6 - x, x - k.x1 + 2.6, k.z0 - z, z - k.z1);
    if (d < 1.5) h = lerp(h, Math.min(h, k.y), smoothstep(1.5, 0, d));
  }
  return h;
}

/** Mask for the coast: [road, grass, packed, rockAllowed] in 0..1. Lawns are painted later by the park. */
export function coastMask(c: CoastDef, x: number, z: number, noise: Noise): [number, number, number, number] {
  const e = edgeZ(c, x), t = (z - e) / c.run;
  let ivy = t > 0 && t < 1.05 ? Math.max(greenCliff(x, noise, c), smoothstep(0.3, 0.05, t) * 0.6) : 0;
  for (const r of c.ravines ?? []) {
    const mouth = edgeZ(c, r.x) + c.run;
    if (z > r.head && z < mouth && Math.abs(x - ravineCentre(r, z)) < ravineHalf(c, r, z) + 2) ivy = 1;
  }
  const beach = t >= 1 ? 1 : 0, bare = t > 0 && t < 1.05 ? 1 - ivy : 0;
  return [0, ivy, Math.max(beach, bare), 1 - ivy];
}
