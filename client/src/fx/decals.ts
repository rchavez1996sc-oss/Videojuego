import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

function holeTexture(): THREE.CanvasTexture {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(20,16,12,1)');
  g.addColorStop(0.18, 'rgba(30,24,18,1)');
  g.addColorStop(0.3, 'rgba(90,80,70,0.85)');
  g.addColorStop(0.55, 'rgba(110,100,90,0.35)');
  g.addColorStop(1, 'rgba(120,110,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(25,20,15,0.6)';
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2, r = s * (0.2 + Math.random() * 0.25);
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(s / 2 + Math.cos(a) * s * 0.1, s / 2 + Math.sin(a) * s * 0.1);
    ctx.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Decals {
  readonly mesh: THREE.InstancedMesh;
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private z = new THREE.Vector3(0, 0, 1);

  constructor(lighting: Lighting, private max = 400) {
    const mat = lighting.setup(new THREE.MeshStandardMaterial({
      map: holeTexture(), transparent: true, depthWrite: false, roughness: 1,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }), 'decal');
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.m);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  place(point: THREE.Vector3, normal: THREE.Vector3, size: number, color: THREE.Color): void {
    this.q.setFromUnitVectors(this.z, normal).multiply(new THREE.Quaternion().setFromAxisAngle(this.z, Math.random() * Math.PI * 2));
    const s = size * (0.8 + Math.random() * 0.4);
    this.m.compose(point.clone().addScaledVector(normal, 0.015), this.q, new THREE.Vector3(s, s, s));
    this.mesh.setMatrixAt(this.next, this.m);
    this.mesh.setColorAt(this.next, color);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.next = (this.next + 1) % this.max;
  }
}
