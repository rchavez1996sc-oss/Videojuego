import * as THREE from 'three';
import { NOISE_GLSL } from './glsl';

export interface CloudDef { cover: number; height?: number; color?: string; shade?: string; speed?: number }

/**
 * Drifting cloud deck: a large plane high above the camera, shaded by layered value noise (coverage, puffy tops
 * lit towards the sun, darker bellies), faded towards the horizon so it melts into the sky and fog. Lima's grey
 * "panza de burro" is a high `cover`.
 */
export function cloudDeck(def: CloudDef, sunDir: THREE.Vector3): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 }, uCover: { value: def.cover }, uSun: { value: sunDir.clone() }, uSpeed: { value: def.speed ?? 1 },
      uColor: { value: new THREE.Color(def.color ?? '#f2f0ea') }, uShade: { value: new THREE.Color(def.shade ?? '#9ea3a8') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime, uCover, uSpeed; uniform vec3 uSun, uColor, uShade;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz * 0.0042 + vec2(uTime * 0.012, uTime * 0.005) * uSpeed;
        float n = clamp(tq_fbm(p) * 0.85 + 0.5, 0.0, 1.0), fine = clamp(tq_fbm(p * 3.7 + 9.1) * 0.8 + 0.5, 0.0, 1.0);
        float d = n * 0.8 + fine * 0.2;
        float a = smoothstep(1.0 - uCover - 0.12, 1.0 - uCover + 0.22, d);
        float belly = smoothstep(0.38, 0.85, d) * (0.75 + 0.25 * (1.0 - uSun.y));
        vec3 col = mix(uColor, uShade, belly) * (0.92 + 0.16 * fine);
        float far = length(vWorld.xz - cameraPosition.xz);
        a *= 1.0 - smoothstep(2200.0, 3900.0, far);
        gl_FragColor = vec4(col, a * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(Math.PI / 2), mat);
  const h = def.height ?? 300, start = performance.now();
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.position.set(camera.position.x, h, camera.position.z);
    mat.uniforms.uTime.value = (performance.now() - start) / 1000;
  };
  return mesh;
}
