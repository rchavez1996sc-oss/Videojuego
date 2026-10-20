import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import ch01 from './data/chapters/ch01_lima.json';
import ch02 from './data/chapters/ch02_aldea.json';
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
import { Hud } from './ui/hud';
import { DynamicResolution } from './render/dynamicRes';
import enemyDefs from './data/enemies.json';
import type { EnemyDef } from './entities/enemy';
import { Enemies } from './systems/enemies';
import { DamageFx } from './ui/damage';
import { Pickups } from './systems/pickups';
import { findRespawn } from './systems/respawn';
import { Grenades } from './weapons/grenades';
import { detonate, BLAST_RADIUS } from './weapons/explosion';
import { ThreatGrid } from './ui/threatGrid';
import { DIFFICULTIES, difficulty, type DifficultyId } from './core/difficulty';
import { installDebug } from './core/debug';
import { buildBarrio } from './world/barrio';
import { buildFarCity } from './world/farCity';
import { createPopulace } from './systems/populace';
import { gatherThreats, surfaceUnder } from './systems/sensing';

const CHAPTERS: Record<string, unknown> = { '1': ch01, '2': ch02 };

const status = document.getElementById('status')!;
const overlay = document.getElementById('overlay')!;
const stats = document.getElementById('stats')!;
const step = (msg: string) => new Promise<void>((r) => { status.textContent = msg; requestAnimationFrame(() => r()); });

async function boot(): Promise<void> {
  if (shotMode) document.body.classList.add('shot');
  const ch = (CHAPTERS[new URLSearchParams(location.search).get('ch') ?? '1'] ?? ch01) as ChapterDef;
  document.querySelector('#overlay .sub')!.textContent = `Capítulo ${ch.number ?? 1} — ${ch.title}`;
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
  await step('Levantando las construcciones…');
  const blockers: ((x: number, z: number) => boolean)[] = [];
  if (ch.village) {
    const village = buildVillage(hf, ch.village, ch.terrain, lighting, world);
    scene.add(village.group);
    blockers.push((x, z) => village.footprints.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + 2));
  }
  const barrio = ch.barrio ? buildBarrio(hf, ch.barrio, lighting, world) : null;
  if (barrio) {
    scene.add(barrio.group);
    blockers.push(barrio.blocked);
  }
  if (ch.farCity) scene.add(buildFarCity(hf, ch.farCity, lighting));
  if (shotMode) (window as unknown as { __scene: THREE.Scene }).__scene = scene;
  await step('Poblando el paisaje…');
  const nearBuilding = (x: number, z: number) => blockers.some((f) => f(x, z));
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
  const { civilians, life, alarm } = createPopulace(ch, barrio, { world, hf, lighting, mixer, sfx, combat, hud, camera, scene });
  combat.onShot = (p) => {
    enemies.hearShot(p);
    alarm(p, 90);
  };
  enemies.onEnemyShot = (p) => alarm(p, 60);
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
    detonate(at, { combat, sfx, tpc, enemies, player, world, playerAlive: deadT <= 0 });
    civilians?.explosion(at, BLAST_RADIUS);
    life?.alarm(at, 150);
    life?.explosion(at, BLAST_RADIUS);
  };
  enemies.onEnemyHit = (kill, headshot, at) => {
    if (kill && Math.random() < 0.15) pickups.spawn(at);
    sfx.hitmarker(kill);
    hud.hitmarker(kill, headshot, 'BAJA  +100');
    if (kill && enemies.aliveCount === 0) setTimeout(() => hud.showToast('ZONA DESPEJADA'), 1200);
  };
  world.step();

  let freeCam = false;
  installDebug({
    extraLog: () => (civilians ? `civ:${civilians.list.map((c) => c.mood[0]).join('')}` : ''),
    views: ch.views ?? [], tpc, hf, player, combat, enemies, grenades, renderer, shotMode,
    frame: (dt) => frame(dt),
    setFreeCam: (v) => (freeCam = v),
    setSkipRender: (v) => (skipRender = v),
    throwGrenade,
    hooks: {
      vehicleTest: () => {
        const tr = life?.trafficEvents;
        if (!tr) return 'no traffic';
        freeCam = false;
        skipRender = true;
        const hit = tr.debugDisableNearest(player.position);
        const log = [`disabled ${hit}`];
        for (let i = 0; i < 60; i++) {
          frame(1 / 20);
          if (i % 20 === 19) log.push(tr.debugStates);
        }
        skipRender = false;
        return log.join('\n');
      },
    },
  });

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
  const groundUnder = () => surfaceUnder(world, hf, player);
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
      civilians?.update(dt, player.position);
      life?.update(dt, player.position, enemies.list.some((e) => e.alive && e.state === 'combat'));
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
    const threats = gatherThreats(enemies, civilians, player.position, camera);
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
