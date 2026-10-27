import * as THREE from 'three';
import type { Pickups } from '../systems/pickups';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ThirdPersonCamera } from './camera';
import type { Heightfield } from '../world/heightfield';
import type { Player } from '../entities/player';
import type { Combat } from '../weapons/combat';
import type { Enemies } from '../systems/enemies';
import type { Grenades } from '../weapons/grenades';
import type { Renderer } from '../render/renderer';
import type { Traffic } from '../systems/traffic';
import type { Squad } from '../systems/squad';
import type { GrenadeMode } from '../weapons/grenadeMode';
import type { Objective } from '../systems/objective';

export interface DebugContext {
  views: [number, number, number, number, number, number][];
  tpc: ThirdPersonCamera;
  hf: Heightfield;
  player: Player;
  combat: Combat;
  enemies: Enemies;
  grenades: Grenades;
  pickups: Pickups;
  renderer: Renderer;
  shotMode: boolean;
  frame: (dt: number) => void;
  setFreeCam: (v: boolean) => void;
  setSkipRender: (v: boolean) => void;
  throwGrenade: () => void;
  extraLog?: () => string;
  traffic?: () => Traffic | undefined;
  scene?: THREE.Scene;
  squad?: Squad | null;
  grenadeMode?: GrenadeMode;
  objective?: Objective | null;
  civilians?: () => THREE.Vector3[];
  world?: RAPIER.World;
}

/** `window.__game`: hooks used by the Playwright screenshot / AI / grenade scripts. */
export function installDebug(c: DebugContext): void {
  const fmt = (v: THREE.Vector3) => `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}`;
  (window as unknown as { __game: object }).__game = {
    setView(i: number) {
      c.setFreeCam(true);
      const [x, dy, z, lx, ldy, lz] = c.views[i];
      c.tpc.place(new THREE.Vector3(x, c.hf.heightAt(x, z) + dy, z), new THREE.Vector3(lx, c.hf.heightAt(lx, lz) + ldy, lz));
      if (c.shotMode) c.frame(1 / 60);
    },
    views: () => c.views.length,
    look(x: number, y: number, z: number, lx: number, ly: number, lz: number) {
      c.setFreeCam(true);
      c.tpc.place(new THREE.Vector3(x, y, z), new THREE.Vector3(lx, ly, lz));
      c.frame(1 / 60);
    },
    follow() {
      c.setFreeCam(false);
    },
    /** Logic-only run: teleports the player, steps `seconds` without rendering, reports AI state every 2 s. */
    aiTest(x: number, z: number, seconds: number, fire: boolean | number) {
      c.setFreeCam(false);
      c.setSkipRender(true);
      c.player.respawn(new THREE.Vector3(x, c.hf.heightAt(x, z), z), Math.atan2(x, z));
      c.tpc.yaw = Math.atan2(x, z);
      const log: string[] = [];
      for (let i = 0; i < seconds * 20; i++) {
        if (fire && i % 10 === 0 && (fire === true || i < fire * 20)) c.combat.debugShoot();
        c.frame(1 / 20);
        if (i % 40 === 39) {
          const states = c.enemies.list.map((e) => `${e.id}:${e.state[0]}${e.cover ? 'C' : ''}${e.crouched ? 'v' : ''}${e.canSee ? '*' : ''}`).join(' ');
          const engaged = c.enemies.list.filter((e) => e.alive && e.engaged);
          const avg = engaged.length ? engaged.reduce((a, e) => a + e.position.distanceTo(c.player.position), 0) / engaged.length : 0;
          const detail = c.enemies.aliveCount <= 5 ? c.enemies.list.filter((e) => e.alive).map((e) => `\n   ${e.id} ${e.state} @${fmt(e.position)} →${e.moveTarget ? fmt(e.moveTarget) : '-'} path=${e.path.length} lk=${fmt(e.lastKnown)} run=${e.running}`).join('') : '';
          log.push(`t=${((i + 1) / 20).toFixed(0)}s hp=${c.player.hp.toFixed(0)} engaged=${engaged.length} avgDist=${avg.toFixed(0)} inside=${c.enemies.insideCount} ${states}${detail}`);
        }
      }
      c.setSkipRender(false);
      return log.join('\n');
    },
    /** Kills all but the `keep` enemies farthest from the player (tests the last-stand hunt). */
    thin(keep: number) {
      const far = [...c.enemies.list].sort((a, b) => b.position.distanceTo(c.player.position) - a.position.distanceTo(c.player.position));
      for (const e of far.slice(keep)) if (e.alive && e.damage(1e6)) e.die(new THREE.Vector3(0, 0, 1));
    },
    /** Throws a grenade from 15 m west of a point and runs until it explodes. */
    grenadeTest(tx: number, tz: number) {
      c.setFreeCam(false);
      c.setSkipRender(true);
      const from = new THREE.Vector3(tx - 15, 0, tz);
      from.y = c.hf.heightAt(from.x, from.z);
      c.player.respawn(from, Math.PI / 2 + Math.PI);
      c.tpc.yaw = -Math.PI / 2;
      c.tpc.pitch = -0.12;
      for (let i = 0; i < 3; i++) c.frame(1 / 30);
      let where: THREE.Vector3 | null = null;
      const prev = c.grenades.onExplode;
      c.grenades.onExplode = (at) => {
        where = at;
        prev(at);
      };
      const before = c.enemies.list.map((e) => e.hp);
      c.throwGrenade();
      for (let n = 0; !where && n < 200; n++) c.frame(1 / 30);
      for (let i = 0; i < 4; i++) c.frame(1 / 30);
      c.grenades.onExplode = prev;
      c.setSkipRender(false);
      const hits = c.enemies.list.map((e, i) => (e.hp !== before[i] ? `${i}: ${before[i]}→${Math.max(0, e.hp).toFixed(0)} ${e.state} @${fmt(e.position)}` : '')).filter(Boolean);
      return `${hits.join(' | ')} · boom @ ${where ? fmt(where) : '-'} · player hp ${c.player.hp.toFixed(0)}`;
    },
    /** Teleports the player and runs `n` frames at 60 Hz holding the given keys; logs frames spent off the ground and height jumps. */
    runLog(x: number, z: number, yaw: number, n: number, keys: string[]) {
      c.setFreeCam(false);
      c.player.respawn(new THREE.Vector3(x, c.hf.heightAt(x, z) + 0.3, z), yaw);
      c.tpc.yaw = yaw;
      for (const k of keys) dispatchEvent(new KeyboardEvent('keydown', { code: k }));
      let air = 0, runs = 0, cur = 0, prevY = c.player.position.y, jumps = 0;
      for (let i = 0; i < n; i++) {
        c.frame(1 / 60);
        const y = c.player.position.y;
        if (Math.abs(y - prevY) > 0.06) jumps++;
        prevY = y;
        if (c.player.airborne) (air++, cur++);
        else (cur > 0 && runs++, (cur = 0));
      }
      for (const k of keys) dispatchEvent(new KeyboardEvent('keyup', { code: k }));
      return `air ${air}/${n} in ${runs} runs, y jumps ${jumps}, end ${fmt(c.player.position)}`;
    },
    /** Runs `n` frames in follow mode, firing every `every` frames (screenshot tests). */
    simulate(n: number, every: number, pitch = -0.02) {
      c.setFreeCam(false);
      c.tpc.pitch = pitch;
      for (let i = 0; i < n; i++) {
        if (every && i % every === 0) c.combat.debugShoot();
        c.frame(1 / 60);
      }
    },
    /** Calls/triangles each top-level scene child costs in the current view (toggled off one at a time). */
    breakdown() {
      const gl = c.renderer.gl, info = gl.info, out: string[] = [];
      gl.info.autoReset = false;
      const draw = () => { info.reset(); gl.render(c.scene!, c.tpc.camera); return [info.render.calls, info.render.triangles]; };
      draw();
      const base = draw();
      const walk = (o: THREE.Object3D, depth: number) => {
        for (const ch of o.children) {
          if (!ch.visible) continue;
          ch.visible = false;
          const [k, t] = draw();
          ch.visible = true;
          const dk = base[0] - k, dt = base[1] - t;
          if (dk >= 15 || dt > 150000) {
            out.push(`${'  '.repeat(depth)}${ch.name || ch.type}#${ch.children.length}: calls ${dk} tris ${dt}`);
            if (depth < 1 && ch.children.length > 1) walk(ch, depth + 1);
          }
        }
      };
      walk(c.scene!, 0);
      gl.info.autoReset = true;
      return `total calls ${base[0]} tris ${base[1]}\n` + out.join('\n');
    },
    /** Grenade in hand with the throw arc drawn, rendered from the player's camera. */
    aimGrenade(pitch: number) {
      c.setFreeCam(false);
      c.tpc.pitch = pitch;
      c.grenadeMode!.equipped = true;
      c.frame(1 / 60);
      c.grenadeMode!.preview();
      c.renderer.render(1 / 60);
    },
    /** Kills the nearest enemy, stands on the body with an empty rifle and presses E; then waits for an emergency crate. */
    lootTest() {
      const g = c.combat.gun, p = c.player.position;
      const e = [...c.enemies.list].filter((x) => x.alive).sort((a, b) => a.position.distanceTo(p) - b.position.distanceTo(p))[0];
      e.damage(1e6);
      e.die(new THREE.Vector3(1, 0, 0));
      for (let i = 0; i < 40; i++) c.frame(1 / 20);
      const drops = c.pickups.markers.filter((m) => m.pos.distanceTo(e.position) < 2).map((m) => m.kind).join('+');
      g.ammo = 0;
      g.reserve = 0;
      c.player.respawn(e.position.clone(), 0);
      for (let i = 0; i < 6; i++) c.frame(1 / 20);
      const looted = g.reserve;
      return `drops=${drops} looted=${looted} toast="${document.querySelector('#hud .toast')?.textContent}"`;
    },
    /** Walks into the station lobby: reports the prompt with defenders alive, then clears them and holds E. */
    objectiveTest() {
      const o = c.objective!, h = o.site.hall, log: string[] = [];
      c.setFreeCam(false);
      c.player.respawn(new THREE.Vector3((h.x0 + h.x1) / 2, h.y + 0.25, (h.z0 + h.z1) / 2), 0);
      for (let i = 0; i < 3; i++) c.frame(1 / 20);
      log.push(`inside-with-defenders: ${document.querySelectorAll('.prompt')[2]?.textContent}`);
      for (const e of c.enemies.list) if (e.alive && e.position.distanceTo(o.position) < o.def.defendRadius && e.damage(1e6)) e.die(new THREE.Vector3(1, 0, 0));
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
      for (let i = 0; i < 70 && !o.done; i++) {
        c.player.hp = 100;
        c.frame(1 / 20);
      }
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
      log.push(`done=${o.done} screen=${document.getElementById('complete')?.textContent?.slice(0, 120)}`);
      return log.join('\n');
    },
    /** Frames a unit from 3.5 m in front (enemy/ally index, or a civilian position); `kill` first plays its death for 3 s. */
    inspect(kind: 'enemy' | 'ally' | 'civ' | 'player', i: number, kill = false, side = 0, dist = 3.5) {
      c.setFreeCam(false);
      const unit = kind === 'enemy' ? c.enemies.list[i] : kind === 'ally' ? c.squad?.list[i].unit : kind === 'player' ? (c.player as never) : null;
      if (unit && kill && unit.alive && unit.damage(1e6)) unit.die(new THREE.Vector3(0, 0, 1));
      for (let k = 0; k < (kill ? 60 : 4); k++) c.frame(1 / 20);
      const p = unit ? unit.position.clone() : c.civilians!()[i].clone();
      const yaw = unit ? unit.yaw + side : side;
      const eye = p.clone().add(new THREE.Vector3(-Math.sin(yaw) * dist, 1.5, -Math.cos(yaw) * dist));
      c.setFreeCam(true);
      c.tpc.place(eye, p.clone().setY(p.y + (dist < 2 ? 1.4 : 0.9)));
      c.frame(1 / 60);
      c.frame(1 / 60);
      return `${kind}${i} @${p.x.toFixed(1)},${p.z.toFixed(1)}`;
    },
    civ: (i: number) => c.civilians!()[i],
    /** Pushes the player into house fronts (sprint, slide, jump, mantle) while whipping the camera; counts wall/camera penetrations. */
    wallTest(spots: number, seconds: number) {
      c.setFreeCam(false);
      const key = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
      let crossed = 0, camIn = 0, frames = 0;
      const log: string[] = [];
      for (let s = 0; s < spots; s++) {
        const side = s % 2 ? 1 : -1, x = -240 + ((s * 97) % 470), wallZ = side * 12;
        c.player.respawn(new THREE.Vector3(x, c.hf.heightAt(x, wallZ - side * 1.2), wallZ - side * 1.2), side > 0 ? Math.PI : 0);
        c.tpc.yaw = side > 0 ? Math.PI : 0;
        key('KeyW', true);
        key('ShiftLeft', true);
        let spotCross = 0;
        for (let i = 0; i < seconds * 30; i++) {
          c.tpc.yaw += Math.sin(i * 0.9) * 0.6 + (i % 23 === 0 ? 2.5 : 0);
          if (i % 30 === 10) key('Space', true);
          if (i % 30 === 24) key('Space', false);
          if (i % 45 === 20) key('ControlLeft', true);
          if (i % 45 === 24) key('ControlLeft', false);
          c.frame(1 / 30);
          frames++;
          if (Math.abs(c.player.position.z) > 12.2 && Math.sign(c.player.position.z) === side && Math.abs(c.player.position.y - c.hf.heightAt(c.player.position.x, c.player.position.z)) < 2) spotCross++;
          let inside = false;
          c.world!.intersectionsWithPoint(c.tpc.camera.position, (col) => {
            if (col.handle !== c.player.collisionHandle && col.isEnabled() && !col.isSensor()) inside = true;
            return !inside;
          });
          if (inside) camIn++;
        }
        ['KeyW', 'ShiftLeft', 'Space', 'ControlLeft'].forEach((k) => key(k, false));
        crossed += spotCross ? 1 : 0;
        if (spotCross) log.push(`spot ${s} x=${x} side=${side} crossed frames=${spotCross} end=${c.player.position.x.toFixed(1)},${c.player.position.y.toFixed(1)},${c.player.position.z.toFixed(1)}`);
      }
      return `spots=${spots} crossedSpots=${crossed} cameraInsideFrames=${camIn}/${frames}\n${log.join('\n')}`;
    },
    /** Dies pressed against house fronts and reports where the player comes back (roof overhead = bad). */
    respawnTest(n: number) {
      c.setFreeCam(false);
      c.setSkipRender(true);
      const out: string[] = [];
      for (let s = 0; s < n; s++) {
        const side = s % 2 ? 1 : -1, x = -230 + ((s * 83) % 440);
        c.player.respawn(new THREE.Vector3(x, c.hf.heightAt(x, side * 11.7), side * 11.7), 0);
        c.frame(1 / 20);
        c.player.hp = 0;
        for (let i = 0; i < 110; i++) c.frame(1 / 20);
        const p = c.player.position;
        const roof = c.world!.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 2, z: p.z }, { x: 0, y: 1, z: 0 }), 30, true);
        out.push(`${x}->${p.x.toFixed(0)},${p.z.toFixed(0)} hp=${c.player.hp.toFixed(0)} roof=${!!roof}`);
      }
      c.setSkipRender(false);
      return out.join(' | ');
    },
    /** Steps in front of a moving vehicle (inside its braking distance) and reports the damage taken. */
    roadTest(gap: number) {
      const tr = c.traffic?.();
      const spot = tr?.debugAhead(gap);
      if (!spot) return 'no traffic';
      c.setFreeCam(false);
      c.setSkipRender(true);
      for (let i = 0; i < 40; i++) c.frame(1 / 20);
      const s = tr!.debugAhead(gap)!;
      c.player.respawn(new THREE.Vector3(s.x, c.hf.heightAt(s.x, s.z), s.z), 0);
      c.player.hp = 100;
      const before = c.player.position.clone();
      for (let i = 0; i < 30; i++) c.frame(1 / 30);
      c.setSkipRender(false);
      return `hp=${c.player.hp.toFixed(0)} moved=${c.player.position.distanceTo(before).toFixed(1)}m`;
    },
    /** Stands at (x, z) with enemies alerted, presses Q, and reports where the player ended and whether the threat can see them. */
    coverTest(x: number, z: number, y?: number) {
      c.setFreeCam(false);
      c.setSkipRender(true);
      c.player.respawn(new THREE.Vector3(x, y ?? c.hf.heightAt(x, z), z), 0);
      c.combat.debugShoot();
      for (let i = 0; i < 20; i++) {
        c.player.hp = 100;
        c.frame(1 / 20);
      }
      const start = c.player.position.clone();
      const toast = document.querySelector('#hud .toast')!;
      toast.textContent = '';
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
      c.frame(1 / 20);
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' }));
      for (let i = 0; i < 60; i++) {
        c.player.hp = 100;
        c.frame(1 / 20);
      }
      const p = c.player.position, e = c.enemies.list.filter((n) => n.alive).sort((a, b) => a.position.distanceTo(p) - b.position.distanceTo(p))[0];
      const eye = e.position.clone().setY(e.position.y + 1.6), chest = p.clone().setY(p.y + 0.8);
      const dir = chest.clone().sub(eye), len = dir.length();
      const hit = c.world!.castRay(new RAPIER.Ray(eye, dir.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (col) => col.handle !== c.player.collisionHandle && col.handle !== e.handle);
      c.setSkipRender(false);
      return `moved ${start.distanceTo(p).toFixed(1)}m crouch=${c.player.crouchAmount.toFixed(2)} enemy@${e.position.distanceTo(p).toFixed(0)}m hidden=${!!hit && hit.timeOfImpact < len - 0.3} toast="${document.querySelector('#hud .toast')?.textContent}"`;
    },
    squadInfo: () => {
      const s = c.squad;
      if (!s) return 'no squad';
      const dead = c.enemies.list.length - c.enemies.aliveCount;
      return `allyKills=${s.allyKills}/${dead} ` + s.list.map((a) => `${a.name}:${a.lost ? 'X' : a.unit.alive ? a.unit.state[0] : 'down'} hp=${a.unit.hp.toFixed(0)} d=${a.unit.position.distanceTo(c.player.position).toFixed(1)} @${a.unit.position.x.toFixed(0)},${a.unit.position.z.toFixed(0)}${a.unit.moveTarget ? ' mv' + a.unit.path.length + '>' + a.unit.moveTarget.x.toFixed(0) + ',' + a.unit.moveTarget.z.toFixed(0) : ''}${a.target ? ' →' + a.target.id : ''}`).join(' | ');
    },
    info: () => ({ calls: c.renderer.gl.info.render.calls, tris: c.renderer.gl.info.render.triangles, pos: c.player.position.toArray().map(Math.round) }),
    /** Disables the nearest moving vehicle and logs every vehicle's state for 3 s. */
    vehicleTest(kind?: string) {
      const tr = c.traffic?.();
      if (!tr) return 'no traffic';
      c.setFreeCam(false);
      c.setSkipRender(true);
      const log = [`disabled ${tr.debugDisableNearest(c.player.position, kind)}`];
      for (let i = 0; i < 60; i++) {
        c.frame(1 / 20);
        if (i % 20 === 19) log.push(tr.debugStates);
      }
      c.setSkipRender(false);
      log.push(`at ${tr.debugLastAt}`);
      return log.join('\n');
    },
    ready: true,
  };
}
