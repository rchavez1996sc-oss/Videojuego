import * as THREE from 'three';

/** An open shop's rolled-up shutter: top centre of the opening, its size and facing. */
interface Spot { top: THREE.Vector3; w: number; h: number; q: THREE.Quaternion; t: number; delay: number; closing: boolean }
const spots: Spot[] = [];

/** Registers the shutter of an open shop (it can be pulled down when shooting starts nearby). */
export function addShutter(top: THREE.Vector3, w: number, h: number, q: THREE.Quaternion): void {
  spots.push({ top: top.clone(), w, h, q: q.clone(), t: 0, delay: 0, closing: false });
}

/**
 * The open shops' shutters as one instanced mesh, rolled up (height 0) until gunfire or an explosion within reach:
 * then each shopkeeper, after a moment's fright, hauls theirs down in about a second and a half with a rattle.
 */
export class Shutters {
  readonly mesh: THREE.InstancedMesh;
  private list = spots.splice(0);
  private m4 = new THREE.Matrix4();
  onRattle: (at: THREE.Vector3) => void = () => {};

  constructor(material: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.05).translate(0, -0.5, 0), material, Math.max(1, this.list.length));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = this.list.length;
    this.list.forEach((_, i) => this.write(i));
    this.mesh.onBeforeRender = () => this.update();
    if (location.search.includes('shot')) Object.assign(window, { __shutters: this.list });
  }

  alarm(at: THREE.Vector3, radius: number): void {
    for (const s of this.list) if (!s.closing && s.top.distanceTo(at) < Math.min(radius, 70)) [s.closing, s.delay] = [true, 0.4 + Math.random() * 2.5];
  }

  private last = performance.now();
  private update(): void {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let dirty = false;
    this.list.forEach((s, i) => {
      if (!s.closing || s.t >= 1) return;
      if ((s.delay -= dt) > 0) return;
      if (s.t === 0) this.onRattle(s.top);
      s.t = Math.min(1, s.t + dt / 1.5);
      this.write(i);
      dirty = true;
    });
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  private write(i: number): void {
    const s = this.list[i], k = s.t * s.t * (3 - 2 * s.t);
    this.mesh.setMatrixAt(i, this.m4.compose(s.top, s.q, new THREE.Vector3(s.w, Math.max(0.001, s.h * k), 1)));
  }
}
