import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Traffic, Victim } from './traffic';
import type { Player } from '../entities/player';
import type { Enemies } from './enemies';
import type { Squad } from './squad';
import { innocents } from './blame';
import { hitHandler } from '../world/surfaces';

/**
 * Who traffic brakes for and who a vehicle can run into: player, squad, police and every civilian or extra whose
 * collider is live (followed by position, not by a physics query, so nobody slips through). Built once per frame.
 */
export function wireRoad(traffic: Traffic, d: { world: RAPIER.World; player: Player; enemies: Enemies; squad: Squad | null; playerHit: (dmg: number, from: THREE.Vector3) => void; alive: () => boolean }): void {
  const { player, enemies, squad, world } = d;
  traffic.obstacles = () => [...(squad?.positions ?? []), ...enemies.list.filter((e) => e.alive && e.state === 'patrol').map((e) => e.position)];
  traffic.victims = () => {
    const out: Victim[] = [];
    if (d.alive()) out.push({ key: 'p', kind: 'player', pos: player.position, alive: () => true, hurt: (dmg, from, shove) => { d.playerHit(dmg, from); player.shove(shove); } });
    for (const e of enemies.list) if (e.alive) out.push({ key: `e${e.id}`, kind: 'police', pos: e.position, alive: () => e.alive, hurt: (dmg, from, shove) => enemies.runOver(e, dmg, from, shove) });
    for (const a of squad?.list ?? []) if (a.unit.alive) out.push({ key: `a${a.unit.id}`, kind: 'ally', pos: a.unit.position, alive: () => a.unit.alive, hurt: (dmg, from) => squad!.hurt(a, dmg, from) });
    for (const h of innocents) {
      const c = world.getCollider(h);
      if (!c || !c.isEnabled()) continue;
      const t = c.translation(), pos = new THREE.Vector3(t.x, t.y - 0.9, t.z);
      let dead = false;
      out.push({ key: `c${h}`, kind: 'civilian', pos, alive: () => !dead && c.isEnabled(), hurt: (dmg) => ((dead = true), hitHandler(h)?.(dmg, pos.clone().setY(t.y))) });
    }
    return out;
  };
}
