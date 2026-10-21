import * as THREE from 'three';
import type { Traffic, Victim } from './traffic';
import type { Player } from '../entities/player';
import type { Enemies } from './enemies';
import type { Squad } from './squad';

/** Who traffic brakes for and who it can run over (only people near the avenue are checked). */
export function wireRoad(traffic: Traffic, d: { player: Player; enemies: Enemies; squad: Squad | null; playerHit: (dmg: number, from: THREE.Vector3) => void; alive: () => boolean }): void {
  const { player, enemies, squad } = d;
  traffic.obstacles = () => squad?.positions ?? [];
  traffic.victims = () => {
    const out: Victim[] = [];
    if (d.alive()) out.push({ key: 'p', pos: player.position, hurt: (dmg, from, shove) => { d.playerHit(dmg, from); player.shove(shove); } });
    for (const e of enemies.list) {
      if (e.alive && Math.abs(e.position.z) < 9) out.push({ key: `e${e.id}`, pos: e.position, hurt: (dmg, from) => enemies.runOver(e, dmg, from) });
    }
    for (const a of squad?.list ?? []) {
      if (a.unit.alive && Math.abs(a.unit.position.z) < 9) out.push({ key: `a${a.unit.id}`, pos: a.unit.position, hurt: (dmg, from) => squad!.hurt(a, dmg, from) });
    }
    return out;
  };
}
