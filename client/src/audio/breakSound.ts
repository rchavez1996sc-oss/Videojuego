import type { Mixer } from './mixer';

/**
 * Dense crackle: many 1–12 ms ticks of filtered noise scattered over `span` s on one source (crumpling sheet metal,
 * splintering wood, grit). One noise source and one gain whose automation draws every tick.
 */
export function crackle(m: Mixer, dest: AudioNode, t: number, count: number, span: number, freq: number, q: number, peak: number, maxDur = 0.012): void {
  const { ctx } = m, src = m.noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0, t);
  const ticks = Array.from({ length: Math.round(count) }, () => Math.random() ** 1.6 * span).sort((a, b) => a - b);
  let free = t;
  for (const o of ticks) {
    const at = Math.max(free, t + o), dur = 0.001 + Math.random() * maxDur, a = peak * (0.25 + Math.random() * 0.75) * (1 - (o / span) * 0.6);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(a, at + 0.0005);
    g.gain.linearRampToValueAtTime(0, at + 0.0005 + dur);
    free = at + 0.0006 + dur;
  }
  src.connect(f).connect(g).connect(dest);
  src.start(t);
  src.stop(free + 0.05);
}

/** Inharmonic ringing of a struck metal tube or pole: partials of a free bar, the low ones lasting longest. */
function ring(m: Mixer, dest: AudioNode, t: number, f0: number, peak: number, decay: number): void {
  for (const [r, a, d] of [[1, 1, 1], [2.76, 0.6, 0.6], [5.4, 0.35, 0.35], [8.93, 0.18, 0.2]] as const) {
    const o = m.ctx.createOscillator();
    o.frequency.value = f0 * r * (0.99 + Math.random() * 0.02);
    o.connect(m.env(t, peak * a, 0.001, decay * d)).connect(dest);
    o.start(t);
    o.stop(t + decay * d + 0.05);
  }
}

function thump(m: Mixer, dest: AudioNode, t: number, f0: number, peak: number, decay: number): void {
  const o = m.ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + decay);
  o.connect(m.env(t, peak, 0.002, decay)).connect(dest);
  o.start(t);
  o.stop(t + decay + 0.05);
}

function hiss(m: Mixer, dest: AudioNode, t: number, type: BiquadFilterType, freq: number, peak: number, attack: number, decay: number): void {
  const src = m.noise(), f = m.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  src.connect(f).connect(m.env(t, peak, attack, decay)).connect(dest);
  src.start(t);
  src.stop(t + attack + decay + 0.05);
}

/**
 * A car mowing something down. Post: bumper thud, the pole's clang ringing out, then its clatter on the pavement as it
 * lands. Rail: tube bending with a grinding squeal, the clank of the joints giving. Tree: the trunk cracking (a sharp
 * snap and a run of splinters), a creak, then the crown thrashing into the ground with a soft heavy thump. `hard` 0..1.
 */
export function snapSound(m: Mixer, kind: 'rail' | 'post' | 'tree', hard: number): void {
  const { ctx } = m;
  if (ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.005, h = Math.max(0.25, hard), out = ctx.createGain(), echo = ctx.createGain();
  out.gain.value = 0.6 + h * 0.35;
  echo.gain.value = 0.3;
  out.connect(m.sfx);
  out.connect(echo).connect(m.street);
  thump(m, out, t, 110, 0.9 * h, 0.18);
  if (kind === 'post') {
    hiss(m, out, t, 'highpass', 3000, 0.5 * h, 0.001, 0.03);
    ring(m, out, t + 0.004, 420 + Math.random() * 160, 0.32, 0.9);
    crackle(m, out, t + 0.01, 10, 0.12, 1800, 2, 0.5);
    const land = t + 0.55 + Math.random() * 0.2;
    ring(m, out, land, 260 + Math.random() * 120, 0.2, 0.5);
    crackle(m, out, land, 14, 0.35, 1400, 1.5, 0.45);
    thump(m, out, land, 150, 0.4, 0.12);
  } else if (kind === 'rail') {
    const src = m.noise(), f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 9;
    f.frequency.setValueAtTime(1900, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    src.connect(f).connect(m.env(t, 0.55 * h, 0.02, 0.3)).connect(out);
    src.start(t);
    src.stop(t + 0.4);
    ring(m, out, t + 0.01, 620 + Math.random() * 200, 0.22, 0.45);
    crackle(m, out, t, 22, 0.3, 1200, 1.2, 0.6);
    crackle(m, out, t + 0.45, 10, 0.3, 900, 1.2, 0.35);
  } else {
    hiss(m, out, t, 'highpass', 2200, 0.55 * h, 0.001, 0.02);
    crackle(m, out, t, 30, 0.35, 1500, 0.9, 0.55, 0.008);
    thump(m, out, t, 75, 0.7, 0.3);
    const creak = ctx.createOscillator(), cf = ctx.createBiquadFilter();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(95, t + 0.25);
    creak.frequency.linearRampToValueAtTime(60, t + 0.85);
    cf.type = 'bandpass';
    cf.frequency.value = 700;
    cf.Q.value = 4;
    creak.connect(cf).connect(m.env(t + 0.25, 0.12, 0.08, 0.5)).connect(out);
    creak.start(t + 0.25);
    creak.stop(t + 0.9);
    const land = t + 1.0 + Math.random() * 0.3;
    hiss(m, out, land - 0.25, 'bandpass', 4200, 0.4, 0.2, 0.7);
    crackle(m, out, land - 0.1, 40, 0.6, 3000, 0.8, 0.3, 0.004);
    thump(m, out, land, 60, 0.8, 0.35);
  }
}
