import type { Mixer } from './mixer';
import { crackle } from './breakSound';

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
  crackle(m, m.sfx, t + 0.005, 6 + k * 18, 0.1 + k * 0.08, 1500, 1.2, g * 0.6, 0.006);
}

export class Scrape {
  private src?: AudioBufferSourceNode;
  private grit?: BiquadFilterNode;
  private squeal?: BiquadFilterNode;
  private gain?: GainNode;
  private jit?: AudioBufferSourceNode;

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
      this.squeal = ctx.createBiquadFilter(); this.squeal.type = 'peaking'; this.squeal.Q.value = 8; this.squeal.gain.value = 9;
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      const am = ctx.createGain(), jit = this.m.noise(), slow = ctx.createBiquadFilter(), depth = ctx.createGain(), low = ctx.createBiquadFilter(), body = ctx.createGain();
      slow.type = 'lowpass'; slow.frequency.value = 35; depth.gain.value = 3;
      low.type = 'lowpass'; low.frequency.value = 240; body.gain.value = 1.6;
      jit.connect(slow).connect(depth).connect(am.gain);
      this.src.connect(this.grit).connect(this.squeal).connect(am);
      this.src.connect(low).connect(body).connect(am);
      am.connect(this.gain).connect(this.m.sfx);
      this.src.start();
      jit.start();
      this.jit = jit;
    }
    const t = ctx.currentTime, k = Math.min(1, Math.max(0, (slide - 1.5) / 14));
    this.gain!.gain.setTargetAtTime(k * 0.55, t, k > 0 ? 0.03 : 0.12);
    this.grit!.frequency.setTargetAtTime(500 + k * 2200 + Math.random() * 300, t, 0.05);
    this.squeal!.frequency.setTargetAtTime(1800 + k * 2600 + Math.random() * 400, t, 0.08);
    if (slide < 0.5 && this.gain!.gain.value < 0.01) this.stop();
  }

  stop(): void {
    this.src?.stop();
    this.jit?.stop();
    this.src = this.jit = undefined;
  }
}
