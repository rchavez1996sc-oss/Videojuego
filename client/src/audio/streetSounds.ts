import type { Mixer } from './mixer';

export type StreetKind = 'pass' | 'moto' | 'truck' | 'door' | 'shutter' | 'airbrake';
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Filtered noise through an envelope, panned and faded with distance; optional filter sweep and tremolo. */
function band(m: Mixer, o: { t: number; type: BiquadFilterType; f: number; f1?: number; q: number; vol: number; attack: number; dur: number; trem?: number; pan: number }): void {
  const { ctx } = m, src = m.noise(), flt = ctx.createBiquadFilter(), p = ctx.createStereoPanner();
  flt.type = o.type;
  flt.Q.value = o.q;
  flt.frequency.setValueAtTime(o.f, o.t);
  if (o.f1) flt.frequency.exponentialRampToValueAtTime(o.f1, o.t + o.attack + o.dur);
  p.pan.value = o.pan;
  let node: AudioNode = src.connect(flt).connect(m.env(o.t, o.vol, o.attack, o.dur));
  if (o.trem) {
    const g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    g.gain.value = 0.6;
    depth.gain.value = 0.4;
    lfo.frequency.value = o.trem;
    lfo.connect(depth).connect(g.gain);
    lfo.start(o.t);
    lfo.stop(o.t + o.attack + o.dur + 0.1);
    node = node.connect(g);
  }
  node.connect(p).connect(m.master);
  src.start(o.t);
  src.stop(o.t + o.attack + o.dur + 0.1);
}

/**
 * Street life heard, not seen: a car or truck going by, a moto's engine pulling away, a car door, a shop shutter
 * rattling, a bus's air brakes. All filtered noise (no pitched tones), quieter and duller with distance.
 */
export function streetSound(m: Mixer, kind: StreetKind, distance: number, pan: number): void {
  if (m.ctx.state !== 'running') return;
  const t = m.ctx.currentTime, fade = Math.max(0.12, 1 - distance / 90), dull = Math.max(0.4, 1 - distance / 120), pn = Math.max(-0.8, Math.min(0.8, pan));
  if (kind === 'pass' || kind === 'truck') {
    const big = kind === 'truck', dur = rnd(1.6, 2.6);
    band(m, { t, type: 'lowpass', f: (big ? 260 : 420) * dull, f1: (big ? 180 : 300) * dull, q: 0.7, vol: (big ? 0.2 : 0.13) * fade, attack: dur * 0.55, dur, trem: big ? 9 : undefined, pan: pn });
    band(m, { t: t + dur * 0.2, type: 'bandpass', f: 1300 * dull, f1: 700 * dull, q: 0.8, vol: 0.05 * fade, attack: dur * 0.4, dur: dur * 0.8, pan: pn });
  } else if (kind === 'moto') {
    const dur = rnd(2, 3.2);
    band(m, { t, type: 'bandpass', f: 220 * dull, f1: 480 * dull, q: 1.6, vol: 0.12 * fade, attack: 0.15, dur, trem: rnd(24, 32), pan: pn });
  } else if (kind === 'door') {
    band(m, { t, type: 'lowpass', f: 380 * dull, q: 1, vol: 0.22 * fade, attack: 0.002, dur: 0.12, pan: pn });
    band(m, { t: t + 0.01, type: 'bandpass', f: 1100 * dull, q: 1.2, vol: 0.05 * fade, attack: 0.002, dur: 0.05, pan: pn });
  } else if (kind === 'shutter') {
    band(m, { t, type: 'bandpass', f: 1500 * dull, q: 1.1, vol: 0.06 * fade, attack: 0.05, dur: rnd(1.2, 2), trem: rnd(16, 22), pan: pn });
    band(m, { t: t + rnd(1.3, 2.1), type: 'lowpass', f: 500 * dull, q: 1, vol: 0.12 * fade, attack: 0.002, dur: 0.15, pan: pn });
  } else {
    band(m, { t, type: 'highpass', f: 2500 * dull, q: 0.6, vol: 0.05 * fade, attack: 0.02, dur: 0.6, pan: pn });
  }
}
