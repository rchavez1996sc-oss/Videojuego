import type * as THREE from 'three';
import { NOISE_GLSL } from './glsl';

const SKIP = new Set(['grass', 'terrain', 'ocean', 'signs']);
const ROAD = new Set(['asphalt', 'asphaltWorn', 'cobble']);
const PAINT = new Set(['road-paint']);

/** Asphalt: broad tonal patches, darker rectangular repairs, oil drips, a dusty lighter cast in places. */
const ROAD_WEAR = /* glsl */ `
  {
    vec2 rp = tq_wpos.xz;
    float broad = tq_noise(rp * 0.045) * 0.6 + tq_noise(rp * 0.17 + 3.0) * 0.4;
    vec2 cell = floor(rp / vec2(5.0, 3.0));
    float repair = step(0.86, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453)) * step(0.15, fract(rp.x / 5.0)) * step(0.2, fract(rp.y / 3.0));
    float oil = smoothstep(0.62, 0.8, tq_noise(rp * 0.9 + 7.0)) * smoothstep(0.2, 0.6, tq_noise(rp * 0.08));
    diffuseColor.rgb *= 1.0 + broad * 0.16 - repair * 0.28 - oil * 0.35;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.4, 0.37) * dot(diffuseColor.rgb, vec3(0.33)) * 2.2, smoothstep(0.2, 0.7, broad) * 0.25);
  }`;

/** Road markings: faded towards the asphalt, worn through in patches and chipped at the edges. */
const PAINT_WEAR = /* glsl */ `
  {
    vec2 rp = tq_wpos.xz;
    float wear = tq_noise(rp * 0.35) * 0.55 + tq_noise(rp * 1.6 + 5.0) * 0.3 + tq_noise(rp * 6.0 + 9.0) * 0.15;
    if (wear < -0.38) discard;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.155, 0.15), clamp(0.25 + (0.1 - wear) * 0.6, 0.15, 0.75));
  }`;

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
  ${ROAD.has(key) ? ROAD_WEAR : PAINT.has(key) ? PAINT_WEAR : ''}
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.57, 0.5) * dot(diffuseColor.rgb, vec3(0.33)) * 1.6, tq_up * (0.08 + 0.08 * max(tq_macro, 0.0)));`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor + tq_macro * 0.12 + tq_streak * 0.08, 0.04, 1.0);`);
}
