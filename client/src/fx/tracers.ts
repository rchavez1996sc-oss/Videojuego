import * as THREE from 'three';

const SPEED = 750, LEN = 6;

interface Tracer { mesh: THREE.Mesh; from: THREE.Vector3; dir: THREE.Vector3; dist: number; t: number }

export class Tracers {
  readonly group = new THREE.Group();
  private pool: Tracer[] = [];
  private next = 0;

  constructor(count = 24) {
    const a = new THREE.PlaneGeometry(0.03, 1).rotateX(Math.PI / 2);
    const b = a.clone().rotateZ(Math.PI / 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.attributes.position.array, ...b.attributes.position.array], 3));
    geo.setIndex([...a.index!.array, ...Array.from(b.index!.array, (i) => i + 4)]);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5.5, 2.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.pool.push({ mesh, from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, t: 0 });
    }
  }

  fire(from: THREE.Vector3, to: THREE.Vector3): void {
    const tr = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    tr.from.copy(from);
    tr.dir.subVectors(to, from);
    tr.dist = tr.dir.length();
    tr.dir.normalize();
    tr.t = 0;
    tr.mesh.visible = true;
  }

  update(dt: number): void {
    for (const tr of this.pool) {
      if (!tr.mesh.visible) continue;
      tr.t += dt * SPEED;
      const head = Math.min(tr.t, tr.dist), tail = Math.max(0, tr.t - LEN);
      if (tail >= tr.dist) {
        tr.mesh.visible = false;
        continue;
      }
      tr.mesh.position.copy(tr.from).addScaledVector(tr.dir, (head + tail) / 2);
      tr.mesh.lookAt(tr.mesh.position.clone().add(tr.dir));
      tr.mesh.scale.set(1, 1, Math.max(0.01, head - tail));
    }
  }
}
