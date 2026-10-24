/**
 * Orchestral stingers for the end of a mission, synthesised on the spot: a brass section (detuned saws through a
 * swelling filter), strings and an "ah" choir pad, timpani, cymbals and a tam-tam, all into a concert-hall reverb.
 */
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Orchestra {
  readonly t0: number;
  private dry: GainNode;
  private wet: GainNode;
  private noise: AudioBuffer;

  constructor(volume: number, readonly ctx: BaseAudioContext) {
    this.t0 = ctx.currentTime + 0.05;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    const out = ctx.createGain();
    out.gain.value = volume;
    out.connect(comp).connect(ctx.destination);
    this.dry = ctx.createGain();
    this.dry.connect(out);
    const hall = ctx.createConvolver();
    hall.buffer = this.impulse(3.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.wet.connect(hall).connect(out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number): AudioBuffer {
    const { ctx } = this, len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * (i < ctx.sampleRate * 0.02 ? i / (ctx.sampleRate * 0.02) : 1);
    }
    return buf;
  }

  private send(node: AudioNode, wet = 1): void {
    node.connect(this.dry);
    const s = this.ctx.createGain();
    s.gain.value = wet;
    node.connect(s).connect(this.wet);
  }

  private env(at: number, attack: number, hold: number, release: number, peak: number): GainNode {
    const g = this.ctx.createGain(), t = this.t0 + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  /** Brass section note: the filter opens with the attack ("blat") and a slow vibrato sets in. */
  brass(at: number, midi: number, dur: number, vel = 1): void {
    const { ctx } = this, t = this.t0 + at, f = hz(midi);
    const g = this.env(at, 0.05, dur, 0.5, 0.11 * vel), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * (6 + 6 * vel)), t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 4.5), t + 0.4);
    const vib = ctx.createOscillator(), depth = ctx.createGain();
    vib.frequency.value = 5.2;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(7, t + 0.5);
    vib.connect(depth);
    for (const det of [-9, 0, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      depth.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
    }
    vib.start(t);
    vib.stop(t + dur + 0.6);
    lp.connect(g);
    this.send(g, 0.8);
  }

  /** Strings and an "ah" choir under the brass: slow swell, formant-filtered saws. */
  pad(at: number, notes: number[], dur: number, vel = 1): void {
    const { ctx } = this, t = this.t0 + at;
    const g = this.env(at, 0.35, dur, 1.4, 0.05 * vel), mix = ctx.createGain();
    for (const [f, q, k] of [[730, 6, 1], [1150, 7, 0.6], [2500, 8, 0.3], [400, 1, 0.8]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const kg = ctx.createGain();
      kg.gain.value = k;
      mix.connect(bp).connect(kg).connect(g);
    }
    for (const n of notes) for (const det of [-12, 11]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(n);
      o.detune.value = det;
      o.connect(mix);
      o.start(t);
      o.stop(t + dur + 1.8);
    }
    this.send(g, 1.3);
  }

  timpani(at: number, midi: number, vel = 1): void {
    const { ctx } = this, t = this.t0 + at, f = hz(midi);
    const o = ctx.createOscillator(), g = this.env(at, 0.004, 0, 1.3, 0.55 * vel);
    o.frequency.setValueAtTime(f * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(g);
    o.start(t);
    o.stop(t + 1.4);
    this.send(g, 0.6);
    this.hiss(at, 'bandpass', 180, 0.25 * vel, 0.002, 0.25, 0.5);
  }

  /** Timpani roll that swells from soft to `vel` over `dur`. */
  roll(at: number, midi: number, dur: number, vel = 1): void {
    for (let x = 0; x < dur; x += 0.065) this.timpani(at + x, midi, 0.15 + vel * 0.7 * (x / dur));
  }

  hiss(at: number, type: BiquadFilterType, freq: number, peak: number, attack: number, release: number, wet = 1, q = 0.7): void {
    const { ctx } = this, t = this.t0 + at, src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    src.buffer = this.noise;
    src.loop = true;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(at, attack, 0, release, peak);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + attack + release + 0.1);
    this.send(g, wet);
  }

  cymbal(at: number, vel = 1, swell = 0): void {
    if (swell) this.hiss(at - swell, 'highpass', 6000, 0.22 * vel, swell, 0.15);
    this.hiss(at, 'highpass', 5200, 0.3 * vel, 0.004, 2.6);
    this.hiss(at, 'bandpass', 3000, 0.12 * vel, 0.004, 1.4, 1, 1.5);
  }

  tamtam(at: number, vel = 1): void {
    this.hiss(at, 'lowpass', 140, 0.9 * vel, 0.01, 3.5, 0.8);
    this.hiss(at + 0.05, 'bandpass', 420, 0.35 * vel, 0.3, 4, 1.2, 3);
  }

  close(after: number): void {
    const { ctx } = this;
    if (ctx instanceof AudioContext) setTimeout(() => ctx.close(), after * 1000);
  }
}

/** Triumphant brass call over a timpani roll, a plagal swell and a long major chord with cymbals and choir. */
export function victoryFanfare(ctx: BaseAudioContext = new AudioContext()): void {
  try {
    const o = new Orchestra(0.75, ctx);
    o.roll(0, 36, 0.85, 0.8);
    o.cymbal(0.85, 0.9, 0.8);
    [[0, 55], [0.14, 55], [0.28, 55]].forEach(([at, n]) => o.brass(at, n, 0.06, 0.8));
    o.brass(0.42, 60, 0.3);
    for (const n of [48, 55, 60, 64, 67, 72]) o.brass(0.85, n, 0.9, 1);
    o.pad(0.85, [48, 60, 64, 67], 1.0);
    o.timpani(0.85, 36, 1);
    for (const n of [53, 57, 60, 65, 69, 72]) o.brass(1.95, n, 0.45, 0.85);
    o.timpani(1.95, 41, 0.8);
    o.roll(2.15, 36, 0.5, 0.7);
    for (const n of [36, 48, 55, 60, 64, 67, 72, 76]) o.brass(2.65, n, 1.9, 1);
    o.pad(2.65, [48, 55, 60, 64, 67, 72], 2.2, 1.2);
    o.timpani(2.65, 36, 1);
    o.cymbal(2.65, 1.1);
    o.timpani(4.4, 36, 0.9);
    o.close(9);
  } catch { /* no audio */ }
}

/** A low minor blow with a tam-tam, a falling horn line, a dark Ab → C minor close and a fading roll. */
export function defeatFanfare(ctx: BaseAudioContext = new AudioContext()): void {
  try {
    const o = new Orchestra(0.95, ctx);
    o.tamtam(0, 1);
    o.timpani(0, 36, 1);
    for (const n of [36, 43, 48, 51]) o.brass(0, n, 0.9, 0.9);
    o.pad(0.1, [48, 51, 55], 1.6, 0.8);
    [[1.0, 55], [1.45, 51], [1.9, 50]].forEach(([at, n]) => o.brass(at, n, 0.35, 0.7));
    for (const n of [44, 48, 51, 56]) o.brass(2.35, n, 0.6, 0.8);
    o.timpani(2.35, 32, 0.7);
    for (const n of [36, 43, 48, 51, 55]) o.brass(3.05, n, 1.8, 0.75);
    o.pad(3.05, [48, 51, 55, 60], 2.2, 1);
    o.roll(3.05, 36, 1.6, 0.6);
    o.tamtam(3.05, 0.7);
    o.close(9);
  } catch { /* no audio */ }
}
