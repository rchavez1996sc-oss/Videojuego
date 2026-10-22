/** Procedural score for the prologue: low drone, slow minor string chords per plate, timpani on each cut. */
const CHORDS = [
  [146.8, 174.6, 220.0],
  [116.5, 146.8, 174.6],
  [98.0, 116.5, 146.8],
  [110.0, 138.6, 164.8],
  [146.8, 174.6, 220.0],
];

export class IntroMusic {
  private ctx = new AudioContext();
  private out: GainNode;
  private verb: ConvolverNode;
  private voices: OscillatorNode[] = [];
  private chordGain: GainNode | null = null;

  constructor() {
    const c = this.ctx;
    this.out = c.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(c.destination);
    this.verb = c.createConvolver();
    const len = c.sampleRate * 3.5, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.5;
    this.verb.connect(wet).connect(this.out);
  }

  start(): void {
    const c = this.ctx, t = c.currentTime;
    void c.resume();
    const lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 4);
    for (const [f, type] of [[36.7, 'sawtooth'], [36.9, 'sawtooth'], [73.4, 'triangle']] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      this.voices.push(o);
    }
    lp.connect(g).connect(this.out);
  }

  /** New plate: a timpani hit (soft at first, building towards the title) and the next chord swelling in. */
  plate(i: number): void {
    const c = this.ctx, t = c.currentTime;
    this.timpani(t, 0.18 + i * 0.16);
    if (this.chordGain) {
      this.chordGain.gain.cancelScheduledValues(t);
      this.chordGain.gain.setTargetAtTime(0, t, 0.8);
    }
    const g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1400, t + 6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 2.2);
    lp.connect(g);
    g.connect(this.out);
    g.connect(this.verb);
    for (const f of CHORDS[i % CHORDS.length]) for (const det of [-6, 0, 7]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + 14);
    }
    this.chordGain = g;
  }

  /** A typewriter key strike (a softer thud for the space bar). */
  key(space: boolean): void {
    const c = this.ctx, t = c.currentTime, len = Math.floor(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    bp.type = 'bandpass';
    bp.frequency.value = space ? 900 : 2200 + Math.random() * 900;
    bp.Q.value = 1.4;
    g.gain.value = space ? 0.14 : 0.26;
    src.connect(bp).connect(g).connect(this.out);
    src.start(t);
    const o = c.createOscillator(), og = c.createGain();
    o.frequency.setValueAtTime(space ? 120 : 180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    og.gain.setValueAtTime(space ? 0.06 : 0.1, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(og).connect(this.out);
    o.start(t);
    o.stop(t + 0.07);
  }

  /** Chapter title: big hit and a high tremolo. */
  title(): void {
    const c = this.ctx, t = c.currentTime;
    this.timpani(t, 1.4);
    this.timpani(t + 0.18, 0.8);
    const o = c.createOscillator(), g = c.createGain(), trem = c.createOscillator(), depth = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 880;
    trem.frequency.value = 9;
    depth.gain.value = 0.012;
    trem.connect(depth).connect(g.gain);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + 1.5);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    o.connect(lp).connect(g);
    g.connect(this.verb);
    g.connect(this.out);
    o.start(t);
    trem.start(t);
    o.stop(t + 12);
    trem.stop(t + 12);
  }

  stop(): void {
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.6);
    setTimeout(() => {
      this.voices.forEach((o) => o.stop());
      void this.ctx.close();
    }, 3000);
  }

  private timpani(t: number, v: number): void {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.8);
    g.gain.setValueAtTime(v * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    o.connect(g);
    g.connect(this.out);
    g.connect(this.verb);
    o.start(t);
    o.stop(t + 2.3);
  }
}
