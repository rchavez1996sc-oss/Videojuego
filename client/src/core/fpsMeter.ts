/**
 * Averages the frame rate over half a second and rewrites the stats line through `text`, with the CPU time of a
 * frame (simulation + draw submission): close to the frame time → CPU-bound; much lower → the GPU is the limit.
 */
export class FpsMeter {
  private frames = 0;
  private acc = 0;
  private cpuMs = 0;

  constructor(private el: HTMLElement) {}

  /** Wraps one frame's work to time it. */
  time(work: () => void): void {
    const t0 = performance.now();
    work();
    this.cpuMs += performance.now() - t0;
  }

  update(dt: number, text: (fps: number, cpu: number) => string): void {
    this.frames++;
    this.acc += dt;
    if (this.acc <= 0.5) return;
    this.el.textContent = text(Math.round(this.frames / this.acc), Math.round((this.cpuMs / this.frames) * 10) / 10);
    this.frames = this.acc = this.cpuMs = 0;
  }
}
