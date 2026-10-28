import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import ch01 from './data/chapters/ch01_lima.json';
import ch02 from './data/chapters/ch02_malecon.json';
import ch03 from './data/chapters/ch03_sanmarcos.json';
import ch04 from './data/chapters/ch04_aldea.json';
import type { ChapterDef } from './data/types';
import { Input } from './core/input';
import { ThirdPersonCamera } from './core/camera';
import { preset, PRESETS, quality, shotMode, gpuName, savedChapter } from './core/settings';
import { guardFrame } from './core/guard';
import { FpsMeter } from './core/fpsMeter';
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
import { Pickups, collectSupplies } from './systems/pickups';
import { wireRoad } from './systems/roadHits';
import { respawnPlayer, streetPoints } from './systems/respawn';
import { startSpot } from './systems/startSpot';
import { Melee } from './systems/melee';
import { coverSeeker } from './systems/takeCover';
import { Grenades } from './weapons/grenades';
import { detonate } from './weapons/explosion';
import { Minimap } from './ui/minimap';
import { loadPhotoTextures, photoEnvironment } from './render/photoTextures';
import { installDebug } from './core/debug';
import { ShadowCull } from './render/shadowCull';
import { buildBarrio } from './world/barrio';
import { buildFarCity } from './world/farCity';
import { buildMalecon } from './world/malecon';
import { buildCampus } from './world/campus';
import { StreetNav } from './ai/nav';
import { cover } from './ai/cover';
import { createPopulace } from './systems/populace';
import { showMissionFailed } from './ui/missionFail';
import { setupStartMenu } from './ui/startMenu';
import { gatherThreats, surfaceUnder } from './systems/sensing';
import { createSquad, type AllyDef } from './systems/squad';
import { GrenadeMode } from './weapons/grenadeMode';
import { MoveFeel } from './core/moveFeel';
import { characters } from './render/characters';
import { Loot } from './systems/loot';
import { Objective } from './systems/objective';
import { Defense } from './systems/defense';
import { showMissionComplete } from './ui/missionComplete';
import { prologueQuiet, showPrologue } from './ui/prologue';
import { showLauncher } from './ui/launcher';
import { counting } from './ui/countdown';
import allyDef from './data/allies.json';

const CHAPTERS: Record<string, unknown> = { '1': ch01, '2': ch02, '3': ch03, '4': ch04 };
const status = document.getElementById('status')!;
const overlay = document.getElementById('overlay')!;
const stats = document.getElementById('stats')!;
const step = (msg: string) => prologueQuiet().then(() => new Promise<void>((r) => { status.textContent = msg; requestAnimationFrame(() => r()); }));

async function boot(): Promise<void> {
  if (shotMode) document.body.classList.add('shot');
  const asked = new URLSearchParams(location.search).get('ch') ?? savedChapter() ?? '1';
  const cards = (['1', '2', '3'] as const).map((id) => ({ id, number: (CHAPTERS[id] as ChapterDef).number ?? +id, title: (CHAPTERS[id] as ChapterDef).title }));
  const chId = shotMode ? asked : await showLauncher(cards, asked), ch = (CHAPTERS[chId] ?? ch01) as ChapterDef;
  document.querySelector('#overlay .sub')!.textContent = `Capítulo ${ch.number ?? 1} — ${ch.title}`;
  const prologue = shotMode ? Promise.resolve() : showPrologue(`CAPÍTULO ${ch.number ?? 1}`, ch.title.toUpperCase(), ch.intro ?? [], ch.introPlates, ch.introScore, true);
  await prologueQuiet().then(() => RAPIER.init());
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 4000);
  const renderer = new Renderer(canvas, scene, camera, ch.biome.exposure);
  const lighting = new Lighting(scene, camera, renderer.gl, ch.biome);

  await loadPhotoTextures();
  for (const env of [photoEnvironment()]) if (env) lighting.useEnvironment(env.texture, env.gain);
  await step('Generando terreno…');
  const hf = new Heightfield(ch.terrain);
  const terrain = new Terrain(hf, ch.biome, lighting, world);
  scene.add(terrain.group);
  await step('Levantando las construcciones…');
  await Promise.all(['64px "Permanent Marker"', '64px "Caveat Brush"'].map((f) => document.fonts.load(f))).catch(() => undefined);
  const blockers: ((x: number, z: number) => boolean)[] = [];
  if (ch.village) {
    const village = buildVillage(hf, ch.village, ch.terrain, lighting, world);
    scene.add(village.group);
    blockers.push((x, z) => village.footprints.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + 2));
  }
  const shadowCull = new ShadowCull(ch.shadowRange ?? 90);
  const barrio = ch.barrio ? buildBarrio(hf, ch.barrio, lighting, world) : ch.malecon ? buildMalecon(hf, ch.malecon, lighting, world) : ch.campus ? buildCampus(hf, ch.campus, lighting, world) : null;
  if (barrio) {
    scene.add(barrio.group);
    shadowCull.add(barrio.group);
    blockers.push(barrio.blocked);
  }
  if (ch.farCity) scene.add(buildFarCity(hf, ch.farCity, lighting));
  if (shotMode) (window as unknown as { __scene: THREE.Scene }).__scene = scene;
  await step('Poblando el paisaje…');
  const nearBuilding = (x: number, z: number) => blockers.some((f) => f(x, z));
  scene.add(buildScatter(hf, lighting, world, ch.scatter, nearBuilding));
  const grass = new Grass(hf, ch.biome, lighting, preset.grassBlades, Math.max(preset.grassBlades, PRESETS.high.grassBlades));
  scene.add(grass.mesh);
  const minimap = new Minimap(renderer.gl, scene, ch.terrain.playable, ['asphalt', 'asphaltWorn'].flatMap((k) => barrio?.materials[k] ?? []), ch.barrio && barrio ? { ...barrio.graph, width: ch.barrio.street } : undefined);

  await step('Cargando personajes…');
  await characters.load(lighting);
  world.step();
  const respawnPts = barrio ? streetPoints(barrio.graph) : undefined;
  const startGoal = ch.objective?.capture ?? barrio?.station?.entrance ?? barrio?.refuge?.[0];
  const start = respawnPts && startGoal && !shotMode ? startSpot(world, hf, respawnPts, startGoal, ch.enemies ?? [], barrio!.inside, ch.defense?.startDistance) : null;
  const spawn = start?.pos ?? new THREE.Vector3(ch.spawn.x, hf.heightAt(ch.spawn.x, ch.spawn.z), ch.spawn.z), startYaw = start?.yaw ?? ch.spawn.yaw;
  const wdef = (weapons as unknown as Record<string, WeaponDef>)[ch.weapon ?? 'ak'], player = new Player(world, lighting, spawn, startYaw, wdef.model);
  scene.add(player.model.root);
  const input = new Input(canvas);
  const tpc = new ThirdPersonCamera(camera, world, startYaw);
  const mixer = new Mixer(), sfx = new Sfx(mixer, wdef.light), hud = new Hud();
  const combat = new Combat(wdef, world, player, tpc, sfx, lighting, hf);
  scene.add(combat.group);
  const rangeOrigin = { ...ch.spawn, yaw: ch.rangeYaw ?? ch.spawn.yaw };
  const range = new ShootingRange(hf, lighting, world, rangeOrigin, ch.range ?? [], (h) => {
    combat.sparkBurst(h.point, h.normal);
    sfx.steelPing(h.point.distanceTo(camera.position));
    sfx.hitmarker(h.kill);
    hud.hitmarker(h.kill, h.headshot);
  });
  scene.add(range.group, buildStructures(hf, lighting, world, rangeOrigin, ch.structures ?? []));
  player.onMantle = () => sfx.footstep(1.3, 'hard');
  const dynRes = new DynamicResolution(renderer), damageFx = new DamageFx((k) => (sfx.thud(k), tpc.kick(0, 0, 0.12 + 0.2 * k)));
  const nav = barrio ? new StreetNav(barrio.graph) : null;
  world.step();
  const enemies = new Enemies(Object.fromEntries(Object.entries(enemyDefs as unknown as Record<string, EnemyDef>).map(([k, d]) => [k, { ...d, hp: Math.round(d.hp * (ch.enemyHealth ?? 1)) }])), ch.enemies ?? [], world, hf, lighting, player, combat, sfx, camera, nav, ch.enemyNear);
  scene.add(enemies.group);
  const { civilians, life, alarm, state: populace } = createPopulace(ch, barrio, { world, hf, lighting, mixer, sfx, combat, hud, camera, scene });
  let failed = false;
  populace.onFail = () => window.setTimeout(() => {
    if (!failed) showMissionFailed('El FLS no dispara contra su propio pueblo. Demasiadas bajas civiles: la gente del barrio ya no confía en ustedes.');
    failed = true;
  }, 2600);
  combat.onShot = (p) => {
    enemies.hearShot(p, ch.alertAll);
    alarm(p, 90);
  };
  enemies.onEnemyShot = (p) => alarm(p, 60);
  const squad = createSquad(ch.squad ?? 0, { ...(allyDef as unknown as AllyDef), gun: wdef.model }, { world, hf, lighting, player, enemies, combat, sfx, hud, camera, nav, alarm }, spawn, startYaw);
  if (squad) scene.add(squad.group);
  if (life) wireRoad(life.trafficEvents, { player, enemies, squad, playerHit: (dmg, from) => enemies.onPlayerHit(dmg, from), alive: () => deadT <= 0 });
  const deathPos = new THREE.Vector3(); let deadT = 0, skipRender = false, shieldT = 0;
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
  const pickups = new Pickups(lighting, hf, ch.medkits ?? [], ch.ammo ?? []);
  const grenades = new Grenades(world, hf, lighting, () => player.collisionHandle);
  grenades.onSettled = (at) => enemies.fleeFrom(at);
  const nadeMode = new GrenadeMode(grenades, world, camera, player, sfx, hud);
  scene.add(pickups.group, grenades.group, nadeMode.group);
  const corpses = new Loot(pickups, (at) => combat.bloodStain(at));
  const objective = ch.objective && barrio?.station ? new Objective(ch.objective, barrio.station, camera, { lighting, world, scene, mixer, cinematic: (eye, look) => (freeCam = true, tpc.place(eye, look)) }) : null;
  let lives = (hud.lives = ch.lives ?? 3);
  const defense = ch.defense && barrio?.refuge ? new Defense(ch.defense, { scene, world, lighting, enemies, sfx, camera, refuge: barrio.refuge, blast: (at) => blast(at) }) : null;
  const goal = objective ?? defense, lose = (why: string) => !failed && window.setTimeout(() => !failed && ((failed = true), showMissionFailed(why)), 4200);
  if (goal) (goal.onFail = lose), (goal.onComplete = () => {
    failed = true;
    const g = (objective?.def ?? defense!.def) as { complete: string; reward: string; loot?: string[]; unlock?: string };
    showMissionComplete(g.complete, g.reward, `ENEMIGOS ABATIDOS ${enemies.list.length - enemies.aliveCount}/${enemies.list.length} · ${defense ? `ESTUDIANTES CAÍDOS ${defense.students.lost}` : `BAJAS CIVILES ${populace.casualties}`} · VIDAS ${lives}`, g.loot, g.unlock, ch.next);
  });
  const blast = (at: THREE.Vector3) => (life?.alarm(at, 150), detonate(at, { combat, sfx, tpc, enemies, player, world, playerAlive: deadT <= 0, also: [civilians, squad, life, defense?.students] }));
  grenades.onExplode = blast;
  enemies.onEnemyHit = (kill, headshot) => {
    sfx.hitmarker(kill);
    hud.hitmarker(kill, headshot, 'BAJA');
    if (kill && enemies.aliveCount === 0 && !defense) setTimeout(() => hud.showToast('ZONA DESPEJADA'), 1200);
  };
  world.step();
  cover.prune(world, (x, z) => hf.heightAt(x, z));

  let freeCam = false;
  installDebug({
    extraLog: () => (civilians ? `civ:${civilians.list.map((c) => c.mood[0]).join('')}` : ''),
    views: ch.views ?? [], tpc, hf, player, combat, enemies, grenades, pickups, renderer, shotMode, scene, squad, grenadeMode: nadeMode, objective, civilians: () => civilians?.present ?? [], world,
    frame: (dt) => frame(dt),
    setFreeCam: (v) => (freeCam = v),
    setSkipRender: (v) => (skipRender = v),
    throwGrenade: () => nadeMode.throwNow(),
    traffic: () => life?.trafficEvents,
  });

  setupStartMenu(overlay, status, canvas, () => !failed && (mixer.resume(), input.lock()), { chapters: cards, current: chId });

  const gpu = gpuName.replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 60);
  const melee = new Melee(player, enemies, sfx, tpc);
  const seekCover = coverSeeker({ world, cover, hf, player, enemies, camera, hud });
  const feel = new MoveFeel(player, tpc, sfx, () => surfaceUnder(world, hf, player));
  const clock = new THREE.Clock();
  const fps = new FpsMeter(stats);
  renderer.gl.info.autoReset = false;
  const frame = (dt: number) => {
    const t = clock.elapsedTime;
    renderer.gl.info.reset();
    if (!freeCam) {
      if (deadT > 0) {
        deadT -= dt;
        player.model.animate(dt, 0, 0, 0);
        damageFx.cut = deadT < 0.45;
        if (deadT <= 0) {
          damageFx.dead = damageFx.cut = false;
          shieldT = 3;
          respawnPlayer({ world, hf, enemies, player, tpc, squad, death: deathPos, spawn: ch.spawn, streets: respawnPts });
        }
      } else {
        if (input.hit('KeyQ')) seekCover();
        player.update(dt, input, tpc.yaw, input.aiming, tpc.pitch, input.firing);
        player.regen(dt);
        shieldT = Math.max(0, shieldT - dt);
        if (player.hp <= 0) {
          hud.lives = --lives;
          if (lives <= 0) {
            window.setTimeout(() => (failed = true), 2600);
            window.setTimeout(() => showMissionFailed('', 'VIDAS AGOTADAS'), 2600);
          }
          deadT = 4.5;
          deathPos.copy(player.position);
          damageFx.dead = true;
          player.die();
        }
      }
      enemies.update(dt);
      squad?.update(dt, tpc.yaw, input.down('KeyE'), deadT <= 0);
      civilians?.update(dt, player.position);
      const inCombat = enemies.list.some((e) => e.alive && e.state === 'combat');
      life?.update(dt, player.position, inCombat);
      world.timestep = dt;
      world.step();
      player.syncPosition();
      feel.update(dt, input);
      tpc.update(dt, input, player.position, player.crouchAmount, player.collisionHandle);
      camera.updateMatrixWorld();
      player.model.root.updateMatrixWorld(true);
      if (!nadeMode.update(input, deadT <= 0) && deadT <= 0 && !melee.update(dt, input)) combat.update(dt, input, input.aiming, player.airborne); else combat.fx(dt);
      grenades.update(dt);
    }
    enemies.sync();
    squad?.sync();
    barrio?.tick?.(dt, [player.position, ...enemies.list.filter((e) => e.alive).map((e) => e.position), ...(squad?.positions ?? []), ...(civilians?.present ?? [])]);
    collectSupplies(dt, pickups, { player, gun: combat.gun, grenades, sfx, hud, alive: deadT <= 0 });
    objective?.update(dt, player.position, enemies.list, input, deadT <= 0);
    defense?.update(dt, player.position, input, deadT <= 0);
    corpses.update(dt, { dead: enemies.list.filter((e) => !e.alive), fallen: squad?.fallen ?? [] });
    const threats = gatherThreats(enemies, civilians, pickups.markers, player.position, camera, squad?.positions, objective?.position ?? defense?.goal);
    minimap.update(player.position, tpc.yaw, threats);
    damageFx.update(dt, player.hp / 100);
    hud.enemies = enemies.aliveCount;
    range.update(dt);
    const g = combat.gun;
    const cone = THREE.MathUtils.degToRad(g.coneDeg(input.aiming, player.speed, player.airborne) * tpc.steady);
    hud.update(dt, {
      spreadPx: (Math.tan(cone) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * innerHeight * 0.5,
      ammo: g.ammo, mag: g.def.magazine, reserve: g.reserve, carry: g.carry, mode: g.mode, weapon: g.def.name, slotLabel: g.def.slot,
      hp: player.hp, cap: player.regenCap, grenades: grenades.count, zoom: tpc.zoom, stamina: player.stamina, reload: g.reloadProgress, reloadHold: combat.reloadHold, aiming: input.aiming, slot: nadeMode.equipped ? 'grenade' : 'rifle',
    });
    if (!shotMode) dynRes.update(dt);
    camera.updateMatrixWorld();
    grass.update(t, camera.position, player.position);
    terrain.update(camera.position);
    shadowCull.update(dt, camera.position);
    lighting.update(camera);
    if (!skipRender) renderer.render(dt);
    input.endFrame();
    fps.update(dt, (n) => `${n} fps · ${quality} · res ${Math.round(dynRes.scale * 100)}% · ${renderer.gl.info.render.calls} draws · ${(renderer.gl.info.render.triangles / 1e6).toFixed(2)}M tris · ${gpu}${stats.dataset.errors ? ` · err ${stats.dataset.errors}` : ''}`);
  };
  const safeFrame = guardFrame(() => (document.pointerLockElement === canvas && !counting ? frame(Math.min(clock.getDelta(), 1 / 20)) : (clock.getDelta(), renderer.render(0))), (n) => stats.dataset.errors = String(n));
  if (!shotMode) void prologue.then(() => renderer.gl.setAnimationLoop(() => !failed && safeFrame()));
}

boot().catch((e) => {
  status.textContent = `Error: ${e instanceof Error ? e.message : e}`;
  console.error(e);
});
