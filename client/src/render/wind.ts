import type * as THREE from 'three';

/** Seconds of wind time, advanced by `Lighting.update`; shared by every swaying material. */
export const WIND = { value: 0 };

/**
 * Lighting hook that sways vegetation: the whole plant bends with slow gusts (offset grows with the square of the
 * height, so the foot stays put) and leaves flutter faster; phase from the instance's position so neighbours differ.
 * `amp` is the bend per metre² of height (≈ 0.004 → 25 cm at 8 m), `flutter` the leaf shiver (0 for trunks).
 */
export function windHook(amp: number, flutter = 0): (shader: THREE.WebGLProgramParametersWithUniforms) => void {
  return (shader) => {
    shader.uniforms.uWind = WIND;
    shader.vertexShader = `uniform float uWind;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    #ifdef USE_INSTANCING
      vec3 wp = instanceMatrix[3].xyz;
    #else
      vec3 wp = modelMatrix[3].xyz;
    #endif
    float ph = wp.x * 0.13 + wp.z * 0.17, h = max(position.y, 0.0), k = ${amp.toFixed(5)} * h * h;
    float gust = 0.6 + 0.4 * sin(uWind * 0.31 + ph * 0.2);
    transformed.x += (sin(uWind * 1.3 + ph) * 0.7 + sin(uWind * 2.7 + ph * 1.7) * 0.3) * k * gust;
    transformed.z += (cos(uWind * 1.1 + ph) * 0.5) * k * gust;
    transformed += vec3(sin(uWind * 7.0 + position.x * 3.0 + position.z * 2.0), sin(uWind * 6.1 + position.y * 3.0) * 0.6, cos(uWind * 6.6 + position.z * 3.0)) * ${flutter.toFixed(4)} * min(h, 6.0);
  }`);
  };
}
