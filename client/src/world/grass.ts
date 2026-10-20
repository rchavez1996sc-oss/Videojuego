import * as THREE from 'three';
import type { Heightfield } from './heightfield';
import type { BiomeDef } from '../data/types';
import type { Lighting } from '../render/lighting';
import { heightTexture, maskTexture } from './terrain';
import { mulberry32 } from '../core/rng';
import { NOISE_GLSL } from '../render/glsl';

const TILE = 50;
const f = (v: number) => v.toFixed(1);

function bladeGeometry(): THREE.BufferGeometry {
  const segs = 3, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const blades: [number, number, number, number][] = [[0, 0, 0, 1], [0.07, 0.04, 1.9, 0.8], [-0.05, 0.06, 4.1, 0.9], [0.02, -0.07, 5.3, 0.7]];
  for (const [ox, oz, rot, hs] of blades) {
    const base = pos.length / 3, c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = 0.05 * (1 - t * 0.85), lean = t * t * 0.18;
      for (const side of [-1, 1]) {
        const lx = side * w, lz = lean;
        pos.push(ox + lx * c - lz * s, t * hs, oz + lx * s + lz * c);
        uv.push(side < 0 ? 0 : 1, t);
      }
      if (i < segs) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class Grass {
  readonly mesh: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(hf: Heightfield, biome: BiomeDef, lighting: Lighting, count: number) {
    const base = bladeGeometry();
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes = base.attributes;
    geo.instanceCount = count;
    const rand = mulberry32(99);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) data.set([rand() * TILE, rand() * TILE, rand() * Math.PI * 2, rand()], i * 4);
    geo.setAttribute('aBlade', new THREE.InstancedBufferAttribute(data, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector2() },
      uPlayer: { value: new THREE.Vector3(0, -999, 0) },
      uHeight: { value: heightTexture(hf) },
      uMask: { value: maskTexture(hf) },
      uN: { value: hf.n },
      uSize: { value: hf.size },
      uBladeH: { value: biome.grass.height },
      uDensity: { value: biome.grass.density ?? 1 },
      uBase: { value: new THREE.Color(biome.grass.colorBase) },
      uTip: { value: new THREE.Color(biome.grass.colorTip) },
    };
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
    lighting.setup(mat, 'grass', (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aBlade;
          uniform float uTime, uN, uSize, uBladeH, uDensity;
          uniform vec2 uCam;
          uniform vec3 uPlayer;
          uniform sampler2D uHeight, uMask;
          uniform vec3 uBase, uTip;
          varying vec3 vGrassCol;
          ${NOISE_GLSL}
          float hAt(vec2 p) {
            vec2 g = (p / uSize + 0.5) * (uN - 1.0);
            vec2 i = floor(g), f = g - i;
            float a = texelFetch(uHeight, ivec2(i), 0).r, b = texelFetch(uHeight, ivec2(i) + ivec2(1, 0), 0).r;
            float c = texelFetch(uHeight, ivec2(i) + ivec2(0, 1), 0).r, d = texelFetch(uHeight, ivec2(i) + ivec2(1, 1), 0).r;
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          vec2 wp = uCam + mod(aBlade.xy - uCam + ${f(TILE / 2)}, ${f(TILE)}) - ${f(TILE / 2)};
          vec4 msk = texture(uMask, wp / uSize + 0.5);
          float dist = length(wp - uCam);
          float keep = smoothstep(aBlade.w - 0.15, aBlade.w + 0.15, msk.g * 1.1 * uDensity) * (1.0 - smoothstep(${f(TILE * 0.3)}, ${f(TILE * 0.48)}, dist));
          float grp = 0.6 + 0.6 * tq_noise(wp * 0.15);
          float bh = uBladeH * (0.55 + aBlade.w * 0.7) * grp * keep * (0.5 + 0.5 * msk.g);
          float bs = sin(aBlade.z), bc = cos(aBlade.z);
          objectNormal = normalize(vec3(bs * 0.3, 1.0, bc * 0.3));
          vGrassCol = mix(uBase, uTip, position.y * position.y) * (0.85 + 0.25 * tq_noise(wp * 0.4));`)
        .replace('#include <begin_vertex>', `
          float widen = (1.0 + dist * 0.03) * clamp(bh / (uBladeH * 0.6), 0.0, 1.0);
          vec3 transformed = vec3((position.x * bc - position.z * bs) * widen, position.y * bh, (position.x * bs + position.z * bc) * widen);
          float gust = tq_noise(wp * 0.05 + uTime * 0.35) * 0.5 + 0.5;
          float sway = (sin(uTime * 1.8 + wp.x * 0.35 + wp.y * 0.2) * 0.35 + gust) * position.y * position.y;
          transformed.x += sway * 0.32 * bh;
          transformed.z += sway * 0.12 * bh + (aBlade.w - 0.5) * 0.2 * position.y * bh;
          transformed.xz += wp;
          float gy = hAt(wp);
          vec2 away = wp - uPlayer.xz;
          float near = (1.0 - smoothstep(0.15, 0.85, length(away))) * step(uPlayer.y - gy, 0.6);
          transformed.xz += normalize(away + 0.0001) * near * 0.3 * position.y * bh;
          transformed.y *= 1.0 - near * 0.65;
          transformed.y += gy - 0.02;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol;')
        .replace('#include <map_fragment>', 'diffuseColor.rgb = vGrassCol;');
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  update(t: number, cam: THREE.Vector3, player: THREE.Vector3): void {
    (this.uniforms.uPlayer.value as THREE.Vector3).copy(player);
    this.uniforms.uTime.value = t;
    (this.uniforms.uCam.value as THREE.Vector2).set(cam.x, cam.z);
  }
}
