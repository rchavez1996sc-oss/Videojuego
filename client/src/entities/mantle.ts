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

/** Feet position along a mantle/vault arc for progress t in [0, 1]. */
export function mantlePath(start: THREE.Vector3, l: Ledge, t: number): THREE.Vector3 {
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
