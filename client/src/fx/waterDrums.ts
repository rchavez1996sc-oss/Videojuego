import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import { onHit, setSurface } from '../world/surfaces';
import { shotMode } from '../core/settings';

const R = 0.29, H = 0.88, DROPS = 900, JETS = 24;

interface Jet { at: THREE.Vector3; dir: THREE.Vector3; base: number; drum: number }
interface Drop { p: THREE.Vector3; v: THREE.Vector3; life: number }

/**
 * Blue plastic water drums by the doors (every house in the barrio keeps one): shot, a hole spouts a jet of water
 * that arcs out, splashes on the ground and weakens as the level drops below the hole (holes higher up run dry
 * sooner). Drums collide; droplets are one instanced mesh.
 */
export class WaterDrums {
  readonly group = new THREE.Group();
  private jets: Jet[] = [];
  private drops: Drop[] = [];
  private dropMesh: THREE.InstancedMesh;
  private level: number[] = [];
  private m = new THREE.Matrix4();

  constructor(spots: { p: THREE.Vector3; yaw: number }[], lighting: Lighting, world: RAPIER.World) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const shell = new THREE.CylinderGeometry(R, R * 0.97, H, 20).translate(0, H / 2, 0);
    for (const y of [0.25, 0.5, 0.75]) shell.attributes.position.array.forEach((_, i, a) => {
      if (i % 3 === 1 && Math.abs((a as Float32Array)[i] - H * y) < 0.03) {
        const arr = a as Float32Array; arr[i - 1] *= 1.03; arr[i + 1] *= 1.03;
      }
    });
    shell.computeVertexNormals();
    const lid = new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.04, 20).translate(0, H + 0.02, 0);
    const blue = lighting.setup(new THREE.MeshStandardMaterial({ color: '#1f5fae', roughness: 0.45 }), 'drum-blue');
    const black = lighting.setup(new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.6 }), 'drum-lid');
    const shells = new THREE.InstancedMesh(shell, blue, Math.max(1, spots.length)), lids = new THREE.InstancedMesh(lid, black, Math.max(1, spots.length));
    spots.forEach((s, i) => {
      this.m.compose(s.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw), new THREE.Vector3(1, 1, 1));
      shells.setMatrixAt(i, this.m);
      lids.setMatrixAt(i, this.m);
      this.level.push(0.6 + Math.random() * 0.35);
      const col = world.createCollider(RAPIER.ColliderDesc.cylinder(H / 2, R).setTranslation(s.p.x, s.p.y + H / 2, s.p.z), body);
      setSurface(col.handle, 'tile');
      onHit(col.handle, (_dmg, at) => (this.puncture(i, s.p, new THREE.Vector3(at.x, at.y, at.z)), false));
    });
    for (const mesh of [shells, lids]) Object.assign(mesh, { castShadow: true, receiveShadow: true });
    shells.count = lids.count = spots.length;
    const water = new THREE.MeshStandardMaterial({ color: '#bcd3dc', roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 5, 4), water, DROPS);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    this.group.add(shells, lids, this.dropMesh);
    if (shotMode) Object.assign(window, { __drums: { self: this, spots } });
  }

  private puncture(i: number, base: THREE.Vector3, at: THREE.Vector3): void {
    const h = at.y - base.y;
    if (h > H * this.level[i] || h < 0.05) return;
    if (this.jets.length >= JETS) this.jets.shift();
    const out = at.clone().sub(base).setY(0).normalize();
    this.jets.push({ at: base.clone().addScaledVector(out, R + 0.01).setY(at.y), dir: out, base: base.y, drum: i });
  }

  update(dt: number, ground: (x: number, z: number) => number): void {
    for (const j of this.jets) {
      const above = this.level[j.drum] * H - (j.at.y - j.base);
      if (above <= 0) continue;
      this.level[j.drum] = Math.max(0, this.level[j.drum] - dt * 0.004);
      const speed = Math.sqrt(2 * 9.8 * above) * 0.9;
      for (let k = 0; k < 5 && this.drops.length < DROPS; k++)
        this.drops.push({ p: j.at.clone(), v: j.dir.clone().multiplyScalar(speed * (0.9 + Math.random() * 0.2)).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.3) * 0.15, (Math.random() - 0.5) * 0.15)), life: 2 });
    }
    this.jets = this.jets.filter((j) => this.level[j.drum] * H > j.at.y - j.base);
    let n = 0;
    for (const d of this.drops) {
      d.v.y -= 9.8 * dt;
      d.p.addScaledVector(d.v, dt);
      d.life -= dt;
      const g = ground(d.p.x, d.p.z);
      if (d.p.y < g) [d.p.y, d.v.x, d.v.z, d.v.y, d.life] = [g + 0.01, d.v.x * 0.2, d.v.z * 0.2, Math.abs(d.v.y) * 0.15, Math.min(d.life, 0.25)];
      if (d.life <= 0) continue;
      this.drops[n++] = d;
      this.dropMesh.setMatrixAt(n - 1, this.m.makeTranslation(d.p.x, d.p.y, d.p.z).scale(new THREE.Vector3(1, 1.8, 1)));
    }
    this.drops.length = n;
    this.dropMesh.count = n;
    this.dropMesh.instanceMatrix.needsUpdate = true;
  }
}
