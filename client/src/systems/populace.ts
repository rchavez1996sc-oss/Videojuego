import * as THREE from 'three';
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

/** Pedestrians plus city life (traffic, strays, birds, ambience) and the shared "something scary happened" alarm. */
export function createPopulace(ch: ChapterDef, barrio: Barrio | null, d: { world: RAPIER.World; hf: Heightfield; lighting: Lighting; mixer: Mixer; sfx: Sfx; combat: Combat; hud: Hud; camera: THREE.Camera; scene: THREE.Scene }) {
  const civilians = barrio && ch.civilians ? new Civilians(barrio.graph, d.hf, d.lighting, d.world, ch.civilians.count, ch.civilians.seed, d.camera, ch.civilians.gear) : null;
  const life = barrio && ch.life ? new CityLife(ch.life, d.world, d.hf, barrio, d.lighting, d.mixer, d.camera) : null;
  const state = { casualties: 0, onFail: () => {} };
  const casualty = (weight = 1) => {
    if (!blame.player) return;
    state.casualties += weight;
    d.hud.civilians = { count: state.casualties, limit: difficulty.value.civilianLimit };
    if (state.casualties >= difficulty.value.civilianLimit) state.onFail();
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
    tr.onSmoke = (p) => d.combat.smokePuff(p);
    tr.onCrash = (p) => d.sfx.crash(p.distanceTo(d.camera.position));
    tr.onDisabled = (p, weight) => {
      if (!blame.player) return alarm(p, 80);
      d.hud.showToast(`VEHÍCULO CIVIL   ${weight} BAJA${weight > 1 ? 'S' : ''}`);
      alarm(p, 80);
      casualty(weight);
    };
  }
  return { civilians, life, alarm, state };
}
