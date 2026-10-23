import type * as THREE from 'three';
import { NOISE_GLSL } from './glsl';

const SKIP = new Set(['grass', 'terrain', 'ocean', 'signs']);

/**
 * World-space wear on every lit surface, so tiled textures stop repeating: large blotches of tone and roughness,
 * rain streaks down walls and a dusty tint on whatever faces up. A few noise lookups per pixel, no extra passes.
 */
export function weathering(shader: THREE.WebGLProgramParametersWithUniforms & { skinning?: boolean }, key: string): void {
  if (SKIP.has(key) || shader.skinning || !shader.fragmentShader.includes('#include <map_fragment>') || !shader.fragmentShader.includes('#include <roughnessmap_fragment>')) return;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 tq_wpos;\nvarying vec3 tq_wnrm;')
    .replace('#include <project_vertex>', `#include <project_vertex>
  mat4 tq_m = modelMatrix;
  #ifdef USE_INSTANCING
  tq_m = modelMatrix * instanceMatrix;
  #endif
  tq_wpos = (tq_m * vec4(transformed, 1.0)).xyz;
  tq_wnrm = normalize(mat3(tq_m) * objectNormal);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec3 tq_wpos;\nvarying vec3 tq_wnrm;\n${NOISE_GLSL}`)
    .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 tq_n = normalize(tq_wnrm);
  float tq_wall = 1.0 - smoothstep(0.25, 0.6, abs(tq_n.y));
  vec2 tq_flat = tq_wpos.xz + tq_wpos.y * 0.7;
  float tq_macro = tq_noise(tq_flat * 0.11) * 0.6 + tq_noise(tq_flat * 0.031 + 7.0) * 0.4;
  float tq_streak = smoothstep(0.15, 0.9, tq_noise(vec2((tq_wpos.x + tq_wpos.z) * 2.3, tq_wpos.y * 0.18))) * tq_wall;
  float tq_up = smoothstep(0.75, 0.95, tq_n.y);
  diffuseColor.rgb *= 1.0 + tq_macro * 0.09 - tq_streak * 0.13;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.57, 0.5) * dot(diffuseColor.rgb, vec3(0.33)) * 1.6, tq_up * (0.08 + 0.08 * max(tq_macro, 0.0)));`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor + tq_macro * 0.12 + tq_streak * 0.08, 0.04, 1.0);`);
}
