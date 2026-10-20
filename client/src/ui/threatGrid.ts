export interface Threat { angle: number; dist: number; aware: boolean; neutral?: boolean; supply?: boolean }

const SECTORS = 12;
const RINGS = [30, 70, 130];

/** Polar grid around the player: lights the direction/distance band holding enemies, never exact spots. */
export class ThreatGrid {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private heat = new Float32Array(SECTORS * RINGS.length);
  private alert = new Float32Array(SECTORS * RINGS.length);
  private civil = new Float32Array(SECTORS * RINGS.length);
  private supply = new Float32Array(SECTORS * RINGS.length);
  private t = 0;
  private size = 132;

  constructor() {
    this.canvas.id = 'threat';
    const dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = this.canvas.height = this.size * dpr;
    this.canvas.style.width = this.canvas.style.height = `${this.size}px`;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    document.body.appendChild(this.canvas);
  }

  /** `angle`: radians relative to view direction (0 ahead, + right). */
  update(dt: number, threats: Threat[]): void {
    this.t += dt;
    const target = new Float32Array(this.heat.length), aware = new Float32Array(this.heat.length), civil = new Float32Array(this.heat.length), supply = new Float32Array(this.heat.length);
    for (const th of threats) {
      const ring = RINGS.findIndex((r) => th.dist < r);
      if (ring < 0) continue;
      const a = ((th.angle / (Math.PI * 2)) * SECTORS + SECTORS + 0.5) % SECTORS;
      const k = Math.floor(a) * RINGS.length + ring;
      if (th.supply) {
        supply[k] = 1;
        continue;
      }
      if (th.neutral) {
        civil[k] = Math.min(1, civil[k] + 0.4);
        continue;
      }
      target[k] = Math.min(1, target[k] + 0.55);
      if (th.aware) aware[k] = 1;
    }
    for (let i = 0; i < this.heat.length; i++) {
      this.heat[i] += (target[i] - this.heat[i]) * Math.min(1, dt * 4);
      this.alert[i] += (aware[i] - this.alert[i]) * Math.min(1, dt * 4);
      this.civil[i] += (civil[i] - this.civil[i]) * Math.min(1, dt * 3);
      this.supply[i] += (supply[i] - this.supply[i]) * Math.min(1, dt * 3);
    }
    this.draw();
  }

  private draw(): void {
    const c = this.ctx, s = this.size, cx = s / 2, cy = s / 2, maxR = s / 2 - 3;
    const radius = (i: number) => 12 + ((maxR - 12) * (i + 1)) / RINGS.length;
    c.clearRect(0, 0, s, s);
    c.fillStyle = 'rgba(10, 10, 9, 0.35)';
    c.beginPath();
    c.arc(cx, cy, maxR, 0, Math.PI * 2);
    c.fill();
    const pulse = 0.65 + 0.35 * Math.sin(this.t * 7);
    for (let sec = 0; sec < SECTORS; sec++) {
      const a0 = ((sec - 0.5) / SECTORS) * Math.PI * 2 - Math.PI / 2, a1 = a0 + (Math.PI * 2) / SECTORS;
      for (let r = 0; r < RINGS.length; r++) {
        const k = sec * RINGS.length + r, h = this.heat[k], n = this.civil[k], sp = this.supply[k];
        if (h < 0.02 && n < 0.02 && sp < 0.02) continue;
        c.fillStyle = h >= 0.02 ? `rgba(${200 + 40 * this.alert[k]}, 50, 30, ${h * (0.35 + 0.5 * this.alert[k] * pulse)})`
          : sp >= 0.02 ? `rgba(90, 200, 110, ${sp * 0.55})` : `rgba(235, 232, 220, ${n * 0.3})`;
        c.beginPath();
        c.arc(cx, cy, radius(r) - 1, a0 + 0.02, a1 - 0.02);
        c.arc(cx, cy, r === 0 ? 12 : radius(r - 1) + 1, a1 - 0.02, a0 + 0.02, true);
        c.closePath();
        c.fill();
      }
    }
    c.strokeStyle = 'rgba(232, 226, 212, 0.18)';
    c.lineWidth = 1;
    for (let r = 0; r < RINGS.length; r++) {
      c.beginPath();
      c.arc(cx, cy, radius(r), 0, Math.PI * 2);
      c.stroke();
    }
    for (let sec = 0; sec < SECTORS; sec++) {
      const a = ((sec - 0.5) / SECTORS) * Math.PI * 2 - Math.PI / 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
      c.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
      c.stroke();
    }
    c.fillStyle = 'rgba(232, 226, 212, 0.9)';
    c.beginPath();
    c.moveTo(cx, cy - 6);
    c.lineTo(cx + 4.5, cy + 4);
    c.lineTo(cx - 4.5, cy + 4);
    c.fill();
  }

  set visible(v: boolean) {
    this.canvas.style.display = v ? '' : 'none';
  }
}
