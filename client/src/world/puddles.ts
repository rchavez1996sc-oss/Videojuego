import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

/** Puddle shape: an irregular blob (alpha), with a darker damp halo around the standing water (rim channel = green). */
function puddleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const blob = (r: number, wob: number, seed: number) => {
    g.beginPath();
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2, d = r * (1 + Math.sin(a * 3 + seed) * wob + Math.sin(a * 7 + seed * 2) * wob * 0.5 + Math.sin(a * 13 + seed * 3) * wob * 0.25);
      g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d * 0.75);
    }
    g.closePath();
  };
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgb(0,255,0)';
  blob(110, 0.18, 1.7);
  g.fill();
  g.filter = 'blur(1.5px)';
  g.fillStyle = 'rgb(255,255,0)';
  blob(78, 0.22, 4.1);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

/**
 * Standing water: puddles by kerbs, under water tanks, outside car washes and broken pipes. Each is a flat quad
 * just above the floor; the red channel of its mask is the water (dark, mirror-smooth, reflects the sky), the green
 * channel the damp halo (darker ground, a little glossy). One instanced draw call, no shadows.
 */
export function puddles(lighting: Lighting, spots: { x: number; y: number; z: number; size: number }[]): THREE.InstancedMesh | null {
  if (!spots.length) return null;
  const mask = puddleTexture();
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: 0.04, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMapIntensity: 1.6 }), 'puddle', (sh) => {
    sh.uniforms.uMask = { value: mask };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMask;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec4 pm = texture2D(uMask, vPuddleUv);
  float water = pm.r, damp = pm.g;
  diffuseColor.a = max(water * 0.9, damp * 0.38);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(0.6, 0.03, water);`);
    sh.vertexShader = sh.vertexShader.replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nvarying vec2 vPuddleUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvPuddleUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <uv_pars_fragment>', '#include <uv_pars_fragment>\nvarying vec2 vPuddleUv;');
  });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  spots.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (p.x * 12.9 + p.z * 7.3) % 6.28);
    mesh.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y + 0.012, p.z), q, s.set(p.size, 1, p.size * (0.7 + ((p.x * 3.1) % 1 + 1) % 1 * 0.5))));
  });
  mesh.name = 'puddles';
  mesh.renderOrder = 1;
  return mesh;
}

/** Wet patches other scenes ask for (a car being washed…); `CityLife` adds them to its puddles. */
export const wetSpots: { x: number; y: number; z: number; size: number }[] = [];
export function addWetSpot(at: THREE.Vector3, size: number): void {
  wetSpots.push({ x: at.x, y: at.y, z: at.z, size });
}
