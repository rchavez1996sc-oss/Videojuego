import * as THREE from 'three';

export interface Emit {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  grow: number;
  life: number;
  gravity: number;
  drag: number;
  alpha: number;
}

/** CPU-simulated point sprites; one pool per blend mode. */
export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private meta: Float32Array;
  private next = 0;

  constructor(private max: number, additive: boolean) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.meta = new Float32Array(max * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: innerHeight * 0.5 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float uPx;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aAlpha > 0.0 ? aSize * uPx * projectionMatrix[1][1] / -mv.z : 0.0;
          vColor = aColor; vAlpha = aAlpha;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float a = smoothstep(0.5, 0.15, d) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    addEventListener('resize', () => (mat.uniforms.uPx.value = innerHeight * 0.5));
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  emit(e: Emit): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([e.pos.x, e.pos.y, e.pos.z], i * 3);
    this.vel.set([e.vel.x, e.vel.y, e.vel.z], i * 3);
    this.col.set([e.color.r, e.color.g, e.color.b], i * 3);
    this.size[i] = e.size;
    this.alpha[i] = e.alpha;
    this.meta.set([0, e.life, e.gravity, e.drag, e.grow, e.alpha], i * 6);
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      const m = i * 6;
      if (this.meta[m + 1] <= 0) continue;
      const age = (this.meta[m] += dt), life = this.meta[m + 1];
      if (age >= life) {
        this.meta[m + 1] = 0;
        this.alpha[i] = 0;
        continue;
      }
      const v = i * 3, drag = Math.exp(-this.meta[m + 3] * dt);
      this.vel[v] *= drag;
      this.vel[v + 2] *= drag;
      this.vel[v + 1] = this.vel[v + 1] * drag - this.meta[m + 2] * dt;
      this.pos[v] += this.vel[v] * dt;
      this.pos[v + 1] += this.vel[v + 1] * dt;
      this.pos[v + 2] += this.vel[v + 2] * dt;
      this.size[i] += this.meta[m + 4] * dt;
      const t = age / life;
      this.alpha[i] = this.meta[m + 5] * (1 - t) * (1 - t);
    }
    const g = this.points.geometry;
    for (const k of ['position', 'aSize', 'aAlpha', 'aColor']) g.attributes[k].needsUpdate = true;
  }
}
