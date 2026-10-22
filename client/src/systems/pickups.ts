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

/** A loose cluster of 7.62 rounds standing around a magazine: [x, z, tilt]. */
const ROUNDS: [number, number, number][] = [[0, 0, 0], [0.06, 0.03, -0.12], [-0.05, 0.05, 0.1], [0.03, -0.06, 0.08], [-0.03, -0.05, -0.1], [0.1, -0.02, -0.2], [-0.08, 0.0, 0.18]];

const flat = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => g.toNonIndexed().deleteAttribute('uv')));

/** Floating medkits and clusters of rounds: some placed in the map, others dropped by fallen enemies. */
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
      cases: flat(ROUNDS.map(([x, z, tilt]) => new THREE.CylinderGeometry(0.024, 0.027, 0.13, 10).translate(0, 0.065, 0).rotateZ(tilt).translate(x, 0, z))),
      tips: flat(ROUNDS.map(([x, z, tilt]) => new THREE.ConeGeometry(0.022, 0.07, 10).translate(0, 0.165, 0).rotateZ(tilt).translate(x, 0, z))),
      mag: flat([new THREE.BoxGeometry(0.07, 0.2, 0.05).translate(0, 0.1, 0).rotateZ(0.25), new THREE.BoxGeometry(0.07, 0.12, 0.05).translate(0.02, 0.24, 0).rotateZ(0.45)].map((g) => g.translate(-0.13, 0, -0.06))),
    };
    this.mat = {
      bag: lighting.setup(new THREE.MeshStandardMaterial({ color: '#4c5530', roughness: 0.8 }), 'medkit-bag'),
      cross: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2) }),
      mag: lighting.setup(new THREE.MeshStandardMaterial({ color: '#2a2b2c', roughness: 0.5, metalness: 0.6 }), 'ammo-mag'),
      brass: lighting.setup(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.9, roughness: 0.28, emissive: '#5a3a08', emissiveIntensity: 0.6 }), 'ammo-brass'),
      copper: lighting.setup(new THREE.MeshStandardMaterial({ color: '#b5612e', metalness: 0.85, roughness: 0.3, emissive: '#3a1606', emissiveIntensity: 0.5 }), 'ammo-copper'),
    };
    for (const [x, z] of medkits) this.spawn(new THREE.Vector3(x, 0, z), 'medkit', Infinity);
    for (const [x, z] of ammo) this.spawn(new THREE.Vector3(x, 0, z), 'ammo', Infinity);
  }

  spawn(at: THREE.Vector3, kind: SupplyKind, ttl = 60): void {
    const g = new THREE.Group();
    const add = (geo: string, mat: string, ry = 0) => {
      const m = new THREE.Mesh(this.geo[geo], this.mat[mat]);
      m.rotation.y = ry;
      m.castShadow = geo === 'bag' || geo === 'cases';
      g.add(m);
    };
    if (kind === 'medkit') {
      add('bag', 'bag');
      add('cross', 'cross');
      add('cross', 'cross', Math.PI);
    } else {
      add('cases', 'brass');
      add('tips', 'copper');
      add('mag', 'mag');
      g.scale.setScalar(1.5);
    }
    const base = this.hf.heightAt(at.x, at.z) + (kind === 'medkit' ? 0.35 : 0.42);
    g.position.set(at.x, base, at.z);
    this.group.add(g);
    this.items.push({ kind, mesh: g, ttl, base, spins: true });
  }

  /** Supplies still on the map and what they are (for the radar icons). */
  get markers(): { pos: THREE.Vector3; kind: SupplyKind }[] {
    return this.items.map((p) => ({ pos: p.mesh.position, kind: p.kind }));
  }

  /** Returns the kind collected this frame, if any. `wants` filters out pickups the player does not need. */
  update(dt: number, player: THREE.Vector3, wants: (k: SupplyKind) => boolean): SupplyKind | null {
    this.t += dt;
    let picked: SupplyKind | null = null;
    this.items = this.items.filter((p) => {
      p.ttl -= dt;
      if (p.spins) p.mesh.rotation.y += dt * 1.2;
      p.mesh.position.y = p.base + Math.sin(this.t * 2.4 + (p.kind === 'ammo' ? 1.3 : 0)) * 0.05;
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

/** A fallen soldier sometimes leaves a medkit (20 %) or a cluster of rounds (30 %). */
export function dropLoot(pickups: Pickups, at: THREE.Vector3): void {
  const roll = Math.random();
  if (roll < 0.2) pickups.spawn(at, 'medkit');
  else if (roll < 0.5) pickups.spawn(at, 'ammo');
}

/** Picks up whatever the player needs and applies it: medkit heals fully, ammo refills the reserve and adds a grenade. */
export function collectSupplies(dt: number, pickups: Pickups, d: { player: Player; gun: Gun; grenades: Grenades; sfx: Sfx; hud: Hud; alive: boolean }): void {
  const got = pickups.update(dt, d.player.position, (k) => d.alive && (k === 'medkit' ? d.player.hp < 99.5 : d.gun.reserve < d.gun.reserveMax || d.grenades.count < 5));
  if (!got) return;
  d.sfx.pickup();
  if (got === 'medkit') {
    d.player.heal();
    d.hud.showToast('BOTIQUÍN');
  } else {
    d.gun.addAmmo(d.gun.reserveMax);
    d.grenades.count = Math.min(d.grenades.count + 1, 5);
    d.hud.showToast('MUNICIÓN Y GRANADA');
  }
}
