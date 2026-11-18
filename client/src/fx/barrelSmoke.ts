import * as THREE from 'three';
import type { Particles } from './particles';

/**
 * Thin smoke curling up from a hot barrel: each shot adds heat, and once the trigger is released after a sustained
 * burst (≥ 4 shots) faint grey wisps rise from the muzzle until the barrel cools (heat decays ~1.3 per second).
 */
export class BarrelSmoke {
  private heat = 0;
  private quiet = 0;
  private acc = 0;
  private at = new THREE.Vector3();

  shot(): void {
    this.heat = Math.min(14, this.heat + 1);
    this.quiet = 0;
  }

  update(dt: number, muzzle: THREE.Object3D, dust: Particles): void {
    this.quiet += dt;
    this.heat = Math.max(0, this.heat - dt * 1.3);
    if (this.heat < 3 || this.quiet < 0.12 || !muzzle.parent) return;
    this.acc += dt * (4 + this.heat * 0.9);
    while (this.acc >= 1) {
      this.acc -= 1;
      muzzle.getWorldPosition(this.at);
      const g = 0.62 + Math.random() * 0.12, strength = Math.min(1, this.heat / 10);
      dust.emit({
        pos: this.at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.02, (Math.random() - 0.5) * 0.02)),
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.25, (Math.random() - 0.5) * 0.08),
        color: new THREE.Color(g, g, g * 1.03), size: 0.05 + Math.random() * 0.04, grow: 0.3, life: 0.9 + Math.random() * 0.7,
        gravity: -0.15, drag: 1.4, alpha: 0.16 + 0.22 * strength,
      });
    }
  }
}
