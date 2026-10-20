import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';
import type { Heightfield } from '../world/heightfield';
import type { Player } from '../entities/player';
import type { Gun } from '../weapons/gun';
import type { Grenades } from '../weapons/grenades';
import type { Sfx } from '../audio/sfx';
import type { Hud } from '../ui/hud';

export type SupplyKind = 'medkit' | 'ammo';

interface Pickup { kind: SupplyKind; mesh: THREE.Group; ttl: number; base: number; spins: boolean }

const flat = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => g.toNonIndexed().deleteAttribute('uv')));

/** Medkits and ammo crates: some placed in the map, others dropped by fallen enemies. */
export class Pickups {
  readonly group = new THREE.Group();
  private items: Pickup[] = [];
  private t = 0;
  private geo: Record<string, THREE.BufferGeometry>;
  private mat: Record<string, THREE.Material>;

  constructor(lighting: Lighting, private hf: Heightfield, medkits: [number, number][], ammo: [number, number][]) {
    this.geo = {
      bag: flat([new THREE.BoxGeometry(0.42, 0.2, 0.28), new THREE.BoxGeometry(0.16, 0.04, 0.05).translate(0, 0.12, 0)]),
      cross: flat([new THREE.BoxGeometry(0.13, 0.04, 0.005), new THREE.BoxGeometry(0.04, 0.13, 0.005)].map((g) => g.translate(0, 0, 0.142))),
      crate: flat([new THREE.BoxGeometry(0.7, 0.36, 0.42), new THREE.BoxGeometry(0.74, 0.05, 0.46).translate(0, 0.19, 0), new THREE.BoxGeometry(0.12, 0.05, 0.05).translate(-0.2, 0.24, 0), new THREE.BoxGeometry(0.12, 0.05, 0.05).translate(0.2, 0.24, 0)]),
      stripe: flat([new THREE.BoxGeometry(0.5, 0.06, 0.005).translate(0, 0.02, 0.212)]),
    };
    this.mat = {
      bag: lighting.setup(new THREE.MeshStandardMaterial({ color: '#4c5530', roughness: 0.8 }), 'medkit-bag'),
      cross: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2) }),
      crate: lighting.setup(new THREE.MeshStandardMaterial({ color: '#3f4a2e', roughness: 0.6, metalness: 0.4 }), 'ammo-crate'),
      stripe: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.4) }),
    };
    for (const [x, z] of medkits) this.spawn(new THREE.Vector3(x, 0, z), 'medkit', Infinity);
    for (const [x, z] of ammo) this.spawn(new THREE.Vector3(x, 0, z), 'ammo', Infinity);
  }

  spawn(at: THREE.Vector3, kind: SupplyKind, ttl = 60): void {
    const g = new THREE.Group();
    const add = (geo: string, mat: string, ry = 0) => {
      const m = new THREE.Mesh(this.geo[geo], this.mat[mat]);
      m.rotation.y = ry;
      m.castShadow = geo === 'bag' || geo === 'crate';
      g.add(m);
    };
    if (kind === 'medkit') {
      add('bag', 'bag');
      add('cross', 'cross');
      add('cross', 'cross', Math.PI);
    } else {
      add('crate', 'crate');
      add('stripe', 'stripe');
      add('stripe', 'stripe', Math.PI);
    }
    const base = this.hf.heightAt(at.x, at.z) + (kind === 'medkit' ? 0.35 : 0.2);
    g.position.set(at.x, base, at.z);
    this.group.add(g);
    this.items.push({ kind, mesh: g, ttl, base, spins: ttl !== Infinity || kind === 'medkit' });
  }

  /** Positions of supplies still on the map (for the radar). */
  get positions(): THREE.Vector3[] {
    return this.items.map((p) => p.mesh.position);
  }

  /** Returns the kind collected this frame, if any. `wants` filters out pickups the player does not need. */
  update(dt: number, player: THREE.Vector3, wants: (k: SupplyKind) => boolean): SupplyKind | null {
    this.t += dt;
    let picked: SupplyKind | null = null;
    this.items = this.items.filter((p) => {
      p.ttl -= dt;
      if (p.spins) p.mesh.rotation.y += dt * 1.2;
      p.mesh.position.y = p.base + (p.kind === 'medkit' ? Math.sin(this.t * 2.4) * 0.05 : 0);
      p.mesh.visible = p.ttl > 5 || Math.sin(this.t * 14) > 0;
      const close = !picked && wants(p.kind) && Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z) < 1.4 && Math.abs(p.base - player.y) < 1.7;
      if (close) picked = p.kind;
      if (close || p.ttl <= 0) {
        this.group.remove(p.mesh);
        return false;
      }
      return true;
    });
    return picked;
  }
}

/** Picks up whatever the player needs and applies it: medkit heals fully, ammo crate refills reserve and adds a grenade. */
export function collectSupplies(dt: number, pickups: Pickups, d: { player: Player; gun: Gun; grenades: Grenades; sfx: Sfx; hud: Hud; alive: boolean }): void {
  const got = pickups.update(dt, d.player.position, (k) => d.alive && (k === 'medkit' ? d.player.hp < 99.5 : d.gun.reserve < d.gun.reserveMax || d.grenades.count < 5));
  if (!got) return;
  d.sfx.pickup();
  if (got === 'medkit') {
    d.player.heal();
    d.hud.showToast('+ BOTIQUÍN');
  } else {
    d.gun.addAmmo(d.gun.reserveMax);
    d.grenades.count = Math.min(d.grenades.count + 1, 5);
    d.hud.showToast('+ MUNICIÓN   + GRANADA');
  }
}
