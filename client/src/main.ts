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
import { Hud } from './ui/hud';
import { DynamicResolution } from './render/dynamicRes';

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
  const range = new ShootingRange(hf, lighting, world, ch.spawn, ch.range ?? [], (h) => {
    combat.sparkBurst(h.point, h.normal);
    sfx.steelPing(h.point.distanceTo(camera.position));
    sfx.hitmarker(h.kill);
    hud.hitmarker(h.kill, h.headshot);
  });
  scene.add(range.group);
  scene.add(buildStructures(hf, lighting, world, ch.spawn, ch.structures ?? []));
  player.onMantle = () => sfx.footstep(1.3);
  const dynRes = new DynamicResolution(renderer);
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

  status.textContent = 'Clic para jugar';
  overlay.addEventListener('click', () => {
    mixer.resume();
    input.lock();
  });
  document.addEventListener('pointerlockchange', () => overlay.classList.toggle('hidden', document.pointerLockElement === canvas));

  const gpu = gpuName.replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 60);
  let lastStep = 0, landed = false;
  const clock = new THREE.Clock();
  let frames = 0, acc = 0;
  renderer.gl.info.autoReset = false;
  const frame = (dt: number) => {
    const t = clock.elapsedTime;
    renderer.gl.info.reset();
    if (!freeCam) {
      player.update(dt, input, tpc.yaw, input.aiming, tpc.pitch, input.firing);
      world.timestep = dt;
      world.step();
      player.syncPosition();
      const moveK = Math.min(player.speed / 6, 1);
      const amp = (0.012 + 0.02 * moveK) * moveK * (input.aiming ? 0.3 : 1);
      const stepWave = Math.abs(Math.sin(player.stepPhase * Math.PI));
      tpc.bob = THREE.MathUtils.damp(tpc.bob, (stepWave - 0.6) * amp - (player.sprinting ? 0.05 : moveK * 0.02), 25, dt);
      tpc.sway = THREE.MathUtils.damp(tpc.sway, Math.sin(player.stepPhase * Math.PI) * amp * 0.5, 20, dt);
      const step = Math.floor(player.stepPhase);
      if (step !== lastStep && player.speed > 0.8 && !player.airborne) sfx.footstep(Math.min(1, player.speed / 6) * (player.crouchAmount > 0.5 ? 0.4 : 1));
      lastStep = step;
      if (player.landImpact > 0.6 && !landed) sfx.footstep(1.6);
      landed = player.landImpact > 0.6;
      tpc.dip = player.landImpact * 0.3;
      tpc.fovBoost = THREE.MathUtils.damp(tpc.fovBoost, player.sprinting ? 7 : 0, 6, dt);
      tpc.update(dt, input, player.position, player.crouchAmount, player.collisionHandle);
      camera.updateMatrixWorld();
      player.model.root.updateMatrixWorld(true);
      combat.update(dt, input, input.aiming, player.airborne);
    }
    range.update(dt);
    const g = combat.gun;
    const cone = THREE.MathUtils.degToRad(g.coneDeg(input.aiming, player.speed, player.airborne));
    hud.update(dt, {
      spreadPx: (Math.tan(cone) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * innerHeight * 0.5,
      ammo: g.ammo, mag: g.def.magazine, reserve: g.reserve, mode: g.mode, weapon: g.def.name,
      hp: 100, stamina: player.stamina, reload: g.reloadProgress, aiming: input.aiming,
    });
    if (!shotMode) dynRes.update(dt);
    camera.updateMatrixWorld();
    grass.update(t, camera.position, player.position);
    terrain.update(camera.position);
    lighting.update();
    renderer.render(dt);
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
