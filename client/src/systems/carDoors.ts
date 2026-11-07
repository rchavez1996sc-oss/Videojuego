import * as THREE from 'three';

const q = new THREE.Quaternion(), ease = (t: number) => t * t * (3 - 2 * t);

/** How far the front doors swing (rad). */
const SWING = 1.15;

/** Front doors cut out of the model (`<key>_doorL`/`_doorR`, hinged at their front edge); `side` = sign of x in `group`. */
export function doorsOf(group: THREE.Object3D): { node: THREE.Object3D; side: number }[] {
  const out: { node: THREE.Object3D; side: number }[] = [];
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  group.traverse((o) => /_door[LR]$/.test(o.name) && out.push({ node: o, side: Math.sign(o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).x) || 1 }));
  return out;
}

/** Opens the door on `side` of a vehicle group to `open` (0 shut … 1 wide), swinging outwards about its hinge. */
export function setDoor(group: THREE.Object3D, side: number, open: number): void {
  for (const d of (group.userData.doors ?? []) as { node: THREE.Object3D; side: number }[]) {
    if (d.side !== side) continue;
    const u = d.node.userData;
    u.rest ??= d.node.quaternion.clone();
    u.up ??= new THREE.Vector3(0, 1, 0).applyQuaternion(d.node.parent!.quaternion.clone().invert());
    d.node.quaternion.copy(u.rest).premultiply(q.setFromAxisAngle(u.up, -side * SWING * ease(THREE.MathUtils.clamp(open, 0, 1))));
  }
}

/**
 * Door opening through getting in (`out` false) or out of the seat, at `k` (0..1) of the clip: the hand reaches the
 * handle early, the door stays open while the body passes, and is pulled shut near the end.
 */
export function doorDuring(out: boolean, k: number): number {
  const [o0, o1, c0, c1] = out ? [0.02, 0.2, 0.62, 0.84] : [0.06, 0.28, 0.72, 0.92];
  return k < c0 ? THREE.MathUtils.clamp((k - o0) / (o1 - o0), 0, 1) : 1 - THREE.MathUtils.clamp((k - c0) / (c1 - c0), 0, 1);
}

/** A quick open-and-shut (getting in or out without the clip): `t` seconds since it began; false when done. */
export function doorPulse(group: THREE.Object3D, side: number, t: number): boolean {
  const k = t / 0.9;
  setDoor(group, side, k < 0.4 ? k / 0.4 : 1 - (k - 0.6) / 0.4);
  return k < 1;
}
