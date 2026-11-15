import type { Mixer } from './mixer';

/** A noise burst through a filter (optionally sweeping), into `dest`. */
function burst(m: Mixer, dest: AudioNode, t: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, attack: number, decay: number): void {
  const src = m.noise(), f = m.ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
  src.connect(f).connect(m.env(t, peak, attack, decay)).connect(dest);
  src.start(t);
  src.stop(t + attack + decay + 0.1);
}

/**
 * A car crash that sounds like one: the deep thump of the body taking the hit, sheet metal crumpling (several
 * resonant ringing bursts, each a panel buckling), the bang of plastic and the bumper, safety glass bursting into a
 * hiss of pebbles, debris clattering down and a short scrape as the cars grind apart. `hard` 0..1 scales loudness,
 * length and how much breaks; louder close up, low-passed and later with distance, with a slap off the façades.
 */
export function crashSound(m: Mixer, distance: number, hard: number): void {
  const { ctx } = m;
  if (ctx.state !== 'running') return;
  const h = Math.max(0.2, Math.min(1, hard)), t = ctx.currentTime + distance / 343 + 0.005, near = Math.max(0.08, 1 - distance / 150);
  const out = ctx.createGain(), dull = ctx.createBiquadFilter(), echo = ctx.createGain();
  out.gain.value = (0.75 + h * 0.9) * near;
  dull.type = 'lowpass';
  dull.frequency.value = 18000 * Math.max(0.12, 1 - distance / 110);
  echo.gain.value = 0.35;
  out.connect(dull).connect(m.sfx);
  dull.connect(echo).connect(m.street);
  const sub = ctx.createOscillator(), sg = m.env(t, 1.6 * h, 0.003, 0.32);
  sub.frequency.setValueAtTime(85, t);
  sub.frequency.exponentialRampToValueAtTime(32, t + 0.3);
  sub.connect(sg).connect(out);
  sub.start(t);
  sub.stop(t + 0.45);
  burst(m, out, t, 'lowpass', 900, 150, 0.7, 1.4, 0.002, 0.28);
  burst(m, out, t + 0.004, 'bandpass', 2600, 900, 0.8, 0.9, 0.001, 0.12);
  const panels = 3 + Math.round(h * 6);
  for (let i = 0; i < panels; i++) {
    const at = t + Math.random() * (0.08 + h * 0.18), f = 450 + Math.random() * 1900;
    burst(m, out, at, 'bandpass', f, f * (0.7 + Math.random() * 0.2), 7 + Math.random() * 8, 0.55 + Math.random() * 0.4, 0.002, 0.18 + Math.random() * 0.35);
  }
  if (h > 0.45) {
    burst(m, out, t + 0.02, 'highpass', 4500, 3000, 0.7, 0.55 * h, 0.002, 0.35);
    for (let i = 0; i < 10 + h * 14; i++) burst(m, out, t + 0.06 + Math.random() * 0.7, 'bandpass', 3500 + Math.random() * 4500, 3000, 4, 0.12 + Math.random() * 0.12, 0.001, 0.03);
  }
  for (let i = 0; i < 4 + h * 8; i++) burst(m, out, t + 0.15 + Math.random() * (0.4 + h * 0.6), 'bandpass', 600 + Math.random() * 1600, 500, 2.5, 0.18 + Math.random() * 0.25, 0.001, 0.05 + Math.random() * 0.06);
  burst(m, out, t + 0.05, 'bandpass', 1400, 600, 1.5, 0.35 * h, 0.04, 0.45 + h * 0.4);
}
