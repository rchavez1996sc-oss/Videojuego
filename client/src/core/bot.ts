import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { DebugContext } from './debug';

const key = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const fmt = (v: THREE.Vector3) => `${v.x.toFixed(0)},${v.y.toFixed(1)},${v.z.toFixed(0)}`;

/**
 * Autopilot playtest: walks the street graph towards the current goal (objective, defense goal, else the nearest
 * policeman), stops to shoot policemen it can see within 70 m, holds E at the goal, jumps when stuck. Returns a log
 * with periodic status lines and anomalies: deaths, stuck spots, falls below the terrain, unreachable goals.
 */
export function playBot(c: DebugContext, seconds: number, extra: () => string = () => ''): string {
  const dt = 1 / 30, log: string[] = [], anomalies: string[] = [];
  let route: THREE.Vector3[] = [], wp = 0, replan = 0, stuckT = 0, jumps = 0, last = c.player.position.clone();
  let deaths = 0, wasDead = false, shots = 0, holdE = 0;
  const held = new Set<string>();
  const hold = (code: string, on: boolean) => {
    if (on === held.has(code)) return;
    on ? held.add(code) : held.delete(code);
    key(code, on);
  };
  c.setFreeCam(false);
  c.setSkipRender(true);
  const eye = new THREE.Vector3(), chest = new THREE.Vector3();
  for (let i = 0; i < seconds / dt; i++) {
    const p = c.player.position, t = i * dt;
    if (c.player.hp <= 0) {
      if (!wasDead) (deaths++, anomalies.push(`t=${t.toFixed(0)} DEATH @${fmt(p)}`));
      wasDead = true;
      for (const k of [...held]) hold(k, false);
      c.frame(dt);
      continue;
    }
    if (wasDead) (wasDead = false, (route = []));
    if (p.y < c.hf.heightAt(p.x, p.z) - 3) anomalies.push(`t=${t.toFixed(0)} UNDER TERRAIN @${fmt(p)}`);
    eye.copy(p).setY(p.y + 1.5);
    let foe = null, best = 70;
    for (const e of c.enemies.list) {
      if (!e.alive) continue;
      chest.copy(e.position).setY(e.position.y + 1.2);
      const d = chest.distanceTo(eye);
      if (d > best) continue;
      const dir = chest.clone().sub(eye).normalize();
      const hit = c.world!.castRay(new RAPIER.Ray(eye, dir), d - 0.6, true, undefined, undefined, undefined, undefined, (col) => col.handle !== c.player.collisionHandle && col.handle !== e.handle);
      if (!hit) (foe = e), (best = d);
    }
    if (foe) {
      for (const k of ['KeyW', 'ShiftLeft']) hold(k, false);
      chest.copy(foe.position).setY(foe.position.y + 1.15);
      const cam = c.tpc.camera.position, d = chest.clone().sub(cam);
      c.tpc.yaw = Math.atan2(-d.x, -d.z);
      c.tpc.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      if (i % 3 === 0) (c.combat.debugShoot(), shots++);
    } else {
      const goal = c.goal?.() ?? c.enemies.list.filter((e) => e.alive).sort((a, b) => a.position.distanceTo(p) - b.position.distanceTo(p))[0]?.position;
      if (goal && (replan -= dt) <= 0) {
        route = c.nav ? [...c.nav.route(p, goal), goal.clone()] : [goal.clone()];
        wp = route.length > 2 && Math.hypot(route[1].x - p.x, route[1].z - p.z) < Math.hypot(route[1].x - route[0].x, route[1].z - route[0].z) ? 1 : 0;
        replan = 6;
      }
      while (wp < route.length - 1 && Math.hypot(route[wp].x - p.x, route[wp].z - p.z) < 1.3) wp++;
      const to = route[wp];
      if (to) {
        const far = Math.hypot(to.x - p.x, to.z - p.z);
        c.tpc.yaw = Math.atan2(-(to.x - p.x), -(to.z - p.z));
        c.tpc.pitch = -0.1;
        hold('KeyW', far > 1.2 || wp < route.length - 1);
        hold('ShiftLeft', far > 12);
        const atGoal = goal && Math.hypot(goal.x - p.x, goal.z - p.z) < 3;
        hold('KeyE', !!atGoal);
        if (atGoal) holdE += dt;
      }
    }
    if (i % 60 === 0) {
      const moved = p.distanceTo(last);
      if (held.has('KeyW') && moved < 1) {
        stuckT += 2;
        key('Space', true);
        c.frame(dt);
        key('Space', false);
        jumps++;
        if (stuckT >= 6) (anomalies.push(`t=${t.toFixed(0)} STUCK @${fmt(p)} toward ${route[wp] ? fmt(route[wp]) : '-'}`), wp++, (stuckT = 0));
      } else stuckT = 0;
      last.copy(p);
    }
    c.frame(dt);
    if (i % 300 === 0) log.push(`t=${t.toFixed(0)} hp=${c.player.hp.toFixed(0)} @${fmt(p)} alive=${c.enemies.aliveCount}/${c.enemies.list.length} ${extra()}`);
  }
  for (const k of [...held]) hold(k, false);
  c.setSkipRender(false);
  return [...log, `deaths=${deaths} shots=${shots} jumps=${jumps} holdE=${holdE.toFixed(1)}s`, ...anomalies.slice(0, 40)].join('\n');
}
