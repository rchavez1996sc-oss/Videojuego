import * as THREE from 'three';
import type { Lighting } from './lighting';

/**
 * Per-person clothing variety on shared civilian materials. Body textures hold skin and clothes in one atlas, so the
 * shader leaves skin-coloured texels alone (only nudging their tone) and recolours the rest: hue shift, saturation and
 * value scale, plus a little colour pushed into greys. Hair gets a natural dye. Each person draws with one of a few
 * material copies (same program, different uniforms).
 */
const HSV = /* glsl */ `
vec3 tq_rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-6)), d / (q.x + 1e-6), q.x);
}
vec3 tq_hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
`;

export function tintHook(hair: boolean) {
  return (shader: THREE.WebGLProgramParametersWithUniforms, mat: THREE.Material) => {
    shader.uniforms.uOutfit = mat.userData.outfit;
    shader.uniforms.uTone = mat.userData.tone;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uOutfit;\nuniform vec3 uTone;\n${HSV}`)
      .replace('#include <map_fragment>', hair ? `#include <map_fragment>
  diffuseColor.rgb = mix(diffuseColor.rgb, uTone * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * 2.2, 0.8);` : `#include <map_fragment>
  {
    vec3 hsv = tq_rgb2hsv(pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2)));
    float skin = max(1.0 - smoothstep(0.11, 0.15, hsv.x), smoothstep(0.95, 0.98, hsv.x)) * smoothstep(0.07, 0.15, hsv.y) * (1.0 - smoothstep(0.6, 0.72, hsv.y)) * smoothstep(0.1, 0.2, hsv.z);
    vec3 cloth = vec3(fract(hsv.x + uOutfit.x), clamp(max(hsv.y * uOutfit.y, uOutfit.w * (1.0 - smoothstep(0.0, 0.2, hsv.y))), 0.0, 1.0), min(hsv.z * uOutfit.z, 0.92));
    diffuseColor.rgb = mix(pow(tq_hsv2rgb(cloth), vec3(2.2)), diffuseColor.rgb * uTone.x, skin);
  }`);
  };
}

const HAIR = ['#1c1714', '#2b2019', '#3d2a1c', '#5a3b22', '#151515', '#6e4a2a', '#8a6a4a', '#7a2e22'];
export const LOOKS = 8;

/** `LOOKS` copies of a civilian material, each with its own clothing (or hair) colours; they share one shader program. */
export function variants(mat: THREE.MeshStandardMaterial, key: string, lighting: Lighting, rand = Math.random): THREE.Material[] {
  const hair = /hair/i.test(mat.name);
  return Array.from({ length: LOOKS }, (_, i) => {
    const m = i ? mat.clone() : mat, c = new THREE.Color(HAIR[Math.floor(rand() * HAIR.length)]);
    m.userData.outfit = { value: i ? new THREE.Vector4(rand(), 0.6 + rand() * 0.8, 0.55 + rand() * 0.45, rand() < 0.5 ? rand() * 0.45 : 0) : new THREE.Vector4(0, 1, 1, 0) };
    m.userData.tone = { value: hair ? new THREE.Vector3(c.r, c.g, c.b) : new THREE.Vector3(0.65 + rand() * 0.33, 0, 0) };
    return lighting.setup(m, key, (sh) => tintHook(hair)(sh, m));
  });
}
