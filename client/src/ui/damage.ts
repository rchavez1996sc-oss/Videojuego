/** Red vignette, directional hit arcs and the death overlay. */
export class DamageFx {
  private vignette = document.createElement('div');
  private arcs = document.createElement('div');
  private death = document.createElement('div');
  private pain = 0;

  constructor() {
    this.vignette.id = 'pain';
    this.arcs.id = 'hit-arcs';
    this.death.id = 'death';
    this.death.innerHTML = '<h2>HAS CAÍDO</h2><p>Reagrupando en el punto de inicio…</p>';
    document.body.append(this.vignette, this.arcs, this.death);
  }

  /** `angle` in radians: 0 = in front, positive = to the right. */
  hit(angle: number, damage: number): void {
    this.pain = Math.min(1, this.pain + damage / 30);
    const arc = document.createElement('i');
    arc.style.transform = `rotate(${angle}rad)`;
    this.arcs.appendChild(arc);
    setTimeout(() => arc.remove(), 1100);
    while (this.arcs.children.length > 5) this.arcs.firstChild!.remove();
  }

  update(dt: number, hpFrac: number): void {
    this.pain = Math.max(0, this.pain - dt * 1.5);
    const low = hpFrac < 0.35 ? (0.35 - hpFrac) * 2 : 0;
    this.vignette.style.opacity = Math.min(1, this.pain * 0.8 + low).toFixed(2);
  }

  set dead(v: boolean) {
    this.death.classList.toggle('on', v);
  }
}
