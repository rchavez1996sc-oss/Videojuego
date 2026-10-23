import type { Mixer } from './mixer';

type Layer = { every: [number, number]; t: number; play: (m: Mixer, vol: number) => void };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Somebody building a second floor: a short run of hammer blows. */
function hammering(m: Mixer, vol: number): void {
  const t = m.ctx.currentTime, n = Math.floor(rnd(4, 9)), gap = rnd(0.35, 0.55);
  for (let i = 0; i < n; i++) noise(m, t + i * gap + rnd(0, 0.05), 2300, 4, 0.05 * vol, 0.05);
}

function wind(m: Mixer, vol: number): void {
  noise(m, m.ctx.currentTime, rnd(350, 650), 0.6, 0.03 * vol, rnd(3, 5), 1.5);
}

function noise(m: Mixer, t: number, f: number, q: number, vol: number, dur: number, attack = 0.002): void {
  const { ctx } = m, src = m.noise(), bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f;
  bp.Q.value = q;
  src.connect(bp).connect(m.env(t, vol, attack, dur)).connect(m.master);
  src.start(t);
  src.stop(t + attack + dur + 0.05);
}

/** Occasional neighbourhood sounds layered over the traffic bed; quieter while there is shooting. */
export class CityBed {
  private layers: Layer[] = [
    { every: [18, 40], t: 9, play: hammering },
    { every: [12, 25], t: 7, play: wind },
  ];

  constructor(private m: Mixer) {}

  update(dt: number, calm: number): void {
    for (const l of this.layers) {
      if ((l.t -= dt) > 0) continue;
      l.t = rnd(...l.every) / Math.max(0.3, calm);
      if (calm > 0.3) l.play(this.m, calm);
    }
  }
}
