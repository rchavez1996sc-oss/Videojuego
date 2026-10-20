import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import chapter from './data/chapters/ch01.json';
import type { ChapterDef } from './data/types';
import { Input } from './core/input';
import { ThirdPersonCamera } from './core/camera';
import { preset, quality, shotMode, gpuName } from './core/settings';
import { Renderer } from './render/renderer';
import { Lighting } from './render/lighting';
import { Heightfield } from './world/heightfield';
import { Terrain } from './world/terrain';
import { Grass } from './world/grass';
import { buildScatter } from './world/scatter';
import { buildVillage } from './world/village';
import { Player } from './entities/player';
import weapons from './data/weapons.json';
import type { WeaponDef } from './weapons/types';
import { Combat } from './weapons/combat';
import { Mixer } from './audio/mixer';
import { Sfx } from './audio/sfx';
import { ShootingRange } from './world/range';
import { buildStructures } from './world/structures';
import { surfaceOf } from './world/surfaces';
import { Hud } from './ui/hud';
import { DynamicResolution } from './render/dynamicRes';
import enemyDefs from './data/enemies.json';
import type { EnemyDef } from './entities/enemy';
import { Enemies } from './systems/enemies';
import { DamageFx } from './ui/damage';
import { Pickups } from './systems/pickups';
import { findRespawn } from './systems/respawn';
import { Grenades } from './weapons/grenades';
import { ThreatGrid, type Threat } from './ui/threatGrid';
import { DIFFICULTIES, difficulty, type DifficultyId } from './core/difficulty';

const status = document.getElementById('status')!;
const overlay = document.getElementById('overlay')!;
const stats = document.getElementById('stats')!;
const step = (msg: string) => new Promise<void>((r) => { status.textContent = msg; requestAnimationFrame(() => r()); });

async function boot(): Promise<void> {
  if (shotMode) document.body.classList.add('shot');
  const ch = chapter as unknown as ChapterDef;
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 4000);
  const renderer = new Renderer(canvas, scene, camera, ch.biome.exposure);
  const lighting = new Lighting(scene, camera, renderer.gl, ch.biome);

  await step('Generando terreno…');
  const hf = new Heightfield(ch.terrain);
  const terrain = new Terrain(hf, ch.biome, lighting, world);
  scene.add(terrain.group);
  await step('Construyendo la aldea…');
  const village = buildVillage(hf, ch, lighting, world);
  scene.add(village.group);
  await step('Sembrando el valle…');
  const nearBuilding = (x: number, z: number) => village.footprints.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + 2);
  scene.add(buildScatter(hf, lighting, world, ch.scatter, nearBuilding));
  const grass = new Grass(hf, ch.biome, lighting, preset.grassBlades);
  scene.add(grass.mesh);

  const spawn = new THREE.Vector3(ch.spawn.x, hf.heightAt(ch.spawn.x, ch.spawn.z), ch.spawn.z);
  const player = new Player(world, lighting, spawn, ch.spawn.yaw);
  scene.add(player.model.root);
  const input = new Input(canvas);
  const tpc = new ThirdPersonCamera(camera, world, ch.spawn.yaw);
  const mixer = new Mixer();
  const sfx = new Sfx(mixer);
  const hud = new Hud();
  const combat = new Combat(weapons.ak as WeaponDef, world, player, tpc, sfx, lighting, hf);
  scene.add(combat.group);
  const rangeOrigin = { ...ch.spawn, yaw: ch.rangeYaw ?? ch.spawn.yaw };
  const range = new ShootingRange(hf, lighting, world, rangeOrigin, ch.range ?? [], (h) => {
    combat.sparkBurst(h.point, h.normal);
    sfx.steelPing(h.point.distanceTo(camera.position));
    sfx.hitmarker(h.kill);
    hud.hitmarker(h.kill, h.headshot);
  });
  scene.add(range.group);
  scene.add(buildStructures(hf, lighting, world, rangeOrigin, ch.structures ?? []));
  player.onMantle = () => sfx.footstep(1.3, 'rock');
  const dynRes = new DynamicResolution(renderer);
  const damageFx = new DamageFx();
  const enemies = new Enemies(enemyDefs as unknown as Record<string, EnemyDef>, ch.enemies ?? [], world, hf, lighting, player, combat, sfx, camera);
  scene.add(enemies.group);
  combat.onShot = (p) => enemies.hearShot(p);
  let deadT = 0, skipRender = false, shieldT = 0;
  const deathPos = new THREE.Vector3();
  enemies.onPlayerHit = (dmg, from) => {
    if (deadT > 0) return;
    player.hurt(shieldT > 0 ? dmg * 0.15 : dmg);
    sfx.hurt();
    const to = from.clone().sub(camera.position).setY(0).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
    damageFx.hit(Math.atan2(to.dot(right), to.dot(fwd)), dmg);
    tpc.kick(0.006, (Math.random() - 0.5) * 0.008, 0.03);
  };
  const pickups = new Pickups(lighting, hf, ch.medkits ?? []);
  scene.add(pickups.group);
  const threatGrid = new ThreatGrid();
  const grenades = new Grenades(world, hf, lighting, () => player.collisionHandle);
  scene.add(grenades.group);
  grenades.onSettled = (at) => enemies.fleeFrom(at);
  const throwGrenade = () => {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const from = player.position.clone().setY(player.position.y + 1.55).addScaledVector(fwd.clone().setY(0).normalize(), 0.55);
    if (grenades.throw(from, fwd, new THREE.Vector3())) sfx.grenadePin();
  };
  grenades.onExplode = (at) => {
    combat.explosionFx(at);
    const cam = camera.position, right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const dist = at.distanceTo(cam);
    sfx.explosion(dist, at.clone().sub(cam).normalize().dot(right));
    tpc.kick(0.01 * Math.max(0, 1 - dist / 40), 0, Math.max(0, 0.5 - dist / 60));
    enemies.hearShot(at);
    enemies.explosion(at, 8, 160);
    const chest = player.position.clone().setY(player.position.y + 1.0);
    const d = chest.distanceTo(at);
    if (d < 8 && deadT <= 0) {
      const dir = chest.clone().sub(at), len = dir.length();
      const block = world.castRay(new RAPIER.Ray(at.clone().setY(at.y + 0.3), dir.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== player.collisionHandle && c.isEnabled());
      if (!block || block.timeOfImpact > len - 0.5) enemies.onPlayerHit(130 * Math.pow(1 - d / 8, 1.2), at);
    }
  };
  enemies.onEnemyHit = (kill, headshot, at) => {
    if (kill && Math.random() < 0.15) pickups.spawn(at);
    sfx.hitmarker(kill);
    hud.hitmarker(kill, headshot, 'BAJA  +100');
    if (kill && enemies.aliveCount === 0) setTimeout(() => hud.showToast('ZONA DESPEJADA'), 1200);
  };
  world.step();

  let freeCam = false;
  const views: [number, number, number, number, number, number][] = [
    [-128, 2.2, -28, 0, 3, 10],
    [-60, 38, 90, 15, 2, -20],
    [44, 1.7, 13.5, 0, 3, 2],
    [-117.6, 1.9, -31.8, -120.5, 1.1, -35.5],
    [-131, 4, -30, -118, 1.5, -24],
  ];
  (window as unknown as { __game: object }).__game = {
    setView(i: number) {
      freeCam = true;
      const [x, dy, z, lx, ldy, lz] = views[i];
      tpc.place(new THREE.Vector3(x, hf.heightAt(x, z) + dy, z), new THREE.Vector3(lx, hf.heightAt(lx, lz) + ldy, lz));
      if (shotMode) frame(1 / 60);
    },
    follow() { freeCam = false; },
    /** Runs `n` frames in follow mode, firing every `every` frames (screenshot tests). */
    /** Logic-only run for AI tests: teleports the player, steps `seconds` without rendering, reports state. */
    aiTest(x: number, z: number, seconds: number, fire: boolean) {
      freeCam = false;
      skipRender = true;
      player.respawn(new THREE.Vector3(x, hf.heightAt(x, z), z), Math.atan2(x, z));
      tpc.yaw = Math.atan2(x, z);
      const log: string[] = [];
      let shots = 0;
      for (let i = 0; i < seconds * 20; i++) {
        if (fire && i % 10 === 0) {
          combat.debugShoot();
          shots++;
        }
        frame(1 / 20);
        if (i % 40 === 39) log.push(`t=${((i + 1) / 20).toFixed(0)}s hp=${player.hp.toFixed(0)} pos=${player.position.x.toFixed(0)},${player.position.z.toFixed(0)} ` + enemies.list.map((e) => `${e.id}:${e.state[0]}${e.cover ? 'C' : ''}${e.crouched ? 'v' : ''}${e.canSee ? '*' : ''}`).join(' '));
      }
      skipRender = false;
      return log.join('\n');
    },
    /** Throws a grenade at a world point from 15 m away and runs until shortly after it explodes. */
    grenadeTest(tx: number, tz: number) {
      freeCam = false;
      skipRender = true;
      const from = new THREE.Vector3(tx - 15, 0, tz);
      from.y = hf.heightAt(from.x, from.z);
      player.respawn(from, Math.PI / 2 + Math.PI);
      tpc.yaw = -Math.PI / 2;
      tpc.pitch = -0.12;
      for (let i = 0; i < 3; i++) frame(1 / 30);
      let exploded = false, where = '';
      const prev = grenades.onExplode;
      grenades.onExplode = (at) => {
        exploded = true;
        where = `${at.x.toFixed(1)},${at.y.toFixed(1)},${at.z.toFixed(1)}`;
        prev(at);
      };
      const before = enemies.list.map((e) => e.hp);
      const fwd0 = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      throwGrenade();
      const trace: string[] = [`fwd ${fwd0.x.toFixed(2)},${fwd0.y.toFixed(2)},${fwd0.z.toFixed(2)} feet ${player.position.y.toFixed(2)} ground ${hf.heightAt(player.position.x, player.position.z).toFixed(2)}`];
      let n = 0;
      while (!exploded && n++ < 200) {
        frame(1 / 30);
        const g = grenades.group.children[0];
        if (g && n % 6 === 0) trace.push(`${g.position.x.toFixed(1)},${g.position.y.toFixed(1)},${g.position.z.toFixed(1)} gnd ${hf.heightAt(g.position.x, g.position.z).toFixed(1)}`);
      }
      console.log(trace.join(' | '));
      for (let i = 0; i < 4; i++) frame(1 / 30);
      skipRender = false;
      return enemies.list.map((e, i) => (e.hp !== before[i] ? `${i}: ${before[i]}→${Math.max(0, e.hp).toFixed(0)} ${e.state} @${e.position.x.toFixed(1)},${e.position.y.toFixed(1)},${e.position.z.toFixed(1)}` : '')).filter(Boolean).join(' | ') + ` · boom @ ${where} · player ${player.position.x.toFixed(1)},${player.position.z.toFixed(1)} hp ${player.hp.toFixed(0)}`;
    },
    simulate(n: number, every: number, pitch = -0.02) {
      freeCam = false;
      tpc.pitch = pitch;
      for (let i = 0; i < n; i++) {
        if (every && i % every === 0) combat.debugShoot();
        frame(1 / 60);
      }
    },
    info: () => ({ calls: renderer.gl.info.render.calls, tris: renderer.gl.info.render.triangles }),
    ready: true,
  };

  status.textContent = 'Elige la dificultad · clic en cualquier parte para jugar';
  const diffBox = overlay.querySelector('.difficulty') as HTMLElement;
  const renderDiff = () => {
    diffBox.innerHTML = '';
    for (const [id, d] of Object.entries(DIFFICULTIES)) {
      const b = document.createElement('button');
      b.textContent = d.label;
      b.classList.toggle('on', id === difficulty.id);
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        difficulty.set(id as DifficultyId);
        renderDiff();
      });
      diffBox.appendChild(b);
    }
  };
  renderDiff();
  overlay.addEventListener('click', () => {
    mixer.resume();
    input.lock();
  });
  document.addEventListener('pointerlockchange', () => overlay.classList.toggle('hidden', document.pointerLockElement === canvas));

  const gpu = gpuName.replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 60);
  let lastStep = 0, landed = false;
  const groundUnder = (): 'grass' | 'dirt' | 'rock' | 'wood' => {
    const p = player.position;
    const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }), 0.8, true, undefined, undefined, undefined, undefined, (c) => c.handle !== player.collisionHandle);
    const surf = hit ? surfaceOf(hit.collider.handle) : 'dirt';
    if (surf === 'dirt') return hf.maskAt(p.x, p.z, 1) > 0.3 ? 'grass' : 'dirt';
    if (surf === 'wood') return 'wood';
    return surf === 'rock' || surf === 'metal' || surf === 'tile' ? 'rock' : 'dirt';
  };
  const clock = new THREE.Clock();
  let frames = 0, acc = 0;
  renderer.gl.info.autoReset = false;
  const frame = (dt: number) => {
    const t = clock.elapsedTime;
    renderer.gl.info.reset();
    if (!freeCam) {
      if (deadT > 0) {
        deadT -= dt;
        if (deadT <= 0) {
          damageFx.dead = false;
          const fallback = new THREE.Vector3(ch.spawn.x, hf.heightAt(ch.spawn.x, ch.spawn.z), ch.spawn.z);
          const spot = findRespawn(world, hf, enemies.list, deathPos, fallback);
          player.respawn(spot.pos, spot.yaw);
          tpc.yaw = spot.yaw;
          tpc.pitch = -0.1;
          shieldT = 3;
          for (const e of enemies.list) {
            if (!e.alive || e.state === 'patrol') continue;
            e.state = 'alert';
            e.stateT = 0;
            e.awareness = 0.5;
            e.lastKnown.copy(deathPos);
            e.moveTarget = null;
          }
        }
      } else {
        player.update(dt, input, tpc.yaw, input.aiming, tpc.pitch, input.firing);
        player.regen(dt);
        shieldT = Math.max(0, shieldT - dt);
        if (player.hp <= 0) {
          deadT = 4;
          deathPos.copy(player.position);
          damageFx.dead = true;
        }
      }
      enemies.update(dt);
      world.timestep = dt;
      world.step();
      player.syncPosition();
      const moveK = Math.min(player.speed / 6, 1);
      const amp = (0.012 + 0.02 * moveK) * moveK * (input.aiming ? 0.3 : 1);
      const stepWave = Math.abs(Math.sin(player.stepPhase * Math.PI));
      tpc.bob = THREE.MathUtils.damp(tpc.bob, (stepWave - 0.6) * amp - (player.sprinting ? 0.05 : moveK * 0.02), 25, dt);
      tpc.sway = THREE.MathUtils.damp(tpc.sway, Math.sin(player.stepPhase * Math.PI) * amp * 0.5, 20, dt);
      const step = Math.floor(player.stepPhase);
      if (step !== lastStep && player.speed > 0.8 && !player.airborne) sfx.footstep(Math.min(1, player.speed / 6) * (player.crouchAmount > 0.5 ? 0.4 : 1), groundUnder());
      lastStep = step;
      if (player.landImpact > 0.6 && !landed) sfx.footstep(1.6, groundUnder());
      landed = player.landImpact > 0.6;
      tpc.dip = player.landImpact * 0.3;
      tpc.fovBoost = THREE.MathUtils.damp(tpc.fovBoost, player.sprinting ? 7 : 0, 6, dt);
      tpc.update(dt, input, player.position, player.crouchAmount, player.collisionHandle);
      camera.updateMatrixWorld();
      player.model.root.updateMatrixWorld(true);
      if (deadT <= 0) combat.update(dt, input, input.aiming, player.airborne);
      if (deadT <= 0 && input.hit('KeyG')) throwGrenade();
      grenades.update(dt);
    }
    enemies.sync();
    if (pickups.update(dt, player.position, player.hp < 99.5 && deadT <= 0)) {
      player.heal();
      grenades.count = Math.min(grenades.count + 1, 5);
      sfx.pickup();
      hud.showToast('+ BOTIQUÍN   + GRANADA');
    }
    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    const camRight = new THREE.Vector3(-camFwd.z, 0, camFwd.x);
    const threats: Threat[] = [];
    for (const e of enemies.list) {
      if (!e.alive) continue;
      const d = e.position.clone().sub(player.position).setY(0);
      const dist = d.length();
      if (dist > 130) continue;
      threats.push({ angle: Math.atan2(d.dot(camRight), d.dot(camFwd)), dist, aware: e.state !== 'patrol' });
    }
    threatGrid.update(dt, threats);
    damageFx.update(dt, player.hp / 100);
    hud.enemies = enemies.aliveCount;
    range.update(dt);
    const g = combat.gun;
    const cone = THREE.MathUtils.degToRad(g.coneDeg(input.aiming, player.speed, player.airborne));
    hud.update(dt, {
      spreadPx: (Math.tan(cone) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * innerHeight * 0.5,
      ammo: g.ammo, mag: g.def.magazine, reserve: g.reserve, mode: g.mode, weapon: g.def.name,
      hp: player.hp, cap: player.regenCap, grenades: grenades.count, zoom: tpc.zoom, stamina: player.stamina, reload: g.reloadProgress, aiming: input.aiming,
    });
    if (!shotMode) dynRes.update(dt);
    camera.updateMatrixWorld();
    grass.update(t, camera.position, player.position);
    terrain.update(camera.position);
    lighting.update();
    if (!skipRender) renderer.render(dt);
    input.endFrame();
    frames++;
    acc += dt;
    if (acc > 0.5) {
      stats.textContent = `${Math.round(frames / acc)} fps · ${quality} · res ${Math.round(dynRes.scale * 100)}% · ${renderer.gl.info.render.calls} draws · ${(renderer.gl.info.render.triangles / 1e6).toFixed(2)}M tris · ${gpu}`;
      frames = acc = 0;
    }
  };
  if (!shotMode) renderer.gl.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 1 / 20)));
}

boot().catch((e) => {
  status.textContent = `Error: ${e instanceof Error ? e.message : e}`;
  console.error(e);
});
