import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

type State = 'ground' | 'fly' | 'gone';
interface Pigeon { p: THREE.Vector3; yaw: number; state: State; v: THREE.Vector3; t: number; peck: number; flap: number; tone: number }
interface Flock { home: THREE.Vector3; birds: Pigeon[]; goneT: number }

function part(g: THREE.BufferGeometry, hex: string, m: THREE.Matrix4): THREE.BufferGeometry {
  const out = g.toNonIndexed().applyMatrix4(m), c = new THREE.Color(hex), n = out.attributes.position.count;
  out.deleteAttribute('uv');
  out.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => c.toArray()[i % 3]), 3));
  return out;
}
const M = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz));

/** Rock-dove body (+z forward, feet at 0): grey-blue body, darker head, iridescent neck, pale wing with two dark bars, coral legs. */
function bodyGeo(): THREE.BufferGeometry {
  const s = new THREE.SphereGeometry(1, 12, 9);
  return mergeGeometries([
    part(s, '#5f6672', M(0, 0.11, 0, 0.07, 0.066, 0.125)),
    part(s, '#868d98', M(0, 0.125, -0.02, 0.072, 0.045, 0.1)),
    part(s, '#355a4c', M(0, 0.15, 0.075, 0.048, 0.05, 0.045)),
    part(s, '#454b55', M(0, 0.185, 0.105, 0.035, 0.034, 0.038)),
    part(new THREE.ConeGeometry(0.009, 0.03, 6), '#2b2b2b', M(0, 0.183, 0.147, 1, 1, 1, Math.PI / 2)),
    part(new THREE.BoxGeometry(0.075, 0.012, 0.1), '#2c3036', M(0, 0.115, -0.15, 1, 1, 1, -0.25)),
    ...[-0.035, 0.035].map((x) => part(new THREE.BoxGeometry(0.068, 0.006, 0.012), '#2a2d33', M(x * 1.85, 0.14, -0.045))),
    ...[-0.022, 0.022].map((x) => part(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), '#c76f6a', M(x, 0.03, 0.01))),
  ])!;
}

/** Spread wings: two tapering panels, tips raised (flapped by scaling y like the vultures). */
function wingGeo(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0.03, 0, 0.06, 0.32, 0.1, -0.02, 0.03, 0, -0.07, 0.32, 0.1, -0.02, 0.27, 0.1, -0.09, 0.03, 0, -0.07,
    -0.03, 0, 0.06, -0.03, 0, -0.07, -0.32, 0.1, -0.02, -0.32, 0.1, -0.02, -0.03, 0, -0.07, -0.27, 0.1, -0.09,
  ], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: 12 }, (_, i) => (i % 3 === 0 && [3, 4, 9, 11].includes(i / 3) ? [0.12, 0.13, 0.15] : [0.36, 0.38, 0.42])).flat(), 3));
  g.computeVertexNormals();
  return g;
}

const UP = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), MX = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Flocks of street pigeons on pavements and corners: they wander in little hops and peck, take off together when
 * someone walks right through them (the player from ~3 m), a moving vehicle passes close or there is gunfire nearby (flutter sound), climb away, and the
 * flock comes back home a while later while nobody is looking. Two instanced draw calls.
 */
export class Pigeons {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private wings: THREE.InstancedMesh;
  private flocks: Flock[] = [];
  onFlutter: ((at: THREE.Vector3, n: number) => void) | null = null;

  constructor(homes: THREE.Vector3[], lighting: Lighting, rand: () => number) {
    for (const home of homes) {
      const birds: Pigeon[] = Array.from({ length: 5 + Math.floor(rand() * 8) }, () => ({
        p: home.clone().add(new THREE.Vector3((rand() - 0.5) * 3, 0, (rand() - 0.5) * 3)), yaw: rand() * 6.28, state: 'ground' as State,
        v: new THREE.Vector3(), t: rand() * 2, peck: 0, flap: rand() * 6, tone: 0.85 + rand() * 0.3,
      }));
      this.flocks.push({ home, birds, goneT: 0 });
    }
    const n = this.flocks.reduce((t, f) => t + f.birds.length, 0);
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), 'pigeon');
    const wingMat = lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), 'pigeon-wing');
    this.body = new THREE.InstancedMesh(bodyGeo(), mat, n);
    this.wings = new THREE.InstancedMesh(wingGeo(), wingMat, n);
    for (const m of [this.body, this.wings]) [m.frustumCulled = false, m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)];
    this.group.add(this.body, this.wings);
  }

  get homes(): THREE.Vector3[] {
    return this.flocks.map((f) => f.home);
  }

  get count(): number {
    return this.flocks.reduce((t, f) => t + f.birds.filter((b) => b.state === 'ground').length, 0);
  }

  /** Gunfire or an explosion: every flock within `radius` (≤ 50 m) takes off. */
  alarm(at: THREE.Vector3, radius: number): void {
    for (const f of this.flocks) if (f.home.distanceTo(at) < Math.min(radius, 50)) this.scare(f, at);
  }

  private scare(f: Flock, from: THREE.Vector3): void {
    let n = 0;
    for (const b of f.birds) {
      if (b.state !== 'ground') continue;
      const away = b.p.clone().sub(from).setY(0);
      away.lengthSq() < 0.01 ? away.set(Math.random() - 0.5, 0, Math.random() - 0.5) : 0;
      away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.4);
      b.v.copy(away.multiplyScalar(3 + Math.random() * 2.5)).setY(2.5 + Math.random() * 1.5);
      [b.state, b.t, n] = ['fly', -Math.random() * 0.25, n + 1];
    }
    if (n) [f.goneT = 0, this.onFlutter?.(f.home, n)];
  }

  /** Pigeons still on the ground in flock `i` (debug). */
  grounded(i: number): number {
    return this.flocks[i]?.birds.filter((b) => b.state === 'ground').length ?? -1;
  }

  /** `threats`: people and vehicles with the distance (m) at which each makes a flock take off. */
  update(dt: number, camera: THREE.Camera, threats: { pos: THREE.Vector3; r: number }[]): void {
    let i = 0;
    for (const f of this.flocks) {
      const camD = f.home.distanceTo(camera.position);
      if (f.birds.some((b) => b.state === 'ground'))
        for (const t of threats) if (Math.abs(t.pos.y - f.home.y) < 2.5 && Math.hypot(t.pos.x - f.home.x, t.pos.z - f.home.z) < t.r + 1.2) { this.scare(f, t.pos); break; }
      if (f.birds.every((b) => b.state === 'gone') && (f.goneT += dt) > 35 && camD > 40) this.reset(f);
      for (const b of f.birds) {
        this.step(b, f, dt);
        if (b.state === 'gone' || camD > 110) [this.body.setMatrixAt(i, ZERO), this.wings.setMatrixAt(i, ZERO)];
        else this.draw(b, i);
        i++;
      }
    }
    this.body.instanceMatrix.needsUpdate = this.wings.instanceMatrix.needsUpdate = true;
  }

  private reset(f: Flock): void {
    for (const b of f.birds) [b.state, b.v.set(0, 0, 0), b.p.copy(f.home).add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3))];
    f.goneT = 0;
  }

  private step(b: Pigeon, f: Flock, dt: number): void {
    b.t += dt;
    if (b.state === 'fly') {
      if (b.t < 0) return;
      b.flap += dt;
      b.v.y = Math.min(b.v.y + dt * 2.2, 5.5);
      b.v.multiplyScalar(1 + dt * 0.25);
      b.p.addScaledVector(b.v, dt);
      b.yaw = Math.atan2(b.v.x, b.v.z);
      if (b.p.y - f.home.y > 28 || b.t > 9) b.state = 'gone';
      return;
    }
    if (b.state !== 'ground') return;
    b.peck = Math.max(0, b.peck - dt);
    if (b.t > 0.5 + ((b.tone * 997) % 1) * 1.2) {
      b.t = 0;
      const r = Math.random();
      if (r < 0.5) b.peck = 0.28;
      else if (r < 0.85) {
        b.yaw += (Math.random() - 0.5) * 1.2;
        const step = new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw)).multiplyScalar(0.12 + Math.random() * 0.1);
        if (b.p.clone().add(step).distanceTo(f.home) > 2.6) b.yaw += Math.PI;
        else b.p.add(step);
      } else b.yaw += (Math.random() - 0.5) * 2.5;
    }
  }

  private draw(b: Pigeon, i: number): void {
    const flying = b.state === 'fly' && b.t >= 0;
    const pitch = flying ? -0.25 : b.peck > 0 ? Math.sin((b.peck / 0.28) * Math.PI) * 0.55 : 0;
    Q.setFromEuler(E.set(pitch, b.yaw, 0, 'YXZ'));
    S.setScalar(b.tone);
    this.body.setMatrixAt(i, MX.compose(b.p, Q, S));
    if (!flying) return void this.wings.setMatrixAt(i, ZERO);
    S.set(b.tone, b.tone * Math.sin(b.flap * 24) * 2, b.tone);
    this.wings.setMatrixAt(i, MX.compose(UP.set(0, 0.13 * b.tone, 0).applyQuaternion(Q).add(b.p), Q, S));
  }
}
