import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import { setSurface } from '../world/surfaces';

type Part = [string, THREE.BufferGeometry];
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const wheel = (x: number, z: number) => new THREE.CylinderGeometry(0.4, 0.4, 0.3, 18).rotateZ(Math.PI / 2).translate(x, 0.4, z);

/** PNP double-cab pickup (local +z forward): white body, green side stripe, dark glass, roll bar, light bar. */
function pickupParts(): Part[] {
  const p: Part[] = [];
  p.push(['white', box(1.9, 0.75, 5.2, 0, 0.9, 0)], ['white', box(1.85, 0.75, 2.5, 0, 1.6, 0.55)]);
  p.push(['green', box(1.93, 0.22, 5.1, 0, 0.95, 0)], ['glass', box(1.8, 0.55, 2.3, 0, 1.68, 0.6)]);
  p.push(['dark', box(1.7, 0.35, 2.1, 0, 0.95, -1.5)], ['dark', box(2.0, 0.25, 0.2, 0, 0.65, 2.62)], ['dark', box(2.0, 0.25, 0.2, 0, 0.65, -2.62)]);
  for (const x of [-0.85, 0.85]) p.push(['steel', box(0.06, 0.7, 0.06, x, 1.6, -0.75)]);
  p.push(['steel', box(1.76, 0.06, 0.06, 0, 1.95, -0.75)]);
  p.push(['red', box(0.6, 0.12, 0.25, -0.35, 2.04, 0.9)], ['blue', box(0.6, 0.12, 0.25, 0.35, 2.04, 0.9)]);
  p.push(['lamp', box(0.35, 0.18, 0.05, -0.65, 0.95, 2.61)], ['lamp', box(0.35, 0.18, 0.05, 0.65, 0.95, 2.61)]);
  for (const x of [-0.92, 0.92]) for (const z of [-1.6, 1.6]) p.push(['tyre', wheel(x, z)]);
  return p;
}

/** Merges `parts` per material into meshes under one group. */
export function assemble(parts: Part[], mats: Record<string, THREE.Material>): THREE.Group {
  const g = new THREE.Group(), by = new Map<string, THREE.BufferGeometry[]>();
  for (const [m, geo] of parts) (by.get(m) ?? by.set(m, []).get(m)!).push(geo.index ? geo.toNonIndexed() : geo);
  for (const [m, list] of by) {
    const mesh = new THREE.Mesh(mergeGeometries(list.map((l) => { l.deleteAttribute('uv'); return l; })), mats[m]);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

export function vehicleMats(lighting: Lighting): Record<string, THREE.Material> {
  const m = (k: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), `veh-${k}`);
  return {
    white: m('white', { color: '#e9ebe8', roughness: 0.35, metalness: 0.3 }), green: m('green', { color: '#1f5a36', roughness: 0.4, metalness: 0.3 }),
    glass: m('glass', { color: '#1a2228', roughness: 0.05, metalness: 0.8 }), dark: m('dark', { color: '#262626', roughness: 0.7 }),
    steel: m('steel', { color: '#8a8f93', roughness: 0.35, metalness: 0.8 }), tyre: m('tyre', { color: '#141414', roughness: 0.9 }),
    red: m('red', { color: '#ff2a1a', emissive: '#ff1a0a', emissiveIntensity: 1.2 }), blue: m('blue', { color: '#2a5aff', emissive: '#1a3aff', emissiveIntensity: 1.2 }),
    lamp: m('lamp', { color: '#fff6dc', emissive: '#fff1c8', emissiveIntensity: 0.8 }),
  };
}

/**
 * Reinforcement pickup: drives along `path` (avenue, then in through a campus entrance), brakes, and parks as solid cover
 * (`onParked` drops its squad off). The light bar flashes while it moves.
 */
export class PoliceTruck {
  readonly group: THREE.Group;
  parked = false;
  onParked: () => void = () => {};
  private leg = 1;
  private collider: RAPIER.Collider | null = null;

  constructor(mats: Record<string, THREE.Material>, private path: THREE.Vector3[], private world: RAPIER.World) {
    this.group = assemble(pickupParts(), mats);
    this.group.position.copy(path[0]);
    this.group.rotation.y = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
  }

  update(dt: number): void {
    if (this.parked) return;
    const p = this.group.position, goal = this.path[this.leg], d = p.distanceTo(goal), last = this.leg === this.path.length - 1;
    const want = Math.atan2(goal.x - p.x, goal.z - p.z), turn = Math.atan2(Math.sin(want - this.group.rotation.y), Math.cos(want - this.group.rotation.y));
    this.group.rotation.y += THREE.MathUtils.clamp(turn, -dt * 1.6, dt * 1.6);
    p.addScaledVector(goal.clone().sub(p).normalize(), Math.min(d, dt * (last ? Math.max(2, Math.min(13, d * 0.9)) : 13)));
    if (d > 0.3) return;
    if (!last) return void this.leg++;
    this.parked = true;
    const q = this.group.quaternion;
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.95, 0.9, 2.6).setTranslation(p.x, p.y + 0.9, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    setSurface(this.collider.handle, 'metal');
    this.onParked();
  }

  remove(): void {
    if (this.collider) this.world.removeCollider(this.collider, false);
    this.group.removeFromParent();
  }
}
