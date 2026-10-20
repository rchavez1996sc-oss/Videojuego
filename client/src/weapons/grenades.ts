import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';
import type { Heightfield } from '../world/heightfield';

const FUSE = 3.5, RADIUS = 0.05, BOUNCE = 0.35, GRAVITY = 9.81;

interface Live { pos: THREE.Vector3; vel: THREE.Vector3; spin: THREE.Vector3; mesh: THREE.Mesh; fuse: number; resting: boolean; warned: boolean }

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
      pos: from.clone(), vel: dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0)).add(inherit),
      spin: new THREE.Vector3(Math.random() * 12, Math.random() * 6, Math.random() * 12), mesh, fuse: FUSE, resting: false, warned: false,
    });
    return true;
  }

  private step(g: Live, dt: number): void {
    if (g.resting) return;
    g.vel.y -= GRAVITY * dt;
    const move = g.vel.clone().multiplyScalar(dt), len = move.length();
    const dir = move.clone().divideScalar(len || 1);
    const ex = this.exclude();
    const hit = len > 0 ? this.world.castRayAndGetNormal(new RAPIER.Ray(g.pos, dir), len + RADIUS, true, undefined, undefined, undefined, undefined, (c) => c.handle !== ex && c.isEnabled()) : null;
    let n: THREE.Vector3 | null = null;
    if (hit) {
      g.pos.addScaledVector(dir, Math.max(0, hit.timeOfImpact - RADIUS));
      n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    } else {
      g.pos.add(move);
      const ground = this.hf.heightAt(g.pos.x, g.pos.z) + RADIUS;
      if (g.pos.y < ground) {
        g.pos.y = ground;
        n = new THREE.Vector3(...this.hf.normalAt(g.pos.x, g.pos.z));
      }
    }
    if (!n) return;
    const vn = g.vel.dot(n);
    if (vn < 0) g.vel.addScaledVector(n, -(1 + BOUNCE) * vn);
    g.vel.multiplyScalar(0.72);
    g.spin.multiplyScalar(0.6);
    if (g.vel.length() < 0.7 && n.y > 0.6) {
      g.vel.set(0, 0, 0);
      g.resting = true;
    }
  }

  update(dt: number): void {
    this.cooldown -= dt;
    this.live = this.live.filter((g) => {
      g.fuse -= dt;
      this.step(g, dt / 2);
      this.step(g, dt / 2);
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.spin.x * dt;
      g.mesh.rotation.y += g.spin.y * dt;
      g.mesh.rotation.z += g.spin.z * dt;
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
