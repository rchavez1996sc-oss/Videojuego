import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const MAX = 48;

/** Chunks of concrete, asphalt and dirt thrown by a blast: ballistic, bounce off the floor (ray), tumble, settle, then sink away. */
export class Debris {
  readonly mesh: THREE.InstancedMesh;
  private bits: { p: THREE.Vector3; v: THREE.Vector3; q: THREE.Quaternion; w: THREE.Vector3; s: number; t: number; rest: boolean }[] = [];
  private m = new THREE.Matrix4();
  private dq = new THREE.Quaternion();
  private sc = new THREE.Vector3();

  constructor(private world: RAPIER.World, material: THREE.Material) {
    const geo = new THREE.DodecahedronGeometry(1, 0).scale(1, 0.6, 0.8);
    this.mesh = new THREE.InstancedMesh(geo, material, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }

  burst(at: THREE.Vector3, n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.bits.length >= MAX) this.bits.shift();
      const a = Math.random() * Math.PI * 2, up = 4 + Math.random() * 9, out = 2 + Math.random() * 9;
      this.bits.push({
        p: at.clone().add(new THREE.Vector3(Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4)),
        v: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out),
        q: new THREE.Quaternion().random(), w: new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 14),
        s: 0.04 + Math.pow(Math.random(), 2.5) * 0.16, t: 0, rest: false,
      });
    }
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.t += dt;
      if (b.t > 14) { this.bits.splice(i, 1); continue; }
      if (!b.rest) {
        b.v.y -= 9.8 * dt;
        const step = b.v.clone().multiplyScalar(dt), len = step.length();
        const hit = len > 1e-4 ? this.world.castRayAndGetNormal(new RAPIER.Ray(b.p, step.clone().divideScalar(len)), len + b.s, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC) : null;
        if (hit) {
          const nrm = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
          b.p.addScaledVector(step, Math.max(0, (hit.timeOfImpact - b.s) / len)).addScaledVector(nrm, 0.005);
          b.v.reflect(nrm).multiplyScalar(0.32);
          b.v.addScaledVector(nrm, -b.v.dot(nrm) * 0.2);
          b.w.multiplyScalar(0.5);
          if (b.v.lengthSq() < 0.5 && nrm.y > 0.6) b.rest = true;
        } else b.p.add(step);
        this.dq.setFromAxisAngle(this.sc.copy(b.w).normalize(), b.w.length() * dt);
        b.q.premultiply(this.dq);
      }
      const sink = b.t > 11 ? (b.t - 11) / 3 : 0;
      this.mesh.setMatrixAt(n++, this.m.compose(b.p, b.q, this.sc.setScalar(b.s * (1 - sink))));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
