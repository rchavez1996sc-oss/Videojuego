import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface Ledge { target: THREE.Vector3; top: number; height: number; vault: boolean }

const UP = { x: 0, y: 1, z: 0 }, DOWN = { x: 0, y: -1, z: 0 };

/** Looks for a climbable edge (0.3 m to `maxHeight`) or a thin vaultable obstacle in front of the feet. */
export function findLedge(world: RAPIER.World, feet: THREE.Vector3, yaw: number, exclude: number, maxHeight = 2.1): Ledge | null {
  const fwd = { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
  const skip = (c: RAPIER.Collider) => c.handle !== exclude;
  const cast = (o: THREE.Vector3, d: typeof UP, len: number) =>
    world.castRayAndGetNormal(new RAPIER.Ray(o, d), len, true, undefined, undefined, undefined, undefined, skip);

  let wall = Infinity;
  for (const h of [0.35, 0.8, 1.3, 1.8, 2.3]) {
    const hit = cast(feet.clone().setY(feet.y + h), fwd, 1.0);
    if (hit && Math.abs(hit.normal.y) < 0.6) wall = Math.min(wall, hit.timeOfImpact);
  }
  if (wall === Infinity) return null;

  const probe = (dist: number) => {
    const from = new THREE.Vector3(feet.x + fwd.x * dist, feet.y + 3.0, feet.z + fwd.z * dist);
    const hit = cast(from, DOWN, 3.7);
    return hit && hit.normal.y > 0.65 ? from.y - hit.timeOfImpact : null;
  };
  const top = probe(wall + 0.3);
  if (top === null) return null;
  const height = top - feet.y;
  if (height < 0.3 || height > maxHeight) return null;
  const standPoint = new THREE.Vector3(feet.x + fwd.x * (wall + 0.3), top + 0.05, feet.z + fwd.z * (wall + 0.3));
  if (cast(standPoint, UP, 1.7)) return null;
  for (const h of [0.15, 0.9, 1.6]) {
    const o = new THREE.Vector3(feet.x, top + h, feet.z);
    if (cast(o, fwd, wall + 0.6)) return null;
  }

  const behind = probe(wall + 0.75), beyond = probe(wall + 1.1);
  if (height <= 1.3 && behind !== null && beyond !== null && behind < top - 0.4 && beyond < top - 0.4) {
    const land = new THREE.Vector3(feet.x + fwd.x * (wall + 1.2), beyond + 0.02, feet.z + fwd.z * (wall + 1.2));
    return { target: land, top, height, vault: true };
  }
  return { target: standPoint.setY(top + 0.02), top, height, vault: false };
}

/** Feet position along a mantle/vault arc for progress t in [0, 1]; `lift` is height the animation already adds on its own. */
export function mantlePath(start: THREE.Vector3, l: Ledge, t: number, lift = 0): THREE.Vector3 {
  const p = arc(start, l, t);
  p.y = Math.max(Math.min(start.y, l.target.y), p.y - lift * Math.sin(Math.PI * t));
  return p;
}

function arc(start: THREE.Vector3, l: Ledge, t: number): THREE.Vector3 {
  if (l.vault) {
    const base = THREE.MathUtils.lerp(start.y, l.target.y, t);
    const peak = l.top + 0.25 - THREE.MathUtils.lerp(start.y, l.target.y, 0.5);
    return new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, l.target.x, t),
      base + Math.max(0, peak) * Math.sin(Math.PI * Math.min(1, t * 1.1)),
      THREE.MathUtils.lerp(start.z, l.target.z, t),
    );
  }
  const rise = Math.min(1, t / 0.6);
  const forward = Math.max(0, (t - 0.45) / 0.55);
  return new THREE.Vector3(
    THREE.MathUtils.lerp(start.x, l.target.x, forward),
    start.y + (l.target.y - start.y) * (1 - (1 - rise) * (1 - rise)),
    THREE.MathUtils.lerp(start.z, l.target.z, forward),
  );
}

/** Mantle clips: which part of the clip plays (start fraction and span) and the base duration before height is added. */
export interface Climb { key: string; from: number; span: number; dur: number; lift?: number }
export const CLIMBS: Record<'vault' | 'low' | 'high' | 'hang' | 'wall', Climb> = {
  vault: { key: 'vault', from: 0.22, span: 0.55, dur: 0.5, lift: 0.4 },
  low: { key: 'climb_low', from: 0.12, span: 0.75, dur: 0.6 },
  high: { key: 'climb', from: 0.12, span: 0.75, dur: 0.75 },
  hang: { key: 'hang_climb', from: 0.08, span: 0.85, dur: 0.9 },
  wall: { key: 'wall_climb', from: 0.15, span: 0.8, dur: 0.65 },
};

/** A 0.4–0.6 m step right ahead of a walking body (lower ones the controller's autostep handles). */
export function stepLedge(world: RAPIER.World, feet: THREE.Vector3, vel: THREE.Vector3, exclude: number): { ledge: Ledge; yaw: number } | null {
  const yaw = Math.atan2(-vel.x, -vel.z);
  const ledge = findLedge(world, feet, yaw, exclude, 0.6);
  if (!ledge || ledge.vault || ledge.height < 0.4) return null;
  return Math.hypot(ledge.target.x - feet.x, ledge.target.z - feet.z) > 0.95 ? null : { ledge, yaw };
}

/** Falls of three storeys (8 m) or more hurt, 25 to 90; five storeys (13.5 m) or more kill. */
export function fallDamage(drop: number): number {
  return drop >= 13.5 ? 999 : drop >= 8 ? 25 + ((drop - 8) / 5.5) * 65 : 0;
}

/** Downhill direction of a contact steeper than the 48° climb limit (37° in a long fall): a slide, not a landing. */
export function steepContact(ctrl: RAPIER.KinematicCharacterController, falling: boolean): THREE.Vector3 | null {
  let best: { x: number; y: number; z: number } | null = null, n = 0;
  for (let i = 0; i < ctrl.numComputedCollisions(); i++) {
    const c = ctrl.computedCollision(i);
    if (!c || Math.abs(c.normal1.y) <= 0.05) continue;
    const s = Math.sign(c.normal1.y), g = { x: c.normal1.x * s, y: c.normal1.y * s, z: c.normal1.z * s };
    if (!best || g.y > best.y) best = g;
    n++;
  }
  return n > 0 && best!.y < (falling ? 0.8 : 0.67) ? new THREE.Vector3(best!.x, 0, best!.z) : null;
}
