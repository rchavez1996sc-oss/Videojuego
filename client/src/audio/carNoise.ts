import type { Mixer } from './mixer';

/**
 * Smaller car noises around the big crash: a knock (bumper tapping a post or a kerb, a door panel thumped — a dull
 * hollow thud with a short rattle of trim) and the scrape of a body grinding along a wall, a barrier or another car,
 * a continuous noise whose pitch, grit and squeal follow the sliding speed.
 */
export function knock(m: Mixer, distance: number, k: number): void {
  const { ctx } = m;
  if (ctx.state !== 'running') return;
  const t = ctx.currentTime + distance / 343, near = Math.max(0.06, 1 - distance / 90), g = (0.35 + k * 0.6) * near;
  const body = ctx.createOscillator(), bf = ctx.createBiquadFilter();
  body.type = 'triangle';
  body.frequency.setValueAtTime(140 + Math.random() * 60, t);
  body.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  bf.type = 'lowpass'; bf.frequency.value = 600;
  body.connect(bf).connect(m.env(t, g, 0.002, 0.16)).connect(m.sfx);
  body.start(t); body.stop(t + 0.25);
  for (let i = 0; i < 3 + k * 5; i++) {
    const src = m.noise(), f = ctx.createBiquadFilter(), at = t + 0.01 + Math.random() * 0.12;
    f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 2400; f.Q.value = 6;
    src.connect(f).connect(m.env(at, g * 0.35, 0.001, 0.04 + Math.random() * 0.05)).connect(m.sfx);
    src.start(at); src.stop(at + 0.15);
  }
}

export class Scrape {
  private src?: AudioBufferSourceNode;
  private grit?: BiquadFilterNode;
  private squeal?: BiquadFilterNode;
  private gain?: GainNode;

  constructor(private m: Mixer) {}

  /** `slide` m/s of grinding contact (0 = none). */
  set(slide: number): void {
    const { ctx } = this.m;
    if (ctx.state !== 'running') return;
    if (!this.src) {
      if (slide < 1.5) return;
      this.src = this.m.noise();
      this.src.loop = true;
      this.grit = ctx.createBiquadFilter(); this.grit.type = 'bandpass'; this.grit.Q.value = 1.2;
      this.squeal = ctx.createBiquadFilter(); this.squeal.type = 'peaking'; this.squeal.Q.value = 12; this.squeal.gain.value = 14;
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      this.src.connect(this.grit).connect(this.squeal).connect(this.gain).connect(this.m.sfx);
      this.src.start();
    }
    const t = ctx.currentTime, k = Math.min(1, Math.max(0, (slide - 1.5) / 14));
    this.gain!.gain.setTargetAtTime(k * 0.55, t, k > 0 ? 0.03 : 0.12);
    this.grit!.frequency.setTargetAtTime(500 + k * 2200 + Math.random() * 300, t, 0.05);
    this.squeal!.frequency.setTargetAtTime(1800 + k * 2600 + Math.random() * 400, t, 0.08);
    if (slide < 0.5 && this.gain!.gain.value < 0.01) this.stop();
  }

  stop(): void {
    this.src?.stop();
    this.src = undefined;
  }
}
