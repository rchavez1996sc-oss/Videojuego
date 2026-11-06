import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Particles } from './particles';
import type { Decals } from './decals';
import type { Lighting } from '../render/lighting';
import { Billows } from './billows';
import { Debris } from './debris';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const C = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

/**
 * Explosion: a real light flash that lights the street, a turbulent fireball that rolls into soot, a dark smoke column
 * that rises and spreads for several seconds, a ground-hugging dust surge, sparks, hot fragments, physical debris
 * that bounces and settles, and a scorch mark. The point light always exists (intensity 0 at rest) so no shader
 * recompiles when it fires.
 */
export class Blast {
  readonly group = new THREE.Group();
  private fireB = new Billows(true);
  private smoke = new Billows(false);
  private debris: Debris;
  private light = new THREE.PointLight('#ffb27a', 0, 45, 2);
  private flashT = 9;

  constructor(private sparks: Particles, private dust: Particles, private decals: Decals, world: RAPIER.World, lighting: Lighting) {
    this.debris = new Debris(world, lighting.setup(new THREE.MeshStandardMaterial({ color: '#58524b', roughness: 0.95 }), 'debris'));
    this.group.add(this.smoke.mesh, this.fireB.mesh, this.debris.mesh, this.light);
  }

  fire(at: THREE.Vector3): void {
    const { sparks, dust } = this, v = new THREE.Vector3(), o = (y: number) => at.clone().setY(at.y + y);
    this.decals.place(at.clone().setY(at.y - 0.03), new THREE.Vector3(0, 1, 0), 3.8, new THREE.Color('#120d09'));
    this.light.position.copy(o(1.2));
    this.flashT = 0;
    sparks.emit({ pos: o(0.8), vel: v.set(0, 0, 0), color: C(5, 3.4, 1.8), size: 7, grow: 6, life: 0.07, gravity: 0, drag: 0, alpha: 1 });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, out = rnd(1.5, 5.5);
      this.fireB.emit({ pos: o(rnd(0.3, 1.4)).add(new THREE.Vector3(Math.cos(a) * rnd(0, 0.8), 0, Math.sin(a) * rnd(0, 0.8))), vel: new THREE.Vector3(Math.cos(a) * out, rnd(2, 7), Math.sin(a) * out),
        size: rnd(1.2, 2.2), grow: rnd(2.6, 4.4), life: rnd(0.32, 0.8), from: C(3.2, 1.7, 0.55), to: C(0.7, 0.16, 0.03), alpha: 0.85, drag: 3.2, lift: 1.5 });
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, out = rnd(0.8, 3.2), d = rnd(0.13, 0.19);
      this.smoke.emit({ pos: o(rnd(0.5, 2.2)).add(new THREE.Vector3(Math.cos(a) * rnd(0, 1.2), 0, Math.sin(a) * rnd(0, 1.2))), vel: new THREE.Vector3(Math.cos(a) * out, rnd(1.6, 4.8), Math.sin(a) * out),
        size: rnd(2, 3.2), grow: rnd(5, 9), life: rnd(5, 10), from: C(d * 0.7, d * 0.64, d * 0.58), to: C(0.42, 0.4, 0.37), alpha: rnd(0.65, 0.85), drag: 0.7, lift: 0.35 });
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rnd(-0.15, 0.15), sp = rnd(8, 16);
      this.smoke.emit({ pos: o(0.4), vel: new THREE.Vector3(Math.cos(a) * sp, rnd(0.2, 0.9), Math.sin(a) * sp), size: rnd(1, 1.6), grow: rnd(4, 6.5), life: rnd(2.4, 4.2),
        from: C(0.42, 0.36, 0.28), to: C(0.55, 0.5, 0.44), alpha: 0.55, drag: 2.4, lift: 0.12 });
    }
    for (let i = 0; i < 50; i++) {
      v.set(rnd(-1, 1), rnd(0.3, 1.6), rnd(-1, 1)).normalize().multiplyScalar(rnd(10, 30));
      sparks.emit({ pos: o(0.4), vel: v.clone(), color: C(8, 4.5, 1.4), size: rnd(0.03, 0.06), grow: 0, life: rnd(0.4, 1.1), gravity: 9.8, drag: 0.6, alpha: 1 });
    }
    for (let i = 0; i < 40; i++) {
      v.set(rnd(-1, 1), rnd(0.4, 1.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(5, 15));
      const s = rnd(0.1, 0.22);
      dust.emit({ pos: o(0.2), vel: v.clone(), color: C(s, s * 0.85, s * 0.7), size: rnd(0.05, 0.14), grow: 0, life: rnd(1, 1.8), gravity: 9.8, drag: 0.3, alpha: 1 });
    }
    this.debris.burst(at, 22);
  }

  update(dt: number): void {
    this.fireB.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
    if (this.flashT < 2) {
      this.flashT += dt;
      const t = this.flashT;
      this.light.intensity = 900 * Math.exp(-t / 0.09) + 120 * Math.exp(-t / 0.45) * (0.75 + Math.random() * 0.25);
      if (this.flashT >= 2) this.light.intensity = 0;
    }
  }
}
