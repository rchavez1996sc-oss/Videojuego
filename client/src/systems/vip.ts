import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Rig } from '../entities/rig';
import { onHit } from '../world/surfaces';
import type { Lighting } from '../render/lighting';

const RADIUS = 0.38;

/**
 * The man in the suit: unarmed, stands among the tables, cowers once the shooting starts. He must be taken alive:
 * a hit kills him (mission lost); standing beside him and holding E takes him prisoner.
 */
export class Vip {
  readonly rig: Rig;
  alive = true;
  captured = false;
  onKilled: () => void = () => {};
  private scared = false;
  private col: RAPIER.Collider;
  private head: THREE.Object3D | null = null;

  constructor(at: THREE.Vector3, yaw: number, lighting: Lighting, world: RAPIER.World) {
    this.rig = new Rig('vip', lighting, false);
    this.rig.root.position.copy(at);
    this.rig.root.rotation.y = yaw;
    this.rig.loop('civ_idle');
    this.col = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, RADIUS).setTranslation(at.x, at.y + 0.9, at.z));
    onHit(this.col.handle, () => {
      if (!this.alive || this.captured) return;
      this.alive = false;
      this.col.setEnabled(false);
      this.rig.die(Math.random() < 0.5 ? 'fall_back' : 'dying');
      this.onKilled();
    });
  }

  get position(): THREE.Vector3 {
    return this.rig.root.position;
  }

  update(dt: number, danger: boolean): void {
    if (danger && !this.scared && this.alive && !this.captured) {
      this.scared = true;
      this.rig.loop('terrified');
    }
    this.rig.tick(dt);
    if (this.alive) this.fitCollider();
  }

  /** Keeps the hit capsule on the visible body (cowering bends and leans him well off his standing axis). */
  private fitCollider(): void {
    const hips = this.rig.hips(), head = (this.head ??= this.rig.root.getObjectByName('mixamorigHead')!).getWorldPosition(new THREE.Vector3());
    const feet = this.rig.root.position.y, top = head.y + 0.15, half = Math.max(0.15, (top - feet) / 2 - RADIUS);
    this.col.setTranslation({ x: (hips.x + head.x) / 2, y: (feet + top) / 2, z: (hips.z + head.z) / 2 });
    this.col.setHalfHeight(half);
  }

  capture(): void {
    this.captured = true;
    this.rig.loop('terrified');
  }
}
