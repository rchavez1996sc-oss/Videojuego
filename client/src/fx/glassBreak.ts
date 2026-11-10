import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Mixer } from '../audio/mixer';
import type { Lighting } from '../render/lighting';

const HOLES = 160, SHARDS = 600;
const GLASS = /glass/i, NOT = /^car-glass|lantern|block|bottle|rail|led|screen|shard/i;

/** Shattered-pane decal: a dark jagged hole with shards still in the frame and cracks running out from it. */
function holeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  g.strokeStyle = 'rgba(235,240,245,0.85)';
  g.lineWidth = 1.4;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + Math.random() * 0.3;
    g.beginPath();
    let r = 30, x = Math.cos(a) * r, y = Math.sin(a) * r;
    g.moveTo(x, y);
    while (r < 120) [r += 10 + Math.random() * 16, x = Math.cos(a + (Math.random() - 0.5) * 0.25) * r, y = Math.sin(a + (Math.random() - 0.5) * 0.25) * r, g.lineTo(x, y)];
    g.stroke();
  }
  for (const r of [55, 85]) {
    g.beginPath();
    for (let k = 0; k <= 22; k++) g.lineTo(Math.cos((k / 22) * 6.28) * r * (0.85 + Math.random() * 0.3), Math.sin((k / 22) * 6.28) * r * (0.85 + Math.random() * 0.3));
    g.stroke();
  }
  g.fillStyle = 'rgba(12,14,16,0.92)';
  g.beginPath();
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI * 2, r = (k % 2 ? 22 : 48) * (0.7 + Math.random() * 0.5);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Shard { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; spin: THREE.Vector3; floor: number; rest: boolean }

/**
 * Windows and shop fronts that break: panes have no colliders, so each player/ally round is also traced against
 * the glass meshes; a hit leaves a shattered hole with cracks (repeated hits nearby widen it), drops a spray of
 * shards that tinkle down and stay on the floor, and plays a crash of breaking glass.
 */
export class GlassBreak {
  readonly group = new THREE.Group();
  readonly panes: THREE.Mesh[] = [];
  private holes: THREE.InstancedMesh;
  private shards: THREE.InstancedMesh;
  private holeAt: { p: THREE.Vector3; n: THREE.Vector3; size: number }[] = [];
  private flying: Shard[] = [];
  private ray = new THREE.Raycaster();
  private m = new THREE.Matrix4();

  constructor(lighting: Lighting, private mixer: Mixer, private world: RAPIER.World) {
    this.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: holeTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }), HOLES);
    const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.05, -0.035, 0, -0.03, 0.04, 0, -0.025], 3));
    tri.computeVertexNormals();
    this.shards = new THREE.InstancedMesh(tri, lighting.setup(new THREE.MeshStandardMaterial({ color: '#9fb2ba', roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }), 'glass-shard'), SHARDS);
    for (const im of [this.holes, this.shards]) [im.count = 0, im.frustumCulled = false];
    this.group.add(this.holes, this.shards);
  }

  /** Collects the window and shop-front glass meshes of the level (call once the level is built). */
  scan(scene: THREE.Object3D): number {
    scene.traverse((o) => {
      const m = o as THREE.Mesh, mat = m.material as THREE.Material | undefined;
      if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && mat && !Array.isArray(mat) && GLASS.test(mat.name) && !NOT.test(mat.name)) this.panes.push(m);
    });
    return this.panes.length;
  }

  /** A round from `from` along `dir` that flew `dist` m: breaks the first pane it crossed. */
  trace(from: THREE.Vector3, dir: THREE.Vector3, dist: number): void {
    this.ray.set(from, dir);
    this.ray.far = dist;
    const near = this.panes.filter((m) => {
      m.geometry.boundingSphere ?? m.geometry.computeBoundingSphere();
      const s = m.geometry.boundingSphere!.clone().applyMatrix4(m.matrixWorld);
      return this.ray.ray.intersectsSphere(s);
    });
    const hit = this.ray.intersectObjects(near, false)[0];
    if (!hit?.face) return;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.dot(dir) > 0) n.negate();
    this.breakAt(hit.point, n, dir);
  }

  private breakAt(p: THREE.Vector3, n: THREE.Vector3, dir: THREE.Vector3): void {
    const old = this.holeAt.find((h) => h.p.distanceTo(p) < 0.35 && h.n.dot(n) > 0.9);
    const i = old ? this.holeAt.indexOf(old) : this.holeAt.length % HOLES;
    const size = old ? Math.min(0.95, old.size * 1.25) : 0.4 + Math.random() * 0.2;
    this.holeAt[i] = { p: old?.p ?? p.clone(), n, size };
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28));
    this.holes.setMatrixAt(i, this.m.compose(this.holeAt[i].p.clone().addScaledVector(n, 0.01), q, new THREE.Vector3(size, size, 1)));
    this.holes.count = Math.max(this.holes.count, i + 1);
    this.holes.instanceMatrix.needsUpdate = true;
    const floorHit = this.world.castRay(new RAPIER.Ray(p, { x: 0, y: -1, z: 0 }), 30, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const floor = floorHit ? p.y - floorHit.timeOfImpact + 0.01 : p.y - 2;
    for (let k = 0; k < (old ? 8 : 18); k++) {
      if (this.flying.length >= SHARDS) this.flying.shift();
      const v = dir.clone().multiplyScalar(1 + Math.random() * 2.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5));
      this.flying.push({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * size * 0.6, (Math.random() - 0.5) * size * 0.6, (Math.random() - 0.5) * 0.1)), v, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), spin: new THREE.Vector3(Math.random() * 14, Math.random() * 10, 0), floor, rest: false });
    }
    this.crash(!old);
  }

  /** A pane going: a dull crack, the crunch of glass breaking, then a few soft clinks of shards (noise, no pure tones). */
  private crash(big: boolean): void {
    const { ctx } = this.mixer;
    if (ctx.state !== 'running') return;
    const t = ctx.currentTime, out = ctx.createGain();
    out.gain.value = big ? 0.32 : 0.22;
    out.connect(this.mixer.sfx);
    const burst = (at: number, type: BiquadFilterType, f: number, q: number, vol: number, dur: number) => {
      const n = this.mixer.noise(), flt = ctx.createBiquadFilter();
      flt.type = type;
      flt.frequency.value = f;
      flt.Q.value = q;
      n.connect(flt).connect(this.mixer.env(at, vol, 0.001, dur)).connect(out);
      n.start(at);
      n.stop(at + dur + 0.05);
    };
    burst(t, 'lowpass', 900, 0.8, 0.9, 0.06);
    burst(t, 'bandpass', 3200, 0.7, 0.7, big ? 0.22 : 0.14);
    for (let k = 0; k < (big ? 7 : 3); k++) burst(t + 0.15 + Math.random() * 0.6, 'bandpass', 3000 + Math.random() * 2500, 3, 0.18 + Math.random() * 0.12, 0.025 + Math.random() * 0.03);
  }

  update(dt: number): void {
    if (!this.flying.length) return;
    this.flying.forEach((s, i) => {
      if (!s.rest) {
        s.v.y -= 9.8 * dt;
        s.p.addScaledVector(s.v, dt);
        s.r.x += s.spin.x * dt;
        s.r.y += s.spin.y * dt;
        if (s.p.y <= s.floor) [s.p.y = s.floor, s.rest = true, s.r.x = 0, s.r.z = 0];
      }
      this.shards.setMatrixAt(i, this.m.compose(s.p, new THREE.Quaternion().setFromEuler(s.r), new THREE.Vector3(1, 1, 1).multiplyScalar(0.6 + (i % 5) * 0.2)));
    });
    this.shards.count = this.flying.length;
    this.shards.instanceMatrix.needsUpdate = true;
  }
}
