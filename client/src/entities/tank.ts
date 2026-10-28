import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import { onHit, setSurface } from '../world/surfaces';
import { assemble } from './policeTruck';

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** T-55 style main battle tank (local +z forward): hull with sloped glacis, tracks, road wheels, fenders. */
function hullParts(): [string, THREE.BufferGeometry][] {
  const p: [string, THREE.BufferGeometry][] = [];
  p.push(['olive', box(3.2, 1.0, 6.2, 0, 1.3, 0)], ['olive', box(3.27, 0.12, 6.6, 0, 1.86, 0)]);
  p.push(['olive', new THREE.BoxGeometry(3.2, 0.9, 1.6).rotateX(-0.6).translate(0, 1.25, 3.35)], ['olive', new THREE.BoxGeometry(3.2, 0.7, 1.0).rotateX(0.5).translate(0, 1.3, -3.25)]);
  for (const s of [-1, 1]) {
    p.push(['track', box(0.62, 0.95, 6.5, s * 1.55, 0.55, 0)]);
    for (let i = 0; i < 5; i++) p.push(['wheel', new THREE.CylinderGeometry(0.42, 0.42, 0.66, 18).rotateZ(Math.PI / 2).translate(s * 1.56, 0.5, -2.3 + i * 1.15)]);
    p.push(['olive', box(0.3, 0.5, 0.9, s * 1.2, 2.05, -2.2)], ['dark', box(0.35, 0.35, 1.2, s * 1.3, 2.0, 1.4)]);
  }
  p.push(['dark', box(0.5, 0.06, 0.5, 0.9, 1.93, 2.2)]);
  return p;
}

function turretParts(): [string, THREE.BufferGeometry][] {
  return [
    ['olive', new THREE.SphereGeometry(1.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.62, 1.15)],
    ['olive', new THREE.CylinderGeometry(1.45, 1.55, 0.25, 28).translate(0, 0.05, 0)],
    ['dark', new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14).translate(-0.55, 0.95, -0.25)],
    ['dark', box(0.35, 0.25, 0.3, 0.55, 0.95, -0.35)],
    ['olive', box(0.9, 0.5, 0.55, 0, 0.5, 1.45)],
  ];
}

function barrelParts(): [string, THREE.BufferGeometry][] {
  return [
    ['olive', new THREE.CylinderGeometry(0.11, 0.13, 5.2, 16).rotateX(Math.PI / 2).translate(0, 0, 2.6)],
    ['olive', new THREE.CylinderGeometry(0.19, 0.19, 0.45, 16).rotateX(Math.PI / 2).translate(0, 0, 3.6)],
    ['dark', new THREE.CylinderGeometry(0.135, 0.135, 0.2, 16).rotateX(Math.PI / 2).translate(0, 0, 5.15)],
  ];
}

/**
 * The regime's tank closing the defense: rolls along `path`, then holds, swinging its turret onto the target and
 * firing a shell every few seconds (`onShell(from, at)`). Bullets just spark; only `destroy()` (the demolition
 * charge) stops it, leaving a scorched, smoking wreck.
 */
export class Tank {
  readonly group = new THREE.Group();
  arrived = false;
  destroyed = false;
  onShell: (from: THREE.Vector3, at: THREE.Vector3) => void = () => {};
  private turret: THREE.Group;
  private barrel: THREE.Group;
  private leg = 1;
  private reload = 4;
  private body: RAPIER.RigidBody;
  private mats: Record<string, THREE.MeshStandardMaterial>;

  constructor(lighting: Lighting, private world: RAPIER.World, private path: THREE.Vector3[]) {
    const m = (k: string, p: THREE.MeshStandardMaterialParameters) => lighting.setup(new THREE.MeshStandardMaterial(p), `tank-${k}`) as THREE.MeshStandardMaterial;
    this.mats = { olive: m('olive', { color: '#4c5434', roughness: 0.75, metalness: 0.25 }), track: m('track', { color: '#2b2a27', roughness: 0.95 }), wheel: m('wheel', { color: '#3c4130', roughness: 0.7 }), dark: m('dark', { color: '#1f201c', roughness: 0.7 }) };
    this.group.add(assemble(hullParts(), this.mats));
    this.turret = assemble(turretParts(), this.mats);
    this.turret.position.set(0, 1.92, 0.3);
    this.barrel = assemble(barrelParts(), this.mats);
    this.barrel.position.set(0, 0.55, 1.2);
    this.turret.add(this.barrel);
    this.group.add(this.turret);
    this.group.position.copy(path[0]);
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0].x, path[0].y + 1.2, path[0].z));
    const col = world.createCollider(RAPIER.ColliderDesc.cuboid(1.7, 1.2, 3.3), this.body);
    setSurface(col.handle, 'metal');
    onHit(col.handle, () => false);
    this.face(path[1]);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  private face(to: THREE.Vector3): void {
    this.group.rotation.y = Math.atan2(to.x - this.position.x, to.z - this.position.z);
  }

  update(dt: number, target: THREE.Vector3 | null): void {
    if (this.destroyed) return;
    if (!this.arrived) {
      const goal = this.path[this.leg], d = goal.distanceTo(this.position);
      const want = Math.atan2(goal.x - this.position.x, goal.z - this.position.z), diff = Math.atan2(Math.sin(want - this.group.rotation.y), Math.cos(want - this.group.rotation.y));
      this.group.rotation.y += THREE.MathUtils.clamp(diff, -dt * 0.6, dt * 0.6);
      if (Math.abs(diff) < 0.5) this.position.addScaledVector(goal.clone().sub(this.position).normalize(), Math.min(d, dt * 5.5));
      if (d < 0.6 && ++this.leg >= this.path.length) this.arrived = true;
      this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + 1.2, z: this.position.z });
      this.body.setNextKinematicRotation(this.group.quaternion);
    }
    if (!target) return;
    const local = this.group.worldToLocal(target.clone()), want = Math.atan2(local.x, local.z);
    const diff = Math.atan2(Math.sin(want - this.turret.rotation.y), Math.cos(want - this.turret.rotation.y));
    this.turret.rotation.y += THREE.MathUtils.clamp(diff, -dt * 0.7, dt * 0.7);
    this.reload -= dt;
    if (!this.arrived || this.reload > 0 || Math.abs(diff) > 0.08) return;
    this.reload = 5 + Math.random() * 2.5;
    const muzzle = this.barrel.localToWorld(new THREE.Vector3(0, 0, 5.3)), aim = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
    const dir = aim.sub(muzzle).normalize(), hit = this.world.castRay(new RAPIER.Ray(muzzle, dir), 300, true, undefined, undefined, undefined, this.body);
    this.onShell(muzzle, muzzle.clone().addScaledVector(dir, hit ? hit.timeOfImpact : 120));
  }

  destroy(): void {
    this.destroyed = true;
    for (const m of Object.values(this.mats)) m.color.multiplyScalar(0.28);
    this.turret.rotation.z = 0.12;
    this.barrel.rotation.x = 0.25;
  }
}
