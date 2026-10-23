import * as THREE from 'three';

/** Static tiled meshes only cast shadows near the camera; far tiles still receive them. */
export class ShadowCull {
  private meshes: { mesh: THREE.Mesh; center: THREE.Vector3; radius: number }[] = [];
  private t = 0;

  constructor(private range: number) {}

  add(root: THREE.Object3D): void {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.castShadow) return;
      const s = o instanceof THREE.InstancedMesh ? o.boundingSphere : o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere!);
      if (!s) return;
      this.meshes.push({ mesh: o, center: s.center.clone(), radius: s.radius });
    });
  }

  update(dt: number, cam: THREE.Vector3): void {
    if ((this.t -= dt) > 0) return;
    this.t = 0.4;
    for (const m of this.meshes) m.mesh.castShadow = Math.hypot(m.center.x - cam.x, m.center.z - cam.z) - m.radius < this.range;
  }
}
