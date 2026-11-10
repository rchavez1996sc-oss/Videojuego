import * as THREE from 'three';
import { placeMenuBoards } from '../world/menuBoards';
import { placeKiosks } from '../world/kiosks';
import { mulberry32 } from '../core/rng';
import { placeMurals } from '../world/wallMurals';
import { addModel, placeModels, scatterModels } from '../world/staticModels';
import RAPIER from '@dimforge/rapier3d-compat';
import { Civilians } from './civilians';
import { CityLife } from './cityLife';
import type { ChapterDef } from '../data/types';
import type { Barrio } from '../world/barrio';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import type { Mixer } from '../audio/mixer';
import type { Sfx } from '../audio/sfx';
import type { Combat } from '../weapons/combat';
import type { Hud } from '../ui/hud';
import { difficulty } from '../core/difficulty';
import { blame } from './blame';
import { litter } from '../world/litter';
import { groundDetail } from '../world/groundDetail';
import { streetSigns } from '../world/streetSigns';
import { buildPintas } from '../world/pintas';
import { roadAt } from '../world/groundStrips';
import { LooseProps } from '../fx/looseProps';
import { parkedCars } from '../world/parkedCars';
import { laundryMesh } from '../world/laundryWind';

/** Pedestrians plus city life (traffic, strays, birds, ambience) and the shared "something scary happened" alarm. */
export function createPopulace(ch: ChapterDef, barrio: Barrio | null, d: { world: RAPIER.World; hf: Heightfield; lighting: Lighting; mixer: Mixer; sfx: Sfx; combat: Combat; hud: Hud; camera: THREE.Camera; scene: THREE.Scene }) {
  const civilians = barrio && ch.civilians ? new Civilians(barrio.graph, d.hf, d.lighting, d.world, ch.civilians.count, ch.civilians.seed, d.camera, ch.civilians.gear, ch.civilians.vendors) : null;
  const life = barrio && ch.life ? new CityLife(ch.life, d.world, d.hf, barrio, d.lighting, d.mixer, d.camera) : null;
  if (barrio && ch.litter) d.scene.add(litter(barrio.graph, d.world, ch.litter, d.lighting));
  if (barrio && ch.groundDetail) d.scene.add(groundDetail(barrio.graph, d.world, ch.groundDetail, d.lighting, (x, z) => d.hf.maskAt(x, z, 0) > 0.5 || d.hf.isPaved(z)));
  if (barrio) {
    parkedCars.build(d.lighting, d.world, barrio);
    d.scene.add(parkedCars.group);
    parkedCars.tick(0, d.camera.position, true);
    const tick = barrio.tick;
    barrio.tick = (dt, movers) => (tick?.(dt, movers), parkedCars.tick(dt, d.camera.position));
  }
  const props = barrio && ch.looseProps ? new LooseProps(barrio.graph, d.world, d.lighting, ch.looseProps, d.sfx, d.camera) : null;
  if (props) d.scene.add(props.group);
  const clothes = laundryMesh(d.lighting);
  if (clothes) d.scene.add(clothes);
  const pintas = buildPintas(d.lighting);
  if (pintas) d.scene.add(pintas);
  if (barrio && ch.streetNames) d.scene.add(streetSigns(barrio.graph, d.world, d.lighting, ch.streetNames, (x, z) => d.hf.maskAt(x, z, 0) > 0.5 || d.hf.isPaved(z) || roadAt(x, z), ch.streetSignArea));
  placeMenuBoards(d.scene, d.lighting, d.hf).catch((e) => console.error('menu boards', e));
  placeKiosks(d.scene, d.lighting).catch((e) => console.error('kiosks', e));
  for (const m of ch.models ?? []) addModel(m);
  if (barrio && ch.modelScatter) scatterModels(barrio.graph, d.world, ch.modelScatter, mulberry32(77), (x, z) => barrio.graph.ground?.(x, z) ?? d.hf.heightAt(x, z), (x, z) => d.hf.maskAt(x, z, 0) > 0.5 || d.hf.isPaved(z) || roadAt(x, z));
  placeModels(d.scene, d.lighting, d.world, d.hf).catch((e) => console.error('models', e));
  placeMurals(d.scene, d.lighting, d.world).catch((e) => console.error('murals', e));
  const state = { casualties: 0, onFail: () => {} };
  const casualty = (weight = 1) => {
    if (!blame.player) return;
    state.casualties += weight;
    const limit = ch.civilianLimit === 0 ? Infinity : ch.civilianLimit ?? difficulty.value.civilianLimit;
    d.hud.civilians = { count: state.casualties, limit };
    if (state.casualties >= limit) state.onFail();
  };
  const alarm = (p: THREE.Vector3, r: number) => {
    civilians?.alarm(p, r);
    barrio?.bystanders?.alarm?.(p, r);
    life?.alarm(p, r);
  };
  if (civilians) {
    d.scene.add(civilians.group);
    civilians.onHurt = () => {
      if (!blame.player) return;
      d.hud.showToast('CIVIL HERIDO');
      d.sfx.hurt();
      casualty();
    };
  }
  if (barrio?.bystanders) barrio.bystanders.onHurt = (p) => {
    alarm(p, 60);
    if (!blame.player) return;
    d.hud.showToast('CIVIL HERIDO');
    d.sfx.hurt();
    casualty();
  };
  if (life) {
    d.scene.add(life.group);
    const tr = life.trafficEvents;
    tr.onSmoke = (p, shade) => d.combat.smokePuff(p, shade);
    life.onDust = (p, tint) => d.combat.smokePuff(p, 0.4, tint);
    tr.onCrash = (p) => d.sfx.crash(p.distanceTo(d.camera.position));
    tr.onDisabled = (p, weight) => {
      if (!blame.player) return alarm(p, 80);
      d.hud.showToast(`VEHÍCULO CIVIL   ${weight} BAJA${weight > 1 ? 'S' : ''}`);
      alarm(p, 80);
      casualty(weight);
    };
  }
  return { civilians, life, alarm, state, props };
}
