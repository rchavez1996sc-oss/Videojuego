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

interface Pickup { kind: SupplyKind; mesh: THREE.Group; ttl: number; base: number; spins: boolean; rounds?: number }

/** Three plain rounds standing side by side. */
const ROUNDS = [-0.065, 0, 0.065];

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
      cases: flat(ROUNDS.map((x) => new THREE.CylinderGeometry(0.025, 0.025, 0.15, 16).translate(x, 0.075, 0))),
      tips: flat(ROUNDS.map((x) => new THREE.SphereGeometry(0.025, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2.6, 1).translate(x, 0.15, 0))),
    };
    this.mat = {
      bag: lighting.setup(new THREE.MeshStandardMaterial({ color: '#4c5530', roughness: 0.8 }), 'medkit-bag'),
      cross: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2) }),
      brass: lighting.setup(new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 0.8, roughness: 0.35, emissive: '#3a2a0a', emissiveIntensity: 0.4 }), 'ammo-brass'),
      copper: lighting.setup(new THREE.MeshStandardMaterial({ color: '#a8673a', metalness: 0.8, roughness: 0.35, emissive: '#2a1206', emissiveIntensity: 0.4 }), 'ammo-copper'),
    };
    for (const [x, z] of medkits) this.spawn(new THREE.Vector3(x, 0, z), 'medkit', Infinity);
    for (const [x, z] of ammo) this.spawn(new THREE.Vector3(x, 0, z), 'ammo', Infinity);
  }

  /** `ground` overrides the terrain height (bodies on roofs); `rounds` makes it a corpse drop with that many bullets. */
  spawn(at: THREE.Vector3, kind: SupplyKind, ttl = 60, ground?: number, rounds?: number): void {
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
      g.scale.setScalar(1.6);
    }
    const base = (ground ?? this.hf.heightAt(at.x, at.z)) + (kind === 'medkit' ? 0.55 : 0.6);
    g.position.set(at.x, base, at.z);
    this.group.add(g);
    this.items.push({ kind, mesh: g, ttl, base, spins: true, rounds });
  }

  /** Supplies still on the map and what they are (for the radar icons). */
  get markers(): { pos: THREE.Vector3; kind: SupplyKind }[] {
    return this.items.map((p) => ({ pos: p.mesh.position, kind: p.kind }));
  }

  /** Returns the pickup collected this frame, if any. `wants` filters out pickups the player does not need. */
  update(dt: number, player: THREE.Vector3, wants: (p: Pickup) => boolean): Pickup | null {
    this.t += dt;
    let picked: Pickup | null = null;
    this.items = this.items.filter((p) => {
      p.ttl -= dt;
      if (p.spins) p.mesh.rotation.y += dt * 1.2;
      p.mesh.position.y = p.base + Math.sin(this.t * 2.4 + (p.kind === 'ammo' ? 1.3 : 0)) * 0.05;
      p.mesh.visible = p.ttl > 5 || Math.sin(this.t * 14) > 0;
      const close = !picked && wants(p) && Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z) < 1.4 && Math.abs(p.base - player.y) < 1.7;
      if (close) picked = p;
      if (close || p.ttl <= 0) {
        this.group.remove(p.mesh);
        return false;
      }
      return true;
    });
    return picked;
  }
}

/** Every fallen policeman leaves his rounds on the body; one in five also a medkit beside them. */
export function dropLoot(pickups: Pickups, at: THREE.Vector3, ground: number): void {
  const a = Math.random() * Math.PI * 2, side = new THREE.Vector3(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
  pickups.spawn(at.clone().add(side), 'ammo', 90, ground, 30 + Math.round(Math.random() * 45));
  if (Math.random() < 0.2) pickups.spawn(at.clone().sub(side), 'medkit', 90, ground);
}

let fullT = 0;

/** Picks up whatever the player needs (and says so when walking over one that is not needed): medkit heals fully, corpse rounds add to the reserve, crates refill it and add a grenade. */
export function collectSupplies(dt: number, pickups: Pickups, d: { player: Player; gun: Gun; grenades: Grenades; sfx: Sfx; hud: Hud; alive: boolean }): void {
  const roomy = d.gun.reserve < d.gun.reserveMax;
  const got = pickups.update(dt, d.player.position, (p) => d.alive && (p.kind === 'medkit' ? d.player.hp < 99.5 : roomy || (!p.rounds && d.grenades.count < 5)));
  fullT -= dt;
  if (!got) {
    const near = pickups.markers.find((m) => Math.hypot(m.pos.x - d.player.position.x, m.pos.z - d.player.position.z) < 1.4 && Math.abs(m.pos.y - d.player.position.y) < 2.3);
    if (near && d.alive && fullT <= 0) {
      d.hud.showToast(near.kind === 'medkit' ? 'VIDA COMPLETA' : 'MUNICIÓN COMPLETA');
      fullT = 3;
    }
    return;
  }
  if (got.kind === 'medkit') d.sfx.pickupMedkit();
  else d.sfx.pickupAmmo();
  if (got.kind === 'medkit') {
    d.player.heal();
    d.hud.showToast('BOTIQUÍN');
  } else if (got.rounds) {
    const before = d.gun.reserve;
    d.gun.addAmmo(got.rounds);
    d.hud.showToast(`${d.gun.reserve - before} BALAS`);
  } else {
    d.gun.addAmmo(d.gun.reserveMax);
    d.grenades.count = Math.min(d.grenades.count + 1, 5);
    d.hud.showToast('MUNICIÓN Y GRANADA');
  }
}
