import * as THREE from 'three';

/** Screen-space bars above units, shown briefly after they take damage. */
export class HealthBars {
  private root = document.createElement('div');
  private bars = new Map<number, HTMLElement>();
  private v = new THREE.Vector3();

  constructor() {
    this.root.id = 'healthbars';
    document.body.appendChild(this.root);
  }

  /** `bleeding`: a downed ally, the bar becomes a draining countdown. */
  update(id: number, world: THREE.Vector3, frac: number, visible: number, camera: THREE.Camera, enemy = true, label = '', bleeding = false): void {
    let el = this.bars.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = `hb ${enemy ? 'enemy' : 'ally'}`;
      el.innerHTML = '<div></div>';
      if (label) el.dataset.label = label;
      this.root.appendChild(el);
      this.bars.set(id, el);
    }
    this.v.copy(world).project(camera);
    const show = visible > 0 && this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1;
    el.style.opacity = show ? String(Math.min(1, visible * 2)) : '0';
    el.classList.toggle('bleeding', bleeding);
    if (!show) return;
    el.style.transform = `translate(${((this.v.x + 1) / 2) * innerWidth}px, ${((1 - this.v.y) / 2) * innerHeight}px)`;
    (el.firstChild as HTMLElement).style.width = `${Math.max(0, frac) * 100}%`;
  }
}
