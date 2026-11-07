import * as THREE from 'three';

/** Characters (their model roots and hips bones) and vehicles (group → width, length) that get a contact shadow. */
export const shadowedChars = new Set<{ model: THREE.Object3D; bones: Map<string, THREE.Bone> }>();
export const shadowedCars = new Map<THREE.Object3D, [number, number]>();

const MAX = 320, RANGE = 45, CAR_RANGE = 70;

function blobTexture(): THREE.Texture {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }), g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Visible in the game scene (not an off-screen stage): itself and every ancestor shown, and attached to it. */
function shown(o: THREE.Object3D, scene: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (!p.parent) return p === scene;
  }
  return false;
}

/**
 * Soft contact shadows (ambient occlusion where a body meets the ground): a dark blur right under each character near
 * the camera — round when standing, stretched along the body when lying — and a long one under each vehicle. The
 * sun's shadow map is too coarse to ground a figure, so without this people and cars look pasted on the street.
 * One instanced draw call, updated each frame.
 */
export class ContactShadows {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private scene: THREE.Object3D) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: blobTexture(), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'contact-shadows';
  }

  update(camera: THREE.Vector3): void {
    let n = 0;
    const put = (x: number, y: number, z: number, yaw: number, w: number, l: number, alpha = 1) => {
      this.q.setFromAxisAngle(this.up, yaw);
      this.m.compose(this.a.set(x, y + 0.025, z), this.q, this.s.set(w * alpha, 1, l * alpha));
      this.mesh.setMatrixAt(n++, this.m);
    };
    for (const [g, [w, l]] of shadowedCars) {
      if (n >= MAX) break;
      g.getWorldPosition(this.a);
      if (this.a.distanceTo(camera) > CAR_RANGE || !shown(g, this.scene)) continue;
      const fwd = this.b.set(0, 0, 1).applyQuaternion(g.getWorldQuaternion(this.q));
      put(this.a.x, this.a.y, this.a.z, Math.atan2(fwd.x, fwd.z), w * 1.25, l * 1.12);
    }
    for (const c of shadowedChars) {
      if (n >= MAX) break;
      const hips = c.bones.get('mixamorigHips'), head = c.bones.get('mixamorigHead');
      if (!hips || !head) continue;
      c.model.getWorldPosition(this.a);
      if (this.a.distanceTo(camera) > RANGE || !shown(c.model, this.scene) || seatedInVehicle(c.model)) continue;
      const foot = this.a.y;
      hips.getWorldPosition(this.a);
      head.getWorldPosition(this.b);
      const lying = this.a.y - foot < 0.45;
      if (lying) {
        const mx = (this.a.x + this.b.x) / 2, mz = (this.a.z + this.b.z) / 2;
        put(mx, foot, mz, Math.atan2(this.b.x - this.a.x, this.b.z - this.a.z), 0.75, 1.9);
      } else put(this.a.x, foot, this.a.z, 0, 0.8, 0.8, THREE.MathUtils.clamp(1.25 - (this.a.y - foot - 0.9) * 0.6, 0.7, 1.1));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Riders and drivers sit in a vehicle group: the vehicle's own shadow covers them. */
function seatedInVehicle(o: THREE.Object3D): boolean {
  for (let p = o.parent; p; p = p.parent) if (shadowedCars.has(p)) return true;
  return false;
}
