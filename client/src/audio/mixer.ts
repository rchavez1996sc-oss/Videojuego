/** Shared AudioContext with master bus, compressor and a valley-style reverb send. */
export class Mixer {
  readonly ctx = new AudioContext();
  readonly master: GainNode;
  readonly sfx: GainNode;
  readonly reverb: GainNode;
  private noiseBuf: AudioBuffer;

  constructor() {
    const { ctx } = this;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(3.2);
    this.reverb = ctx.createGain();
    this.reverb.gain.value = 0.55;
    this.reverb.connect(conv).connect(this.master);
    const echo = ctx.createDelay(1.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    echo.delayTime.value = 0.42;
    fb.gain.value = 0.28;
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    this.reverb.connect(echo).connect(lp).connect(fb).connect(echo);
    lp.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number): AudioBuffer {
    const { ctx } = this, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        const slap = [0.09, 0.21, 0.37, 0.6].some((r) => Math.abs(t - r - c * 0.013) < 0.004) ? 0.6 : 0;
        d[i] = ((Math.random() * 2 - 1) * 0.35 + slap * (Math.random() - 0.5)) * Math.pow(1 - t / seconds, 3.2);
      }
    }
    return buf;
  }

  resume(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  noise(): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loopStart = Math.random() * 0.5;
    src.loop = true;
    return src;
  }

  /** Envelope helper: returns a gain that ramps 0 → peak → 0. */
  env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }
}
