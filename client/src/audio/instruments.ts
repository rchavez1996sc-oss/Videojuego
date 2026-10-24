import { hz, type Orchestra } from './fanfare';

/** Extra voices for the fanfares, built on the Orchestra's envelopes, noise and hall. */

/** Bright trumpet: square-ish reed through an opening filter, a tongued attack and late vibrato. */
export function trumpet(o: Orchestra, at: number, midi: number, dur: number, vel = 1): void {
  const { ctx } = o, t = o.t0 + at, f = hz(midi);
  const g = o.env(at, 0.025, dur, 0.18, 0.1 * vel), lp = ctx.createBiquadFilter(), peak = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 2, t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(12000, f * 10), t + 0.04);
  lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 7), t + 0.2);
  peak.type = 'peaking';
  peak.frequency.value = 1500;
  peak.gain.value = 6;
  const vib = ctx.createOscillator(), depth = ctx.createGain();
  vib.frequency.value = 5.6;
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(dur > 0.4 ? 9 : 0, t + Math.max(0.05, dur * 0.6));
  vib.connect(depth);
  for (const [type, det, k] of [['sawtooth', -4, 1], ['square', 5, 0.6]] as const) {
    const osc = ctx.createOscillator(), kg = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f * 0.97, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    osc.detune.value = det;
    depth.connect(osc.detune);
    kg.gain.value = k;
    osc.connect(kg).connect(lp);
    osc.start(t);
    osc.stop(t + dur + 0.3);
  }
  vib.start(t);
  vib.stop(t + dur + 0.3);
  lp.connect(peak).connect(g);
  o.send(g, 0.7);
  o.hiss(at, 'bandpass', 2500, 0.03 * vel, 0.002, 0.03, 0.3, 1);
}

/** Breathy flute / quena: a pure tone with breath noise and a soft vibrato. */
export function flute(o: Orchestra, at: number, midi: number, dur: number, vel = 1): void {
  const { ctx } = o, t = o.t0 + at, f = hz(midi);
  const g = o.env(at, 0.05, dur, 0.15, 0.12 * vel), osc = ctx.createOscillator(), h2 = ctx.createOscillator(), k2 = ctx.createGain();
  osc.frequency.value = f;
  h2.frequency.value = f * 2;
  k2.gain.value = 0.18;
  const vib = ctx.createOscillator(), depth = ctx.createGain();
  vib.frequency.value = 5;
  depth.gain.value = 10;
  vib.connect(depth).connect(osc.detune);
  depth.connect(h2.detune);
  osc.connect(g);
  h2.connect(k2).connect(g);
  for (const x of [osc, h2, vib]) {
    x.start(t);
    x.stop(t + dur + 0.25);
  }
  o.send(g, 1);
  o.hiss(at, 'bandpass', f * 2, 0.025 * vel, 0.04, dur, 1, 2);
}

/** Plucked string (Karplus-Strong, rendered on the spot): charango or guitar depending on `bright`. */
export function pluck(o: Orchestra, at: number, midi: number, vel = 1, bright = 0.6, decay = 1.2): void {
  const { ctx } = o, sr = ctx.sampleRate, f = hz(midi), n = Math.floor(sr * decay), p = Math.max(2, Math.round(sr / f));
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < p; i++) d[i] = Math.random() * 2 - 1;
  const damp = 0.5 + bright * 0.497;
  for (let i = p; i < n; i++) d[i] = damp * 0.5 * (d[i - p] + d[i - p + 1]) * 0.999 + (1 - damp) * d[i - p];
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf;
  g.gain.value = 0.22 * vel;
  src.connect(g);
  src.start(o.t0 + at);
  o.send(g, 0.8);
}

/** A strummed chord: strings struck a few ms apart. */
export function strum(o: Orchestra, at: number, notes: number[], vel = 1, bright = 0.7, decay = 1.2): void {
  notes.forEach((n, i) => pluck(o, at + i * 0.012, n, vel, bright, decay));
}

/** Big drum: Andean bombo (`taiko` false) or a heavy taiko hit. */
export function drum(o: Orchestra, at: number, vel = 1, taiko = false): void {
  const { ctx } = o, t = o.t0 + at, f = taiko ? 55 : 80;
  const osc = ctx.createOscillator(), g = o.env(at, 0.003, 0, taiko ? 1.2 : 0.45, (taiko ? 0.9 : 0.6) * vel);
  osc.frequency.setValueAtTime(f * 2.2, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 1.3);
  o.send(g, taiko ? 0.9 : 0.5);
  o.hiss(at, 'lowpass', taiko ? 500 : 1400, (taiko ? 0.5 : 0.3) * vel, 0.002, taiko ? 0.25 : 0.08, 0.6);
}

/** Church organ: additive drawbars with a slow swell. */
export function organ(o: Orchestra, at: number, notes: number[], dur: number, vel = 1): void {
  const { ctx } = o, t = o.t0 + at, g = o.env(at, 0.08, dur, 0.6, 0.035 * vel);
  for (const n of notes) for (const [r, k] of [[0.5, 0.6], [1, 1], [2, 0.7], [3, 0.35], [4, 0.3], [8, 0.12]]) {
    const osc = ctx.createOscillator(), kg = ctx.createGain();
    osc.frequency.value = hz(n) * r;
    kg.gain.value = k;
    osc.connect(kg).connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.8);
  }
  o.send(g, 1.4);
}

/** Overdriven guitar power chord (root, fifth, octave) through a soft clipper and a cabinet filter. */
export function powerChord(o: Orchestra, at: number, root: number, dur: number, vel = 1): void {
  const { ctx } = o, t = o.t0 + at, shaper = ctx.createWaveShaper(), cab = ctx.createBiquadFilter();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 6);
  shaper.curve = curve;
  cab.type = 'lowpass';
  cab.frequency.value = 3200;
  const g = o.env(at, 0.005, dur, 0.4, 0.09 * vel), pre = ctx.createGain();
  pre.gain.value = 0.6;
  for (const n of [root, root + 7, root + 12]) for (const det of [-6, 6]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = hz(n);
    osc.detune.value = det;
    osc.connect(pre);
    osc.start(t);
    osc.stop(t + dur + 0.5);
  }
  pre.connect(shaper).connect(cab).connect(g);
  o.send(g, 0.5);
}

/** Marimba / xylophone bar: a sine with its 4th partial, quick decay. */
export function mallet(o: Orchestra, at: number, midi: number, vel = 1): void {
  const { ctx } = o, t = o.t0 + at;
  for (const [r, k, d] of [[1, 1, 0.5], [3.9, 0.35, 0.12], [9.2, 0.12, 0.05]]) {
    const osc = ctx.createOscillator(), g = o.env(at, 0.002, 0, d, 0.16 * vel * k);
    osc.frequency.value = hz(midi) * r;
    osc.connect(g);
    osc.start(t);
    osc.stop(t + d + 0.1);
    o.send(g, 0.7);
  }
}

/** Modern "supersaw" synth chord with a rising noise sweep into it. */
export function synthHit(o: Orchestra, at: number, notes: number[], dur: number, vel = 1, riser = 0): void {
  const { ctx } = o, t = o.t0 + at;
  if (riser) {
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = o.env(at - riser, riser, 0, 0.05, 0.12 * vel);
    src.buffer = o.noise;
    src.loop = true;
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, t - riser);
    bp.frequency.exponentialRampToValueAtTime(6000, t);
    src.connect(bp).connect(g);
    src.start(t - riser);
    src.stop(t + 0.1);
    o.send(g, 0.6);
  }
  const lp = ctx.createBiquadFilter(), g = o.env(at, 0.01, dur, 0.5, 0.03 * vel);
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(8000, t);
  lp.frequency.exponentialRampToValueAtTime(2200, t + dur);
  for (const n of notes) for (const det of [-22, -11, -4, 0, 4, 11, 22]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = hz(n);
    osc.detune.value = det;
    osc.connect(lp);
    osc.start(t);
    osc.stop(t + dur + 0.6);
  }
  lp.connect(g);
  o.send(g, 0.8);
}
