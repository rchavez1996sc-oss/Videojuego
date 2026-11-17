import * as THREE from 'three';

/**
 * Army field uniform on the police model: every clothing texel (not skin: warm hue with some saturation) becomes
 * woodland camouflage — olive, khaki, brown and black blotches from value noise in UV space — keeping the original
 * shading; the darkest parts (vest, boots, gloves) turn olive drab.
 */
export function armyHook(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
float tq_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tq_n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tq_h(i), tq_h(i + vec2(1, 0)), f.x), mix(tq_h(i + vec2(0, 1)), tq_h(i + vec2(1, 1)), f.x), f.y); }
float tq_f(vec2 p) { return tq_n(p) * 0.6 + tq_n(p * 2.3 + 7.1) * 0.3 + tq_n(p * 5.1 + 3.3) * 0.1; }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 g = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2));
    float mx = max(g.r, max(g.g, g.b)), mn = min(g.r, min(g.g, g.b)), sat = (mx - mn) / (mx + 1e-4);
    float warm = step(g.b, g.g) * step(g.g, g.r) * smoothstep(0.12, 0.28, sat) * smoothstep(0.18, 0.3, mx);
    float lum = dot(g, vec3(0.3, 0.59, 0.11));
    vec2 uv = vMapUv * 26.0;
    float a = tq_f(uv), b = tq_f(uv * 1.3 + 11.0), c2 = tq_f(uv * 0.9 + 23.0);
    vec3 camo = vec3(0.36, 0.38, 0.22);
    camo = mix(camo, vec3(0.52, 0.48, 0.33), step(0.56, a));
    camo = mix(camo, vec3(0.30, 0.22, 0.14), step(0.6, b));
    camo = mix(camo, vec3(0.10, 0.10, 0.08), step(0.66, c2));
    vec3 drab = vec3(0.17, 0.18, 0.11);
    vec3 cloth = mix(drab, camo, smoothstep(0.08, 0.2, lum)) * (0.55 + 1.1 * lum);
    diffuseColor.rgb = mix(pow(cloth, vec3(2.2)), diffuseColor.rgb, warm);
  }`);
}
