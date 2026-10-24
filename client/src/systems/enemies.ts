import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Enemy, type EnemyDef } from '../entities/enemy';
import { think, act, type AIContext } from '../ai/brain';
import { cover } from '../ai/cover';
import { onHit, pierceChance } from '../world/surfaces';
import { shuffleRoamers } from './enemySpots';
import { shotMode } from '../core/settings';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import type { Player } from '../entities/player';
import type { Combat } from '../weapons/combat';
import type { Sfx } from '../audio/sfx';
import { HealthBars } from '../ui/healthbars';
import type { StreetNav } from '../ai/nav';
import { difficulty } from '../core/difficulty';
import { enemyFire } from './enemyFire';

/** `leash`: a garrison post — the enemy fights and takes cover but never goes farther than this from its spawn. */
export interface SpawnDef { type: string; x: number; z: number; y?: number; at?: number; patrol?: [number, number][]; leash?: number }

export interface KillEvent { headshot: boolean; distance: number }

export class Enemies {
  readonly group = new THREE.Group();
  readonly list: Enemy[] = [];
  onPlayerHit: (damage: number, from: THREE.Vector3) => void = () => {};
  onEnemyHit: (kill: boolean, headshot: boolean, at: THREE.Vector3) => void = () => {};
  onEnemyShot: (at: THREE.Vector3) => void = () => {};
  onAllyKill: (at: THREE.Vector3) => void = () => {};
  /** Living squad members enemies may pick as targets instead of the player. */
  allies: () => Enemy[] = () => [];
  /** Returns true when `handle` was a squad member (who then takes the damage). */
  onAllyHit: (handle: number, damage: number, from: THREE.Vector3) => boolean = () => false;
  private focus = new Map<number, { unit: Enemy | null; t: number }>();
  private byCollider = new Map<number, Enemy>();
  private pFeet = new THREE.Vector3();
  private pChest = new THREE.Vector3();
  private pConceal = 1;
  private bars = new HealthBars();
  private ctx: AIContext;
  private time = 0;
  private attackers = new Set<number>();
  private intelT = 8;
  private intelHold = 0;
  private alerted = false;

  constructor(defs: Record<string, EnemyDef>, spawns: SpawnDef[], private world: RAPIER.World, private hf: Heightfield, lighting: Lighting, private player: Player, private combat: Combat, private sfx: Sfx, private camera: THREE.PerspectiveCamera, nav: StreetNav | null = null) {
    if (nav && !shotMode) spawns = shuffleRoamers(spawns, nav.nodes, world, hf, player.position);
    spawns.forEach((s, i) => {
      const def = defs[s.type], spot = new THREE.Vector3(s.x, hf.heightAt(s.x, s.z), s.z);
      if (s.y === undefined && s.at === undefined && nav && world.castRay(new RAPIER.Ray({ x: spot.x, y: spot.y + 0.6, z: spot.z }, { x: 0, y: 1, z: 0 }), 40, true)) {
        const n = nav.route(spot, spot)[0];
        spot.set(n.x, hf.heightAt(n.x, n.z), n.z);
      }
      const patrol = (s.patrol ?? []).map(([x, z]) => new THREE.Vector3(x, hf.heightAt(x, z), z));
      const e = new Enemy(i, def, world, lighting, new THREE.Vector3(spot.x, s.at ?? spot.y + (s.y ?? 0), spot.z), patrol, s.y !== undefined || s.at !== undefined);
      if (s.leash) e.leash = { at: e.position.clone(), r: s.leash };
      this.list.push(e);
      this.group.add(e.model.root, e.flash.group);
      onHit(e.handle, (dmg, p) => this.hit(e, dmg, new THREE.Vector3(p.x, p.y, p.z)));
      this.byCollider.set(e.handle, e);
    });
    const ray = (from: THREE.Vector3, to: THREE.Vector3, self: number, glass = true) => {
      const dir = to.clone().sub(from);
      const len = dir.length();
      dir.divideScalar(len);
      return { hit: world.castRay(new RAPIER.Ray(from, dir), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== self && c.isEnabled() && (!glass || pierceChance(c.handle) < 1)), len };
    };
    this.ctx = {
      time: 0,
      playerFeet: new THREE.Vector3(),
      playerChest: new THREE.Vector3(),
      playerConcealment: 1,
      sees: (from, to, self) => {
        const r = ray(from, to, self);
        return !r.hit || r.hit.collider.handle === player.collisionHandle || r.hit.timeOfImpact > r.len - 0.4;
      },
      blocked: (from, to, self) => {
        const r = ray(from, to, self);
        return !!r.hit && r.hit.collider.handle !== player.collisionHandle && r.hit.timeOfImpact < r.len - 0.5;
      },
      groundY: (x, z) => hf.heightAt(x, z),
      route: (from, to, self) => {
        if (!nav) return [];
        const a = from.clone().setY(from.y + 0.8), b = to.clone().setY(to.y + 0.8);
        const r = ray(a, b, self, false);
        if (!r.hit || r.hit.collider.handle === player.collisionHandle || r.hit.timeOfImpact > r.len - 0.5) return [];
        const path = nav.route(from, to);
        if (path.length > 1 && path[0].distanceTo(to) > from.distanceTo(to) + 5) path.shift();
        return path;
      },
      cover,
      alertNearby: (src) => {
        for (const o of this.list) if (o !== src && o.alive && o.position.distanceTo(src.position) <= 45) (o.awareness = Math.max(o.awareness, 0.75)), o.lastKnown.copy(src.lastKnown);
      },
    };
  }

  /** Test helper: living non-static enemies standing under a roof (i.e. inside a building). */
  get insideCount(): number {
    return this.list.filter((e) => e.alive && !e.isStatic && this.world.castRay(new RAPIER.Ray({ x: e.position.x, y: e.position.y + 0.6, z: e.position.z }, { x: 0, y: 1, z: 0 }), 40, true, undefined, undefined, undefined, undefined, (c) => c.handle !== e.handle)).length;
  }

  get aliveCount(): number {
    return this.list.filter((e) => e.alive).length;
  }

  /** Last few survivors: they all hunt the player and show up on the radar wherever they are. */
  get lastStand(): boolean {
    return this.aliveCount <= Math.max(4, Math.ceil(this.list.length * 0.25));
  }

  /** Silences radio reports for a while (used right after the player respawns). */
  suppressIntel(seconds: number): void {
    this.intelHold = seconds;
  }

  /** Squad radio: sightings are shared instantly; every few seconds hunters also get a rough fix on the player. */
  private shareIntel(dt: number): void {
    this.intelHold -= dt;
    this.intelT -= dt;
    const spotted = this.list.some((e) => e.alive && e.canSee && e.state === 'combat');
    const periodic = this.intelT <= 0 && this.intelHold <= 0;
    if (!spotted && !periodic) return;
    const last = this.lastStand || this.alerted;
    if (periodic) this.intelT = last ? 5 : 8;
    for (const e of this.list) {
      if (last && e.alive && periodic && !e.isStatic) {
        e.engaged = true;
        e.awareness = Math.max(e.awareness, 0.75);
      }
      if (!e.alive || !(e.engaged || e.state === 'alert') || e.canSee || (!last && e.position.distanceTo(this.player.position) > 160)) continue;
      const noise = spotted ? 2 : 10;
      e.lastKnown.copy(this.player.position).add(new THREE.Vector3((Math.random() - 0.5) * noise, 0, (Math.random() - 0.5) * noise));
    }
  }

  /** Player gunshot: everyone in earshot learns roughly where it came from; with `global`, the whole force starts hunting. */
  hearShot(at: THREE.Vector3, global = false): void {
    this.alerted ||= global;
    for (const e of this.list) {
      if (!e.alive) continue;
      const d = e.position.distanceTo(at);
      if (d > e.def.hearing) continue;
      e.awareness = Math.max(e.awareness, d < 70 ? 1 : 0.6);
      e.engaged = true;
      e.lastKnown.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * d * 0.12, 0, (Math.random() - 0.5) * d * 0.12));
    }
  }

  private hit(e: Enemy, dmg: number, point: THREE.Vector3): void {
    if (!e.alive) return;
    const headshot = point.y - e.position.y > e.headY;
    const kill = e.damage(dmg * (headshot ? 2.5 : 1), point);
    e.awareness = 1;
    e.lastKnown.copy(this.player.position);
    e.lastSeenT = this.time;
    this.combat.bloodPuff(point);
    if (kill) e.die(point.clone().sub(this.player.position).setY(0).normalize());
    this.onEnemyHit(kill, headshot, e.position.clone());
  }

  byHandle(handle: number): Enemy | undefined {
    return this.byCollider.get(handle);
  }

  /** A squad member's round: no hitmarker for the player; returns true on a kill. */
  allyHit(e: Enemy, dmg: number, point: THREE.Vector3, from: THREE.Vector3): boolean {
    if (!e.alive) return false;
    const kill = e.damage(dmg * (point.y - e.position.y > e.headY ? 2.5 : 1), point);
    e.awareness = 1;
    e.lastKnown.copy(from);
    this.combat.bloodPuff(point);
    if (kill) {
      e.die(point.clone().sub(from).setY(0).normalize());
      this.onAllyKill(e.position.clone());
    }
    return kill;
  }

  /** Struck by a vehicle: no credit to anyone, but they notice where it came from. */
  runOver(e: Enemy, dmg: number, from: THREE.Vector3): void {
    e.awareness = Math.max(e.awareness, 0.6);
    if (e.damage(dmg)) e.die(e.position.clone().sub(from).setY(0).normalize());
  }

  /** Every 1.5 s each enemy may switch to a squad member that is clearly closer and in sight than the player. */
  private aimAt(e: Enemy, dt: number): void {
    const c = this.ctx;
    let f = this.focus.get(e.id);
    if (!f) this.focus.set(e.id, (f = { unit: null, t: Math.random() * 1.5 }));
    if ((f.t -= dt) <= 0) {
      f.t = 1.5;
      const dp = e.position.distanceTo(this.pFeet), eye = e.position.clone().setY(e.position.y + e.eyeY);
      f.unit = this.allies()
        .filter((a) => a.position.distanceTo(e.position) < Math.min(dp * 0.8, e.def.sight))
        .sort((a, b) => a.position.distanceToSquared(e.position) - b.position.distanceToSquared(e.position))
        .find((a) => c.sees(eye, a.position.clone().setY(a.position.y + 1.2), e.handle)) ?? null;
    }
    if (f.unit && !f.unit.alive) f.unit = null;
    if (f.unit) {
      c.playerFeet.copy(f.unit.position);
      c.playerChest.copy(f.unit.position).setY(f.unit.position.y + 1.25 - (f.unit.crouched ? 0.45 : 0));
      c.playerConcealment = 1;
    } else {
      c.playerFeet.copy(this.pFeet);
      c.playerChest.copy(this.pChest);
      c.playerConcealment = this.pConceal;
    }
  }

  /** Area damage with line-of-sight check; returns how many enemies died. */
  explosion(at: THREE.Vector3, radius: number, maxDamage: number): number {
    let kills = 0;
    for (const e of this.list) {
      if (!e.alive) continue;
      const chest = e.position.clone().setY(e.position.y + 1.0);
      const d = chest.distanceTo(at);
      if (d > radius || this.ctx.blocked(at.clone().setY(at.y + 0.3), chest, e.handle)) continue;
      const dmg = maxDamage * Math.pow(1 - d / radius, 1.2);
      e.awareness = 1;
      e.lastKnown.copy(this.player.position);
      e.shownT = 3;
      if (e.damage(dmg)) {
        e.die(chest.clone().sub(at).setY(0.4).normalize().multiplyScalar(2.5));
        kills++;
        this.onEnemyHit(true, false, e.position.clone());
      } else this.onEnemyHit(false, false, e.position.clone());
    }
    return kills;
  }

  /** Some enemies who notice a live grenade nearby sprint away from it after a short reaction delay. */
  fleeFrom(at: THREE.Vector3): void {
    for (const e of this.list) {
      if (!e.alive || e.isStatic || e.position.distanceTo(at) > 8 || Math.random() > 0.6) continue;
      setTimeout(() => {
        if (!e.alive) return;
        const away = e.position.clone().sub(at).setY(0).normalize();
        e.moveTarget = e.position.clone().addScaledVector(away, 9);
        e.path = [];
        e.running = true;
        e.crouched = false;
        if (e.cover) e.cover.owner = -1;
        e.cover = null;
      }, 500 + Math.random() * 700);
    }
  }

  private fire(e: Enemy): void {
    enemyFire(e, this, this.ctx, this.attackers.has(e.id), this.world, this.camera, this.combat, this.sfx, this.player);
  }

  update(dt: number): void {
    this.time += dt;
    const c = this.ctx;
    c.time = this.time;
    c.playerFeet.copy(this.player.position);
    c.playerChest.copy(this.player.position).setY(this.player.position.y + 1.3 - this.player.crouchAmount * 0.45);
    const grass = this.hf.maskAt(this.player.position.x, this.player.position.z, 1);
    c.playerConcealment = this.player.crouchAmount > 0.5 ? (grass > 0.5 ? 0.35 : 0.6) : 1;
    this.pFeet.copy(c.playerFeet);
    this.pChest.copy(c.playerChest);
    this.pConceal = c.playerConcealment;
    this.shareIntel(dt);
    this.attackers.clear();
    this.list
      .filter((e) => e.alive && e.state === 'combat' && e.canSee)
      .sort((a, b) => a.position.distanceToSquared(c.playerFeet) - b.position.distanceToSquared(c.playerFeet))
      .slice(0, difficulty.value.attackers)
      .forEach((e) => this.attackers.add(e.id));
    for (const e of this.list) {
      e.flash.update(dt);
      if (e.alive) {
        this.aimAt(e, dt);
        think(e, c, dt);
        const toPlayer = c.playerChest.clone().sub(e.position.clone().setY(e.position.y + 1.4));
        const pitch = e.state === 'combat' ? Math.atan2(toPlayer.y, Math.hypot(toPlayer.x, toPlayer.z)) : 0;
        if (act(e, c, dt)) this.fire(e);
        e.update(dt, pitch);
      } else e.update(dt, 0);
      e.shownT = Math.max(0, e.shownT - dt);
    }
  }

  /** After the physics step: copy bodies to models and refresh the bars. */
  sync(): void {
    for (const e of this.list) {
      e.sync();
      const camD = e.position.distanceToSquared(this.camera.position);
      e.model.far = camD > 25 * 25 && e.alive;
      const near = camD < 60 * 60;
      if (near !== e.shadowed) e.model.castShadow = e.shadowed = near;
      const top = e.position.clone().setY(e.position.y + 2.05 - (e.crouched ? 0.5 : 0));
      this.bars.update(e.id, top, e.hp / e.def.hp, e.alive ? e.shownT : 0, this.camera);
    }
  }
}
