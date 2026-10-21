import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Enemy } from '../entities/enemy';
import type { Pickups } from './pickups';
import type { Heightfield } from '../world/heightfield';
import type { Player } from '../entities/player';
import type { Gun } from '../weapons/gun';
import type { Sfx } from '../audio/sfx';
import type { Hud } from '../ui/hud';
import type { Input } from '../core/input';

/** Seconds a fallen soldier's magazines can still be taken. */
const WINDOW = 30, RANGE = 2.3, EMPTY_DELAY = 2, EMPTY_EVERY = 40, LOW_EVERY = 100;

interface Body { t: number; rounds: number }

/** Ammo from fresh corpses (E) plus small supply drops near the player when they run dry. */
export class Loot {
  private bodies = new Map<Enemy, Body>();
  private prompt = document.createElement('div');
  private emptyT = EMPTY_DELAY;
  private lowT = LOW_EVERY;

  constructor(private pickups: Pickups, private world: RAPIER.World, private hf: Heightfield) {
    this.prompt.className = 'prompt';
    document.body.appendChild(this.prompt);
  }

  update(dt: number, d: { dead: Enemy[]; player: Player; gun: Gun; input: Input; sfx: Sfx; hud: Hud; alive: boolean }): void {
    const p = d.player.position;
    let near: Body | null = null, best = RANGE;
    for (const e of d.dead) {
      let b = this.bodies.get(e);
      if (!b) this.bodies.set(e, (b = { t: 0, rounds: 30 + Math.round(Math.random() * 45) }));
      b.t += dt;
      const dist = e.position.distanceTo(p);
      if (b.t < WINDOW && b.rounds > 0 && dist < best) {
        best = dist;
        near = b;
      }
    }
    const show = d.alive && !!near;
    this.prompt.style.opacity = show ? '1' : '0';
    if (show) this.prompt.innerHTML = `<kbd>E</kbd> TOMAR MUNICIÓN <span>${near!.rounds}</span>`;
    if (show && d.input.hit('KeyE')) {
      if (d.gun.reserve >= d.gun.reserveMax) d.hud.showToast('MUNICIÓN LLENA');
      else {
        const before = d.gun.reserve;
        d.gun.addAmmo(near!.rounds);
        d.hud.showToast(`+${d.gun.reserve - before} BALAS`);
        near!.rounds = 0;
        d.sfx.pickup();
      }
    }
    this.resupply(dt, d);
  }

  private resupply(dt: number, d: { player: Player; gun: Gun; hud: Hud; alive: boolean }): void {
    if (!d.alive) return;
    const total = d.gun.ammo + d.gun.reserve;
    if (total <= 0) {
      if ((this.emptyT -= dt) <= 0 && this.drop(d.player)) {
        this.emptyT = EMPTY_EVERY;
        d.hud.showToast('MUNICIÓN DE EMERGENCIA CERCA');
      }
    } else this.emptyT = Math.min(this.emptyT + dt, EMPTY_DELAY);
    if (d.gun.reserve < d.gun.reserveMax * 0.35 && (this.lowT -= dt) <= 0 && this.drop(d.player)) {
      this.lowT = LOW_EVERY;
      d.hud.showToast('CAJA DE MUNICIÓN CERCA');
    }
  }

  /** A crate 7–14 m away, in the open and in line of sight of the player. */
  private drop(player: Player): boolean {
    const p = player.position, eye = p.clone().setY(p.y + 1.5);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 7;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, y = this.hf.heightAt(x, z);
      if (Math.abs(y - p.y) > 2.5) continue;
      if (this.world.castRay(new RAPIER.Ray({ x, y: y + 0.3, z }, { x: 0, y: 1, z: 0 }), 30, true)) continue;
      const to = new THREE.Vector3(x, y + 0.5, z).sub(eye), len = to.length();
      const hit = this.world.castRay(new RAPIER.Ray(eye, to.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.isEnabled() && c.handle !== player.collisionHandle);
      if (hit && hit.timeOfImpact < len - 0.6) continue;
      this.pickups.spawn(new THREE.Vector3(x, y, z), 'ammo', 90);
      return true;
    }
    return false;
  }
}
