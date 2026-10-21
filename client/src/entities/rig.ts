import * as THREE from 'three';
import { characters, type CharKind } from '../render/characters';
import { buildAK } from '../weapons/akModel';
import { bakeLod } from '../render/merge';
import type { Lighting } from '../render/lighting';

const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/;
const split = new Map<string, { lower: THREE.AnimationClip; upper: THREE.AnimationClip; full: THREE.AnimationClip }>();

function parts(key: string) {
  let p = split.get(key);
  if (!p) {
    const full = characters.clips.get(key)!;
    const isUpper = (t: THREE.KeyframeTrack) => UPPER.test(t.name.slice(0, t.name.lastIndexOf('.')));
    p = { full, lower: new THREE.AnimationClip(`${key}-lo`, full.duration, full.tracks.filter((t) => !isUpper(t))), upper: new THREE.AnimationClip(`${key}-up`, full.duration, full.tracks.filter(isUpper)) };
    split.set(key, p);
  }
  return p;
}

/** Reference ground speed (m/s) of each locomotion clip, to keep feet from sliding. */
const PACE: Record<string, number> = { walk: 1.5, run: 3.7, sprint: 5.8, crouch: 1.2, civ_walk: 1.4, civ_run: 3.9 };
const DIR8 = ['f', 'fr', 'r', 'br', 'b', 'bl', 'l', 'fl'];
const DIR4 = ['f', 'r', 'b', 'l'];
const FADE = 0.2;

/** Faction dress on top of the base character: which arms get bands, scarf/beanie colours, balaclava. */
export interface Outfit { color: string; bands?: ('Left' | 'Right')[]; scarf?: string; balaclava?: boolean; beanie?: string }

/** Skinned Mixamo soldier/civilian with layered animation; drop-in replacement for the procedural Mannequin. */
export class Rig {
  readonly root = new THREE.Group();
  readonly muzzle: THREE.Object3D;
  readonly ejector: THREE.Object3D;
  readonly weapon: THREE.Object3D;
  scared = false;
  private mixer: THREE.AnimationMixer;
  private inst: ReturnType<typeof characters.create>;
  private lowKey = '';
  private upKey = '';
  private lower: THREE.AnimationAction | null = null;
  private upper: THREE.AnimationAction | null = null;
  private overlay: { key: string; t: number } | null = null;
  private lockT = 0;
  private dead = false;
  private isFar = false;
  private skip = 0;
  private acc = 0;
  private last = new THREE.Vector3();
  private hands: [THREE.Bone, THREE.Bone];
  private spine: THREE.Bone[];
  private tmp = new THREE.Matrix4();

  constructor(kind: CharKind, lighting: Lighting, private armed = true, detailedGun = false, outfit?: Outfit) {
    this.inst = characters.create(kind);
    this.root.add(this.inst.model);
    this.mixer = new THREE.AnimationMixer(this.inst.model);
    const b = this.inst.bones;
    this.hands = [b.get('mixamorigRightHand')!, b.get('mixamorigLeftHand')!];
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
    this.weapon.visible = armed;
    this.root.add(this.weapon);
    if (outfit) this.dress(outfit, lighting);
    this.play(armed ? 'idle' : 'civ_walk', armed ? 'idle' : 'civ_walk', 0);
    this.mixer.update(Math.random());
  }

  /** Faction pieces bound to bones (rig space is centimetres): arm bands, neck scarf, balaclava, beanie. */
  private dress(o: Outfit, lighting: Lighting): void {
    const mat = (c: string) => lighting.setup(new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 }), `outfit-${c}`);
    const bone = (n: string) => this.inst.bones.get(`mixamorig${n}`);
    const add = (n: string, geo: THREE.BufferGeometry, color: string, y: number, rx = 0) => {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.y = y;
      m.rotation.x = rx;
      bone(n)?.add(m);
    };
    for (const side of o.bands ?? []) add(`${side}Arm`, new THREE.CylinderGeometry(6.2, 6.2, 9, 12, 1, true), o.color, 11);
    if (o.scarf) {
      add('Neck', new THREE.TorusGeometry(7.5, 3.2, 8, 16), o.scarf, 3, Math.PI / 2);
      add('Neck', new THREE.ConeGeometry(7, 10, 8, 1, true), o.scarf, -2, Math.PI);
    }
    if (o.balaclava) add('Head', new THREE.SphereGeometry(12.2, 16, 12).scale(0.92, 1.12, 1.04).translate(0, 0, 1.6), '#141416', 9.5);
    if (o.beanie) add('Head', new THREE.SphereGeometry(11.9, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.95, 0.9, 1.05), o.beanie, 13);
  }

  private action(clip: THREE.AnimationClip): THREE.AnimationAction {
    return this.mixer.clipAction(clip);
  }

  private play(lowKey: string, upKey: string, fade = FADE): void {
    if (lowKey !== this.lowKey) {
      const next = this.action(parts(lowKey).lower).reset().play();
      if (this.lower && fade) this.lower.crossFadeTo(next, fade, false);
      else this.lower?.stop();
      this.lower = next;
      this.lowKey = lowKey;
    }
    if (upKey !== this.upKey) {
      const next = this.action(parts(upKey).upper).reset().play();
      const once = this.overlay?.key === upKey && upKey !== 'fire';
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      if (this.upper && fade) this.upper.crossFadeTo(next, fade * 0.6, false);
      else this.upper?.stop();
      this.upper = next;
      this.upKey = upKey;
    }
  }

  /** Short upper-body overlays: 'fire' (refreshed per shot), 'reload', 'throw', 'hit'. */
  gesture(key: 'fire' | 'reload' | 'throw' | 'hit', seconds?: number): void {
    if (this.dead || (this.overlay && this.overlay.key !== 'fire' && this.overlay.key !== 'hit' && key === 'fire')) return;
    const dur = characters.clips.get(key)!.duration;
    const t = key === 'fire' ? 0.3 : seconds ?? dur * (key === 'hit' ? 0.35 : 1);
    if (this.overlay?.key === key) this.overlay.t = Math.max(this.overlay.t, t);
    else {
      this.overlay = { key, t };
      this.upKey = '';
    }
    if (seconds && key !== 'fire') this.mixer.clipAction(parts(key).upper).timeScale = dur / seconds;
  }

  fire(): void {
    this.gesture('fire');
  }

  die(kind: string): void {
    this.dead = true;
    this.overlay = null;
    this.mixer.stopAllAction();
    const a = this.action(parts(kind).full).reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    this.lowKey = this.upKey = '';
    this.lower = this.upper = null;
  }

  /** Back on their feet: plays the get-up clip before locomotion resumes. */
  revive(): void {
    this.dead = false;
    this.mixer.stopAllAction();
    const a = this.action(parts('getup').full).reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    this.lockT = a.getClip().duration * 0.9;
    this.lowKey = this.upKey = '';
    this.lower = this.upper = null;
  }

  private chooseLower(speed: number, crouch: number, fwd: number, side: number): [string, number] {
    if (!this.armed) {
      if (speed < 0.3) return [this.scared ? 'terrified' : 'idle', 1];
      return speed < 2.6 ? ['civ_walk', speed / PACE.civ_walk] : ['civ_run', speed / PACE.civ_run];
    }
    const ang = Math.atan2(side, fwd);
    if (crouch > 0.5) {
      if (speed < 0.3) return ['crouch_idle', 1];
      return [`crouch_${DIR4[Math.round(((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4]}`, speed / PACE.crouch];
    }
    if (speed < 0.3) return ['idle', 1];
    if (speed > 5 && fwd > speed * 0.8) return ['sprint', speed / PACE.sprint];
    const dir = DIR8[Math.round(((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
    return speed < 2.8 ? [`walk_${dir}`, speed / PACE.walk] : [`run_${dir}`, speed / PACE.run];
  }

  animate(dt: number, speed: number, crouch: number, aimPitch: number): void {
    this.acc += dt;
    if (this.isFar && ++this.skip % 3 !== 0) return;
    const step = this.acc;
    this.acc = 0;
    if (!this.dead && this.lockT <= 0) {
      const delta = this.root.position.clone().sub(this.last);
      const yaw = this.root.rotation.y;
      const fwd = (delta.x * Math.sin(yaw) + delta.z * Math.cos(yaw)) / Math.max(step, 1e-3);
      const side = (delta.x * -Math.cos(yaw) + delta.z * Math.sin(yaw)) / Math.max(step, 1e-3);
      const [low, rate] = this.chooseLower(speed, crouch, fwd, side);
      if (this.overlay && (this.overlay.t -= step) <= 0) {
        this.overlay = null;
        this.upKey = '';
      }
      const up = this.overlay?.key ?? (this.armed && low === 'idle' && crouch < 0.5 ? 'aim' : low.startsWith('civ') && low !== 'civ_run' ? 'civ_walk' : low);
      this.play(low, up);
      if (this.lower) this.lower.timeScale = low === 'idle' && !this.armed ? 0 : THREE.MathUtils.clamp(rate, 0.6, 1.6);
      if (this.upper && up === low) this.upper.timeScale = this.lower!.timeScale;
      if (this.upper && !this.armed && up === 'civ_walk' && low !== 'civ_walk') this.upper.timeScale = 0;
    }
    this.lockT -= step;
    this.last.copy(this.root.position);
    this.mixer.update(step);
    if (!this.dead && this.armed && aimPitch) for (const b of this.spine) b.rotateX(-aimPitch / 3);
    if (this.armed && this.weapon.visible) this.placeWeapon();
  }

  /** Rifle between the hands: grip at the right hand, barrel through the left. */
  private placeWeapon(): void {
    this.root.updateMatrixWorld(true);
    const inv = this.tmp.copy(this.root.matrixWorld).invert();
    const rh = this.hands[0].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const lh = this.hands[1].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const dir = lh.sub(rh).normalize().add(new THREE.Vector3(0, 0, this.dead ? 0 : 0.9)).normalize();
    const m = new THREE.Matrix4().lookAt(rh.clone().add(dir), rh, new THREE.Vector3(0, 1, 0));
    this.weapon.quaternion.setFromRotationMatrix(m);
    this.weapon.position.copy(rh).add(new THREE.Vector3(0, 0.05, 0.04).applyQuaternion(this.weapon.quaternion));
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
