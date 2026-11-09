import * as THREE from 'three';
import { twoBoneIk } from './handIk';
import type { Enemy } from './enemy';

/**
 * A bone the gesture bends after the mixer: when the mixer did not rewrite it this frame (still poses skip unchanged
 * bones) the pose from before our bend is put back first, so bends never pile up frame after frame.
 */
class Bent {
  private orig = new THREE.Quaternion();
  private wrote = new THREE.Quaternion(0, 0, 0, 0);
  constructor(readonly bone: THREE.Object3D) {}
  begin(): void {
    if (this.bone.quaternion.equals(this.wrote)) this.bone.quaternion.copy(this.orig);
    this.orig.copy(this.bone.quaternion);
  }
  end(): void { this.wrote.copy(this.bone.quaternion); }
}

type Kind = 'look' | 'radio' | 'shift';

const PQ = new THREE.Quaternion(), D = new THREE.Quaternion();
/** Turns a bone about a world axis (its parent's world rotation taken into account, unlike `rotateOnWorldAxis`). */
function twist(bone: THREE.Object3D, axis: THREE.Vector3, angle: number): void {
  bone.parent!.getWorldQuaternion(PQ);
  D.setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(PQ.clone().invert().multiply(D).multiply(PQ));
}

/**
 * Idle business of a patrolling police officer standing still: looks slowly round the street (head and shoulders),
 * talks into the shoulder radio (left hand up to the collar, head tilted to it) or shifts weight. One at a time, every
 * 4–12 s, eased in and out; only when calm, standing, alive and on screen-ish distance (the rig's near LOD).
 */
export function idleGestures(e: Enemy): Enemy {
  const b = e.model.bones, get = (n: string) => b.get(`mixamorig${n}`);
  const head = get('Head'), neck = get('Neck'), chest = get('Spine2'), arm = get('LeftArm'), fore = get('LeftForeArm'), hand = get('LeftHand');
  if (!head || !neck || !chest || !arm || !fore || !hand) return e;
  const bent = [head, neck, chest, arm, fore, hand].map((x) => new Bent(x));
  let wait = 1 + Math.random() * 5, kind: Kind | null = null, t = 0, dur = 0, side = 1, w = 0;
  const target = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  e.model.post = (dt) => {
    const calm = e.state === 'patrol' && !e.moveTarget && !e.crouched;
    e.model.root.userData.gesture = `${kind ?? '-'} w${w.toFixed(2)} wait${wait.toFixed(1)} calm${+calm}`;
    if (!kind) {
      if (!calm || (wait -= dt) > 0) return;
      kind = (['look', 'look', 'radio', 'shift'] as Kind[])[Math.floor(Math.random() * 4)];
      [t, dur, side] = [0, kind === 'radio' ? 3 + Math.random() * 2.5 : 2.6 + Math.random() * 2, Math.random() < 0.5 ? 1 : -1];
    }
    t += dt;
    const ease = Math.min(1, t / 0.6, Math.max(0, (dur - t) / 0.6));
    w = calm ? ease : Math.max(0, w - dt * 4);
    if (t >= dur || (!calm && w <= 0)) {
      [kind, wait, w] = [null, 2.5 + Math.random() * 5, 0];
      return;
    }
    bent.forEach((x) => x.begin());
    chest.updateWorldMatrix(true, true);
    if (kind === 'look') {
      const a = Math.sin((t / dur) * Math.PI * 2) * 0.75 * side * w;
      twist(chest, up, a * 0.2);
      twist(neck, up, a * 0.25);
      twist(head, up, a * 0.6);
    } else if (kind === 'shift') {
      twist(chest, e.model.root.getWorldDirection(fwd), 0.06 * side * w);
      twist(head, fwd, -0.1 * side * w);
    } else {
      e.model.root.getWorldDirection(fwd);
      right.crossVectors(up, fwd).normalize();
      neck.getWorldPosition(target).addScaledVector(fwd, 0.13).addScaledVector(right, 0.13).add(up.clone().multiplyScalar(-0.08));
      twoBoneIk(arm, fore, hand, target, w);
      twist(head, fwd, 0.22 * w);
      twist(head, up, 0.35 * w);
      fore.updateWorldMatrix(false, true);
      twist(hand, right, -0.4 * w);
    }
    bent.forEach((x) => x.end());
  };
  return e;
}
