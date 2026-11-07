import * as THREE from 'three';
import { characters, type CharKind } from '../render/characters';
import { grenadeGeometry, type GunModel } from '../weapons/gunModels';
import { mountGun, type Arm } from './mountGun';
import { dress, type Outfit } from './outfit';
import { addWound } from './wounds';
import { GESTURE_MAX_SPEED, GESTURE_SPAN, parts, pistolUpper } from './clipParts';
import { civilianGait, chooseGait } from './gait';
import { Lean } from './lean';
import { supportHand, type GripPose } from './handIk';
import type { Lighting } from '../render/lighting';

export type { Outfit } from './outfit';

const FADE = 0.2;
/** Mixamo clips that stand still before the action: Hit By Car only takes the blow at 56 % (2.7 s in). */
const CLIP_START: Record<string, number> = { hit_car: 0.555, stumble: 0.14 };
/** Clips authored facing away from the viewer and starting mid-ladder: turn the body round and drop it to the rungs. */
const HOLD_FIX: Record<string, { yaw: number; y: number }> = { ladder: { yaw: Math.PI, y: -0.75 } };

/** Skinned Mixamo character with layered animation: legs from speed/direction, torso from stance and gestures. */
export class Rig {
  readonly root = new THREE.Group();
  private arms: Arm[]; private cur = 0; private detailed: boolean;
  private get arm(): Arm { return this.arms[this.cur]; }
  get weapon(): THREE.Object3D { return this.arm.weapon; }
  get muzzle(): THREE.Object3D { return this.arm.muzzle; }
  get ejector(): THREE.Object3D { return this.arm.ejector; }
  private get grip(): GripPose | undefined { return this.arm.grip; }
  private get gunModel(): GunModel { return this.arm.model; }
  /** Adds another weapon (kept out of sight until `wield`): its index. */
  addArm(model: GunModel): number {
    const r = this.root, at = r.position.clone(), rot = r.rotation.clone();
    r.position.set(0, 0, 0);
    r.rotation.set(0, 0, 0);
    this.mixer.stopAllAction();
    [this.lower, this.upper, this.lowKey, this.upKey] = [null, null, '', ''];
    this.arms.push(mountGun(this.mixer, this.inst.model, this.inst.bones, this.lighting, model, this.detailed, true));
    r.position.copy(at);
    r.rotation.copy(rot);
    this.arms[this.arms.length - 1].weapon.visible = false;
    return this.arms.length - 1;
  }
  /** Takes weapon `i` in hand (the others hidden); the stance follows its kind on the next frame. */
  wield(i: number): void {
    if (i === this.cur || !this.arms[i]) return;
    this.arm.weapon.visible = false;
    this.cur = i;
    this.overlay = null;
  }
  scared = false;
  /** Shouldered rifle (aiming, firing or in a firefight). */
  aiming = false; airborne = false;
  /** Weapon put away (grenade in hand, climbing). */
  holster = false;
  private mixer: THREE.AnimationMixer;
  readonly inst: ReturnType<typeof characters.create>;
  get bones(): Map<string, THREE.Bone> { return this.inst.bones; }
  private extraNear: THREE.Object3D[] = [];
  /** Props on the bones (backpack, book) shown only with the near LOD. */
  nearOnly(...o: THREE.Object3D[]): void { this.extraNear.push(...o); }
  private lowKey = ''; private upKey = '';
  private lower: THREE.AnimationAction | null = null; private upper: THREE.AnimationAction | null = null;
  private overlay: { key: string; t: number; from: number } | null = null;
  private nade: THREE.Mesh | null = null;
  private held: { key: string; action: THREE.AnimationAction } | null = null;
  private lockT = 0; private aimT = 0; private kick = 0; private ikW = 0;
  dead = false; private isFar = false;
  private skip = 0; private acc = 0; private last = new THREE.Vector3();
  /** Smoothed ground velocity in the body frame (forward, side): frame-time jitter must not flip the gait. */
  private move = new THREE.Vector2();
  private spine: THREE.Bone[];
  /** Spine before the aim bend: the mixer skips bones whose value did not change (still poses), so the bend must not pile up. */
  private bent: THREE.Quaternion[] = [];
  readonly lean = new Lean(); private wounds = 0;
  private idleKey: string; private steps: [string, string];

  constructor(kind: CharKind, private lighting: Lighting, private armed = true, detailedGun = false, outfit?: Outfit, gunModel: GunModel = 'ak') {
    const update = this.root.updateMatrixWorld.bind(this.root);
    this.root.updateMatrixWorld = (force) => void (this.root.visible && update(force));
    this.inst = characters.create(kind);
    this.root.add(this.inst.model);
    this.mixer = new THREE.AnimationMixer(this.inst.model);
    const b = this.inst.bones;
    this.spine = ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'].map((n) => b.get(n)!);
    this.detailed = detailedGun;
    this.arms = [mountGun(this.mixer, this.inst.model, b, lighting, gunModel, detailedGun, armed)];
    if (!armed) this.weapon.visible = false;
    if (outfit) dress(b, outfit, lighting);
    ({ steps: this.steps, idle: this.idleKey } = civilianGait(kind === 'civ_b', (k) => characters.clips.has(k)));
    this.play(armed ? 'idle' : this.steps[0], armed ? 'aim' : this.steps[0], 0);
    this.mixer.update(Math.random());
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
      if (once) next.time = this.overlay!.from;
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      if (this.upper && fade) this.upper.crossFadeTo(next, fade * 0.6, false);
      else this.upper?.stop();
      this.upper = next;
      this.upKey = upKey;
    }
  }

  /** Static extras (seated, chatting, at the railing): loops one full-body clip, advanced by `tick`. */
  loop(key: string): boolean {
    const clip = characters.clips.get(key);
    if (clip) this.mixer.stopAllAction().clipAction(clip).play(); else return false;
    this.mixer.update(Math.random() * clip.duration);
    return true;
  }
  tick(dt: number): void { this.mixer.update(dt); }

  /** Upper-body one-shots: 'reload', 'throw', 'hit'; `from` starts part-way into the clip. */
  gesture(gesture: 'reload' | 'throw' | 'hit', seconds?: number, from = 0): void {
    if (this.dead || this.held) return;
    const key = this.clipFor(gesture), dur = characters.clips.get(key)!.duration;
    if (key === 'hit' && this.overlay && this.overlay.key !== 'hit') return;
    const [a, e] = GESTURE_SPAN[key] ?? [from, dur], start = seconds ? Math.max(from, a, e - GESTURE_MAX_SPEED * seconds) : from;
    this.overlay = { key, t: seconds ?? dur * (key === 'hit' ? 0.35 : 1), from: start };
    this.upKey = '';
    this.mixer.clipAction(parts(key).upper).timeScale = seconds ? (e - start) / seconds : 1;
  }

  /** Ends a torso gesture early (a reload let go of). */
  stopGesture(key: 'reload' | 'throw' | 'hit'): void {
    if (this.overlay?.key === this.clipFor(key)) this.overlay.t = 0;
  }

  private clipFor(gesture: string): string {
    return gesture === 'reload' && this.gunModel === 'pistol' && characters.clips.has('p_reload') ? 'p_reload' : gesture;
  }

  /** Torso frozen at `at` seconds of `key` until `clearPose` (grenade held ready or cocked). */
  pose(key: string, at: number): void {
    if (this.dead || this.held || (this.overlay?.key === key && this.overlay.from === at && this.overlay.t === Infinity)) return;
    this.overlay = { key, t: Infinity, from: at };
    this.upKey = '';
    this.mixer.clipAction(parts(key).upper).timeScale = 0;
  }

  clearPose(): void {
    if (this.overlay?.t !== Infinity) return;
    this.overlay = null;
    this.upKey = '';
  }

  /** A frag grenade in the right hand. */
  set grenadeInHand(v: boolean) {
    if (!this.nade && v) {
      this.nade = new THREE.Mesh(grenadeGeometry(80), this.lighting.setup(new THREE.MeshStandardMaterial({ color: '#4a5232', roughness: 0.6, metalness: 0.3 }), 'grenade'));
      this.nade.position.set(0, 9, 3);
      this.inst.bones.get('mixamorigRightHand')?.add(this.nade);
    }
    if (this.nade) this.nade.visible = v;
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
    if (this.wounds++ < 7) addWound(this.inst.bones, [...this.inst.near, ...this.inst.far], at, this.lighting);
  }

  /** World position of the hips (where a fallen body's torso lies). */
  hips(): THREE.Vector3 { return this.inst.bones.get('mixamorigHips')!.getWorldPosition(new THREE.Vector3()); }

  durationOf(key: string): number { return characters.clips.get(key)?.duration ?? 1; }
  die(kind: string): void {
    [this.held, this.overlay, this.dead] = [null, null, false];
    this.mixer.stopAllAction();
    this.hold(kind, 1, true, CLIP_START[kind] ?? 0);
    this.dead = true;
  }

  /** Back on their feet: plays the get-up clip before locomotion resumes, or `stand` goes straight to idle. */
  revive(stand = false): void {
    this.dead = false;
    this.mixer.stopAllAction();
    [this.held, this.lowKey, this.upKey] = [null, '', ''];
    [this.move.x, this.move.y] = [0, 0];
    if (stand) return void (this.lockT = 0);
    this.hold('getup', 1, true);
    this.lockT = this.durationOf('getup') * 0.9;
  }

  private chooseUpper(low: string, crouch: number): string {
    if (this.overlay) return this.overlay.key;
    if (!this.armed) return low;
    const aim = this.aiming || this.aimT > 0 || (this.gunModel !== 'pistol' && (low === 'idle' || low === 'crouch_idle'));
    const up = aim ? (crouch > 0.5 ? 'crouch_aim' : 'aim') : low;
    return this.gunModel === 'pistol' ? pistolUpper(up) : up;
  }

  animate(dt: number, speed: number, crouch: number, aimPitch: number): void {
    this.acc += dt;
    if (this.isFar && ++this.skip % 2 !== 0) return;
    const step = this.acc;
    this.acc = 0;
    this.lockT -= step;
    this.aimT -= step;
    if (this.lockT <= 0 && this.held?.key === 'getup') this.release();
    if (!this.dead && !this.held) {
      const delta = this.root.position.clone().sub(this.last), yaw = this.root.rotation.y, inv = 1 / Math.max(step, 1e-3);
      const k = 1 - Math.exp(-step * 10);
      this.move.x += ((delta.x * Math.sin(yaw) + delta.z * Math.cos(yaw)) * inv - this.move.x) * k;
      this.move.y += ((delta.x * -Math.cos(yaw) + delta.z * Math.sin(yaw)) * inv - this.move.y) * k;
      const [low, rate] = chooseGait({ armed: this.armed, airborne: this.airborne, aiming: this.aiming, idle: this.scared ? 'terrified' : this.idleKey, steps: this.steps, was: this.lowKey.replace('+', '') }, speed, crouch, this.move.x, this.move.y);
      if (this.overlay && (this.overlay.t -= step) <= 0) {
        this.overlay = null;
        this.upKey = '';
      }
      const up = this.chooseUpper(low, crouch);
      const sway = this.armed && speed >= 0.3 && up !== low && !this.overlay ? '+' : '';
      this.play(low + sway, up + sway);
      const scale = THREE.MathUtils.clamp(rate, 0.6, 1.6);
      if (this.lower) this.lower.timeScale = scale;
      if (this.upper && up === low) this.upper.timeScale = scale;
    }
    this.last.copy(this.root.position);
    this.bent.forEach((q, i) => this.spine[i].quaternion.copy(q));
    this.bent.length = 0;
    this.mixer.update(step);
    this.lean.update(step, this.root.rotation.y, this.dead || this.held ? 0 : this.move.x);
    if (!this.dead && !this.held && (this.armed || this.lean.active)) {
      const bend = this.armed ? aimPitch / 3 : 0, k = this.kick;
      this.spine.forEach((b, i) => (this.bent[i] ??= new THREE.Quaternion()).copy(b.quaternion));
      for (const [i, b] of this.spine.entries()) b.rotateX(-bend - (i === 2 ? k * 0.07 : k * 0.025));
      this.lean.apply(this.spine);
    }
    if (!this.dead && !this.held && this.armed) {
      this.kick = Math.max(0, this.kick - step * 14);
      this.ikW = THREE.MathUtils.damp(this.ikW, !this.holster && (this.grip || speed < 3) && (!this.overlay || this.overlay.key === 'hit') ? 1 : 0, 10, step);
      supportHand(this.inst.bones, this.inst.model, this.ikW, this.grip);
    }
    if (this.armed) this.weapon.visible = !this.holster && (!this.held || this.dead);
  }

  set far(v: boolean) {
    if (v === this.isFar) return;
    this.isFar = v;
    this.inst.near.forEach((m) => (m.visible = !v));
    this.inst.far.forEach((m) => (m.visible = v));
    this.extraNear.forEach((m) => (m.visible = !v));
  }

  set castShadow(v: boolean) { this.root.traverse((o) => o instanceof THREE.Mesh && (o.castShadow = v && !o.userData.noShadow)); }
}
