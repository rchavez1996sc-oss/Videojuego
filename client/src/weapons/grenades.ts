import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';
import type { Heightfield } from '../world/heightfield';

const UP = new THREE.Vector3(0, 1, 0);
const FUSE = 3.5, RADIUS = 0.05, BOUNCE = 0.3, GRAVITY = 9.81;
/** Hand throw: release speed (m/s) and the extra upward angle a thrower gives over the line of sight. */
export const THROW_SPEED = 15, THROW_LOFT = 0.2;
/** Grip loss on impact (tangential speed kept) and rolling resistance on the ground (m/s²). */
const SKID = 0.7, ROLL_DRAG = 2.2;

/** Launch velocity for a throw along `dir` (the same rule draws the aiming arc). */
export function throwVelocity(dir: THREE.Vector3, inherit = new THREE.Vector3()): THREE.Vector3 {
  const flat = Math.hypot(dir.x, dir.z) || 1, pitch = Math.atan2(dir.y, flat) + THROW_LOFT;
  return new THREE.Vector3((dir.x / flat) * Math.cos(pitch), Math.sin(pitch), (dir.z / flat) * Math.cos(pitch)).multiplyScalar(THROW_SPEED).add(inherit);
}

interface Live { pos: THREE.Vector3; vel: THREE.Vector3; spin: THREE.Vector3; mesh: THREE.Mesh; fuse: number; resting: boolean; warned: boolean; ground: THREE.Vector3 | null; rollA: number; stuck: number }

/** Frag grenades integrated by hand with ray casts (Rapier dynamic balls tunnel through the big heightfield). */
export class Grenades {
  readonly group = new THREE.Group();
  count = 3;
  onExplode: (at: THREE.Vector3) => void = () => {};
  onSettled: (at: THREE.Vector3) => void = () => {};
  private live: Live[] = [];
  private geo: THREE.BufferGeometry;
  private mat: THREE.Material;
  private cooldown = 0;

  constructor(private world: RAPIER.World, private hf: Heightfield, lighting: Lighting, private exclude: () => number) {
    this.geo = mergeGeometries([
      new THREE.SphereGeometry(0.045, 12, 10).scale(1, 1.2, 1),
      new THREE.CylinderGeometry(0.016, 0.016, 0.035, 8).translate(0, 0.06, 0),
      new THREE.BoxGeometry(0.012, 0.05, 0.02).translate(0.022, 0.045, 0),
    ].map((g) => g.toNonIndexed().deleteAttribute('uv')));
    this.mat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#4a5232', roughness: 0.6, metalness: 0.3 }), 'grenade');
  }

  throw(from: THREE.Vector3, dir: THREE.Vector3, inherit: THREE.Vector3): boolean {
    if (this.count <= 0 || this.cooldown > 0) return false;
    this.count--;
    this.cooldown = 0.9;
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    mesh.position.copy(from);
    this.group.add(mesh);
    this.live.push({
      pos: from.clone(), vel: throwVelocity(dir, inherit),
      spin: new THREE.Vector3(6 + Math.random() * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4), mesh, fuse: FUSE, resting: false, warned: false, ground: null, rollA: 0, stuck: 0,
    });
    return true;
  }

  private cast(from: THREE.Vector3, dir: THREE.Vector3, len: number) {
    const ex = this.exclude();
    return this.world.castRayAndGetNormal(new RAPIER.Ray(from, dir), len, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => c.handle !== ex && c.isEnabled());
  }

  /** Free flight with bounces (restitution on the normal, grip loss along it), then rolling on the surface until it stops. */
  private step(g: Live, dt: number): void {
    if (g.resting) return;
    if (g.ground) return this.roll(g, dt);
    const before = g.pos.clone();
    this.fly(g, dt);
    g.stuck = g.pos.distanceTo(before) < 0.004 ? g.stuck + dt : 0;
    if (g.stuck > 0.3) g.resting = true;
  }

  private fly(g: Live, dt: number): void {
    g.vel.y -= GRAVITY * dt;
    const move = g.vel.clone().multiplyScalar(dt), len = move.length();
    const dir = move.clone().divideScalar(len || 1);
    const hit = len > 0 ? this.cast(g.pos, dir, len + RADIUS) : null;
    let n: THREE.Vector3 | null = null;
    if (hit) {
      g.pos.addScaledVector(dir, Math.max(0, hit.timeOfImpact - RADIUS));
      n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    } else {
      g.pos.add(move);
      const ground = this.hf.heightAt(g.pos.x, g.pos.z) + RADIUS;
      if (g.pos.y < ground - 0.25) {
        g.pos.y = ground;
        n = new THREE.Vector3(...this.hf.normalAt(g.pos.x, g.pos.z));
      }
    }
    if (!n) return;
    const vn = g.vel.dot(n);
    if (vn >= 0) return;
    const tangent = g.vel.clone().addScaledVector(n, -vn).multiplyScalar(SKID);
    g.vel.copy(tangent).addScaledVector(n, -vn * BOUNCE);
    g.spin.multiplyScalar(0.5);
    if (-vn * BOUNCE < 1.1 && n.y > 0.55) {
      g.vel.copy(tangent);
      g.ground = n;
    }
  }

  /** Rolls along the floor about its long axis: slope pull, rolling resistance, follows the surface by a ray down; drops back to flight off an edge; rests when it stops or wedges. */
  private roll(g: Live, dt: number): void {
    const n = g.ground!, pull = new THREE.Vector3(0, -GRAVITY, 0).addScaledVector(n, GRAVITY * n.y);
    g.vel.addScaledVector(pull, dt).addScaledVector(n, -g.vel.dot(n));
    const speed = g.vel.length(), slow = Math.max(0, speed - ROLL_DRAG * dt);
    if (slow < 0.12 && pull.length() < 2.5) {
      g.vel.set(0, 0, 0);
      g.resting = true;
      return;
    }
    g.vel.multiplyScalar(speed > 0 ? slow / speed : 0);
    const move = g.vel.clone().multiplyScalar(dt), len = move.length();
    g.stuck = len < 0.004 ? g.stuck + dt : 0;
    if (g.stuck > 0.3) {
      g.resting = true;
      return;
    }
    if (len > 1e-5) {
      const wall = this.cast(g.pos, move.clone().divideScalar(len), len + RADIUS);
      if (wall && Math.abs(wall.normal.y) < 0.55) {
        const wn = new THREE.Vector3(wall.normal.x, wall.normal.y, wall.normal.z);
        g.vel.addScaledVector(wn, -(1 + BOUNCE) * g.vel.dot(wn)).multiplyScalar(0.6);
        return;
      }
      g.pos.add(move);
    }
    const down = this.cast(g.pos.clone().setY(g.pos.y + 0.2), new THREE.Vector3(0, -1, 0), 0.2 + RADIUS + 0.15);
    if (!down || down.normal.y < 0.5) {
      g.ground = null;
      return;
    }
    g.pos.y += 0.2 - down.timeOfImpact + RADIUS;
    g.ground = new THREE.Vector3(down.normal.x, down.normal.y, down.normal.z);
    if (speed > 0.05) g.spin.crossVectors(g.ground, g.vel).multiplyScalar(1 / RADIUS);
  }

  update(dt: number): void {
    this.cooldown -= dt;
    this.live = this.live.filter((g) => {
      g.fuse -= dt;
      this.step(g, dt / 2);
      this.step(g, dt / 2);
      g.mesh.position.copy(g.pos);
      const w = g.spin.length();
      if (g.ground && w > 1e-3 && !g.resting) {
        g.rollA += w * dt;
        g.mesh.quaternion.setFromUnitVectors(UP, g.spin.clone().divideScalar(w)).multiply(new THREE.Quaternion().setFromAxisAngle(UP, g.rollA));
      } else if (w > 1e-3 && !g.resting) g.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(g.spin.clone().divideScalar(w), w * dt));
      if (!g.warned && g.vel.length() < 3 && g.fuse < FUSE - 0.6) {
        g.warned = true;
        this.onSettled(g.pos.clone());
      }
      if (g.fuse > 0) return true;
      this.group.remove(g.mesh);
      this.onExplode(g.pos.clone());
      return false;
    });
  }
}
