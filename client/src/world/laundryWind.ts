import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { WIND } from '../render/wind';

/** One garment pegged on a line: top-centre, size, facing and colour. */
interface Cloth { top: THREE.Vector3; w: number; h: number; yaw: number; color: string }
const clothes: Cloth[] = [];

/** Registers a garment hanging from a clothes line (built later as one instanced, wind-blown mesh). */
export function hangCloth(top: THREE.Vector3, w: number, h: number, yaw: number, color: string): void {
  clothes.push({ top: top.clone(), w, h, yaw, color });
}

/**
 * Every garment of the level in one instanced draw: a cloth panel pinned along its top edge whose hem swings with the
 * wind (sideways sway growing with the drop, a slower billow out of its plane, a fast flutter at the hem), each with
 * its own phase from its position so a line of shirts doesn't move in lockstep.
 */
export function laundryMesh(lighting: Lighting): THREE.InstancedMesh | null {
  if (!clothes.length) return null;
  const geo = new THREE.PlaneGeometry(1, 1, 2, 4).translate(0, -0.5, 0);
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide }), 'laundry', (shader) => {
    shader.uniforms.uWind = WIND;
    shader.vertexShader = `uniform float uWind;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    vec3 wp = instanceMatrix[3].xyz;
    float ph = wp.x * 0.37 + wp.z * 0.23, drop = -position.y, k = drop * drop;
    float gust = 0.55 + 0.45 * sin(uWind * 0.4 + ph * 0.3);
    transformed.z += (sin(uWind * 1.7 + ph) * 0.22 + 0.12) * k * gust;
    transformed.x += sin(uWind * 2.3 + ph * 1.3) * 0.06 * k * gust;
    transformed.z += sin(uWind * 9.0 + position.x * 6.0 + ph) * 0.025 * drop;
  }`);
  });
  const mesh = new THREE.InstancedMesh(geo, mat, clothes.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  clothes.splice(0).forEach((c, i) => {
    mesh.setMatrixAt(i, m4.compose(c.top, q.setFromAxisAngle(up, c.yaw), new THREE.Vector3(c.w, c.h, 1)));
    mesh.setColorAt(i, new THREE.Color(c.color));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'laundry';
  return mesh;
}
