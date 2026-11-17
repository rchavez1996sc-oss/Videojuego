import * as THREE from 'three';

/** Street-lamp heads registered while the level is built (pole arms, globes, lanterns). */
export const lampSpots: THREE.Vector3[] = [];
/** Small lamps that only get a glow pool on the ground, never one of the real point lights. */
export const glowSpots: THREE.Vector3[] = [];

const GLOWS = ['lampHead', 'globe', 'lanternGlass', 'lampBlue', 'lamp'];

/** Soft warm disc for the pool of light a street lamp throws on the ground. */
function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let k = 0; k <= 8; k++) {
    const t = k / 8, a = Math.exp(-t * t * 4.2) * (1 - t);
    grad.addColorStop(t, `rgba(255,${Math.round(212 - t * 24)},${Math.round(148 - t * 30)},${a.toFixed(3)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Soft halo seen around a lit lamp head (and through dawn mist). */
function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,236,200,0.9)');
  grad.addColorStop(0.18, 'rgba(255,214,160,0.45)');
  grad.addColorStop(0.5, 'rgba(255,190,120,0.1)');
  grad.addColorStop(1, 'rgba(255,180,110,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface Slot { light: THREE.PointLight; spot: THREE.Vector3 | null; level: number }

/**
 * Evening, night and first light: lamp heads, lit windows, shop interiors and vehicle lights glow (emissive, so bloom
 * picks them up); every lamp of the level throws a warm pool of light on the real surface below it (pavement, cobbles,
 * deck — found by a ray, one additive instanced decal) and wears a soft halo (one point sprite cloud); a fixed set of
 * real point lights (8/12/16 by quality) serves the lamps nearest the camera, each fading out before it moves and
 * fading in at its new lamp, so walls never pop. A fixed light count means no shader recompiles. Nothing by day.
 */
export class NightLights {
  private slots: Slot[] = [];
  private t = 0;

  constructor(scene: THREE.Scene, private glow: number, floor: (p: THREE.Vector3) => number, count = 12) {
    if (location.search.includes('shot')) Object.assign(window, { __lamps: lampSpots, __glows: glowSpots });
    if (glow <= 0) return;
    const warm = new THREE.Color('#ffc98a');
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || Array.isArray(m) || !('emissive' in m)) return;
      if (GLOWS.includes(m.name)) [m.emissive.copy(warm), m.emissiveIntensity = 4 * glow];
      else if (m.name === 'shopLit') m.emissiveIntensity = 0.55 + 1.8 * glow;
      else if (m.name === 'roomLit') m.emissiveIntensity = 2.4 * glow;
      else if (m.name.startsWith('curtain')) m.emissiveIntensity = 2.2 * glow;
      else if (m.name === 'light' || m.name === 'veh-lamp') [m.emissive.set('#fff3d6'), m.emissiveIntensity = 3 * glow];
      else if (m.name === 'tail') [m.emissive.set('#ff1a0a'), m.emissiveIntensity = 1.5 * glow];
    });
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(warm, 0, 32, 1.6);
      this.slots.push({ light, spot: null, level: 0 });
      scene.add(light);
    }
    if (!lampSpots.length && !glowSpots.length) return;
    this.layPools = () => {
      const spots = [...lampSpots, ...glowSpots];
      const mat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: Math.min(0.32, 0.3 * glow), blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, spots.length), m = new THREE.Matrix4();
      spots.forEach((p, i) => {
        const y = floor(p), h = Math.max(3, p.y - y), r = Math.min(13, h * 1.45);
        pools.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, y + 0.04, p.z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r)));
      });
      pools.frustumCulled = false;
      pools.renderOrder = 2;
      pools.name = 'lamp-pools';
      scene.add(pools);
    };
    const halos = new THREE.Points(new THREE.BufferGeometry().setFromPoints(lampSpots), new THREE.PointsMaterial({ map: haloTexture(), size: 2.6, sizeAttenuation: true, transparent: true, opacity: Math.min(0.85, 0.75 * glow), blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffd9a8' }));
    halos.frustumCulled = false;
    halos.renderOrder = 3;
    halos.name = 'lamp-halos';
    scene.add(halos);
  }
  /** Pools are laid on the first update, once the physics broadphase knows every collider (their rays need it). */
  private layPools: (() => void) | null = null;

  update(dt: number, camera: THREE.Vector3): void {
    if (!this.slots.length) return;
    if (this.layPools) [this.layPools(), (this.layPools = null)];
    const full = 55 * this.glow, fade = dt / 0.35;
    if ((this.t -= dt) <= 0) {
      this.t = 0.4;
      const want = lampSpots.map((p) => [p, p.distanceToSquared(camera)] as const).sort((a, b) => a[1] - b[1]).slice(0, this.slots.length).map((x) => x[0]);
      const free = this.slots.filter((s) => !s.spot || !want.includes(s.spot));
      const missing = want.filter((p) => !this.slots.some((s) => s.spot === p));
      for (const s of free) s.spot = s.level > 0.02 && s.spot ? s.spot : null;
      for (const p of missing) {
        const s = free.find((f) => !f.spot || f.level <= 0.02);
        if (!s) break;
        s.spot = p;
        s.level = 0;
        s.light.position.copy(p).add(new THREE.Vector3(0, -0.4, 0));
        free.splice(free.indexOf(s), 1);
      }
      for (const s of free) (s as Slot & { leaving?: boolean }).leaving = true;
      for (const s of this.slots) if (s.spot && want.includes(s.spot)) (s as Slot & { leaving?: boolean }).leaving = false;
    }
    for (const s of this.slots as (Slot & { leaving?: boolean })[]) {
      s.level = THREE.MathUtils.clamp(s.level + (s.spot && !s.leaving ? fade : -fade), 0, 1);
      if (s.leaving && s.level <= 0) s.spot = null;
      s.light.intensity = full * s.level * s.level * (3 - 2 * s.level);
    }
  }
}
