import type { Mixer } from './mixer';

type Layer = { every: [number, number]; t: number; play: (m: Mixer, vol: number) => void };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** A motorbike or mototaxi passing a few streets away: a buzzing engine swelling and fading with a pitch drop. */
function moto(m: Mixer, vol: number): void {
  const { ctx } = m, t = ctx.currentTime, dur = rnd(2.5, 4), f = rnd(70, 110);
  const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), pan = ctx.createStereoPanner();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 1.12, t);
  o.frequency.linearRampToValueAtTime(f * 0.9, t + dur);
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  pan.pan.setValueAtTime(rnd(-1, 0), t);
  pan.pan.linearRampToValueAtTime(rnd(0, 1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.03 * vol, t + dur * 0.5);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(lp).connect(g).connect(pan).connect(m.master);
  o.start(t);
  o.stop(t + dur + 0.1);
}

/** Somebody building a second floor: a short run of hammer blows. */
function hammering(m: Mixer, vol: number): void {
  const t = m.ctx.currentTime, n = Math.floor(rnd(4, 9)), gap = rnd(0.35, 0.55);
  for (let i = 0; i < n; i++) noise(m, t + i * gap + rnd(0, 0.05), 2300, 4, 0.05 * vol, 0.05);
}

function sparrows(m: Mixer, vol: number): void {
  const t = m.ctx.currentTime;
  for (let i = 0; i < Math.floor(rnd(3, 7)); i++) tone(m, t + i * rnd(0.08, 0.18), 'sine', rnd(3800, 5200), 0.05, 0.008 * vol, 9000);
}

function wind(m: Mixer, vol: number): void {
  noise(m, m.ctx.currentTime, rnd(350, 650), 0.6, 0.03 * vol, rnd(3, 5), 1.5);
}

/** A far-off siren wailing for a few seconds. */
function siren(m: Mixer, vol: number): void {
  const { ctx } = m, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  for (let i = 0; i < 4; i++) {
    o.frequency.setValueAtTime(650, t + i * 1.6);
    o.frequency.linearRampToValueAtTime(1150, t + i * 1.6 + 0.8);
    o.frequency.linearRampToValueAtTime(650, t + i * 1.6 + 1.6);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.006 * vol, t + 1.5);
  g.gain.linearRampToValueAtTime(0, t + 6.4);
  o.connect(g).connect(m.reverb);
  o.start(t);
  o.stop(t + 6.5);
}

function tone(m: Mixer, t: number, type: OscillatorType, f: number, dur: number, vol: number, cut: number): void {
  const { ctx } = m, o = ctx.createOscillator(), lp = ctx.createBiquadFilter();
  o.type = type;
  o.frequency.value = f;
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  o.connect(lp).connect(m.env(t, vol, 0.01, dur)).connect(m.master);
  o.start(t);
  o.stop(t + dur + 0.05);
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
    { every: [6, 14], t: 3, play: moto },
    { every: [18, 40], t: 9, play: hammering },
    { every: [8, 20], t: 5, play: sparrows },
    { every: [12, 25], t: 7, play: wind },
    { every: [60, 120], t: 45, play: siren },
  ];

  constructor(private m: Mixer) {}

  update(dt: number, calm: number): void {
    for (const l of this.layers) {
      if ((l.t -= dt) > 0) continue;
      l.t = rnd(...l.every) / Math.max(0.3, calm);
      if (calm > 0.3 || l.play === siren) l.play(this.m, calm);
    }
  }
}
