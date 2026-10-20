import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Gun } from './gun';
import type { WeaponDef } from './types';
import type { Input } from '../core/input';
import type { ThirdPersonCamera } from '../core/camera';
import type { Player } from '../entities/player';
import type { Sfx } from '../audio/sfx';
import { Particles } from '../fx/particles';
import { Decals } from '../fx/decals';
import { Tracers } from '../fx/tracers';
import { MuzzleFlash } from '../fx/muzzleFlash';
import { Shells } from '../fx/shells';
import { SURFACE_FX, hitHandler, surfaceOf, type Surface } from '../world/surfaces';
import type { Lighting } from '../render/lighting';
import type { Heightfield } from '../world/heightfield';

export interface HitEvent { kill: boolean; headshot: boolean }

export class Combat {
  readonly group = new THREE.Group();
  readonly gun: Gun;
  onHitConfirmed: (e: HitEvent) => void = () => {};
  onShot: (from: THREE.Vector3) => void = () => {};
  private dust = new Particles(1500, false);
  private sparks = new Particles(400, true);
  private decals: Decals;
  private tracers = new Tracers();
  private flash = new MuzzleFlash();
  private shells: Shells;
  private shots = 0;
  private tmp = new THREE.Vector3();

  constructor(def: WeaponDef, private world: RAPIER.World, private player: Player, private cam: ThirdPersonCamera, private sfx: Sfx, lighting: Lighting, hf: Heightfield) {
    this.gun = new Gun(def);
    this.decals = new Decals(lighting);
    this.shells = new Shells(lighting, hf, () => sfx.shellBounce());
    this.group.add(this.dust.points, this.sparks.points, this.decals.mesh, this.tracers.group, this.flash.group, this.shells.mesh);
  }

  update(dt: number, input: Input, aiming: boolean, airborne: boolean): void {
    if (input.hit('KeyR') && this.gun.startReload()) this.sfx.reload(this.gun.ammo === 0);
    if (input.hit('KeyB')) this.gun.toggleMode();
    const result = this.gun.update(dt, input.firing, input.hit('Mouse0'));
    if (result === 'dry') {
      this.sfx.dryFire();
      if (this.gun.startReload()) this.sfx.reload(true);
    } else if (result === 'fire') {
      this.fire(aiming, airborne);
    } else if (!input.firing) {
      this.cam.recover(dt, this.gun.def.recoilRecover);
    }
    this.dust.update(dt);
    this.sparks.update(dt);
    this.tracers.update(dt);
    this.flash.update(dt);
    this.shells.update(dt);
  }

  /** Test hook for automated screenshots. */
  debugShoot(): void {
    if (this.gun.ammo > 0) {
      this.gun.ammo--;
      this.fire(true, false);
    }
  }

  private ray(origin: THREE.Vector3, dir: THREE.Vector3, max: number) {
    const exclude = this.player.collisionHandle;
    return this.world.castRayAndGetNormal(new RAPIER.Ray(origin, dir), max, true, undefined, undefined, undefined, undefined, (c) => c.handle !== exclude);
  }

  private fire(aiming: boolean, airborne: boolean): void {
    const def = this.gun.def, camera = this.cam.camera;
    const cone = THREE.MathUtils.degToRad(this.gun.coneDeg(aiming, this.player.speed, airborne));
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const r = Math.sqrt(Math.random()) * Math.tan(cone), a = Math.random() * Math.PI * 2;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();

    const camHit = this.ray(camera.position, dir, def.range);
    const aimPoint = camera.position.clone().addScaledVector(dir, camHit ? camHit.timeOfImpact : def.range);
    const muzzle = this.player.model.muzzle.getWorldPosition(new THREE.Vector3());
    const toAim = aimPoint.clone().sub(muzzle);
    const dist = toAim.length();
    toAim.normalize();
    const hit = this.ray(muzzle, toAim, dist + 0.5);
    const end = hit ? muzzle.clone().addScaledVector(toAim, hit.timeOfImpact) : aimPoint;

    this.flash.fire(this.player.model.muzzle);
    if (this.shots++ % def.tracerEvery === 0) this.tracers.fire(muzzle, end);
    this.shells.eject(this.player.model.ejector, right);
    this.sfx.rifleShot();
    this.onShot(muzzle);
    const [kUp, kSide] = this.gun.recoil(aiming);
    this.cam.kick(kUp, kSide, aiming ? 0.012 : 0.02);
    if (this.gun.ammo === 0 && this.gun.startReload()) this.sfx.reload(true);

    if (!hit) return;
    const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    const handle = hit.collider.handle;
    const travelled = muzzle.distanceTo(end);
    const falloff = travelled <= def.falloffStart ? 1 : THREE.MathUtils.lerp(1, def.falloffMin, Math.min(1, (travelled - def.falloffStart) / (def.range - def.falloffStart)));
    const handler = hitHandler(handle);
    if (handler && handler(def.damage * falloff, end) !== false) return;
    this.impact(end, normal, surfaceOf(handle), toAim);
  }

  impact(point: THREE.Vector3, normal: THREE.Vector3, surface: Surface, dir: THREE.Vector3): void {
    const fx = SURFACE_FX[surface];
    const color = new THREE.Color(fx.dust);
    this.decals.place(point, normal, fx.decal, new THREE.Color(fx.decalColor).multiplyScalar(3));
    for (let i = 0; i < 7; i++) {
      this.tmp.copy(normal).multiplyScalar(1 + Math.random() * 2.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6));
      this.dust.emit({ pos: point.clone().addScaledVector(normal, 0.05), vel: this.tmp.clone(), color: color.clone().multiplyScalar(0.8 + Math.random() * 0.3), size: 0.12 + Math.random() * 0.12, grow: 0.9, life: 0.9 + Math.random() * 0.9, gravity: 0.6, drag: 2.5, alpha: 0.55 });
    }
    for (let i = 0; i < 6; i++) {
      this.tmp.copy(normal).multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3));
      this.dust.emit({ pos: point.clone(), vel: this.tmp.clone(), color: color.clone().multiplyScalar(0.45), size: 0.025 + Math.random() * 0.02, grow: 0, life: 0.7, gravity: 9.8, drag: 0.5, alpha: 1 });
    }
    if (fx.sparks) {
      const refl = dir.clone().reflect(normal);
      for (let i = 0; i < 8; i++) {
        this.tmp.copy(refl).multiplyScalar(5 + Math.random() * 6).add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4));
        this.sparks.emit({ pos: point.clone(), vel: this.tmp.clone(), color: new THREE.Color(6, 3.5, 1.2), size: 0.022, grow: -0.02, life: 0.18 + Math.random() * 0.15, gravity: 9.8, drag: 1, alpha: 1 });
      }
    }
    this.sfx.impact(surface, point.distanceTo(this.cam.camera.position));
  }

  explosionFx(at: THREE.Vector3): void {
    const up = new THREE.Vector3(0, 1, 0);
    this.decals.place(at.clone().setY(at.y - 0.03), up, 2.6, new THREE.Color('#1a140f'));
    this.sparks.emit({ pos: at.clone().setY(at.y + 0.5), vel: new THREE.Vector3(), color: new THREE.Color(9, 5, 2), size: 7, grow: 6, life: 0.16, gravity: 0, drag: 0, alpha: 1 });
    for (let i = 0; i < 14; i++) {
      this.tmp.set((Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5);
      this.sparks.emit({ pos: at.clone().setY(at.y + 0.3), vel: this.tmp.clone(), color: new THREE.Color(7, 3, 1), size: 0.9, grow: 1.5, life: 0.25 + Math.random() * 0.15, gravity: 0, drag: 4, alpha: 1 });
    }
    for (let i = 0; i < 30; i++) {
      this.tmp.set((Math.random() - 0.5) * 18, 3 + Math.random() * 12, (Math.random() - 0.5) * 18);
      this.sparks.emit({ pos: at.clone().setY(at.y + 0.2), vel: this.tmp.clone(), color: new THREE.Color(6, 3.5, 1.2), size: 0.035, grow: 0, life: 0.6 + Math.random() * 0.5, gravity: 9.8, drag: 0.6, alpha: 1 });
    }
    for (let i = 0; i < 26; i++) {
      this.tmp.set((Math.random() - 0.5) * 12, 2 + Math.random() * 9, (Math.random() - 0.5) * 12);
      this.dust.emit({ pos: at.clone(), vel: this.tmp.clone(), color: new THREE.Color('#2e261e'), size: 0.05 + Math.random() * 0.05, grow: 0, life: 1.2, gravity: 9.8, drag: 0.4, alpha: 1 });
    }
    for (let i = 0; i < 18; i++) {
      this.tmp.set((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
      const shade = 0.25 + Math.random() * 0.25;
      this.dust.emit({ pos: at.clone().setY(at.y + 0.6), vel: this.tmp.clone(), color: new THREE.Color(shade, shade * 0.92, shade * 0.85), size: 1.2 + Math.random(), grow: 2.2, life: 3 + Math.random() * 2.5, gravity: -0.15, drag: 1.2, alpha: 0.6 });
    }
  }

  smokePuff(at: THREE.Vector3): void {
    const shade = 0.12 + Math.random() * 0.12;
    this.tmp.set((Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6);
    this.dust.emit({ pos: at.clone(), vel: this.tmp.clone(), color: new THREE.Color(shade, shade, shade * 1.05), size: 0.6 + Math.random() * 0.4, grow: 1.6, life: 2.5 + Math.random() * 1.5, gravity: -0.4, drag: 0.8, alpha: 0.5 });
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    this.tracers.fire(from, to);
  }

  bloodPuff(point: THREE.Vector3): void {
    for (let i = 0; i < 9; i++) {
      this.tmp.set((Math.random() - 0.5) * 1.4, Math.random() * 0.9, (Math.random() - 0.5) * 1.4);
      this.dust.emit({ pos: point.clone(), vel: this.tmp.clone(), color: new THREE.Color(0.32 + Math.random() * 0.1, 0.03, 0.02), size: 0.08 + Math.random() * 0.1, grow: 0.5, life: 0.45 + Math.random() * 0.3, gravity: 2.5, drag: 3, alpha: 0.75 });
    }
  }

  /** Small burst used by targets and later by enemies. */
  sparkBurst(point: THREE.Vector3, normal: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      this.tmp.copy(normal).multiplyScalar(3 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5));
      this.sparks.emit({ pos: point.clone(), vel: this.tmp.clone(), color: new THREE.Color(6, 3.5, 1.2), size: 0.025, grow: -0.02, life: 0.25, gravity: 9.8, drag: 1, alpha: 1 });
    }
  }
}
