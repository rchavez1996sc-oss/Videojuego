/** Averages the frame rate over half a second and rewrites the stats line through `text`. */
export class FpsMeter {
  private frames = 0;
  private acc = 0;

  constructor(private el: HTMLElement) {}

  update(dt: number, text: (fps: number) => string): void {
    this.frames++;
    this.acc += dt;
    if (this.acc <= 0.5) return;
    this.el.textContent = text(Math.round(this.frames / this.acc));
    this.frames = this.acc = 0;
  }
}
