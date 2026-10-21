import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Enemy, type EnemyDef } from '../entities/enemy';
import type { Outfit } from '../entities/rig';
import { allyAct, allyThink, slotPosition, type Ally, type AllyContext } from '../ai/allyBrain';
import { onHit, surfaceOf } from '../world/surfaces';
import { HealthBars } from '../ui/healthbars';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import type { Player } from '../entities/player';
import type { Combat } from '../weapons/combat';
import type { Sfx } from '../audio/sfx';
import type { Hud } from '../ui/hud';
import type { Enemies } from './enemies';
import type { StreetNav } from '../ai/nav';

const CATCH_UP = 35;

export interface AllyDef extends EnemyDef { names: string[]; killShare: number; bleedOut: number; outfits: Outfit[] }

interface Deps {
  world: RAPIER.World; hf: Heightfield; lighting: Lighting; player: Player; enemies: Enemies; combat: Combat;
  sfx: Sfx; hud: Hud; camera: THREE.PerspectiveCamera; nav: StreetNav | null; alarm: (at: THREE.Vector3, r: number) => void;
}

const REVIVE_TIME = 2.5, REVIVE_RANGE = 2.4;

/** The player's fire team: follows in formation, fights, can be downed and revived (hold E). */
export class Squad {
  readonly group = new THREE.Group();
  readonly list: Ally[] = [];
  allyKills = 0;
  private handles = new Set<number>();
  private bars = new HealthBars();
  private ctx: AllyContext;
  private reviveT = 0;
  private lag = new Map<Ally, { t: number; d: number }>();
  private prompt = document.createElement('div');

  constructor(private def: AllyDef, count: number, private d: Deps, spawn: THREE.Vector3, yaw: number) {
    const ground = (x: number, z: number) => d.hf.heightAt(x, z);
    const names = [...def.names].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const unit = new Enemy(100 + i, def, d.world, d.lighting, slotPosition(i, spawn, yaw, ground), [], false, def.outfits[i % def.outfits.length]);
      unit.yaw = yaw;
      const a: Ally = { unit, name: names[i % names.length], slot: i, target: null, downedT: 0, lost: false };
      this.list.push(a);
      this.handles.add(unit.handle);
      this.group.add(unit.model.root, unit.flash.group);
      onHit(unit.handle, (dmg, p) => {
        d.combat.bloodPuff(new THREE.Vector3(p.x, p.y, p.z));
        d.hud.showToast(`¡FUEGO AMIGO! — ${a.name}`);
        this.hurt(a, dmg * 0.5, d.player.position);
      });
    }
    const ray = (from: THREE.Vector3, to: THREE.Vector3, self: number) => {
      const dir = to.clone().sub(from), len = dir.length();
      return { hit: d.world.castRay(new RAPIER.Ray(from, dir.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== self && !this.handles.has(c.handle) && c.handle !== d.player.collisionHandle && c.isEnabled()), len };
    };
    this.ctx = {
      leader: new THREE.Vector3(), leaderYaw: yaw, leaderAlive: true, foes: d.enemies.list,
      visible: (u, t) => ray(u.position.clone().setY(u.position.y + u.eyeY), chestOf(t), u.handle).hit?.collider.handle === t.handle,
      groundY: ground,
      route: (from, to, self) => {
        if (!d.nav || from.distanceTo(to) < 18) return [];
        const r = ray(from.clone().setY(from.y + 0.8), to.clone().setY(to.y + 0.8), self);
        if (!r.hit || r.hit.timeOfImpact > r.len - 0.5) return [];
        const path = d.nav.route(from, to);
        while (path.length && path[0].distanceTo(to) > from.distanceTo(to) + 3) path.shift();
        return path;
      },
    };
    d.enemies.allies = () => this.list.filter((a) => a.unit.alive).map((a) => a.unit);
    d.enemies.onAllyHit = (handle, dmg, from) => {
      const a = this.list.find((x) => x.unit.handle === handle);
      if (a) this.hurt(a, dmg, from);
      return !!a;
    };
    this.prompt.className = 'prompt';
    document.body.appendChild(this.prompt);
  }

  /** Squad members who bled out (their ammo can be taken). */
  get fallen(): Enemy[] {
    return this.list.filter((a) => a.lost).map((a) => a.unit);
  }

  get positions(): THREE.Vector3[] {
    return this.list.filter((a) => a.unit.alive).map((a) => a.unit.position);
  }

  private hurt(a: Ally, dmg: number, from: THREE.Vector3): void {
    if (!a.unit.alive || !a.unit.damage(dmg)) return;
    a.unit.die(a.unit.position.clone().sub(from).setY(0).normalize());
    a.downedT = this.def.bleedOut;
    a.target = null;
    this.d.hud.showToast(`${a.name} HERIDO — MANTÉN E PARA REANIMAR`);
  }

  explosion(at: THREE.Vector3, radius: number): void {
    for (const a of this.list) {
      const r = a.unit.position.distanceTo(at);
      if (r < radius) this.hurt(a, 130 * Math.pow(1 - r / radius, 1.2), at);
    }
  }

  /** After the player respawns the surviving team regroups around them. */
  regroup(pos: THREE.Vector3, yaw: number): void {
    for (const a of this.list) if (a.unit.alive) a.unit.teleport(slotPosition(a.slot, pos, yaw, this.ctx.groundY));
  }

  update(dt: number, leaderYaw: number, reviveHeld: boolean, leaderAlive: boolean): void {
    const c = this.ctx;
    c.leader.copy(this.d.player.position);
    c.leaderYaw = leaderYaw;
    c.leaderAlive = leaderAlive;
    for (const a of this.list) {
      const u = a.unit;
      u.flash.update(dt);
      if (u.alive) {
        allyThink(a, c, dt);
        const aim = a.target ? chestOf(a.target).sub(u.position.clone().setY(u.position.y + 1.4)) : null;
        if (allyAct(a, c, dt)) this.fire(a);
        if (leaderAlive) this.catchUp(a, dt);
        u.update(dt, aim ? Math.atan2(aim.y, Math.hypot(aim.x, aim.z)) : 0);
      } else {
        u.update(dt, 0);
        if (!a.lost && (a.downedT -= dt) <= 0) {
          a.lost = true;
          this.d.hud.showToast(`${a.name} HA CAÍDO`);
        }
      }
    }
    this.updateRevive(dt, reviveHeld && leaderAlive);
  }

  /** Far behind and not closing in for a while: reappears in formation behind the player, out of the camera's view. */
  private catchUp(a: Ally, dt: number): void {
    const u = a.unit, d = u.position.distanceTo(this.d.player.position);
    const l = this.lag.get(a) ?? { t: 0, d };
    this.lag.set(a, l);
    if (d < CATCH_UP || d < l.d - 4) {
      l.t = 0;
      l.d = d;
      return;
    }
    if ((l.t += dt) < 6) return;
    const spot = slotPosition(a.slot + 2, this.d.player.position, this.ctx.leaderYaw, this.ctx.groundY);
    const view = new THREE.Vector3(0, 0, -1).applyQuaternion(this.d.camera.quaternion);
    if (spot.clone().sub(this.d.camera.position).normalize().dot(view) > 0.3) return;
    u.teleport(spot);
    l.t = 0;
    l.d = 0;
  }

  private updateRevive(dt: number, held: boolean): void {
    const p = this.d.player.position;
    const near = this.list.find((a) => !a.unit.alive && !a.lost && a.unit.position.distanceTo(p) < REVIVE_RANGE);
    this.reviveT = near && held ? this.reviveT + dt : 0;
    this.prompt.style.opacity = near ? '1' : '0';
    if (!near) return;
    this.prompt.innerHTML = this.reviveT > 0 ? `REANIMANDO A ${near.name} <span>${Math.round((this.reviveT / REVIVE_TIME) * 100)}%</span>` : `<kbd>E</kbd> MANTÉN PARA REANIMAR A ${near.name}`;
    if (this.reviveT < REVIVE_TIME) return;
    near.unit.revive(this.def.hp * 0.5);
    this.reviveT = 0;
    this.d.hud.showToast(`${near.name} DE VUELTA EN COMBATE`);
  }

  private fire(a: Ally): void {
    const { world, enemies, combat, camera, sfx, player } = this.d;
    const u = a.unit, t = a.target!;
    const muzzle = u.model.muzzle.getWorldPosition(new THREE.Vector3());
    u.flash.fire(u.model.muzzle);
    u.model.fire();
    const aim = chestOf(t);
    const dead = enemies.list.length - enemies.aliveCount;
    if (dead >= 2 && this.allyKills / dead > this.def.killShare) aim.add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 - 0.1, Math.random() - 0.5).normalize().multiplyScalar(1.2 + Math.random() * 1.6));
    const dist = muzzle.distanceTo(aim);
    const dir = aim.sub(muzzle).normalize();
    const cone = THREE.MathUtils.degToRad(this.def.spread + dist * this.def.spreadPerMeter * 10);
    const r = Math.sqrt(Math.random()) * Math.tan(cone), ang = Math.random() * Math.PI * 2;
    const uu = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), vv = dir.clone().cross(uu);
    dir.addScaledVector(uu, Math.cos(ang) * r).addScaledVector(vv, Math.sin(ang) * r).normalize();
    const hit = world.castRayAndGetNormal(new RAPIER.Ray(muzzle, dir), 300, true, undefined, undefined, undefined, undefined, (c) => c.handle !== u.handle && !this.handles.has(c.handle) && c.handle !== player.collisionHandle && c.isEnabled());
    const end = muzzle.clone().addScaledVector(dir, hit ? hit.timeOfImpact : 300);
    const cam = camera.position;
    if (Math.random() < 0.4) combat.tracer(muzzle, end);
    sfx.distantShot(muzzle.distanceTo(cam), muzzle.clone().sub(cam).normalize().dot(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)), false);
    const foe = hit ? enemies.byHandle(hit.collider.handle) : undefined;
    if (foe) {
      if (enemies.allyHit(foe, this.def.damage * (0.85 + Math.random() * 0.3), end, u.position)) this.allyKills++;
    } else if (hit && end.distanceTo(cam) < 90) combat.impact(end, new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), surfaceOf(hit.collider.handle), dir);
    enemies.hearShot(muzzle);
    this.d.alarm(muzzle, 90);
  }

  sync(): void {
    for (const a of this.list) {
      const u = a.unit;
      u.sync();
      const camD = u.position.distanceToSquared(this.d.camera.position);
      u.model.far = camD > 25 * 25 && u.alive;
      const near = camD < 60 * 60;
      if (near !== u.shadowed) u.model.castShadow = u.shadowed = near;
      const show = !a.lost && camD < 90 * 90 ? 1 : 0;
      this.bars.update(u.id, u.position.clone().setY(u.position.y + (u.alive ? 2.05 - (u.crouched ? 0.5 : 0) : 0.6)), u.hp / this.def.hp, show, this.d.camera, false, a.name);
    }
  }
}

function chestOf(e: Enemy): THREE.Vector3 {
  return e.position.clone().setY(e.position.y + 1.25 - (e.crouched ? 0.45 : 0));
}

export function createSquad(count: number, def: AllyDef, d: Deps, spawn: THREE.Vector3, yaw: number): Squad | null {
  return count > 0 ? new Squad(def, count, d, spawn, yaw) : null;
}
