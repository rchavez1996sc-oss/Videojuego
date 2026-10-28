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
import { unblamed } from './blame';

/** Gate: squads on foot enter at (`inX`, `inZ`); pickups from that side follow `drive` in through the nearest vehicle entrance and drop at (`dropX`, `dropZ`). */
export interface DefenseDef {
  title: string; seconds: number; waves: number[]; students: number; limit: number;
  gates: { x: number; inX: number; inZ: number; foot?: [number, number][]; drive: [number, number][]; dropX: number; dropZ: number }[];
  tank: [number, number][]; charge: [number, number, number];
  tankAlert: string; failed: string; complete: string; reward: string;
  /** Opening hunt: kill `huntKills` police, then `news` sends the player to the faculty (within `arrive` m starts the hold). */
  huntKills: number; huntTitle: string; news: string; goTitle: string; arrive: number; readyAlert: string; startDistance?: number;
}

type Phase = 'hunt' | 'go' | 'hold' | 'tank' | 'ready';

export interface DefenseDeps { scene: THREE.Scene; world: RAPIER.World; lighting: Lighting; enemies: Enemies; sfx: Sfx; camera: THREE.Camera; refuge: THREE.Vector3[]; entry?: THREE.Vector3; blast: (at: THREE.Vector3) => void }

const clock = (s: number) => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

/**
 * Chapter goal in phases: hunt police until `huntKills` are down; news of a tank sends the player to the faculty, where
 * students are building an improvised charge; reaching it starts the hold — `seconds` of police waves (by pickup or on
 * foot, dead or not) while the charge's progress bar climbs to 95 %. At 0:00 the tank rolls in along the avenue and the
 * bar reaches 100 % as it arrives; carry the charge to the tank, hold E to plant it, get clear. Too many students dead
 * loses the mission.
 */
export class Defense {
  readonly students: Students;
  done = false;
  onComplete: () => void = () => {};
  onFail: (why: string) => void = () => {};
  private t = 0;
  private phase: Phase = 'hunt';
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
    d.enemies.victims = () => (this.besieged ? this.students.alive : []);
    d.enemies.onVictimHit = (h, dmg) => this.besieged && this.students.policeHit(h, dmg);
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
    return `t ${this.t.toFixed(0)} lost ${this.students.lost} police ${e.aliveCount}/${e.list.length} near40 ${ds.filter((d) => d < 40).length} closest ${ds[0]?.toFixed(0) ?? '-'} median ${ds[ds.length >> 1]?.toFixed(0) ?? '-'} phase ${this.phase} kills ${this.kills} prog ${this.progress.toFixed(0)} trucks ${this.trucks.length} tank ${this.tank ? (this.tank.destroyed ? 'dead' : this.tank.arrived ? 'here' : 'moving') : '-'} carry ${this.carrying} fuse ${this.fuse.toFixed(1)} done ${this.done}`;
  }

  /** The siege has begun: police go for the students. */
  private get besieged(): boolean {
    return this.phase !== 'hunt' && this.phase !== 'go';
  }

  private get kills(): number {
    return this.d.enemies.list.length - this.d.enemies.aliveCount;
  }

  /** Where the minimap points: nothing while hunting, the faculty, the tank as it comes, then the charge and the tank. */
  get goal(): THREE.Vector3 | undefined {
    if (this.phase === 'hunt') return undefined;
    if (this.phase === 'go' || this.phase === 'hold') return this.d.entry ?? this.centre;
    return this.phase === 'ready' && !this.carrying && this.fuse < 0 ? this.charge.position : this.tank!.position;
  }

  /** The improvised charge: 95 % over the hold, the last 5 % while the tank drives in. */
  private get progress(): number {
    return this.phase === 'hold' ? (95 * this.t) / this.def.seconds : this.phase === 'tank' ? 95 + 5 * this.tank!.progress : 100;
  }

  private flash(text: string, seconds = 4.5): void {
    this.alert.textContent = text;
    this.alert.classList.add('on');
    clearTimeout(this.alertT);
    this.alertT = window.setTimeout(() => this.alert.classList.remove('on'), seconds * 1000);
  }
  private alertT = 0;

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
    if (!drop.truck) {
      const [x, z] = gate.foot?.[Math.floor(this.rand() * gate.foot.length)] ?? [gate.inX, gate.inZ];
      return this.squad(x, z, drop.size);
    }
    const truck = new PoliceTruck(this.mats, gate.drive.map(([x, z]) => new THREE.Vector3(x, 0, z)), this.d.world);
    truck.onParked = () => this.squad(gate.dropX, gate.dropZ, drop.size);
    this.trucks.push(truck);
    this.d.scene.add(truck.group);
    if (this.trucks.length > 6) this.trucks.shift()!.remove();
  }

  update(dt: number, player: THREE.Vector3, input: Input, alive: boolean): void {
    if (this.done) return;
    if (this.phase === 'hunt' && this.kills >= this.def.huntKills) (this.phase = 'go'), this.flash(this.def.news, 11);
    if (this.phase === 'go' && Math.min(player.distanceTo(this.centre), player.distanceTo(this.d.entry ?? this.centre) * 2) < this.def.arrive) this.phase = 'hold';
    if (this.phase === 'hold') this.t += dt;
    while (this.phase === 'hold' && this.drops.length && this.drops[0].t <= this.t) this.arrive(this.drops.shift()!);
    for (const tr of this.trucks) tr.update(dt);
    this.students.update(dt, this.d.camera.position);
    if (this.students.lost >= this.def.limit) {
      this.done = true;
      this.onFail(this.def.failed);
      return;
    }
    const left = this.def.seconds - this.t;
    if (this.phase === 'hold' && left <= 0) this.rollIn();
    if (this.phase === 'tank' && this.tank!.arrived) this.ready();
    this.tank?.update(dt, alive ? player.clone().setY(player.y + 1) : null);
    this.objectiveText(left, player);
    this.chargeLogic(dt, player, input, alive);
    this.showMarker(player);
  }

  private rollIn(): void {
    const path = this.def.tank.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.tank = new Tank(this.d.lighting, this.d.world, path);
    this.tank.onShell = (_from, at) => unblamed(() => this.d.blast(at));
    this.d.scene.add(this.tank.group);
    this.phase = 'tank';
    this.flash(this.def.tankAlert, 7);
  }

  private ready(): void {
    const [x, z, y] = this.def.charge;
    this.charge.position.set(x, y + 0.14, z);
    this.charge.visible = true;
    this.phase = 'ready';
    this.flash(this.def.readyAlert, 8);
  }

  private objectiveText(left: number, player: THREE.Vector3): void {
    const p = this.phase, wave = Math.min(this.def.waves.length, Math.floor(this.t / 60) + 1), dead = `CAÍDOS ${this.students.lost}/${this.def.limit}`;
    const title = p === 'hunt' ? this.def.huntTitle : p === 'go' ? this.def.goTitle : p === 'hold' ? this.def.title : p === 'tank' ? 'EL TANQUE SE ACERCA' : 'DESTRUYE EL TANQUE';
    const line = p === 'hunt' ? `BAJAS ${Math.min(this.kills, this.def.huntKills)}/${this.def.huntKills}` : p === 'go' ? `${Math.round(player.distanceTo(this.centre))} m`
      : p === 'hold' ? `<em>${clock(left)}</em> · OLEADA ${wave}/${this.def.waves.length} · ${dead}` : p === 'tank' ? `RESISTAN · ${dead}`
      : this.fuse >= 0 ? `<em>DETONACIÓN ${Math.ceil(this.fuse)}</em> · ¡ALÉJATE!` : this.carrying ? `COLOCA EL EXPLOSIVO EN EL TANQUE · ${dead}` : `TOMA EL EXPLOSIVO · ${dead}`;
    const pct = Math.floor(this.progress), bar = p === 'hold' || p === 'tank' ? `<span class="prog"><i><b style="width:${pct}%"></b></i>EXPLOSIVO IMPROVISADO ${pct}%</span>` : '';
    const html = `<span class="k">OBJETIVO</span><b>${title}</b><span class="d">${line}</span>${bar}`;
    if (this.panel.innerHTML !== html) this.panel.innerHTML = html;
  }

  private chargeLogic(dt: number, player: THREE.Vector3, input: Input, alive: boolean): void {
    let text = '';
    if (this.phase === 'ready' && this.fuse < 0 && alive) {
      if (!this.carrying && player.distanceTo(this.charge.position) < 2) {
        text = '<kbd>E</kbd> TOMAR EL EXPLOSIVO';
        if (input.hit('KeyE')) (this.carrying = true), (this.charge.visible = false), this.d.sfx.grenadePin();
      } else if (this.carrying && Math.hypot(player.x - this.tank!.position.x, player.z - this.tank!.position.z) < 6.5) {
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
    const goal = this.goal;
    if (!goal) return void (this.marker.style.opacity = '0');
    const far = player.distanceTo(goal), cam = this.d.camera as THREE.PerspectiveCamera;
    const v = goal.clone().setY(goal.y + (this.tank ? 3 : 4)).project(cam), ahead = goal.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) > 0;
    const on = ahead && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && far > (this.tank ? 3 : 35);
    this.marker.style.opacity = on ? '1' : '0';
    if (!on) return;
    this.marker.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
    this.marker.dataset.dist = `${Math.round(far)} m`;
  }
}
