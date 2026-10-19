import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Heightfield } from './heightfield';
import type { Lighting } from '../render/lighting';
import { onHit, setSurface } from './surfaces';
import { wood } from '../render/textures';

export interface TargetHit { point: THREE.Vector3; normal: THREE.Vector3; damage: number; kill: boolean; headshot: boolean; distance: number }

interface Target { pivot: THREE.Group; hp: number; down: number; swing: number; swingV: number; fall: number; normal: THREE.Vector3; headY: number }

const HP = 100;

function silhouette(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.26, 0);
  s.lineTo(0.26, 0);
  s.lineTo(0.24, 0.5);
  s.quadraticCurveTo(0.22, 0.62, 0.1, 0.64);
  s.lineTo(0.07, 0.66);
  s.absarc(0, 0.77, 0.11, -Math.PI * 0.3, Math.PI * 1.3, false);
  s.lineTo(-0.1, 0.64);
  s.quadraticCurveTo(-0.22, 0.62, -0.24, 0.5);
  s.lineTo(-0.26, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -0.006);
  return g;
}

export class ShootingRange {
  readonly group = new THREE.Group();
  private targets: Target[] = [];

  constructor(hf: Heightfield, lighting: Lighting, world: RAPIER.World, origin: { x: number; z: number; yaw: number }, layout: [number, number][], onTargetHit: (h: TargetHit) => void) {
    const wd = wood();
    const steel = lighting.setup(new THREE.MeshStandardMaterial({ color: '#c9c4b8', metalness: 0.6, roughness: 0.55 }), 'target-steel');
    const post = lighting.setup(new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, roughness: 0.9 }), 'target-post');
    const plateGeo = silhouette();
    const fwd = new THREE.Vector3(-Math.sin(origin.yaw), 0, -Math.cos(origin.yaw));
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const [dist, lat] of layout) {
      const x = origin.x + fwd.x * dist + side.x * lat, z = origin.z + fwd.z * dist + side.z * lat;
      const y = hf.heightAt(x, z);
      const root = new THREE.Group();
      root.position.set(x, y, z);
      root.rotation.y = origin.yaw;
      for (const px of [-0.22, 0.22]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), post);
        p.position.set(px, 0.3, 0.06);
        p.castShadow = p.receiveShadow = true;
        root.add(p);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), post);
      bar.position.set(0, 0.78, 0.06);
      root.add(bar);
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.78, 0);
      const plate = new THREE.Mesh(plateGeo, steel);
      plate.position.y = -0.0;
      plate.castShadow = plate.receiveShadow = true;
      pivot.add(plate);
      root.add(pivot);
      this.group.add(root);

      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), origin.yaw);
      const t: Target = { pivot, hp: HP, down: 0, swing: 0, swingV: 0, fall: 0, normal, headY: y + 0.78 + 0.64 };
      this.targets.push(t);
      const q = root.quaternion;
      const center = new THREE.Vector3(0, 1.2, 0).applyQuaternion(q).add(root.position);
      const col = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.26, 0.45, 0.04).setTranslation(center.x, center.y, center.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
        body,
      );
      setSurface(col.handle, 'metal');
      onHit(col.handle, (damage, p) => {
        if (t.down > 0) return;
        const point = new THREE.Vector3(p.x, p.y, p.z);
        const headshot = point.y > t.headY;
        const dmg = damage * (headshot ? 2.5 : 1);
        t.hp -= dmg;
        t.swingV += 6 + dmg * 0.08;
        const kill = t.hp <= 0;
        if (kill) {
          t.down = 4;
          t.fall = 0;
        }
        onTargetHit({ point, normal, damage: dmg, kill, headshot, distance: 0 });
      });
    }
  }

  update(dt: number): void {
    for (const t of this.targets) {
      t.swingV += (-t.swing * 90 - t.swingV * 6) * dt;
      t.swing += t.swingV * dt;
      if (t.down > 0) {
        t.down -= dt;
        t.fall = Math.min(1, t.fall + dt * 4);
        if (t.down <= 0) t.hp = HP;
      } else {
        t.fall = Math.max(0, t.fall - dt * 3);
      }
      t.pivot.rotation.x = -t.swing * 0.15 - t.fall * (Math.PI / 2 - 0.2);
    }
  }
}
