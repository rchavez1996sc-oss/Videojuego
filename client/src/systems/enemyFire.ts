import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Enemy } from '../entities/enemy';
import type { AIContext } from '../ai/brain';
import type { Enemies } from './enemies';
import type { Combat } from '../weapons/combat';
import type { Sfx } from '../audio/sfx';
import type { Player } from '../entities/player';
import { surfaceOf } from '../world/surfaces';
import { difficulty } from '../core/difficulty';

/** One enemy round: accurate attackers aim at the target's chest, the rest suppress around it. */
export function enemyFire(e: Enemy, en: Enemies, ctx: AIContext, attacker: boolean, world: RAPIER.World, camera: THREE.PerspectiveCamera, combat: Combat, sfx: Sfx, player: Player): void {
  const muzzle = e.model.muzzle.getWorldPosition(new THREE.Vector3());
  e.flash.fire(e.model.muzzle);
  e.model.fire();
  en.onEnemyShot(muzzle);
  const dist = muzzle.distanceTo(ctx.playerChest);
  const moving = player.speed > 3 ? 1.2 : player.speed > 0.5 ? 0.5 : 0;
  const settle = 1 + 1.6 * Math.max(0, 1 - e.stateT / 3.5);
  const cone = THREE.MathUtils.degToRad((e.def.spread + dist * e.def.spreadPerMeter * 10 + moving) * settle * difficulty.value.spread);
  const aimPoint = ctx.playerChest.clone();
  if (!attacker) {
    const off = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(1.6 + Math.random() * 2.5);
    aimPoint.add(off);
  }
  const dir = aimPoint.sub(muzzle).normalize();
  const r = Math.sqrt(Math.random()) * Math.tan(cone), a = Math.random() * Math.PI * 2;
  const u = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), v = dir.clone().cross(u);
  dir.addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
  const hit = world.castRayAndGetNormal(new RAPIER.Ray(muzzle, dir), 400, true, undefined, undefined, undefined, undefined, (c) => c.handle !== e.handle && c.isEnabled());
  const end = muzzle.clone().addScaledVector(dir, hit ? hit.timeOfImpact : 400);
  if (Math.random() < 0.5) combat.tracer(muzzle, end);
  const cam = camera.position;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const pan = muzzle.clone().sub(cam).normalize().dot(right);
  sfx.distantShot(muzzle.distanceTo(cam), pan, e.def.rpm < 100);
  if (hit?.collider.handle === player.collisionHandle) {
    en.onPlayerHit(e.def.damage * difficulty.value.damage * (0.85 + Math.random() * 0.3), muzzle);
    return;
  }
  if (hit && en.onAllyHit(hit.collider.handle, e.def.damage * difficulty.value.damage * 0.8 * (0.85 + Math.random() * 0.3), muzzle)) {
    combat.bloodPuff(end);
    return;
  }
  const closest = cam.clone().sub(muzzle).dot(dir);
  if (closest > 0 && closest < (hit?.timeOfImpact ?? 400) && muzzle.clone().addScaledVector(dir, closest).distanceTo(cam) < 2.2) sfx.whiz(pan);
  if (hit && end.distanceTo(cam) < 90) combat.impact(end, new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), surfaceOf(hit.collider.handle), dir);
}
