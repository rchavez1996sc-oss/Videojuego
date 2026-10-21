import type { Mixer } from './mixer';

const CHORDS = [[110, 130.8, 164.8], [87.3, 110, 130.8], [73.4, 87.3, 110], [82.4, 98, 123.5]];

/** Low tension bed: detuned drone, slow minor pads, and a heartbeat pulse that only comes in when the fight heats up. */
export class Music {
  private intensity = 0;
  private target = 0;
  private hitBoost = 0;
  private lastHp = 100;
  private chordT = 0;
  private chord = 0;
  private beatT = 0;
  private pads: { osc: OscillatorNode; gain: GainNode }[] = [];
  private droneGain: GainNode;
  private droneFilter: BiquadFilterNode;
  private started = false;

  constructor(private m: Mixer) {
    const { ctx } = m;
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 220;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneFilter.connect(this.droneGain).connect(m.music);
    m.music.gain.value = 0.55;
  }

  private start(): void {
    const { ctx } = this.m;
    for (const [f, detune] of [[55, -7], [55, 6], [82.4, 0]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(this.droneFilter);
      o.start();
    }
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), lp = ctx.createBiquadFilter();
      osc.type = 'triangle';
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      gain.gain.value = 0;
      osc.connect(lp).connect(gain).connect(this.m.music);
      osc.start();
      this.pads.push({ osc, gain });
    }
    this.started = true;
  }

  private beat(t: number, strong: boolean): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(strong ? 70 : 58, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.25);
    const g = this.m.env(t, (strong ? 0.5 : 0.3) * this.intensity, 0.005, 0.3);
    o.connect(g).connect(this.m.music);
    o.start(t);
    o.stop(t + 0.4);
    if (this.intensity > 0.55) {
      const n = this.m.noise(), f = ctx.createBiquadFilter(), e = this.m.env(t + 0.375, 0.06 * this.intensity, 0.002, 0.05);
      f.type = 'highpass';
      f.frequency.value = 6000;
      n.connect(f).connect(e).connect(this.m.music);
      n.start(t + 0.375);
      n.stop(t + 0.45);
    }
  }

  /** `combat`: enemies are fighting nearby; a drop in `hp` counts as being hit. */
  update(dt: number, combat: boolean, hp: number): void {
    if (this.m.ctx.state !== 'running') return;
    if (!this.started) this.start();
    if (hp < this.lastHp - 0.5) this.hitBoost = 1;
    this.lastHp = hp;
    this.hitBoost = Math.max(0, this.hitBoost - dt / 12);
    this.target = Math.max(0.15, combat ? 0.5 : 0.15, this.hitBoost);
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * (this.target > this.intensity ? 1.5 : 0.25));
    const t = this.m.ctx.currentTime, k = this.intensity;
    this.droneGain.gain.setTargetAtTime(0.012 + k * 0.03, t, 0.5);
    this.droneFilter.frequency.setTargetAtTime(160 + k * 380, t, 0.8);
    if ((this.chordT -= dt) <= 0) {
      this.chordT = 9 - k * 3;
      this.chord = (this.chord + 1 + Math.floor(Math.random() * 2)) % CHORDS.length;
      this.pads.forEach((p, i) => {
        p.osc.frequency.setTargetAtTime(CHORDS[this.chord][i] * 2, t, 1.2);
        p.gain.gain.setTargetAtTime(0.006 + k * 0.01, t, 2);
      });
    }
    if (k > 0.35 && (this.beatT -= dt) <= 0) {
      this.beatT = 0.75 - (k - 0.35) * 0.35;
      this.beat(t + 0.02, Math.random() < 0.5);
    }
  }
}
