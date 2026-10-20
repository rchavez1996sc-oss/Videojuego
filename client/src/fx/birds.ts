import * as THREE from 'three';

interface Bird { center: THREE.Vector3; radius: number; speed: number; angle: number; height: number; flap: number }

/** Gallinazos (black vultures) circling lazily over the hills. One instanced draw call. */
export class Birds {
  readonly mesh: THREE.InstancedMesh;
  private birds: Bird[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();

  constructor(count: number, area: number, seed = Math.random) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, -1.1, 0.12, -0.1, 0, 0, -0.3, 0, 0, 0.35, 0, 0, -0.3, 1.1, 0.12, -0.1, 0, 0.02, 0.35, 0, 0.02, 0.6, 0, 0.0, 0.2], 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: '#161514', side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.InstancedMesh(g, mat, count);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      const s = seed() < 0.5 ? 1 : -1;
      this.birds.push({
        center: new THREE.Vector3((seed() * 2 - 1) * area, 0, s * (140 + seed() * 160)),
        radius: 25 + seed() * 50, speed: 0.12 + seed() * 0.12, angle: seed() * Math.PI * 2, height: 70 + seed() * 80, flap: seed() * 10,
      });
    }
  }

  update(dt: number): void {
    this.birds.forEach((b, i) => {
      b.angle += b.speed * dt;
      b.flap += dt;
      const p = new THREE.Vector3(b.center.x + Math.cos(b.angle) * b.radius, b.height + Math.sin(b.angle * 0.7) * 6, b.center.z + Math.sin(b.angle) * b.radius);
      const heading = Math.atan2(-Math.sin(b.angle), Math.cos(b.angle));
      this.q.setFromEuler(new THREE.Euler(0, heading, 0.35));
      const flapping = Math.sin(b.flap * 0.4) > 0.6 ? 1 + Math.sin(b.flap * 9) * 0.6 : 1;
      this.m.compose(p, this.q, new THREE.Vector3(1.6, 1.6 * flapping, 1.6));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
