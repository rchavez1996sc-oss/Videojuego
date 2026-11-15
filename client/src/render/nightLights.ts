import * as THREE from 'three';

/** Street-lamp heads registered while the level is built (pole arms, globes, lanterns). */
export const lampSpots: THREE.Vector3[] = [];

const POOL = 12, GLOWS = ['lampHead', 'globe', 'lanternGlass', 'lampBlue', 'lamp'];

/** Soft warm disc for the pool of light a street lamp throws on the ground. */
function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,150,1)');
  grad.addColorStop(0.35, 'rgba(255,200,130,0.55)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * Evening and night: lamp heads, lit shop interiors and vehicle lights glow (emissive, so bloom picks them up); every
 * street lamp of the level throws a warm pool of light on the road below (one additive instanced decal, so whole
 * avenues read as lit even far away); and a fixed pool of real point lights hops to the lamps nearest the camera to
 * light walls, cars and people. A fixed light count means no shader recompiles. Nothing happens by day (`glow` 0).
 */
export class NightLights {
  private pool: THREE.PointLight[] = [];
  private t = 0;

  constructor(scene: THREE.Scene, private glow: number, ground: (x: number, z: number) => number) {
    if (glow <= 0) return;
    const warm = new THREE.Color('#ffc98a');
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || Array.isArray(m) || !('emissive' in m)) return;
      if (GLOWS.includes(m.name)) [m.emissive.copy(warm), m.emissiveIntensity = 4 * glow];
      else if (m.name === 'shopLit') m.emissiveIntensity = 0.55 + 1.8 * glow;
      else if (m.name === 'light' || m.name === 'veh-lamp') [m.emissive.set('#fff3d6'), m.emissiveIntensity = 3 * glow];
      else if (m.name === 'tail') [m.emissive.set('#ff1a0a'), m.emissiveIntensity = 1.5 * glow];
    });
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(warm, 0, 30, 1.6);
      this.pool.push(l);
      scene.add(l);
    }
    if (!lampSpots.length) return;
    const mat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: Math.min(0.42, 0.38 * glow), blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, lampSpots.length), m = new THREE.Matrix4();
    lampSpots.forEach((p, i) => {
      const y = ground(p.x, p.z), h = Math.max(3, p.y - y), r = Math.min(13, h * 1.45);
      pools.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, Math.min(p.y - 2.5, y + 0.06), p.z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r)));
    });
    pools.frustumCulled = false;
    pools.renderOrder = 2;
    pools.name = 'lamp-pools';
    scene.add(pools);
  }

  update(dt: number, camera: THREE.Vector3): void {
    if (!this.pool.length || (this.t -= dt) > 0) return;
    this.t = 0.5;
    const near = lampSpots.map((p) => [p, p.distanceToSquared(camera)] as const).sort((a, b) => a[1] - b[1]).slice(0, POOL);
    this.pool.forEach((l, i) => {
      const s = near[i];
      l.intensity = s ? 55 * this.glow : 0;
      if (s) l.position.copy(s[0]).add(new THREE.Vector3(0, -0.4, 0));
    });
  }
}
