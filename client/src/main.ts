import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import chapter from './data/chapters/ch01.json';
import type { ChapterDef } from './data/types';
import { Input } from './core/input';
import { ThirdPersonCamera } from './core/camera';
import { preset, shotMode } from './core/settings';
import { Renderer } from './render/renderer';
import { Lighting } from './render/lighting';
import { Heightfield } from './world/heightfield';
import { Terrain } from './world/terrain';
import { Grass } from './world/grass';
import { buildScatter } from './world/scatter';
import { buildVillage } from './world/village';
import { Player } from './entities/player';

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
  world.step();

  let freeCam = false;
  const views: [number, number, number, number, number, number][] = [
    [-128, 2.2, -28, 0, 3, 10],
    [-60, 38, 90, 15, 2, -20],
    [44, 1.7, 13.5, 0, 3, 2],
    [-117.6, 1.9, -31.8, -120.5, 1.1, -35.5],
  ];
  (window as unknown as { __game: object }).__game = {
    setView(i: number) {
      freeCam = true;
      const [x, dy, z, lx, ldy, lz] = views[i];
      tpc.place(new THREE.Vector3(x, hf.heightAt(x, z) + dy, z), new THREE.Vector3(lx, hf.heightAt(lx, lz) + ldy, lz));
      if (shotMode) frame(1 / 60);
    },
    follow() { freeCam = false; },
    info: () => ({ calls: renderer.gl.info.render.calls, tris: renderer.gl.info.render.triangles }),
    ready: true,
  };

  status.textContent = 'Clic para jugar';
  overlay.addEventListener('click', () => input.lock());
  document.addEventListener('pointerlockchange', () => overlay.classList.toggle('hidden', document.pointerLockElement === canvas));

  const clock = new THREE.Clock();
  let frames = 0, acc = 0;
  renderer.gl.info.autoReset = false;
  const frame = (dt: number) => {
    const t = clock.elapsedTime;
    renderer.gl.info.reset();
    if (!freeCam) {
      player.update(dt, input, tpc.yaw, input.aiming, tpc.pitch);
      world.timestep = dt;
      world.step();
      player.syncPosition();
      tpc.update(dt, input, player.position, player.crouchAmount, player.collisionHandle);
    }
    camera.updateMatrixWorld();
    grass.update(t, camera.position);
    terrain.update(camera.position);
    lighting.update();
    renderer.render(dt);
    input.endFrame();
    frames++;
    acc += dt;
    if (acc > 0.5) {
      stats.textContent = `${Math.round(frames / acc)} fps · ${renderer.gl.info.render.calls} draws · ${(renderer.gl.info.render.triangles / 1e6).toFixed(2)}M tris`;
      frames = acc = 0;
    }
  };
  if (!shotMode) renderer.gl.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 1 / 20)));
}

boot().catch((e) => {
  status.textContent = `Error: ${e instanceof Error ? e.message : e}`;
  console.error(e);
});
