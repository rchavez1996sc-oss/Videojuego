import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';
import { WIND } from '../render/wind';

interface Span { a: THREE.Vector3; c: THREE.Vector3; sag: number; ground: number; cut: number }

/** Every overhead wire the level strings (poles, house drops, alleys); `cable()` registers here, `buildCables` makes the mesh. */
const SPANS: Span[] = [];
const SEG = 12;
if (location.search.includes('shot')) Object.assign(window, { __spans: SPANS });

export function addSpan(a: THREE.Vector3, c: THREE.Vector3, sag: number): void {
  SPANS.push({ a: a.clone(), c: c.clone(), sag, ground: NaN, cut: -1 });
}

const pointAt = (s: Span, t: number) => s.a.clone().lerp(s.c, t).add(new THREE.Vector3(0, -s.sag * 4 * t * (1 - t), 0));

/**
 * Overhead cables as one mesh: they sway in the wind (most at mid-span, slower and wider the more they sag), and a
 * cut cable's two halves hang straight down from their poles and lie on the ground. Cut state per cable in a small
 * data texture, so cutting one costs a texel upload. Rounds passing within a few cm spark; 35 % of them cut it.
 */
export class Cables {
  readonly mesh: THREE.Mesh | null = null;
  private state: THREE.DataTexture;
  private data: Float32Array;
  private live: { end: THREE.Vector3; until: number; next: number }[] = [];
  private clock = 0;
  onSpark: ((at: THREE.Vector3) => void) | null = null;

  constructor(lighting: Lighting, groundAt: (x: number, z: number) => number) {
    for (const s of SPANS) if (Number.isNaN(s.ground)) s.ground = Math.min(groundAt(s.a.x, s.a.z), groundAt(s.c.x, s.c.z));
    const n = Math.max(1, SPANS.length);
    this.data = new Float32Array(n * 4);
    this.state = new THREE.DataTexture(this.data, n, 1, THREE.RGBAFormat, THREE.FloatType);
    this.state.needsUpdate = true;
    if (!SPANS.length) return;
    const parts = SPANS.map((s, id) => {
      const g = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)), SEG, 0.012, 4).toNonIndexed();
      const pos = g.attributes.position, t = new Float32Array(pos.count), ids = new Float32Array(pos.count), ring = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) [t[i] = pos.getX(i), ids[i] = id, ring[i * 2] = pos.getY(i), ring[i * 2 + 1] = pos.getZ(i)];
      g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
      g.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
      g.setAttribute('aRing', new THREE.BufferAttribute(ring, 2));
      g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(pos.count * 3).map((_, i) => s.a.getComponent(i % 3)), 3));
      g.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(pos.count * 3).map((_, i) => s.c.getComponent(i % 3)), 3));
      g.setAttribute('aSag', new THREE.BufferAttribute(new Float32Array(pos.count).fill(s.sag), 1));
      g.setAttribute('aGround', new THREE.BufferAttribute(new Float32Array(pos.count).fill(s.ground), 1));
      g.deleteAttribute('uv');
      return g;
    });
    const geo = mergeGeometries(parts)!;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 }), 'cable-wind', (sh) => {
      Object.assign(sh.uniforms, { uWind: WIND, uState: { value: this.state }, uN: { value: n } });
      sh.vertexShader = `attribute float aT, aId, aSag, aGround;\nattribute vec2 aRing;\nattribute vec3 aA, aC;\nuniform float uWind, uN;\nuniform sampler2D uState;\n${sh.vertexShader}`.replace('#include <begin_vertex>', `
  vec4 st = texture2D(uState, vec2((aId + 0.5) / uN, 0.5));
  vec3 span = aC - aA, along = normalize(span), side = normalize(vec3(-along.z, 0.0, along.x) + 1e-5);
  float len = length(span), bell = 4.0 * aT * (1.0 - aT);
  vec3 centre = mix(aA, aC, aT) - vec3(0.0, aSag * bell, 0.0);
  float ph = aId * 1.7, gust = 0.55 + 0.45 * sin(uWind * 0.31 + ph * 0.1);
  centre += side * sin(uWind * (1.6 - aSag * 0.4) + ph) * aSag * 0.22 * bell * gust;
  centre.y += sin(uWind * 2.1 + ph) * aSag * 0.04 * bell;
  if (st.r > 0.5) {
    float fromA = aT < st.g ? aT * len : (1.0 - aT) * len;
    vec3 root = aT < st.g ? aA : aC, hang = root - vec3(0.0, fromA, 0.0);
    float drop = root.y - aGround;
    if (fromA > drop) hang = vec3(root.x, aGround + 0.02, root.z) + (aT < st.g ? along : -along) * (fromA - drop) * 0.8;
    centre = hang + side * sin(uWind * 3.0 + aT * 9.0) * 0.03;
  }
  vec3 transformed = centre + side * aRing.y + vec3(0.0, aRing.x, 0.0);`).replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(vec3(0.0, aRing.x, 0.0) + vec3(-aRing.y, 0.0, aRing.y) + 1e-4);');
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.name = 'cables';
    (this as { mesh: THREE.Mesh | null }).mesh = mesh;
  }

  get count(): number {
    return SPANS.length;
  }

  /** A round's path: sparks off any intact cable it passes within 5 cm of; sometimes cuts it there. */
  trace(from: THREE.Vector3, dir: THREE.Vector3, dist: number): void {
    const ray = new THREE.Ray(from, dir), p = new THREE.Vector3(), q = new THREE.Vector3();
    SPANS.forEach((s, id) => {
      if (s.cut >= 0 || ray.distanceSqToPoint(s.a.clone().lerp(s.c, 0.5)) > 400) return;
      for (let k = 0; k < SEG; k++) {
        const a = pointAt(s, k / SEG), b = pointAt(s, (k + 1) / SEG);
        if (ray.distanceSqToSegment(a, b, p, q) > 0.0025 || p.distanceTo(from) > dist) continue;
        this.onSpark?.(q);
        if (Math.random() < 0.35) this.cut(id, (k + 0.5) / SEG);
        return;
      }
    });
  }

  private cut(id: number, t: number): void {
    const s = SPANS[id];
    s.cut = t;
    this.data.set([1, t, 0, 0], id * 4);
    this.state.needsUpdate = true;
    for (const root of [s.a, s.c]) this.live.push({ end: new THREE.Vector3(root.x, s.ground + 0.05, root.z).lerp(pointAt(s, t).setY(s.ground + 0.05), 0.5), until: this.clock + 9, next: this.clock + 0.3 });
  }

  /** Cut ends lying on the ground keep arcing for a while. */
  update(dt: number): void {
    this.clock += dt;
    this.live = this.live.filter((l) => l.until > this.clock);
    for (const l of this.live) if (this.clock > l.next) [this.onSpark?.(l.end), l.next = this.clock + 0.2 + Math.random() * 1.1];
  }
}
