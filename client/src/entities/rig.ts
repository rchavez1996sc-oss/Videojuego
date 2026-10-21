import * as THREE from 'three';
import { characters, type CharKind } from '../render/characters';
import { buildAK } from '../weapons/akModel';
import { bakeLod } from '../render/merge';
import { dress, type Outfit } from './outfit';
import { addWound } from './wounds';
import type { Lighting } from '../render/lighting';

export type { Outfit } from './outfit';

const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/;
/** Aiming on the move: the chest and arms hold the aim, the hips and lower back keep the stride's sway. */
const CHEST = /Spine2|Neck|Head|Shoulder|Arm|Hand/;
type Parts = Record<'full' | 'lower' | 'upper' | 'body' | 'chest', THREE.AnimationClip>;
const split = new Map<string, Parts>();

function parts(key: string): Parts {
  let p = split.get(key);
  if (!p) {
    const full = characters.clips.get(key)!;
    const bone = (t: THREE.KeyframeTrack) => t.name.slice(0, t.name.lastIndexOf('.'));
    const clip = (tag: string, keep: (t: THREE.KeyframeTrack) => boolean) => new THREE.AnimationClip(`${key}-${tag}`, full.duration, full.tracks.filter(keep));
    p = {
      full,
      lower: clip('lo', (t) => !UPPER.test(bone(t))),
      upper: clip('up', (t) => UPPER.test(bone(t))),
      body: clip('body', (t) => !CHEST.test(bone(t))),
      chest: clip('chest', (t) => CHEST.test(bone(t))),
    };
    split.set(key, p);
  }
  return p;
}

/** Reference ground speed (m/s) of each locomotion clip, to keep feet from sliding. */
const PACE: Record<string, number> = { walk: 1.5, run: 3.7, sprint: 5.8, crouch: 1.2, civ_walk: 1.4, civ_run: 3.9 };
const DIR8 = ['f', 'fr', 'r', 'br', 'b', 'bl', 'l', 'fl'];
const DIR4 = ['f', 'r', 'b', 'l'];
const FADE = 0.2;
/** Clips authored facing away from the viewer and starting mid-ladder: turn the body round and drop it to the rungs. */
const HOLD_FIX: Record<string, { yaw: number; y: number }> = { ladder: { yaw: Math.PI, y: -0.75 } };

/** Skinned Mixamo character with layered animation: legs from speed/direction, torso from stance and gestures. */
export class Rig {
  readonly root = new THREE.Group();
  readonly muzzle: THREE.Object3D;
  readonly ejector: THREE.Object3D;
  readonly weapon: THREE.Object3D;
  scared = false;
  /** Shouldered rifle (aiming, firing or in a firefight). */
  aiming = false;
  airborne = false;
  /** Weapon put away (grenade in hand, climbing). */
  holster = false;
  private mixer: THREE.AnimationMixer;
  private inst: ReturnType<typeof characters.create>;
  private lowKey = '';
  private upKey = '';
  private lower: THREE.AnimationAction | null = null;
  private upper: THREE.AnimationAction | null = null;
  private overlay: { key: string; t: number } | null = null;
  private held: { key: string; action: THREE.AnimationAction } | null = null;
  private lockT = 0;
  private aimT = 0;
  private kick = 0;
  private dead = false;
  private isFar = false;
  private skip = 0;
  private acc = 0;
  private last = new THREE.Vector3();
  private spine: THREE.Bone[];
  private wounds = 0;

  constructor(kind: CharKind, private lighting: Lighting, private armed = true, detailedGun = false, outfit?: Outfit) {
    this.inst = characters.create(kind);
    this.root.add(this.inst.model);
    this.mixer = new THREE.AnimationMixer(this.inst.model);
    const b = this.inst.bones;
    this.spine = ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'].map((n) => b.get(n)!);
    const ak = buildAK(lighting);
    let gun: THREE.Object3D = ak.group;
    if (!detailedGun) {
      const merged = bakeLod(ak.group, lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), 'ak-baked'));
      merged.add(ak.muzzle, ak.ejector);
      gun = merged;
    }
    this.weapon = gun;
    this.muzzle = ak.muzzle;
    this.ejector = ak.ejector;
    if (armed) this.gripWeapon(b.get('mixamorigRightHand')!, b.get('mixamorigLeftHand')!);
    else this.weapon.visible = false;
    if (outfit) dress(b, outfit, lighting);
    this.play(armed ? 'idle' : 'civ_walk', armed ? 'aim' : 'civ_walk', 0);
    this.mixer.update(Math.random());
  }

  /** Parents the rifle to the right hand, calibrated so that in the aiming pose it points straight ahead, slightly towards the left hand. */
  private gripWeapon(rightHand: THREE.Bone, leftHand: THREE.Bone): void {
    const a = this.mixer.clipAction(parts('aim').full).play();
    this.mixer.update(0);
    this.inst.model.updateMatrixWorld(true);
    const rh = rightHand.getWorldPosition(new THREE.Vector3()), lh = leftHand.getWorldPosition(new THREE.Vector3());
    const ahead = new THREE.Vector3(0, 0, 1).add(lh.clone().sub(rh).setY(0).normalize().multiplyScalar(0.15)).normalize();
    const look = new THREE.Matrix4().lookAt(rh.clone().add(ahead), rh, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(look);
    const pos = rh.clone().add(new THREE.Vector3(0.0, 0.04, 0.06).applyQuaternion(q));
    const world = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
    const local = rightHand.matrixWorld.clone().invert().multiply(world);
    local.decompose(this.weapon.position, this.weapon.quaternion, this.weapon.scale);
    rightHand.add(this.weapon);
    a.stop();
  }

  /** `lowKey`/`upKey` may end in '+' (moving while aiming): legs and lower back from the stride, chest and arms from the aim. */
  private play(lowKey: string, upKey: string, fade = FADE): void {
    if (lowKey !== this.lowKey) {
      const mixed = lowKey.endsWith('+'), base = mixed ? lowKey.slice(0, -1) : lowKey;
      const next = this.mixer.clipAction(mixed ? parts(base).body : parts(base).lower).reset().play();
      if (this.lower && fade) this.lower.crossFadeTo(next, fade, false);
      else this.lower?.stop();
      this.lower = next;
      this.lowKey = lowKey;
    }
    if (upKey !== this.upKey) {
      const mixed = upKey.endsWith('+'), base = mixed ? upKey.slice(0, -1) : upKey;
      const next = this.mixer.clipAction(mixed ? parts(base).chest : parts(base).upper).reset().play();
      const once = this.overlay?.key === upKey;
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      if (this.upper && fade) this.upper.crossFadeTo(next, fade * 0.6, false);
      else this.upper?.stop();
      this.upper = next;
      this.upKey = upKey;
    }
  }

  /** Upper-body one-shots: 'reload', 'throw', 'hit'. */
  gesture(key: 'reload' | 'throw' | 'hit', seconds?: number): void {
    if (this.dead || this.held) return;
    const dur = characters.clips.get(key)!.duration;
    if (key === 'hit' && this.overlay && this.overlay.key !== 'hit') return;
    this.overlay = { key, t: seconds ?? dur * (key === 'hit' ? 0.35 : 1) };
    this.upKey = '';
    this.mixer.clipAction(parts(key).upper).timeScale = seconds ? dur / seconds : 1;
  }

  /** A shot: shoulder the rifle for a moment and kick the torso back. */
  fire(): void {
    this.aimT = 0.8;
    this.kick = 1;
  }

  /** Full-body clip that overrides locomotion (climb, ladder) until `release`. `rate` may be negative (ladder down). */
  hold(key: string, rate: number, once = false, startFrac = 0): void {
    if (this.dead) return;
    if (this.held?.key === key) {
      this.held.action.timeScale = rate;
      return;
    }
    this.release(0);
    const a = this.mixer.clipAction(parts(key).full).reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.time = a.getClip().duration * startFrac;
    a.timeScale = rate;
    a.play();
    this.lower?.fadeOut(0.1);
    this.upper?.fadeOut(0.1);
    this.lower = this.upper = null;
    this.lowKey = this.upKey = '';
    this.held = { key, action: a };
    const fix = HOLD_FIX[key];
    this.inst.model.rotation.y = fix?.yaw ?? 0;
    this.inst.model.position.y = fix?.y ?? 0;
  }

  release(fade = FADE): void {
    if (!this.held) return;
    this.inst.model.rotation.y = 0;
    this.inst.model.position.y = 0;
    if (fade) this.held.action.fadeOut(fade);
    else this.held.action.stop();
    this.held = null;
  }

  /** A wet blood blot where a round struck (at most seven per body). */
  wound(at: THREE.Vector3): void {
    if (this.wounds++ < 7) addWound(this.inst.bones, at, this.lighting);
  }

  /** World position of the hips (where a fallen body's torso lies). */
  hips(): THREE.Vector3 {
    return this.inst.bones.get('mixamorigHips')!.getWorldPosition(new THREE.Vector3());
  }

  durationOf(key: string): number {
    return characters.clips.get(key)?.duration ?? 1;
  }

  die(kind: string): void {
    this.held = null;
    this.overlay = null;
    this.mixer.stopAllAction();
    this.dead = false;
    this.hold(kind, 1, true);
    this.dead = true;
  }

  /** Back on their feet: plays the get-up clip before locomotion resumes. */
  revive(): void {
    this.dead = false;
    this.mixer.stopAllAction();
    this.held = null;
    this.hold('getup', 1, true);
    this.lockT = this.durationOf('getup') * 0.9;
  }

  private chooseLower(speed: number, crouch: number, fwd: number, side: number): [string, number] {
    if (!this.armed) {
      if (speed < 0.3) return [this.scared ? 'terrified' : 'idle', 1];
      return speed < 2.6 ? ['civ_walk', speed / PACE.civ_walk] : ['civ_run', speed / PACE.civ_run];
    }
    if (this.airborne) return ['jump', 1];
    const ang = (Math.atan2(side, fwd) + Math.PI * 2) % (Math.PI * 2);
    if (crouch > 0.5) return speed < 0.3 ? ['crouch_idle', 1] : [`crouch_${DIR4[Math.round(ang / (Math.PI / 2)) % 4]}`, speed / PACE.crouch];
    if (speed < 0.3) return ['idle', 1];
    if (speed > 5 && fwd > speed * 0.8 && !this.aiming) return ['sprint', speed / PACE.sprint];
    const dir = DIR8[Math.round(ang / (Math.PI / 4)) % 8];
    return speed < 2.8 ? [`walk_${dir}`, speed / PACE.walk] : [`run_${dir}`, speed / PACE.run];
  }

  private chooseUpper(low: string, crouch: number): string {
    if (this.overlay) return this.overlay.key;
    if (!this.armed) return low.startsWith('civ') && low !== 'civ_run' ? 'civ_walk' : low;
    if (this.aiming || this.aimT > 0 || low === 'idle' || low === 'crouch_idle') return crouch > 0.5 ? 'crouch_aim' : 'aim';
    return low;
  }

  animate(dt: number, speed: number, crouch: number, aimPitch: number): void {
    this.acc += dt;
    if (this.isFar && ++this.skip % 3 !== 0) return;
    const step = this.acc;
    this.acc = 0;
    this.lockT -= step;
    this.aimT -= step;
    if (this.lockT <= 0 && this.held?.key === 'getup') this.release();
    if (!this.dead && !this.held) {
      const delta = this.root.position.clone().sub(this.last), yaw = this.root.rotation.y, inv = 1 / Math.max(step, 1e-3);
      const fwd = (delta.x * Math.sin(yaw) + delta.z * Math.cos(yaw)) * inv;
      const side = (delta.x * -Math.cos(yaw) + delta.z * Math.sin(yaw)) * inv;
      const [low, rate] = this.chooseLower(speed, crouch, fwd, side);
      if (this.overlay && (this.overlay.t -= step) <= 0) {
        this.overlay = null;
        this.upKey = '';
      }
      const up = this.chooseUpper(low, crouch);
      const sway = this.armed && speed >= 0.3 && up !== low && !this.overlay ? '+' : '';
      this.play(low + sway, up + sway);
      const scale = (low === 'idle' && !this.armed) ? 0 : THREE.MathUtils.clamp(rate, 0.6, 1.6);
      if (this.lower) this.lower.timeScale = scale;
      if (this.upper && up === low) this.upper.timeScale = scale;
      if (this.upper && !this.armed && up === 'civ_walk' && low !== 'civ_walk') this.upper.timeScale = 0;
    }
    this.last.copy(this.root.position);
    this.mixer.update(step);
    if (!this.dead && !this.held && this.armed) {
      const bend = aimPitch / 3, k = this.kick;
      for (const [i, b] of this.spine.entries()) b.rotateX(-bend - (i === 2 ? k * 0.07 : k * 0.025));
      this.kick = Math.max(0, this.kick - step * 14);
    }
    if (this.armed) this.weapon.visible = !this.holster && (!this.held || this.dead);
  }

  set far(v: boolean) {
    if (v === this.isFar) return;
    this.isFar = v;
    this.inst.near.forEach((m) => (m.visible = !v));
    this.inst.far.forEach((m) => (m.visible = v));
  }

  set castShadow(v: boolean) {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = v;
    });
  }
}
