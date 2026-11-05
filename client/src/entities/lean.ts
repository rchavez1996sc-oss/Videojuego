import * as THREE from 'three';

const SHARE = [0.3, 0.35, 0.35];

/**
 * Procedural body lean from the root's motion: rolls into turns (yaw rate × forward speed) and pitches forward
 * when accelerating or sprinting, back when braking. Damped so frame jitter does not show; applied on the spine
 * after the mixer (the rig restores the spine before the next mixer update).
 */
export class Lean {
  roll = 0;
  pitch = 0;
  private yaw = NaN;
  private fwd = 0;

  update(dt: number, yaw: number, fwd: number): void {
    const t = Math.max(dt, 1e-3);
    if (Number.isNaN(this.yaw)) [this.yaw, this.fwd] = [yaw, fwd];
    const yawRate = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw)) / t, acc = (fwd - this.fwd) / t;
    this.yaw = yaw;
    this.fwd = fwd;
    const roll = THREE.MathUtils.clamp(-yawRate * Math.max(0, fwd) * 0.03, -0.2, 0.2);
    const pitch = THREE.MathUtils.clamp(acc * 0.012 + Math.max(0, fwd - 3) * 0.03, -0.1, 0.16);
    this.roll = THREE.MathUtils.damp(this.roll, roll, 6, t);
    this.pitch = THREE.MathUtils.damp(this.pitch, pitch, 4, t);
  }

  get active(): boolean { return Math.abs(this.roll) > 0.004 || Math.abs(this.pitch) > 0.004; }

  apply(spine: THREE.Bone[]): void {
    spine.forEach((b, i) => {
      b.rotateZ(this.roll * SHARE[i]);
      b.rotateX(this.pitch * SHARE[i]);
    });
  }
}
