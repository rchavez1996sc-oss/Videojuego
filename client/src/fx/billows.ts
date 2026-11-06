import * as THREE from 'three';

/** One puff of fire or smoke: world-space billboard that grows, turns, rises and fades between two colours. */
export interface Puff {
  pos: THREE.Vector3; vel: THREE.Vector3; size: number; grow: number; life: number;
  from: THREE.Color; to: THREE.Color; alpha: number; drag: number; lift: number; spin?: number;
}

const MAX = 160;

/** 2×2 atlas of soft, lumpy puffs (density in red, drawn on opaque black: canvas colour is not premultiplied, so blobs on transparent black would leave a hard-edged mask). */
function puffAtlas(): THREE.CanvasTexture {
  const S = 128, cv = Object.assign(document.createElement('canvas'), { width: S * 2, height: S * 2 }), g = cv.getContext('2d')!;
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S * 2, S * 2);
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * S, oy = Math.floor(k / 2) * S;
    g.save();
    g.beginPath();
    g.rect(ox, oy, S, S);
    g.clip();
    for (let i = 0; i < 70; i++) {
      const a = r() * 6.28, d = Math.pow(r(), 0.7) * S * 0.3, x = ox + S / 2 + Math.cos(a) * d, y = oy + S / 2 + Math.sin(a) * d, rad = S * (0.08 + r() * 0.16);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,255,255,${0.16 + r() * 0.16})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(ox, oy, S, S);
    }
    g.restore();
  }
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.NoColorSpace });
}

const VERT = `
attribute vec3 iPos; attribute vec4 iCol; attribute vec3 iSRF;
varying vec2 vUv; varying vec4 vCol; varying float vShade;
void main() {
  float c = cos(iSRF.y), s = sin(iSRF.y);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSRF.x;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  mv.xy += q;
  gl_Position = projectionMatrix * mv;
  float f = iSRF.z;
  vUv = (uv + vec2(mod(f, 2.0), floor(f / 2.0))) * 0.5;
  vCol = iCol;
  vShade = position.y + 0.5;
}`;
const FRAG = `
uniform sampler2D map; uniform float lit;
varying vec2 vUv; varying vec4 vCol; varying float vShade;
void main() {
  float a = texture2D(map, vUv).r * vCol.a;
  if (a < 0.004) discard;
  vec3 col = vCol.rgb * mix(1.0, 0.62 + 0.55 * vShade, lit);
  gl_FragColor = vec4(col, a);
}`;

/** CPU-simulated billboard puffs in one instanced draw (smoke: alpha blended and shaded top-light; fire: additive). */
export class Billows {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private live: (Puff & { age: number; rot: number; spin: number; frame: number })[] = [];
  private iPos = new Float32Array(MAX * 3);
  private iCol = new Float32Array(MAX * 4);
  private iSRF = new Float32Array(MAX * 3);
  private tmp = new THREE.Color();

  constructor(additive: boolean, map = puffAtlas()) {
    const geo = (this.geo = new THREE.InstancedBufferGeometry());
    const plane = new THREE.PlaneGeometry(1, 1);
    geo.index = plane.index;
    geo.setAttribute('position', plane.attributes.position);
    geo.setAttribute('uv', plane.attributes.uv);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.iPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.iCol, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iSRF', new THREE.InstancedBufferAttribute(this.iSRF, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, lit: { value: additive ? 0 : 1 } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
  }

  emit(p: Puff): void {
    if (this.live.length >= MAX) this.live.shift();
    this.live.push({ ...p, age: 0, rot: Math.random() * 6.28, spin: p.spin ?? (Math.random() - 0.5) * 0.6, frame: Math.floor(Math.random() * 4) });
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      if (p.age >= p.life) { this.live.splice(i, 1); continue; }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.vel.y += p.lift * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.spin * dt;
    }
    for (const p of this.live) {
      const k = p.age / p.life, fadeIn = Math.min(1, p.age / 0.08);
      this.tmp.copy(p.from).lerp(p.to, Math.min(1, k * 1.6));
      this.iPos.set([p.pos.x, p.pos.y, p.pos.z], n * 3);
      this.iCol.set([this.tmp.r, this.tmp.g, this.tmp.b, p.alpha * fadeIn * (1 - k) * (1 - k * 0.3)], n * 4);
      this.iSRF.set([p.size + p.grow * (1 - Math.pow(1 - k, 2.2)), p.rot, p.frame], n * 3);
      n++;
    }
    this.geo.instanceCount = n;
    for (const k of ['iPos', 'iCol', 'iSRF']) (this.geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  }
}
