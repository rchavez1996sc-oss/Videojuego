import * as THREE from 'three';

/** Street-lamp heads registered while the level is built (pole arms). */
export const lampSpots: THREE.Vector3[] = [];

const POOL = 8;

/**
 * Evening and night: lamp heads, lit shop interiors and vehicle lights glow (emissive, so bloom picks them up), and
 * a fixed pool of real point lights hops to the street lamps nearest the camera, pooling warm light on the road
 * below. A fixed light count means no shader recompiles. Nothing happens by day (`glow` 0).
 */
export class NightLights {
  private pool: THREE.PointLight[] = [];
  private t = 0;

  constructor(private scene: THREE.Scene, private glow: number) {
    if (glow <= 0) return;
    const warm = new THREE.Color('#ffc98a');
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || Array.isArray(m) || !('emissive' in m)) return;
      if (m.name === 'lampHead') [m.emissive.copy(warm), m.emissiveIntensity = 4 * glow];
      else if (m.name === 'shopLit') m.emissiveIntensity = 0.55 + 1.8 * glow;
      else if (m.name === 'light' || m.name === 'veh-lamp') [m.emissive.set('#fff3d6'), m.emissiveIntensity = 3 * glow];
      else if (m.name === 'tail') [m.emissive.set('#ff1a0a'), m.emissiveIntensity = 1.5 * glow];
    });
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(warm, 0, 22, 2);
      this.pool.push(l);
      scene.add(l);
    }
  }

  update(dt: number, camera: THREE.Vector3): void {
    if (!this.pool.length || (this.t -= dt) > 0) return;
    this.t = 0.5;
    const near = lampSpots.map((p) => [p, p.distanceToSquared(camera)] as const).sort((a, b) => a[1] - b[1]).slice(0, POOL);
    this.pool.forEach((l, i) => {
      const s = near[i];
      l.intensity = s ? 60 * this.glow : 0;
      if (s) l.position.copy(s[0]).add(new THREE.Vector3(0, -0.25, 0));
    });
    void this.scene;
  }
}
