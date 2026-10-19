import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import type { Heightfield } from '../world/heightfield';

interface Shell { pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; life: number; bounces: number }

export class Shells {
  readonly mesh: THREE.InstancedMesh;
  private shells: Shell[] = [];
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private one = new THREE.Vector3(1, 1, 1);
  private zero = new THREE.Vector3();

  constructor(lighting: Lighting, private hf: Heightfield, private onBounce: (p: THREE.Vector3) => void, max = 40) {
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#c8a050', metalness: 0.9, roughness: 0.3 }), 'shell');
    this.mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0055, 0.0065, 0.039, 8).rotateX(Math.PI / 2), mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    for (let i = 0; i < max; i++) {
      this.shells.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0, bounces: 0 });
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    }
  }

  eject(from: THREE.Object3D, right: THREE.Vector3): void {
    const s = this.shells[this.next];
    this.next = (this.next + 1) % this.shells.length;
    from.getWorldPosition(s.pos);
    s.vel.copy(right).multiplyScalar(2.2 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2 + Math.random(), (Math.random() - 0.5) * 0.6));
    s.rot.set(Math.random() * 6, Math.random() * 6, 0);
    s.spin.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20);
    s.life = 8;
    s.bounces = 0;
  }

  update(dt: number): void {
    this.shells.forEach((s, i) => {
      if (s.life <= 0) return;
      s.life -= dt;
      if (s.bounces < 4) {
        s.vel.y -= 9.8 * dt;
        s.pos.addScaledVector(s.vel, dt);
        s.rot.x += s.spin.x * dt;
        s.rot.y += s.spin.y * dt;
        const ground = this.hf.heightAt(s.pos.x, s.pos.z) + 0.006;
        if (s.pos.y < ground) {
          s.pos.y = ground;
          s.vel.set(s.vel.x * 0.45, Math.abs(s.vel.y) * 0.3, s.vel.z * 0.45);
          s.spin.multiplyScalar(0.5);
          if (s.bounces++ < 2) this.onBounce(s.pos);
          if (s.bounces >= 4) s.rot.x = Math.PI / 2;
        }
      }
      this.q.setFromEuler(s.rot);
      this.m.compose(s.pos, this.q, s.life > 0 ? this.one : this.zero);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
