import * as THREE from 'three';
import type { Particles } from './particles';
import type { Decals } from './decals';

const RINGS = 3, RING_LIFE = 0.45, RING_SIZE = 13;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Grenade blast: layered fireball, ground shockwave, dust skirt, rising smoke column, debris and a scorch mark. */
export class Blast {
  readonly group = new THREE.Group();
  private rings: { mesh: THREE.Mesh; t: number }[] = [];
  private v = new THREE.Vector3();

  constructor(private sparks: Particles, private dust: Particles, private decals: Decals) {
    const geo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 1.1), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.rings.push({ mesh, t: RING_LIFE });
    }
  }

  fire(at: THREE.Vector3): void {
    const { sparks, dust, v } = this;
    this.decals.place(at.clone().setY(at.y - 0.03), new THREE.Vector3(0, 1, 0), 3.4, new THREE.Color('#140f0b'));
    const ring = this.rings.reduce((a, b) => (a.t > b.t ? a : b));
    ring.t = 0;
    ring.mesh.position.copy(at).setY(at.y + 0.15);
    ring.mesh.visible = true;
    sparks.emit({ pos: at.clone().setY(at.y + 0.6), vel: v.set(0, 0, 0), color: new THREE.Color(14, 9, 5), size: 11, grow: 10, life: 0.12, gravity: 0, drag: 0, alpha: 1 });
    for (let i = 0; i < 22; i++) {
      v.set(rnd(-1, 1), rnd(0.2, 1.3), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 9));
      const hot = Math.random();
      sparks.emit({ pos: at.clone().setY(at.y + 0.4), vel: v.clone(), color: new THREE.Color(8 + hot * 4, 3 + hot * 2.5, 0.8 + hot), size: rnd(1.2, 2.4), grow: rnd(2.5, 4.5), life: rnd(0.28, 0.55), gravity: -2, drag: 5, alpha: 1 });
    }
    for (let i = 0; i < 46; i++) {
      v.set(rnd(-1, 1), rnd(0.3, 1.6), rnd(-1, 1)).normalize().multiplyScalar(rnd(9, 26));
      sparks.emit({ pos: at.clone().setY(at.y + 0.3), vel: v.clone(), color: new THREE.Color(7, 4, 1.3), size: rnd(0.03, 0.06), grow: 0, life: rnd(0.5, 1.2), gravity: 9.8, drag: 0.5, alpha: 1 });
    }
    for (let i = 0; i < 40; i++) {
      v.set(rnd(-1, 1), rnd(0.4, 1.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(5, 15));
      const s = rnd(0.1, 0.22);
      dust.emit({ pos: at.clone().setY(at.y + 0.2), vel: v.clone(), color: new THREE.Color(s, s * 0.85, s * 0.7), size: rnd(0.05, 0.14), grow: 0, life: rnd(1, 1.8), gravity: 9.8, drag: 0.3, alpha: 1 });
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd(-0.1, 0.1), sp = rnd(7, 13);
      dust.emit({ pos: at.clone().setY(at.y + 0.3), vel: v.set(Math.cos(a) * sp, rnd(0.3, 1.2), Math.sin(a) * sp).clone(), color: new THREE.Color(0.42, 0.36, 0.28), size: rnd(1, 1.6), grow: 2.4, life: rnd(1.6, 2.6), gravity: 0, drag: 2.6, alpha: 0.55 });
    }
    for (let i = 0; i < 30; i++) {
      const shade = rnd(0.08, 0.26), lift = rnd(1.5, 5.5);
      v.set(rnd(-1.6, 1.6), lift, rnd(-1.6, 1.6));
      dust.emit({ pos: at.clone().setY(at.y + rnd(0.4, 1.6)), vel: v.clone(), color: new THREE.Color(shade, shade * 0.93, shade * 0.86), size: rnd(1.4, 2.6), grow: rnd(1.6, 2.8), life: rnd(4.5, 8), gravity: -0.35, drag: 0.9, alpha: 0.7 });
    }
  }

  update(dt: number): void {
    for (const r of this.rings) {
      if (r.t >= RING_LIFE) continue;
      r.t += dt;
      const k = Math.min(1, r.t / RING_LIFE), ease = 1 - (1 - k) * (1 - k);
      r.mesh.scale.setScalar(0.5 + ease * RING_SIZE);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55;
      r.mesh.visible = k < 1;
    }
  }
}
