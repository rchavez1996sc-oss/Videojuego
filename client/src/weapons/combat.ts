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
    const [kUp, kSide] = this.gun.recoil(aiming);
    this.cam.kick(kUp, kSide, aiming ? 0.012 : 0.02);
    if (this.gun.ammo === 0 && this.gun.startReload()) this.sfx.reload(true);

    if (!hit) return;
    const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    const handle = hit.collider.handle;
    const travelled = muzzle.distanceTo(end);
    const falloff = travelled <= def.falloffStart ? 1 : THREE.MathUtils.lerp(1, def.falloffMin, Math.min(1, (travelled - def.falloffStart) / (def.range - def.falloffStart)));
    const handler = hitHandler(handle);
    if (handler) {
      handler(def.damage * falloff, end);
      return;
    }
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

  /** Small burst used by targets and later by enemies. */
  sparkBurst(point: THREE.Vector3, normal: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      this.tmp.copy(normal).multiplyScalar(3 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5));
      this.sparks.emit({ pos: point.clone(), vel: this.tmp.clone(), color: new THREE.Color(6, 3.5, 1.2), size: 0.025, grow: -0.02, life: 0.25, gravity: 9.8, drag: 1, alpha: 1 });
    }
  }
}
