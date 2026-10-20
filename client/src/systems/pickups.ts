import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';
import type { Heightfield } from '../world/heightfield';

interface Pickup { mesh: THREE.Group; ttl: number; base: number }

function medkitMeshes(lighting: Lighting): { bag: THREE.BufferGeometry; cross: THREE.BufferGeometry; bagMat: THREE.Material; crossMat: THREE.Material } {
  const bag = mergeGeometries([
    new THREE.BoxGeometry(0.42, 0.2, 0.28),
    new THREE.BoxGeometry(0.16, 0.04, 0.05).translate(0, 0.12, 0),
    new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6).rotateZ(Math.PI / 2).translate(0, 0.15, 0),
  ].map((g) => g.toNonIndexed().deleteAttribute('uv')));
  const cross = mergeGeometries([
    new THREE.BoxGeometry(0.13, 0.04, 0.005), new THREE.BoxGeometry(0.04, 0.13, 0.005),
  ].map((g) => g.toNonIndexed().deleteAttribute('uv').translate(0, 0, 0.142)));
  return {
    bag, cross,
    bagMat: lighting.setup(new THREE.MeshStandardMaterial({ color: '#4c5530', roughness: 0.8 }), 'medkit-bag'),
    crossMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2) }),
  };
}

/** Medkits: a few hidden in the map plus occasional drops from fallen enemies. */
export class Pickups {
  readonly group = new THREE.Group();
  private items: Pickup[] = [];
  private parts: ReturnType<typeof medkitMeshes>;
  private t = 0;

  constructor(lighting: Lighting, private hf: Heightfield, fixed: [number, number][]) {
    this.parts = medkitMeshes(lighting);
    for (const [x, z] of fixed) this.spawn(new THREE.Vector3(x, hf.heightAt(x, z), z), Infinity);
  }

  spawn(at: THREE.Vector3, ttl = 60): void {
    const g = new THREE.Group();
    const bag = new THREE.Mesh(this.parts.bag, this.parts.bagMat);
    bag.castShadow = true;
    const front = new THREE.Mesh(this.parts.cross, this.parts.crossMat);
    const back = front.clone();
    back.rotation.y = Math.PI;
    g.add(bag, front, back);
    const base = this.hf.heightAt(at.x, at.z) + 0.35;
    g.position.set(at.x, base, at.z);
    this.group.add(g);
    this.items.push({ mesh: g, ttl, base });
  }

  /** Returns true when the player collected one this frame. */
  update(dt: number, player: THREE.Vector3, wantsHeal: boolean): boolean {
    this.t += dt;
    let picked = false;
    this.items = this.items.filter((p) => {
      p.ttl -= dt;
      p.mesh.rotation.y += dt * 1.2;
      p.mesh.position.y = p.base + Math.sin(this.t * 2.4) * 0.05;
      p.mesh.visible = p.ttl > 5 || Math.sin(this.t * 14) > 0;
      const close = wantsHeal && !picked && Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z) < 1.3 && Math.abs(p.base - player.y) < 1.6;
      if (close) picked = true;
      if (close || p.ttl <= 0) {
        this.group.remove(p.mesh);
        return false;
      }
      return true;
    });
    return picked;
  }
}
