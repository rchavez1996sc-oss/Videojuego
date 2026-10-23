/** Red vignette, directional hit arcs and the death overlay. */
export class DamageFx {
  private vignette = document.createElement('div');
  private arcs = document.createElement('div');
  private death = document.createElement('div');
  private pain = 0;
  private lastHp = 1;
  private struck = false;

  /** `onImpact(k)`: health lost without a hit from someone (a fall), `k` 0..1 by severity. */
  constructor(private onImpact: (k: number) => void = () => {}) {
    this.vignette.id = 'pain';
    this.arcs.id = 'hit-arcs';
    this.death.id = 'death';
    this.death.innerHTML = '<h2>HAS CAÍDO</h2><p>Reagrupando en una posición segura…</p>';
    document.body.append(this.vignette, this.arcs, this.death);
  }

  /** `angle` in radians: 0 = in front, positive = to the right. */
  hit(angle: number, damage: number): void {
    this.pain = Math.min(1, this.pain + damage / 30);
    this.struck = true;
    const arc = document.createElement('i');
    arc.style.transform = `rotate(${angle}rad)`;
    this.arcs.appendChild(arc);
    setTimeout(() => arc.remove(), 1100);
    while (this.arcs.children.length > 5) this.arcs.firstChild!.remove();
  }

  update(dt: number, hpFrac: number): void {
    const lost = this.lastHp - hpFrac;
    if (lost > 0.05 && !this.struck && hpFrac > 0) this.impact(Math.min(1, lost * 2));
    this.lastHp = hpFrac;
    this.struck = false;
    this.pain = Math.max(0, this.pain - dt * 1.5);
    const low = hpFrac < 0.35 ? (0.35 - hpFrac) * 2 : 0;
    this.vignette.style.opacity = Math.min(1, this.pain * 0.8 + low).toFixed(2);
  }

  private impact(k: number): void {
    this.pain = 1;
    this.onImpact(k);
    for (const el of [document.body, document.getElementById('hud')]) {
      el?.classList.remove('jolt');
      void el?.offsetWidth;
      el?.classList.add('jolt');
    }
    setTimeout(() => document.body.classList.remove('jolt'), 700);
  }

  set dead(v: boolean) {
    this.death.classList.toggle('on', v);
  }

  /** Fade to black just before the respawn cut. */
  set cut(v: boolean) {
    this.death.classList.toggle('cut', v);
  }
}
