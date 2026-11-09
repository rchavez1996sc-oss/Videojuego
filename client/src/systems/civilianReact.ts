import * as THREE from 'three';
import { twoBoneIk } from '../entities/handIk';
import type { Rig } from '../entities/rig';

/** What a passer-by is doing about the armed man: hands up while a gun points at them, or filming the shooting. */
export type Act = 'hands' | 'film' | null;

/** The bit of a passer-by the reactions need (see `Civilians`). */
export interface Reactor { model: Rig; pos: THREE.Vector3; mood: string; act: Act; reactT: number; threat: THREE.Vector3; filmed?: boolean; phone?: THREE.Object3D }

const PQ = new THREE.Quaternion(), D = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
const A = new THREE.Vector3(), FWD = new THREE.Vector3(), RIGHT = new THREE.Vector3(), TO = new THREE.Vector3();

/** Bones bent after the mixer, restored first when the mixer left them alone (still poses), so bends don't pile up. */
function keep(bones: THREE.Object3D[]): { begin(): void; end(): void } {
  const orig = bones.map(() => new THREE.Quaternion()), wrote = bones.map(() => new THREE.Quaternion(0, 0, 0, 0));
  return {
    begin: () => bones.forEach((b, i) => (b.quaternion.equals(wrote[i]) && b.quaternion.copy(orig[i]), orig[i].copy(b.quaternion))),
    end: () => bones.forEach((b, i) => wrote[i].copy(b.quaternion)),
  };
}

/**
 * Arms posed after the animation: both hands raised open beside the head (surrender), or the right hand holding the
 * phone up in front of the face (filming), eased in and out by the act's weight.
 */
export function reactPose(c: Reactor): void {
  const b = c.model.bones, g = (n: string) => b.get(`mixamorig${n}`)!;
  const arms = (['Left', 'Right'] as const).map((s) => [g(`${s}Arm`), g(`${s}ForeArm`), g(`${s}Hand`)]);
  if (arms.flat().some((x) => !x)) return;
  const head = g('Head'), bent = keep([...arms.flat(), head]);
  let w = 0, last: Act = null;
  c.model.post = (dt) => {
    const want = c.act && c.reactT > 0 ? 1 : 0;
    w = THREE.MathUtils.damp(w, want, want ? 7 : 4, dt);
    if (c.act) last = c.act;
    if (c.phone) c.phone.visible = last === 'film' && w > 0.05;
    if (w < 0.01) return;
    bent.begin();
    c.model.root.updateMatrixWorld(true);
    c.model.root.getWorldDirection(FWD);
    RIGHT.crossVectors(UP, FWD).normalize();
    head.getWorldPosition(A);
    if (last === 'hands') {
      for (const [i, [arm, fore, hand]] of arms.entries()) {
        const side = i === 0 ? 1 : -1;
        TO.copy(A).addScaledVector(UP, 0.32).addScaledVector(RIGHT, side * 0.36).addScaledVector(FWD, 0.08);
        twoBoneIk(arm, fore, hand, TO, w);
      }
    } else {
      const [arm, fore, hand] = arms[1];
      TO.copy(A).addScaledVector(FWD, 0.34).addScaledVector(RIGHT, -0.06).addScaledVector(UP, -0.02);
      twoBoneIk(arm, fore, hand, TO, w);
      hand.parent!.updateWorldMatrix(true, false);
      hand.parent!.getWorldQuaternion(PQ);
      D.setFromAxisAngle(RIGHT, -1.1 * w);
      hand.quaternion.premultiply(PQ.clone().invert().multiply(D).multiply(PQ));
    }
    bent.end();
  };
}

/** Distance from `p` (chest height) to the aim ray, or Infinity when behind / farther than `range`. */
export function offAim(p: THREE.Vector3, origin: THREE.Vector3, dir: THREE.Vector3, range: number): number {
  TO.copy(p).setY(p.y + 1.1).sub(origin);
  const along = TO.dot(dir);
  if (along < 0 || along > range) return Infinity;
  return TO.addScaledVector(dir, -along).length();
}

const DIR = new THREE.Vector3();

/**
 * Per-frame reactions: a calm passer-by within 25 m whom the aimed gun points at (chest within 0.9 m of the aim ray)
 * stops, faces the shooter and puts their hands up for as long as they are covered (+1.5 s); afterwards half of them
 * bolt. Filmers (picked when the shooting starts, see `Civilians.alarm`) run once their clip is done.
 */
export function reactStep(list: Reactor[], camera: THREE.Camera, aiming: boolean, panic: (c: Reactor) => void): void {
  camera.getWorldDirection(DIR);
  for (const c of list) {
    if (c.mood === 'dead' || c.mood === 'gone') {
      c.act = null;
      continue;
    }
    const covered = aiming && offAim(c.pos, camera.position, DIR, 25) < 0.9;
    if (c.act === 'hands') {
      if (covered) [c.reactT, c.threat] = [Math.max(c.reactT, 1.5), c.threat.copy(camera.position).setY(c.pos.y)];
      if (c.reactT <= 0) {
        c.act = null;
        if (Math.random() < 0.5) panic(c);
      }
    } else if (c.act === 'film' && c.reactT <= 0) {
      c.act = null;
      panic(c);
    } else if (!c.act && covered && (c.mood === 'walk' || c.mood === 'idle') && c.reactT <= 0) {
      [c.act, c.reactT] = ['hands', 2 + Math.random()];
      c.threat.copy(camera.position).setY(c.pos.y);
    }
  }
}
