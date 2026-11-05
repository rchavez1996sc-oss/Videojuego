import * as THREE from 'three';
import { physicsStep } from '../physics/fastStep';
import { surfaceUnder } from '../systems/sensing';
import type { Pickups } from '../systems/pickups';
import RAPIER from '@dimforge/rapier3d-compat';
import { surfaceOf } from '../world/surfaces';
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
import type { StreetNav } from '../ai/nav';
import { playBot } from './bot';

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
  nav?: StreetNav | null;
  goal?: () => THREE.Vector3 | undefined;
  status?: () => string;
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
    bot: (seconds: number) => playBot(c, seconds, c.status),
    route(x: number, z: number, tx: number, tz: number) {
      const r = c.nav?.route(new THREE.Vector3(x, 0, z), new THREE.Vector3(tx, 0, tz)) ?? [];
      return `${r.length} nodes: ${r.map(fmt).join(' ')} · goal ${c.goal?.() ? fmt(c.goal()!) : '-'}`;
    },
    gunfire(x: number, z: number, frames = 60) {
      c.combat.onShot(new THREE.Vector3(x, c.hf.heightAt(x, z) + 1.5, z));
      for (let i = 0; i < frames; i++) c.frame(1 / 30);
    },
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
    runLog(x: number, z: number, yaw: number, n: number, keys: string[], y?: number, jitter = 0) {
      c.setFreeCam(false);
      c.player.respawn(new THREE.Vector3(x, y ?? c.hf.heightAt(x, z) + 0.3, z), yaw);
      c.tpc.yaw = yaw;
      c.setSkipRender(true);
      for (const k of keys) dispatchEvent(new KeyboardEvent('keydown', { code: k }));
      let air = 0, runs = 0, cur = 0, prevY = c.player.position.y, jumps = 0;
      const ms: number[] = [], rig = c.player.model as unknown as { lowKey: string };
      let swaps = 0, key = '', seen = '';
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        c.frame(1 / 60 + (Math.random() - 0.5) * jitter);
        if (i > 40 && rig.lowKey !== key) (swaps++, seen.length < 160 && (seen += rig.lowKey + ' '));
        key = rig.lowKey;
        ms.push(performance.now() - t0);
        const y = c.player.position.y;
        if (Math.abs(y - prevY) > 0.06) jumps++;
        prevY = y;
        if (c.player.airborne) (air++, cur++);
        else (cur > 0 && runs++, (cur = 0));
      }
      c.setSkipRender(false);
      for (const k of keys) dispatchEvent(new KeyboardEvent('keyup', { code: k }));
      ms.sort((a, b) => a - b);
      return `hp ${c.player.hp.toFixed(0)} swaps ${swaps} [${seen}] air ${air}/${n} in ${runs} runs, y jumps ${jumps}, end ${fmt(c.player.position)}, sim ms p50 ${ms[n >> 1].toFixed(1)} p95 ${ms[Math.floor(n * 0.95)].toFixed(1)} max ${ms[n - 1].toFixed(1)}`;
    },
    ground(x: number, z: number, y?: number) {
      c.player.respawn(new THREE.Vector3(x, y ?? c.hf.heightAt(x, z) + 0.3, z), 0);
      for (let i = 0; i < 20; i++) c.frame(1 / 60);
      return `${x},${z} → ${surfaceUnder(c.world!, c.hf, c.player)} y ${c.player.position.y.toFixed(2)}`;
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
    probe(x: number, y: number, z: number, dx: number, dz: number, len = 8) {
      const out: string[] = [];
      for (const h of [0.05, 0.12, 0.2, 0.3, 0.5, 0.9]) {
        const hit = c.world!.castRayAndGetNormal(new RAPIER.Ray({ x, y: y + h, z }, { x: dx, y: 0, z: dz }), len, true);
        out.push(`${h}: ${hit ? `${hit.timeOfImpact.toFixed(2)} n=${hit.normal.x.toFixed(1)},${hit.normal.y.toFixed(1)},${hit.normal.z.toFixed(1)} ${surfaceOf(hit.collider.handle)}` : '-'}`);
      }
      return out.join(' | ');
    },
    profile(x: number, z0: number, z1: number, step = 0.1) {
      const out: string[] = [];
      for (let z = z0; z <= z1 + 1e-6; z += step) {
        const hit = c.world!.castRay(new RAPIER.Ray({ x, y: 3, z }, { x: 0, y: -1, z: 0 }), 6, true, RAPIER.QueryFilterFlags.ONLY_FIXED);
        out.push(`${z.toFixed(1)}:${hit ? (3 - hit.timeOfImpact).toFixed(2) + surfaceOf(hit.collider.handle)[0] : '-'}`);
      }
      return out.join(' ');
    },
    ctrlTrace(i: number, x: number, z: number, tx: number, tz: number, frames = 120) {
      i = c.enemies.list.findIndex((u, k) => k >= i && !u.isStatic && u.alive && u.def.run > 0);
      const e = c.enemies.list[i] as unknown as { teleport(p: THREE.Vector3): void; update(dt: number, p: number): void; sync(): void; moveTarget: THREE.Vector3 | null; position: THREE.Vector3; ctrl: RAPIER.KinematicCharacterController };
      e.teleport(new THREE.Vector3(x, c.hf.heightAt(x, z), z));
      physicsStep(c.world!);
      const out: string[] = [];
      for (let f = 0; f < frames; f++) {
        e.moveTarget = new THREE.Vector3(tx, 0, tz);
        e.update(1 / 60, 0);
        physicsStep(c.world!);
        e.sync();
        if (f % 6) continue;
        const cols: string[] = [];
        for (let k = 0; k < e.ctrl.numComputedCollisions(); k++) {
          const cc = e.ctrl.computedCollision(k);
          if (cc) cols.push(`${surfaceOf(cc.collider?.handle ?? -1)}${cc.collider?.parent()?.isFixed() ? 'F' : 'K'}(${cc.normal1.x.toFixed(1)},${cc.normal1.y.toFixed(1)},${cc.normal1.z.toFixed(1)})`);
        }
        out.push(`${f}: ${e.position.z.toFixed(2)} y${e.position.y.toFixed(3)} g${+e.ctrl.computedGrounded()} ${cols.join(' ')}`);
      }
      return out.join('\n');
    },
    enemyInfo(i: number) {
      const e = c.enemies.list[i] as unknown as Record<string, unknown>;
      return JSON.stringify(Object.fromEntries(Object.entries(e).filter(([, v]) => typeof v !== 'object' || v === null || (v as THREE.Vector3).isVector3).map(([k, v]) => [k, (v as THREE.Vector3)?.isVector3 ? (v as THREE.Vector3).toArray().map((n) => +n.toFixed(2)) : v])));
    },
    /** Walks police officer `i` (no brain) from (x,z) to (tx,tz): counts hops, detours, stalls and the time taken. */
    npcWalk(i: number, x: number, z: number, tx: number, tz: number, run = false, frames = 600) {
      i = c.enemies.list.findIndex((u, k) => k >= i && !u.isStatic && u.alive && u.def.run > 0);
      const e = c.enemies.list[i] as unknown as { teleport(p: THREE.Vector3): void; update(dt: number, p: number): void; sync(): void; moveTarget: THREE.Vector3 | null; running: boolean; position: THREE.Vector3; hop: unknown; detour: unknown };
      e.teleport(new THREE.Vector3(x, c.hf.heightAt(x, z), z));
      physicsStep(c.world!);
      const goal = new THREE.Vector3(tx, 0, tz);
      const trace: string[] = [];
      let hops = 0, detours = 0, slow = 0, wasHop = false, wasDet = false, f = 0, path = 0;
      const last = e.position.clone();
      for (; f < frames; f++) {
        e.moveTarget = goal; e.running = run;
        e.update(1 / 60, 0);
        physicsStep(c.world!);
        e.sync();
        if (e.hop && !wasHop) hops++;
        if (e.detour && !wasDet) detours++;
        [wasHop, wasDet] = [!!e.hop, !!e.detour];
        const step = Math.hypot(e.position.x - last.x, e.position.z - last.z);
        path += step;
        if (step < 0.01) slow++;
        if (f % 20 === 0) trace.push(`${e.position.x.toFixed(1)},${e.position.y.toFixed(2)},${e.position.z.toFixed(1)}${e.detour ? 'D' : ''}`);
        last.copy(e.position);
        if (Math.hypot(e.position.x - tx, e.position.z - tz) < 0.6) break;
      }
      const straight = Math.hypot(tx - x, tz - z);
      return `${f}f hops ${hops} detours ${detours} stalls ${slow} path ${path.toFixed(1)}/${straight.toFixed(1)} end ${e.position.x.toFixed(1)},${e.position.y.toFixed(2)},${e.position.z.toFixed(1)}\n  ${trace.join(' ')}`;
    },
    /** Draws of one rendered frame (shadow passes included) by material name and pass, top 30. */
    drawTally(view: number) {
      const gl = c.renderer.gl, orig = gl.renderBufferDirect.bind(gl), t: Record<string, number> = {};
      gl.renderBufferDirect = (cam, scn, geo, mat, obj, grp) => {
        const k = `${gl.getRenderTarget() ? 'rt' : 'screen'}:${(cam as THREE.Camera).type === 'OrthographicCamera' ? 'shadow' : 'view'}:${mat.name || ((obj as THREE.Mesh).material as THREE.Material)?.name || mat.type}${(obj as THREE.InstancedMesh).isInstancedMesh ? '[I]' : ''}${(obj as THREE.SkinnedMesh).isSkinnedMesh ? '[S]' : ''}`;
        t[k] = (t[k] ?? 0) + 1;
        orig(cam, scn, geo, mat, obj, grp);
      };
      const [x, dy, z, lx, ldy, lz] = c.views[view] ?? [];
      if (view >= 0) c.setFreeCam(true);
      if (view >= 0) c.tpc.place(new THREE.Vector3(x, c.hf.heightAt(x, z) + dy, z), new THREE.Vector3(lx, c.hf.heightAt(lx, lz) + ldy, lz));
      c.frame(1 / 60);
      gl.renderBufferDirect = orig;
      const total = Object.values(t).reduce((a, b) => a + b, 0), shadow = Object.entries(t).filter(([k]) => k.includes(':shadow:')).reduce((a, [, n]) => a + n, 0);
      return `total ${total} shadow ${shadow}\n` + Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => `${n} ${k}`).join('\n');
    },
    /** Without rendering: meshes in view and shadow casters per top-level child (by name), skinned counted apart. */
    drawStats() {
      const cam = c.tpc.camera, fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const sph = new THREE.Sphere(), rows: Record<string, [number, number, number, number]> = {};
      for (const top of c.scene!.children) {
        const k = `${top.name || top.type}#${top.children.length}`, r = (rows[k] = [0, 0, 0, 0]);
        top.traverseVisible((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material.length : 1;
          if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
          sph.copy((m as THREE.SkinnedMesh).boundingSphere ?? m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld);
          const inView = !m.frustumCulled || fr.intersectsSphere(sph);
          if (inView) r[(m as THREE.SkinnedMesh).isSkinnedMesh ? 1 : 0] += mats;
          if (m.castShadow) r[2] += mats;
          if (inView) r[3] += ((m as THREE.InstancedMesh).count ?? 1) * (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
        });
      }
      return Object.entries(rows).filter(([, r]) => r[0] + r[1] + r[2] > 5).sort((a, b) => b[1][0] + b[1][1] - a[1][0] - a[1][1]).map(([k, r]) => `${k}: view ${r[0]} skinned ${r[1]} casters ${r[2]} tris ${Math.round(r[3] / 1000)}k`).join('\n');
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
    woundTest(i: number, side = Math.PI) {
      const e = c.enemies.list[i], f = new THREE.Vector3(Math.sin(e.yaw + side), 0, Math.cos(e.yaw + side));
      for (const [y, s] of [[1.35, 0], [1.1, 0.12], [1.62, 0.05], [1.3, -0.15]]) e.damage(5, e.position.clone().add(new THREE.Vector3(0, y, 0)).addScaledVector(f, 0.4).add(new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(s)));
      const out: number[][] = [];
      c.scene!.traverse((o) => { if ((o as THREE.Mesh).material && ((o as THREE.Mesh).material as THREE.Material).name === 'wound') out.push(o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))); });
      return JSON.stringify({ f: f.toArray().map((v) => +v.toFixed(2)), p: e.position.toArray().map((v) => +v.toFixed(2)), out });
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
    programs: () => Object.entries((c.renderer.gl.info.programs ?? []).reduce((m: Record<string, number>, p: { name: string }) => ((m[p.name] = (m[p.name] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 25),
    info: () => ({ calls: c.renderer.gl.info.render.calls, tris: c.renderer.gl.info.render.triangles, pos: c.player.position.toArray().map(Math.round), programs: c.renderer.gl.info.programs?.length, colliders: c.world?.colliders.len() }),
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
