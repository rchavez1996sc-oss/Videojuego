import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { CoverIndex } from '../ai/cover';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { Enemies } from './enemies';
import type { Heightfield } from '../world/heightfield';
import type { Hud } from '../ui/hud';

/**
 * Nearest spot (≤ 14 m, on the player's floor: deck, plaza or ground) that hides the player from the closest aware enemy — or, with no enemy around, from whatever
 * lies ahead of the camera — and can be reached in a straight line.
 */
export function findCover(world: RAPIER.World, cover: CoverIndex, groundY: (x: number, z: number) => number, from: THREE.Vector3, enemies: Enemy[], ahead: THREE.Vector3, self: number): THREE.Vector3 | null {
  const threat = enemies
    .filter((e) => e.alive && e.state !== 'patrol' && e.position.distanceTo(from) < 120)
    .sort((a, b) => a.position.distanceToSquared(from) - b.position.distanceToSquared(from))[0]?.position.clone() ?? from.clone().addScaledVector(ahead.clone().setY(0).normalize(), 30);
  const chest = threat.clone().setY(threat.y + 1.3);
  const ray = (a: THREE.Vector3, b: THREE.Vector3) => {
    const dir = b.clone().sub(a), len = dir.length();
    return { hit: world.castRay(new RAPIER.Ray(a, dir.divideScalar(len)), len, true, undefined, undefined, undefined, undefined, (c) => c.handle !== self && c.isEnabled()), len };
  };
  for (const c of cover.candidates(from, threat, 14, from.distanceTo(threat), -2)) {
    const spot = c.pos.clone();
    if (Math.abs(spot.y - from.y) > 1.5) continue;
    const shield = ray(spot.clone().setY(spot.y + 0.9), chest);
    if (!shield.hit || shield.hit.timeOfImpact > shield.len - 0.6) continue;
    const path = ray(from.clone().setY(from.y + 0.6), spot.clone().setY(spot.y + 0.6));
    if (path.hit && path.hit.timeOfImpact < path.len - 0.4) continue;
    return spot;
  }
  for (const r of [2.5, 4, 6, 8, 11]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = from.x + Math.cos(a) * r, z = from.z + Math.sin(a) * r;
      const spot = new THREE.Vector3(x, groundY(x, z), z);
      if (Math.abs(spot.y - from.y) > 1) continue;
      const shield = ray(spot.clone().setY(spot.y + 0.9), chest);
      if (!shield.hit || shield.hit.timeOfImpact > shield.len - 0.6) continue;
      const path = ray(from.clone().setY(from.y + 0.6), spot.clone().setY(spot.y + 0.6).addScaledVector(spot.clone().sub(from).setY(0).normalize(), 0.5));
      if (path.hit) continue;
      return spot;
    }
  }
  return null;
}

/** The Q action: run to the nearest useful cover, or say there is none. */
export function coverSeeker(d: { world: RAPIER.World; cover: CoverIndex; hf: Heightfield; player: Player; enemies: Enemies; camera: THREE.Camera; hud: Hud }): () => void {
  return () => {
    const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(d.camera.quaternion);
    const p = d.player.position, down = { x: 0, y: -1, z: 0 };
    const floor = (x: number, z: number) => {
      const hit = d.world.castRay(new RAPIER.Ray({ x, y: p.y + 1.2, z }, down), 3, true, undefined, undefined, undefined, undefined, (c) => c.handle !== d.player.collisionHandle);
      return hit ? p.y + 1.2 - hit.timeOfImpact : d.hf.heightAt(x, z);
    };
    const spot = findCover(d.world, d.cover, floor, d.player.position, d.enemies.list, ahead, d.player.collisionHandle);
    if (spot) d.player.takeCover(spot);
    else d.hud.showToast('SIN COBERTURA CERCA');
  };
}
