import type { Renderer } from './renderer';

/** Lowers internal resolution when frame rate drops below target, raises it back when there is headroom. */
export class DynamicResolution {
  scale = 1;
  private acc = 0;
  private frames = 0;
  private good = 0;

  constructor(private renderer: Renderer, private min = 0.6, private target = 57) {}

  update(dt: number): void {
    this.acc += dt;
    this.frames++;
    if (this.acc < 1) return;
    const fps = this.frames / this.acc;
    this.acc = this.frames = 0;
    if (fps < this.target - 4 && this.scale > this.min) {
      this.scale = Math.max(this.min, this.scale - (fps < 40 ? 0.15 : 0.07));
      this.good = 0;
      this.renderer.setScale(this.scale);
    } else if (fps >= this.target && this.scale < 1 && ++this.good >= 4) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.good = 0;
      this.renderer.setScale(this.scale);
    }
  }
}
