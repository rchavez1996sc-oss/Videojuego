import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { buildAK } from '../weapons/akModel';
import { mergeRig } from '../render/merge';

export interface Palette { id: string; cloth: string; vest: string; skin: string; helmet: string }

export const PLAYER_PALETTE: Palette = { id: 'p', cloth: '#4b4a36', vest: '#2f3226', skin: '#a07258', helmet: '#4b4a36' };

/** Placeholder soldier until the Mixamo rig arrives (Fase 1). */
export class Mannequin {
  readonly root = new THREE.Group();
  private legs: THREE.Object3D[] = [];
  private arms: THREE.Object3D[] = [];
  private torso: THREE.Object3D;
  private phase = 0;
  readonly muzzle: THREE.Object3D;
  readonly ejector: THREE.Object3D;
  readonly weapon: THREE.Object3D;

  readonly head: THREE.Object3D;
  readonly hips: THREE.Group;

  constructor(lighting: Lighting, pal: Palette = PLAYER_PALETTE, private armed = true) {
    const std = (key: string, color: string, r = 0.85) => lighting.setup(new THREE.MeshStandardMaterial({ color, roughness: r }), `${key}-${pal.id}`);
    const cloth = std('m-cloth', pal.cloth), vest = std('m-vest', pal.vest), skin = std('m-skin', pal.skin, 0.6);
    const gear = std('m-gear', '#1d1e1a', 0.5), helmet = std('m-helmet', pal.helmet, 0.7);
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, pos: [number, number, number]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const hips = (this.hips = new THREE.Group());
    hips.position.y = 0.95;
    this.root.add(hips);
    this.torso = new THREE.Group();
    hips.add(this.torso);
    part(new THREE.CapsuleGeometry(0.2, 0.38, 6, 12), cloth, this.torso, [0, 0.33, 0]);
    part(new THREE.BoxGeometry(0.44, 0.42, 0.3), vest, this.torso, [0, 0.36, 0.01]);
    for (const x of [-0.12, 0, 0.12]) part(new THREE.BoxGeometry(0.1, 0.14, 0.06), gear, this.torso, [x, 0.3, 0.18]);
    const head = part(new THREE.SphereGeometry(0.115, 16, 12), skin, this.torso, [0, 0.76, 0.01]);
    part(new THREE.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), helmet, head, [0, 0.02, -0.005]);
    this.head = new THREE.Object3D();
    this.head.position.set(0, 0.76, 0.01);
    this.torso.add(this.head);
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.11, 0, 0);
      hips.add(leg);
      part(new THREE.CapsuleGeometry(0.085, 0.75, 4, 10), cloth, leg, [0, -0.45, 0]);
      part(new THREE.BoxGeometry(0.13, 0.11, 0.27), gear, leg, [0, -0.9, 0.04]);
      this.legs.push(leg);
      const arm = new THREE.Group();
      arm.position.set(s * 0.27, 0.58, 0);
      this.torso.add(arm);
      const a = part(new THREE.CapsuleGeometry(0.06, 0.48, 4, 8), cloth, arm, [0, -0.2, 0.12]);
      a.rotation.x = armed ? -1.1 : 0;
      if (!armed) a.position.set(0, -0.28, 0);
      this.arms.push(arm);
    }
    const ak = armed ? buildAK(lighting) : null;
    if (ak) {
      ak.group.position.set(0.13, 0.43, 0.3);
      this.torso.add(ak.group);
    }
    this.muzzle = ak?.muzzle ?? new THREE.Object3D();
    this.ejector = ak?.ejector ?? new THREE.Object3D();
    this.weapon = ak?.group ?? new THREE.Group();
    mergeRig(this.root, new Set([hips, this.torso, this.weapon, ...this.legs, ...this.arms]), lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 'm-baked'));
  }

  set castShadow(v: boolean) {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = v;
    });
  }

  animate(dt: number, speed: number, crouch: number, aimPitch: number): void {
    this.phase += dt * (2 + speed * 1.6);
    const amp = Math.min(speed / 5, 1) * 0.7;
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase + i * Math.PI) * amp));
    this.arms.forEach((a, i) => (a.rotation.x = this.armed ? -0.2 + Math.sin(this.phase + i * Math.PI) * amp * 0.15 : -Math.sin(this.phase + i * Math.PI) * amp * 0.9));
    this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, -aimPitch * 0.5 + crouch * 0.35, 0.2);
    this.root.children[0].position.y = 0.95 - crouch * 0.35 + Math.abs(Math.sin(this.phase)) * amp * 0.05;
  }
}
