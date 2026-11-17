import type { Renderer } from './renderer';

/**
 * Lowers internal resolution when the frame rate stays below target and raises it back only after a long stretch of
 * headroom. Every change reallocates all post-processing buffers (a visible hitch), so it must not oscillate: a drop
 * needs 2 slow seconds in a row (1 if under 40 fps), a rise 6 good seconds, and the scale that just failed stays
 * banned for 45 s.
 */
export class DynamicResolution {
  scale = 1;
  private acc = 0;
  private frames = 0;
  private good = 0;
  private slow = 0;
  private ceiling = 1;
  private banUntil = 0;
  private clock = 0;

  constructor(private renderer: Renderer, private min = 0.7, private target = 57) {}

  update(dt: number): void {
    this.acc += dt;
    this.clock += dt;
    this.frames++;
    if (this.acc < 1) return;
    const fps = this.frames / this.acc;
    this.acc = this.frames = 0;
    if (this.clock > this.banUntil) this.ceiling = 1;
    if (fps < this.target - 4) {
      this.good = 0;
      if (++this.slow < (fps < 40 ? 1 : 2) || this.scale <= this.min) return;
      this.slow = 0;
      [this.ceiling, this.banUntil] = [this.scale - 0.01, this.clock + 45];
      this.apply(Math.max(this.min, this.scale - (fps < 40 ? 0.15 : 0.1)));
    } else {
      this.slow = 0;
      if (fps >= this.target && this.scale < this.ceiling && ++this.good >= 6) {
        this.good = 0;
        this.apply(Math.min(this.ceiling, this.scale + 0.1));
      }
    }
  }

  private apply(scale: number): void {
    if (Math.abs(scale - this.scale) < 0.02) return;
    this.scale = scale;
    this.renderer.setScale(scale);
  }
}
