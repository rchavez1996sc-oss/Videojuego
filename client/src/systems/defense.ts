import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Enemies } from './enemies';
import { Students } from './students';
import { schedule, type Drop } from './waves';
import { PoliceTruck, vehicleMats } from '../entities/policeTruck';
import { Tank } from '../entities/tank';
import { celebrate } from '../ui/objectiveDone';
import type { Lighting } from '../render/lighting';
import type { Input } from '../core/input';
import type { Sfx } from '../audio/sfx';
import { mulberry32 } from '../core/rng';
import { shotMode } from '../core/settings';

/** Gate: squads on foot enter at (`inX`, `inZ`); pickups from that side follow `drive` in through the nearest vehicle entrance and drop at (`dropX`, `dropZ`). */
export interface DefenseDef {
  title: string; seconds: number; waves: number[]; students: number; limit: number;
  gates: { x: number; inX: number; inZ: number; drive: [number, number][]; dropX: number; dropZ: number }[];
  tank: [number, number][]; charge: [number, number, number];
  tankAlert: string; failed: string; complete: string; reward: string;
}

export interface DefenseDeps { scene: THREE.Scene; world: RAPIER.World; lighting: Lighting; enemies: Enemies; sfx: Sfx; camera: THREE.Camera; refuge: THREE.Vector3[]; blast: (at: THREE.Vector3) => void }

const clock = (s: number) => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

/**
 * Chapter goal "hold out": students shelter in the faculty while police reinforcements pour in through the gates
 * for `seconds` (waves per minute, by pickup or on foot, dead or not). Then a tank rolls in and a demolition charge
 * turns up: carry it to the tank, hold E to plant it, get clear. Too many students dead loses the mission.
 */
export class Defense {
  readonly students: Students;
  done = false;
  onComplete: () => void = () => {};
  onFail: (why: string) => void = () => {};
  private t = 0;
  private drops: Drop[];
  private trucks: PoliceTruck[] = [];
  private mats: Record<string, THREE.Material>;
  private tank: Tank | null = null;
  private charge: THREE.Mesh;
  private carrying = false;
  private plantT = 0;
  private fuse = -1;
  private beepT = 0;
  private panel = document.createElement('div');
  private marker = document.createElement('div');
  private prompt = document.createElement('div');
  private alert = document.createElement('div');
  private rand = mulberry32(77);
  private centre: THREE.Vector3;

  constructor(readonly def: DefenseDef, private d: DefenseDeps) {
    this.students = new Students(d.refuge, def.students, d.lighting, d.world, this.rand);
    d.scene.add(this.students.group);
    this.students.onLost = () => this.flash(`ESTUDIANTE CAÍDO · ${this.students.lost}/${def.limit}`);
    d.enemies.victims = () => this.students.alive;
    d.enemies.onVictimHit = (h, dmg) => this.students.policeHit(h, dmg);
    this.centre = d.refuge.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(Math.max(1, d.refuge.length));
    this.drops = schedule(def.waves, def.gates.length, this.rand);
    this.mats = vehicleMats(d.lighting);
    this.charge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), d.lighting.setup(new THREE.MeshStandardMaterial({ color: '#5a4a2a', roughness: 0.8, emissive: '#ff6a10', emissiveIntensity: 0 }), 'charge'));
    this.charge.visible = false;
    d.scene.add(this.charge);
    this.panel.id = 'objective';
    this.marker.id = 'obj-marker';
    this.prompt.className = 'prompt';
    this.alert.id = 'op-alert';
    document.body.append(this.panel, this.marker, this.prompt, this.alert);
    if (shotMode) Object.assign(window, { __defense: this });
  }

  /** Test summary: clock, students lost, police alive/arrived, pickups, tank. */
  status(): string {
    const e = this.d.enemies, live = e.list.filter((x) => x.alive), ds = live.map((x) => x.position.distanceTo(this.centre)).sort((a, b) => a - b);
    return `t ${this.t.toFixed(0)} lost ${this.students.lost} police ${e.aliveCount}/${e.list.length} near40 ${ds.filter((d) => d < 40).length} closest ${ds[0]?.toFixed(0) ?? '-'} median ${ds[ds.length >> 1]?.toFixed(0) ?? '-'} trucks ${this.trucks.length} tank ${this.tank ? (this.tank.destroyed ? 'dead' : this.tank.arrived ? 'here' : 'moving') : '-'} carry ${this.carrying} fuse ${this.fuse.toFixed(1)} done ${this.done}`;
  }

  /** Where the minimap points: the faculty while holding, then the charge, then the tank. */
  get goal(): THREE.Vector3 {
    if (!this.tank) return this.centre;
    return this.carrying || this.fuse >= 0 ? this.tank.position : this.charge.position;
  }

  private flash(text: string): void {
    this.alert.textContent = text;
    this.alert.classList.add('on');
    setTimeout(() => this.alert.classList.remove('on'), 4500);
  }

  private squad(x: number, z: number, size: number): void {
    for (let i = 0; i < size; i++) {
      const e = this.d.enemies.add({ type: this.rand() < 0.15 ? 'marksman' : 'rifleman', x: x + (this.rand() - 0.5) * 6, z: z + (this.rand() - 0.5) * 4 });
      const prey = this.students.alive[Math.floor(this.rand() * this.students.alive.length)];
      e.engaged = true;
      e.awareness = 0.8;
      e.lastKnown.copy(prey?.position ?? this.centre);
    }
  }

  private arrive(drop: Drop): void {
    const gate = this.def.gates[drop.gate];
    if (!drop.truck) return this.squad(gate.inX, gate.inZ, drop.size);
    const truck = new PoliceTruck(this.mats, gate.drive.map(([x, z]) => new THREE.Vector3(x, 0, z)), this.d.world);
    truck.onParked = () => this.squad(gate.dropX, gate.dropZ, drop.size);
    this.trucks.push(truck);
    this.d.scene.add(truck.group);
    if (this.trucks.length > 6) this.trucks.shift()!.remove();
  }

  update(dt: number, player: THREE.Vector3, input: Input, alive: boolean): void {
    if (this.done) return;
    this.t += dt;
    while (this.drops.length && this.drops[0].t <= this.t) this.arrive(this.drops.shift()!);
    for (const tr of this.trucks) tr.update(dt);
    this.students.update(dt, this.d.camera.position);
    if (this.students.lost >= this.def.limit) {
      this.done = true;
      this.onFail(this.def.failed);
      return;
    }
    const left = this.def.seconds - this.t;
    if (left <= 0 && !this.tank) this.rollIn();
    this.tank?.update(dt, alive ? player.clone().setY(player.y + 1) : null);
    this.objectiveText(left);
    this.chargeLogic(dt, player, input, alive);
    this.showMarker(player);
  }

  private rollIn(): void {
    const path = this.def.tank.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.tank = new Tank(this.d.lighting, this.d.world, path);
    this.tank.onShell = (_from, at) => this.d.blast(at);
    this.d.scene.add(this.tank.group);
    const [x, z, y] = this.def.charge;
    this.charge.position.set(x, y + 0.14, z);
    this.charge.visible = true;
    this.flash(this.def.tankAlert);
  }

  private objectiveText(left: number): void {
    const wave = Math.min(this.def.waves.length, Math.floor(this.t / 60) + 1), dead = `CAÍDOS ${this.students.lost}/${this.def.limit}`;
    const line = !this.tank ? `<em>${clock(left)}</em> · OLEADA ${wave}/${this.def.waves.length} · ${dead}` : this.fuse >= 0 ? `<em>DETONACIÓN ${Math.ceil(this.fuse)}</em> · ¡ALÉJATE!` : this.carrying ? `COLOCA EL EXPLOSIVO EN EL TANQUE · ${dead}` : `TOMA EL EXPLOSIVO · ${dead}`;
    const html = `<span class="k">OBJETIVO</span><b>${this.tank ? 'DESTRUYE EL TANQUE' : this.def.title}</b><span class="d">${line}</span>`;
    if (this.panel.innerHTML !== html) this.panel.innerHTML = html;
  }

  private chargeLogic(dt: number, player: THREE.Vector3, input: Input, alive: boolean): void {
    let text = '';
    if (this.tank && this.fuse < 0 && alive) {
      if (!this.carrying && player.distanceTo(this.charge.position) < 2) {
        text = '<kbd>E</kbd> TOMAR EL EXPLOSIVO';
        if (input.hit('KeyE')) (this.carrying = true), (this.charge.visible = false), this.d.sfx.grenadePin();
      } else if (this.carrying && Math.hypot(player.x - this.tank.position.x, player.z - this.tank.position.z) < 6.5) {
        this.plantT = input.down('KeyE') ? this.plantT + dt : 0;
        const pct = Math.min(100, Math.round((this.plantT / 2) * 100));
        text = this.plantT > 0 ? `COLOCANDO EXPLOSIVO <span>${pct}%</span><i class="bar"><b style="width:${pct}%"></b></i>` : '<kbd>E</kbd> MANTÉN PARA COLOCAR EL EXPLOSIVO';
        if (this.plantT >= 2) this.plant();
      }
    }
    this.prompt.style.opacity = text ? '1' : '0';
    if (text && this.prompt.innerHTML !== text) this.prompt.innerHTML = text;
    if (this.fuse < 0) return;
    this.fuse -= dt;
    this.beepT -= dt;
    const mat = this.charge.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = Math.max(0, mat.emissiveIntensity - dt * 4);
    if (this.beepT <= 0) {
      this.beepT = Math.max(0.15, this.fuse / 6);
      mat.emissiveIntensity = 2;
      this.d.sfx.chargeBeep(this.fuse < 2);
    }
    if (this.fuse > 0) return;
    this.done = true;
    this.charge.visible = false;
    this.d.blast(this.tank!.position.clone().setY(1.6));
    this.tank!.destroy();
    this.prompt.style.opacity = this.marker.style.opacity = '0';
    celebrate('TANQUE DESTRUIDO', () => this.onComplete());
  }

  private plant(): void {
    const t = this.tank!;
    this.carrying = false;
    this.fuse = 6;
    this.charge.position.copy(t.position).add(new THREE.Vector3(Math.sin(t.group.rotation.y) * 3.3, 1.75, Math.cos(t.group.rotation.y) * 3.3));
    this.charge.rotation.y = t.group.rotation.y;
    this.charge.visible = true;
    this.flash('EXPLOSIVO COLOCADO · ¡CORRE!');
  }

  private showMarker(player: THREE.Vector3): void {
    const goal = this.goal, far = player.distanceTo(goal), cam = this.d.camera as THREE.PerspectiveCamera;
    const v = goal.clone().setY(goal.y + (this.tank ? 3 : 4)).project(cam), ahead = goal.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) > 0;
    const on = ahead && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && far > (this.tank ? 3 : 35);
    this.marker.style.opacity = on ? '1' : '0';
    if (!on) return;
    this.marker.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
    this.marker.dataset.dist = `${Math.round(far)} m`;
  }
}
