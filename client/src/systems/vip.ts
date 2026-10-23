import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Rig } from '../entities/rig';
import { characters } from '../render/characters';
import { onHit } from '../world/surfaces';
import type { Lighting } from '../render/lighting';

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

  constructor(at: THREE.Vector3, yaw: number, lighting: Lighting, world: RAPIER.World) {
    this.rig = new Rig('civ_a', lighting, false);
    this.rig.root.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) o.material = characters.suit(o.material as THREE.Material);
    });
    this.rig.root.position.copy(at);
    this.rig.root.rotation.y = yaw;
    this.rig.loop('civ_idle');
    this.col = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(at.x, at.y + 0.9, at.z));
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
  }

  capture(): void {
    this.captured = true;
    this.rig.loop('terrified');
  }
}
