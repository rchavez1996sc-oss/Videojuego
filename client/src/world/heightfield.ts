import { Noise, lerp, smoothstep } from '../core/rng';
import type { TerrainDef } from '../data/types';

/** Height grid (row-major, z rows, x columns) plus a RGBA mask: R road, G grass density, B packed ground. */
export class Heightfield {
  readonly n: number;
  readonly size: number;
  readonly step: number;
  readonly half: number;
  readonly heights: Float32Array;
  readonly mask: Uint8Array;
  private roadDist: Float32Array;

  constructor(readonly def: TerrainDef) {
    this.n = def.resolution;
    this.size = def.size;
    this.step = def.size / (this.n - 1);
    this.half = def.size / 2;
    this.heights = new Float32Array(this.n * this.n);
    this.mask = new Uint8Array(this.n * this.n * 4);
    this.roadDist = new Float32Array(this.n * this.n);
    this.generate();
  }

  private distToRoad(x: number, z: number): number {
    let best = Infinity;
    const r = this.def.road;
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, az] = r[i], [bx, bz] = r[i + 1];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  }

  private rawHeight(x: number, z: number, noise: Noise, dRoad: number): number {
    const d = this.def;
    let h = noise.fbm(x, z, 1 / 170, 5) * d.rolling;
    const wobble = noise.fbm(x + 500, z - 300, 1 / 90, 3) * 25;
    const hills = smoothstep(d.valleyWidth, d.valleyWidth + 200, dRoad + wobble);
    h += hills * d.hillHeight * (0.65 + 0.6 * noise.ridged(x, z, 1 / 140, 4));
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const m = smoothstep(d.playable / 2 - 40, d.playable / 2 + 220, edge + wobble);
    h += m * m * d.mountainHeight * (0.55 + 0.35 * noise.fbm(x, z, 1 / 300, 3) + 0.4 * noise.ridged(x, z, 1 / 260, 4));
    return h;
  }

  private generate(): void {
    const { n, step, half, def } = this;
    const noise = new Noise(def.seed);
    const flatTargets = def.flatten.map((f) => this.rawHeight(f.x, f.z, noise, this.distToRoad(f.x, f.z)));
    for (let zi = 0; zi < n; zi++) {
      for (let xi = 0; xi < n; xi++) {
        const x = -half + xi * step, z = -half + zi * step;
        const dRoad = this.distToRoad(x, z);
        let h = this.rawHeight(x, z, noise, dRoad);
        def.flatten.forEach((f, i) => {
          const t = smoothstep(f.r, f.r * 0.55, Math.hypot(x - f.x, z - f.z));
          h = lerp(h, flatTargets[i] + noise.fbm(x, z, 1 / 40, 2) * 0.6, t);
        });
        const rwh = (this.def.roadWidth ?? 6.4) / 2;
        h -= (1 - smoothstep(rwh - 0.7, rwh + 3.8, dRoad)) * 0.35;
        const k = zi * n + xi;
        this.heights[k] = h;
        this.roadDist[k] = dRoad;
      }
    }
    this.buildMask(noise);
  }

  private buildMask(noise: Noise): void {
    const { n, step, half, def } = this;
    for (let zi = 0; zi < n; zi++) {
      for (let xi = 0; xi < n; xi++) {
        const x = -half + xi * step, z = -half + zi * step;
        const k = zi * n + xi;
        const edgeNoise = noise.fbm(x, z, 1 / 6, 2) * 1.6;
        const rw = (def.roadWidth ?? 6.4) / 2;
        const road = 1 - smoothstep(rw - 1, rw + 1, this.roadDist[k] + edgeNoise * (rw > 4 ? 0.3 : 1));
        let packed = 0;
        for (const f of def.flatten) {
          packed = Math.max(packed, smoothstep(f.r * 0.85, f.r * 0.35, Math.hypot(x - f.x, z - f.z) + edgeNoise * 6));
        }
        const slope = 1 - this.normalAt(x, z)[1];
        const patches = smoothstep(-0.35, 0.25, noise.fbm(x, z, 1 / 25, 3));
        let grass = (1 - road) * (1 - packed * 0.85) * smoothstep(0.32, 0.12, slope) * patches;
        grass *= smoothstep(def.mountainHeight * 0.6, def.mountainHeight * 0.3, this.heights[k]);
        if (def.paved?.some((p) => Math.abs(z - p.z) < p.half)) grass = 0;
        const o = k * 4;
        this.mask[o] = road * 255;
        this.mask[o + 1] = grass * 255;
        this.mask[o + 2] = packed * 255;
        this.mask[o + 3] = 255;
      }
    }
  }

  private at(xi: number, zi: number): number {
    xi = Math.max(0, Math.min(this.n - 1, xi));
    zi = Math.max(0, Math.min(this.n - 1, zi));
    return this.heights[zi * this.n + xi];
  }

  heightAt(x: number, z: number): number {
    const fx = (x + this.half) / this.step, fz = (z + this.half) / this.step;
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const tx = fx - x0, tz = fz - z0;
    const a = lerp(this.at(x0, z0), this.at(x0 + 1, z0), tx);
    const b = lerp(this.at(x0, z0 + 1), this.at(x0 + 1, z0 + 1), tx);
    return lerp(a, b, tz);
  }

  normalAt(x: number, z: number, e = this.step): [number, number, number] {
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const len = Math.hypot(dx, 2 * e, dz);
    return [-dx / len, (2 * e) / len, -dz / len];
  }

  maskAt(x: number, z: number, channel: 0 | 1 | 2): number {
    const xi = Math.round((x + this.half) / this.step), zi = Math.round((z + this.half) / this.step);
    if (xi < 0 || zi < 0 || xi >= this.n || zi >= this.n) return 0;
    return this.mask[(zi * this.n + xi) * 4 + channel] / 255;
  }

  /** Column-major copy (x columns, z rows) as expected by Rapier's heightfield. */
  rapierHeights(): Float32Array {
    const { n } = this;
    const out = new Float32Array(n * n);
    for (let zi = 0; zi < n; zi++) for (let xi = 0; xi < n; xi++) out[zi + xi * n] = this.heights[zi * n + xi];
    return out;
  }
}
