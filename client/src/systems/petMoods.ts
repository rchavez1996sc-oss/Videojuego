import * as THREE from 'three';
import type { Dog, Dogs } from './dogs';

/**
 * How a stray reacts to the player passing close (< 9 m, calm streets only), by its nature:
 * - dogs (40 %) tag along a couple of metres behind for up to 25 s, (30 %) stand their ground barking and back off
 *   if the player comes too close, the rest ignore him;
 * - cats jump onto a wall or ledge within reach (0.8–2.4 m up) and sit there a while, or dash away.
 * Returns true while the pet is handled here (the roaming logic is skipped).
 */
export function petsMeetPlayer(dogs: Dogs, d: Dog, dt: number, player: THREE.Vector3, ledge?: (from: THREE.Vector3, dir: THREE.Vector3) => THREE.Vector3 | null): boolean {
  if (d.panic > 0) return (d.mode = 'roam'), false;
  const to = player.clone().sub(d.pos).setY(0), dist = to.length(), cat = d.beast.kind === 'cat';
  d.modeT -= dt;
  if (d.jump) {
    d.jump.t = Math.min(1, d.jump.t + dt / 0.45);
    d.pos.lerpVectors(d.jump.from, d.jump.to, d.jump.t);
    d.pos.y += Math.sin(d.jump.t * Math.PI) * 0.6;
    d.speed = 2.5;
    if (d.jump.t >= 1) [d.jump = null, d.speed = 0];
    return true;
  }
  if (d.mode === 'perched') {
    d.speed = 0;
    d.yaw += Math.atan2(Math.sin(Math.atan2(to.x, to.z) - d.yaw), Math.cos(Math.atan2(to.x, to.z) - d.yaw)) * Math.min(1, dt * 2);
    if (d.modeT > 0) return true;
    const down = d.pos.clone().add(new THREE.Vector3(Math.sin(d.yaw), 0, Math.cos(d.yaw)).multiplyScalar(-1.2));
    down.y = dogs.groundAt(down.x, down.z);
    d.jump = { from: d.pos.clone(), to: down, t: 0 };
    return (d.mode = 'roam'), true;
  }
  if (d.mode === 'roam') {
    if (dist > 9 || d.modeT > -6) return false;
    if (cat) {
      const away = to.clone().normalize().negate(), spot = ledge?.(d.pos, away) ?? ledge?.(d.pos, away.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.2));
      if (spot && dist < 5) {
        d.jump = { from: d.pos.clone(), to: spot, t: 0 };
        d.yaw = Math.atan2(spot.x - d.pos.x, spot.z - d.pos.z);
        return (d.mode = 'perched'), (d.modeT = 10 + Math.random() * 12), true;
      }
      if (dist < 4) d.panic = 2.5;
      return false;
    }
    if (d.nature < 0.4) [d.mode, d.modeT] = ['follow', 25];
    else if (d.nature < 0.7) [d.mode, d.modeT] = ['bark', 12];
    else return (d.modeT = 0), false;
  }
  if (dist > 25 || d.modeT <= 0) {
    d.node = dogs.nearestNode(d.pos);
    d.target = dogs.graph.nodes[d.node].clone();
    d.queue = [];
    [d.mode, d.modeT] = ['roam', 0];
    return false;
  }
  const want = Math.atan2(to.x, to.z);
  d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 5);
  let goal = 0;
  if (d.mode === 'follow') goal = dist > 2.6 ? Math.min(3.8, (dist - 2.2) * 1.6) : 0;
  else goal = dist < 3.5 ? -1.4 : 0;
  d.speed = THREE.MathUtils.damp(d.speed, Math.abs(goal), 5, dt);
  d.pos.addScaledVector(to.normalize(), Math.sign(goal) * d.speed * dt);
  d.pos.y = dogs.groundAt(d.pos.x, d.pos.z);
  if (d.mode === 'bark' && (d.barkT -= dt) <= 0) [d.barkT = 0.5 + Math.random() * 0.9, dogs.onBark(d.pos.clone())];
  return true;
}
