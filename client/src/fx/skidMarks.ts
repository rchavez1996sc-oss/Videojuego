import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

const MAX = 700;

/**
 * Tyre marks left by the driven vehicle: black rubber streaks on paving when a wheel slides (skid, handbrake
 * turn, hard braking) and darker tread ruts in bare earth whenever it rolls. A ring of thin quads (oldest reused),
 * one instanced draw call, drawn just above the ground without depth writes.
 */
export class SkidMarks {
  readonly mesh: THREE.InstancedMesh;
  private next = 0;
  private last = new Map<number, THREE.Vector3>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();

  constructor(lighting: Lighting) {
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 'skid');
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  }

  /** Wheel `id` is at `at`; `kind` null lifts it (no mark), 'skid' = rubber on paving, 'rut' = track in the dirt. */
  wheel(id: number, at: THREE.Vector3, kind: 'skid' | 'rut' | null, width: number): void {
    const prev = this.last.get(id);
    if (!kind) return void this.last.delete(id);
    if (!prev) return void this.last.set(id, at.clone());
    const len = prev.distanceTo(at);
    if (len < 0.25) return;
    if (len > 2) return void this.last.set(id, at.clone());
    const mid = prev.clone().add(at).multiplyScalar(0.5).setY(Math.max(prev.y, at.y) + 0.015);
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(at.x - prev.x, at.z - prev.z));
    this.mesh.setMatrixAt(this.next, this.m.compose(mid, this.q, new THREE.Vector3(width, 1, len + 0.04)));
    const c = kind === 'skid' ? new THREE.Color(0.012, 0.012, 0.013) : new THREE.Color(0.09, 0.066, 0.045);
    this.mesh.setColorAt(this.next, c.multiplyScalar(0.9 + Math.random() * 0.2));
    this.next = (this.next + 1) % MAX;
    this.mesh.count = Math.max(this.mesh.count, this.next);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.last.set(id, at.clone());
  }

  reset(): void {
    this.last.clear();
  }
}

/** Per-frame marks for the driven car: sideways slip, locked handbrake or hard braking = skid; bare earth = ruts. */
export function trackWheels(marks: SkidMarks, contacts: { at: THREE.Vector3; rear: boolean; i: number }[], vel: THREE.Vector3, yaw: number, braking: boolean, handbrake: boolean, earth: (p: THREE.Vector3) => boolean, width: number): void {
  const speed = Math.hypot(vel.x, vel.z), lat = Math.abs(vel.x * Math.cos(yaw) - vel.z * Math.sin(yaw));
  const slide = speed > 3 && (lat > 1.8 || (handbrake && speed > 4) || (braking && speed > 7));
  const seen = new Set<number>();
  for (const c of contacts) {
    seen.add(c.i);
    const dirt = earth(c.at);
    marks.wheel(c.i, c.at, dirt && speed > 0.5 ? 'rut' : slide && (c.rear || braking) ? 'skid' : null, width);
  }
  for (let i = 0; i < 4; i++) if (!seen.has(i)) marks.wheel(i, new THREE.Vector3(), null, width);
}
