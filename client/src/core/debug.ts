import * as THREE from 'three';
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

export interface DebugContext {
  views: [number, number, number, number, number, number][];
  tpc: ThirdPersonCamera;
  hf: Heightfield;
  player: Player;
  combat: Combat;
  enemies: Enemies;
  grenades: Grenades;
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
      const info = c.renderer.gl.info.render, out: string[] = [];
      c.frame(1 / 60);
      const base = [info.calls, info.triangles];
      for (const o of c.scene?.children ?? []) {
        if (!o.visible) continue;
        o.visible = false;
        c.frame(1 / 60);
        out.push(`${o.name || o.type}#${o.children.length}: calls ${base[0] - info.calls} tris ${base[1] - info.triangles}`);
        o.visible = true;
      }
      return `total calls ${base[0]} tris ${base[1]}\n` + out.filter((l) => !/calls 0 tris 0/.test(l)).join('\n');
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
      c.frame(1 / 20);
      c.player.respawn(e.position.clone().add(new THREE.Vector3(0.8, 0, 0)), 0);
      g.ammo = 0;
      g.reserve = 0;
      c.frame(1 / 20);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
      c.frame(1 / 20);
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
      const looted = g.reserve;
      g.reserve = 0;
      for (let i = 0; i < 80; i++) c.frame(1 / 20);
      return `looted=${looted} toast="${document.querySelector('#hud .toast')?.textContent}"`;
    },
    squadInfo: () => {
      const s = c.squad;
      if (!s) return 'no squad';
      const dead = c.enemies.list.length - c.enemies.aliveCount;
      return `allyKills=${s.allyKills}/${dead} ` + s.list.map((a) => `${a.name}:${a.lost ? 'X' : a.unit.alive ? a.unit.state[0] : 'down'} hp=${a.unit.hp.toFixed(0)} d=${a.unit.position.distanceTo(c.player.position).toFixed(1)} @${a.unit.position.x.toFixed(0)},${a.unit.position.z.toFixed(0)}${a.unit.moveTarget ? ' mv' + a.unit.path.length + '>' + a.unit.moveTarget.x.toFixed(0) + ',' + a.unit.moveTarget.z.toFixed(0) : ''}${a.target ? ' →' + a.target.id : ''}`).join(' | ');
    },
    info: () => ({ calls: c.renderer.gl.info.render.calls, tris: c.renderer.gl.info.render.triangles }),
    /** Disables the nearest moving vehicle and logs every vehicle's state for 3 s. */
    vehicleTest() {
      const tr = c.traffic?.();
      if (!tr) return 'no traffic';
      c.setFreeCam(false);
      c.setSkipRender(true);
      const log = [`disabled ${tr.debugDisableNearest(c.player.position)}`];
      for (let i = 0; i < 60; i++) {
        c.frame(1 / 20);
        if (i % 20 === 19) log.push(tr.debugStates);
      }
      c.setSkipRender(false);
      return log.join('\n');
    },
    ready: true,
  };
}
