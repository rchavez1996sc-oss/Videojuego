import type { Mixer } from './mixer';

/** Helicopter rotor: a looping low "chop" (noise pulsed at the blade rate) whose level follows distance. */
export class RotorSound {
  private gain: GainNode;
  private src: AudioBufferSourceNode;

  constructor(m: Mixer) {
    const c = m.ctx, rate = c.sampleRate, len = Math.floor(rate * 2), buf = c.createBuffer(1, len, rate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const phase = ((i / rate) * 11) % 1, chop = Math.exp(-phase * 9);
      d[i] = (Math.random() * 2 - 1) * (0.25 + chop) + Math.sin((i / rate) * Math.PI * 2 * 22) * chop * 0.8;
    }
    this.src = c.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.gain = c.createGain();
    this.gain.gain.value = 0;
    this.src.connect(lp).connect(this.gain).connect(m.master);
    this.src.start();
  }

  /** `distance` in metres; silent beyond ~600 m, loud overhead. */
  set distance(d: number) {
    this.gain.gain.value = Math.min(0.9, 60 / Math.max(25, d)) * Math.max(0, 1 - d / 600);
  }

  stop(): void {
    this.src.stop();
  }
}
