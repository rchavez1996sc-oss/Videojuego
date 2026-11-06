import * as THREE from 'three';
import type { DebugContext } from './debug';

/** Test hooks for weapon handling: reload frames and grenade flight traces. */
export function animDebug(c: DebugContext) {
  const frameOn = (side: number, dist: number, h = 1.3) => {
    const p = c.player.position, yaw = c.player.yaw + side;
    c.setFreeCam(true);
    c.tpc.place(p.clone().add(new THREE.Vector3(-Math.sin(yaw) * dist, h + 0.2, -Math.cos(yaw) * dist)), p.clone().setY(p.y + h));
    c.frame(1 / 60);
  };
  return {
    /** Empties the magazine, plays the reload up to `progress` (0..1) and frames the player from `side`. */
    reloadAt(progress: number, side = 1.2, dist = 3) {
      c.setFreeCam(false);
      const g = c.combat.gun;
      g.ammo = 0;
      for (let i = 0; i < 4 && g.reloading <= 0; i++) c.frame(1 / 30);
      const total = g.reloading;
      while (g.reloading > 0 && 1 - g.reloading / total < progress) c.frame(1 / 30);
      frameOn(side, dist);
      return `total ${total.toFixed(2)} at ${(1 - g.reloading / total).toFixed(2)}`;
    },
    /** Throws along the view at `pitch` and samples the grenade every 0.1 s until it explodes. */
    nadeTrace(pitch = 0) {
      c.setFreeCam(false);
      c.setSkipRender(true);
      c.tpc.pitch = pitch;
      c.grenades.count = 3;
      c.frame(1 / 30);
      const g = c.grenades.group, out: string[] = [];
      c.throwGrenade();
      for (let t = 0; t < 4.2 && g.children.length; t += 1 / 30) {
        c.frame(1 / 30);
        if (Math.round(t * 30) % 3 === 0 && g.children[0]) out.push(g.children[0].position.toArray().map((v) => v.toFixed(2)).join(','));
      }
      c.setSkipRender(false);
      return out.join(' | ');
    },
  };
}
