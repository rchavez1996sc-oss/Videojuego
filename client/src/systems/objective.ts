import * as THREE from 'three';
import type { StationInfo } from '../world/station';
import type { Enemy } from '../entities/enemy';
import type { Input } from '../core/input';

export interface ObjectiveDef { title: string; detail: string; defendRadius: number; hold: number; complete: string; reward: string; loot?: string[]; unlock?: string; action?: string; doing?: string }

/** Chapter goal: storm the station and hold E in the lobby to loot the arms cache (defenders need not all be dead). */
export class Objective {
  private panel = document.createElement('div');
  private marker = document.createElement('div');
  private prompt = document.createElement('div');
  private holdT = 0;
  private v = new THREE.Vector3();
  done = false;
  onComplete: () => void = () => {};

  constructor(readonly def: ObjectiveDef, readonly site: StationInfo, private camera: THREE.Camera) {
    this.panel.id = 'objective';
    this.marker.id = 'obj-marker';
    this.prompt.className = 'prompt';
    document.body.append(this.panel, this.marker, this.prompt);
  }

  get position(): THREE.Vector3 {
    return this.site.entrance;
  }

  private defenders(enemies: Enemy[]): number {
    return enemies.filter((e) => e.alive && e.position.distanceTo(this.site.entrance) < this.def.defendRadius).length;
  }

  private inside(p: THREE.Vector3): boolean {
    const h = this.site.hall;
    return p.x > h.x0 && p.x < h.x1 && p.z > h.z0 && p.z < h.z1 && Math.abs(p.y - h.y) < 2;
  }

  update(dt: number, player: THREE.Vector3, enemies: Enemy[], input: Input, alive: boolean): void {
    if (this.done) return;
    const dist = Math.round(player.distanceTo(this.site.entrance));
    const left = this.defenders(enemies);
    this.panel.innerHTML = `<span class="k">OBJETIVO</span><b>${this.def.title}</b><span class="d">${left ? `DEFENSORES ${left} · ` : ''}${dist} m</span>`;
    this.camera.updateMatrixWorld();
    const ahead = this.v.copy(this.site.entrance).sub(this.camera.position).dot(this.camera.getWorldDirection(new THREE.Vector3())) > 0;
    this.v.copy(this.site.entrance).setY(this.site.entrance.y + 5).project(this.camera);
    const onScreen = ahead && Math.abs(this.v.x) < 0.95 && Math.abs(this.v.y) < 0.95 && dist > 6;
    this.marker.style.opacity = onScreen ? '1' : '0';
    if (onScreen) {
      this.marker.style.transform = `translate(${((this.v.x + 1) / 2) * innerWidth}px, ${((1 - this.v.y) / 2) * innerHeight}px)`;
      this.marker.dataset.dist = `${dist} m`;
    }
    const inside = alive && this.inside(player);
    this.prompt.style.opacity = inside ? '1' : '0';
    if (!inside) {
      this.holdT = 0;
      return;
    }
    this.holdT = input.down('KeyE') ? this.holdT + dt : 0;
    this.prompt.innerHTML = this.holdT > 0 ? `${this.def.doing ?? 'SAQUEANDO CARGAMENTO'} <span>${Math.round((this.holdT / this.def.hold) * 100)}%</span>` : `<kbd>E</kbd> MANTÉN PARA ${this.def.action ?? 'SAQUEAR EL CARGAMENTO'}`;
    if (this.holdT < this.def.hold) return;
    this.done = true;
    this.prompt.style.opacity = this.marker.style.opacity = '0';
    this.panel.innerHTML = `<span class="k">OBJETIVO CUMPLIDO</span><b>${this.def.title}</b>`;
    this.onComplete();
  }
}
