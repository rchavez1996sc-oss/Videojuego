import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Enemies } from './enemies';
import { Vip } from './vip';
import { carry } from '../entities/rig';
import { truce } from './truce';
import { PoliceTruck, vehicleMats } from '../entities/policeTruck';
import { celebrate } from '../ui/objectiveDone';
import type { Lighting } from '../render/lighting';
import type { Input } from '../core/input';
import type { Sfx } from '../audio/sfx';
import { shotMode } from '../core/settings';
import { siren } from '../audio/siren';

/** One group of the ambush: on foot at `at` (optionally on a roof at `y`), or driven in by pickup along `drive`. */
export interface AmbushGroup { delay: number; size: number; at: [number, number]; y?: number; drive?: [number, number][]; type?: string }

export interface HandoverDef {
  title: string; detail: string; action: string; doing: string;
  hostage: [number, number]; meet: [number, number, number]; across: [number, number, number]; hold: number;
  betrayal: string; fightTitle: string; ambush: AmbushGroup[];
  failed: string; complete: string; reward: string; loot?: string[];
}

type Phase = 'escort' | 'fight';

export interface HandoverDeps { scene: THREE.Scene; world: RAPIER.World; lighting: Lighting; enemies: Enemies; sfx: Sfx; camera: THREE.Camera; floor: (x: number, z: number) => number; nodes?: THREE.Vector3[] }

/**
 * Chapter goal in three acts: walk the hostage (he follows the player's trail) to the middle of the bridge and hold E
 * to hand him over; he crosses to the Junta's party by the chapel while everyone holds fire — then the betrayal:
 * sirens, the party opens fire and soldiers pour in on foot and by pickup from several sides. Win by killing every
 * one of them. The hostage dying before the handover loses the mission; shooting first triggers the betrayal at once.
 */
export class Handover {
  done = false;
  onComplete: () => void = () => {};
  onFail: (why: string) => void = () => {};
  private phase: Phase = 'escort';
  private vip: Vip;
  private trail: THREE.Vector3[] = [];
  private gait = '';
  private holdT = 0;
  private t = 0;
  private pending: AmbushGroup[];
  private trucks: PoliceTruck[] = [];
  private bars: THREE.MeshStandardMaterial[];
  private mats: Record<string, THREE.Material>;
  private party: { e: Enemies['list'][number]; hp: number }[];
  private panel = document.createElement('div');
  private marker = document.createElement('div');
  private prompt = document.createElement('div');
  private alert = document.createElement('div');
  private stopSiren: (() => void) | null = null;

  constructor(readonly def: HandoverDef, private d: HandoverDeps) {
    const [hx, hz] = def.hostage;
    this.vip = new Vip(new THREE.Vector3(hx, d.floor(hx, hz), hz), 0, d.lighting, d.world);
    this.vip.onKilled = () => this.phase !== 'fight' && !this.done && ((this.done = true), this.onFail(def.failed));
    d.scene.add(this.vip.rig.root);
    this.party = d.enemies.list.map((e) => ({ e, hp: e.hp }));
    this.pending = [...def.ambush].sort((a, b) => a.delay - b.delay);
    this.mats = vehicleMats(d.lighting);
    this.mats.red = (this.mats.red as THREE.MeshStandardMaterial).clone();
    this.mats.blue = (this.mats.blue as THREE.MeshStandardMaterial).clone();
    this.bars = [this.mats.red as THREE.MeshStandardMaterial, this.mats.blue as THREE.MeshStandardMaterial];
    this.panel.id = 'objective';
    this.marker.id = 'obj-marker';
    this.prompt.className = 'prompt';
    this.alert.id = 'op-alert';
    document.body.append(this.panel, this.marker, this.prompt, this.alert);
    if (shotMode) Object.assign(window, { __handover: this });
  }

  status(): string {
    return `phase ${this.phase} t ${this.t.toFixed(0)} vip ${this.vip.alive ? this.vip.position.toArray().map((v) => v.toFixed(1)).join(',') : 'dead'} left ${this.d.enemies.aliveCount}/${this.d.enemies.list.length} pending ${this.pending.length} done ${this.done}`;
  }

  get goal(): THREE.Vector3 | undefined {
    const [x, z, y] = this.def.meet;
    return this.phase === 'escort' ? new THREE.Vector3(x, y, z) : undefined;
  }

  /** Test hook: skip straight to the betrayal. */
  betray(): void {
    if (this.phase === 'fight') return;
    this.phase = 'fight';
    this.betrayedAt = this.t;
    truce.until = 0;
    this.stopSiren = siren(this.d.sfx);
    this.flash(this.def.betrayal, 9);
    for (const { e } of this.party) (e.engaged = true), (e.awareness = 1);
    if (!this.crossing) this.vip.rig.loop('terrified');
  }
  private crossing = false;

  update(dt: number, player: THREE.Vector3, input: Input, alive: boolean): void {
    if (this.done) return;
    this.t += dt;
    carry.relaxed = this.phase !== 'fight';
    this.nameTag();
    if (this.phase !== 'fight') {
      truce.until = performance.now() + 1500;
      if (this.party.some((p) => p.e.hp < p.hp)) this.betray();
      else for (const { e } of this.party) Object.assign(e, { awareness: 0, engaged: false, state: 'patrol' });
    }
    if (this.phase === 'escort') this.escort(dt, player, input, alive);
    else if (this.phase === 'fight') this.fight(dt);
    if (this.vip.alive) this.vip.update(dt, false);
    const blink = Math.floor(this.t * 3) % 2;
    this.bars.forEach((m, i) => (m.emissiveIntensity = i === blink ? 4 : 0.3));
    this.text(player);
    this.showMarker(player);
  }

  /** The hostage walks at the player's side (right, else left; along the player's trail when far or boxed in); holding E at the meeting point hands him over. */
  private escort(dt: number, player: THREE.Vector3, input: Input, alive: boolean): void {
    const last = this.trail[this.trail.length - 1];
    if (!last || last.distanceTo(player) > 0.7) {
      if (last) this.heading.copy(player).sub(last).setY(0).normalize();
      this.trail.push(player.clone());
    }
    if (this.trail.length > 400) this.trail.shift();
    const v = this.vip.position;
    while (this.trail.length > 1 && v.distanceTo(this.trail[0]) < 0.6) this.trail.shift();
    const gap = v.distanceTo(player), slot = this.sideSlot(player);
    if (slot && gap < 8) {
      const d = v.distanceTo(slot);
      if (d > 0.35) this.walk(dt, slot, Math.min(5.4, Math.max(1.3, d * 2.4)));
      else (this.setGait('civ_idle'), (this.vip.rig.root.rotation.y = Math.atan2(this.heading.x, this.heading.z)));
      this.trail.length = 0;
      this.trail.push(player.clone());
    } else if (gap > 2.4 && this.trail[0]) this.walk(dt, this.trail[0], gap > 15 ? 5.2 : gap > 6 ? 3.8 : 1.8);
    else this.setGait('civ_idle');
    const [mx, mz] = this.def.meet, near = Math.hypot(player.x - mx, player.z - mz) < 4 && v.distanceTo(player) < 6;
    let text = '';
    if (near && alive) {
      this.holdT = input.down('KeyE') ? this.holdT + dt : 0;
      const pct = Math.min(100, Math.round((this.holdT / this.def.hold) * 100));
      text = this.holdT > 0 ? `${this.def.doing} <span>${pct}%</span><i class="bar"><b style="width:${pct}%"></b></i>` : `<kbd>E</kbd> ${this.def.action}`;
      if (this.holdT >= this.def.hold) (this.prompt.style.opacity = '0'), (this.crossing = true), this.betray();
    }
    if (this.phase === 'escort') this.prompt.style.opacity = text ? '1' : '0';
    if (text && this.prompt.innerHTML !== text) this.prompt.innerHTML = text;
  }

  private heading = new THREE.Vector3(0, 0, 1);
  /** A free spot 1.2 m to the player's right (or left), slightly behind, with a clear line from the player. */
  private sideSlot(player: THREE.Vector3): THREE.Vector3 | null {
    const right = new THREE.Vector3(-this.heading.z, 0, this.heading.x);
    for (const s of [1, -1]) {
      const p = player.clone().addScaledVector(right, s * 1.2).addScaledVector(this.heading, -0.3);
      const from = player.clone().setY(player.y + 1), dir = p.clone().setY(player.y + 1).sub(from), len = dir.length();
      const hit = this.d.world.castRay(new RAPIER.Ray(from, dir.normalize()), len + 0.35, true, undefined, undefined, undefined, undefined, (c) => !c.isSensor() && c.parent()?.isFixed() === true);
      if (!hit) return p;
    }
    return null;
  }

  /** Steps the hostage toward `to` at `speed`, on the walkable floor; true on arrival. */
  private walk(dt: number, to: THREE.Vector3, speed: number): boolean {
    const v = this.vip.position, dx = to.x - v.x, dz = to.z - v.z, d = Math.hypot(dx, dz);
    if (d < 0.3) return true;
    const step = Math.min(d, speed * dt);
    v.x += (dx / d) * step;
    v.z += (dz / d) * step;
    v.y = this.phase === 'escort' ? THREE.MathUtils.lerp(v.y, to.y, Math.min(1, step / Math.max(d, 0.01))) : this.d.floor(v.x, v.z);
    this.vip.rig.root.rotation.y = Math.atan2(dx, dz);
    this.setGait(speed > 3 ? 'civ_run' : 'civ_walk');
    return false;
  }

  private setGait(key: string): void {
    if (this.gait !== key) (this.gait = key), this.vip.rig.loop(key);
  }

  private fight(dt: number): void {
    if (this.crossing && this.vip.alive) {
      const [ax, az, ay] = this.def.across;
      if (this.walk(dt, new THREE.Vector3(ax, ay, az), 4.4)) (this.crossing = false), (this.gait = 'terrified'), this.vip.rig.loop('terrified');
    }
    while (this.pending.length && this.pending[0].delay <= this.t - this.betrayedAt) this.arrive(this.pending.shift()!);
    for (const tr of this.trucks) tr.update(dt);
    if (!this.pending.length && this.trucks.every((t) => t.parked) && this.d.enemies.aliveCount === 0) {
      this.done = true;
      this.stopSiren?.();
      this.prompt.style.opacity = this.marker.style.opacity = '0';
      celebrate('EMBOSCADA REPELIDA', () => this.onComplete());
    }
  }
  private betrayedAt = 0;

  private squad(g: AmbushGroup, x: number, z: number): void {
    const near = (this.d.nodes ?? []).filter((n) => Math.hypot(n.x - x, n.z - z) < 26).sort(() => Math.random() - 0.5);
    for (let i = 0; i < g.size; i++) {
      const n = g.y === undefined ? near[i % Math.max(1, near.length)] : undefined, a = (i / g.size) * Math.PI * 2;
      const px = n ? n.x + (Math.random() - 0.5) * 1.5 : x + Math.cos(a) * (i ? 2.5 : 0), pz = n ? n.z + (Math.random() - 0.5) * 1.5 : z + Math.sin(a) * (i ? 2.5 : 0);
      const e = this.d.enemies.add({ type: g.type ?? 'soldier', x: px, z: pz, ...(g.y !== undefined ? { y: g.y } : {}) });
      e.engaged = true;
      e.awareness = 0.9;
      e.lastKnown.copy(this.vip.position);
    }
  }

  private arrive(g: AmbushGroup): void {
    if (!g.drive) return this.squad(g, g.at[0], g.at[1]);
    const truck = new PoliceTruck(this.mats, g.drive.map(([x, z]) => new THREE.Vector3(x, 0, z)), this.d.world);
    truck.onParked = () => this.squad(g, g.at[0], g.at[1]);
    this.trucks.push(truck);
    this.d.scene.add(truck.group);
  }

  private flash(text: string, seconds = 4.5): void {
    this.alert.textContent = text;
    this.alert.classList.add('on');
    clearTimeout(this.alertT);
    this.alertT = window.setTimeout(() => this.alert.classList.remove('on'), seconds * 1000);
  }
  private alertT = 0;
  private tag = Object.assign(document.createElement('div'), { textContent: 'GIACOMO MIRÓ QUESADA' });
  /** Name label floating over the hostage's head while he is alive and in view. */
  private nameTag(): void {
    if (!this.tag.isConnected) {
      Object.assign(this.tag.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', font: '600 12px "Barlow Condensed", sans-serif', letterSpacing: '0.12em', color: '#f3e7c9', textShadow: '0 1px 3px #000, 0 0 6px #000', padding: '2px 8px', background: 'rgba(20,16,10,0.55)', borderLeft: '2px solid #d9a640', whiteSpace: 'nowrap', zIndex: '5' });
      document.body.append(this.tag);
    }
    const head = this.vip.position.clone().setY(this.vip.position.y + 2.15), cam = this.d.camera as THREE.PerspectiveCamera, far = head.distanceTo(cam.position);
    const v = head.clone().project(cam), ahead = head.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) > 0;
    const on = this.vip.alive && ahead && far < 70 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && !document.body.classList.contains('paused');
    this.tag.style.opacity = on ? String(Math.min(1, (70 - far) / 20)) : '0';
    if (on) this.tag.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
  }

  private text(player: THREE.Vector3): void {
    const p = this.phase, [mx, mz] = this.def.meet;
    const title = p === 'fight' ? this.def.fightTitle : this.def.title;
    const line = p === 'escort' ? `${this.def.detail} · ${Math.round(Math.hypot(player.x - mx, player.z - mz))} m` : p === 'fight' ? `ENEMIGOS ${this.d.enemies.aliveCount}${this.pending.length ? ' · LLEGAN MÁS' : ''}` : 'MIRÓ QUESADA CRUZA EL PUENTE · NO DISPAREN';
    const html = `<span class="k">OBJETIVO</span><b>${title}</b><span class="d">${line}</span>`;
    if (this.panel.innerHTML !== html) this.panel.innerHTML = html;
  }

  private showMarker(player: THREE.Vector3): void {
    const goal = this.goal;
    if (!goal) return void (this.marker.style.opacity = '0');
    const far = player.distanceTo(goal), cam = this.d.camera as THREE.PerspectiveCamera;
    const v = goal.clone().setY(goal.y + 3).project(cam), ahead = goal.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) > 0;
    const on = ahead && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && far > 6;
    this.marker.style.opacity = on ? '1' : '0';
    if (!on) return;
    this.marker.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
    this.marker.dataset.dist = `${Math.round(far)} m`;
  }
}
