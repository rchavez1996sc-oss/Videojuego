import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import type { StreetGraph } from '../world/barrio';
import type { Sfx } from '../audio/sfx';
import { mulberry32 } from '../core/rng';
import { onHit, setSurface, type Surface } from '../world/surfaces';
import { surfaceTop } from '../world/groundStrips';
import { shotMode } from '../core/settings';

/** A loose object: half-extents (m), mass (kg), bounciness, surface for bullet sounds, colours to pick from. */
interface Kind { geo: () => THREE.BufferGeometry; half: [number, number, number]; mass: number; bounce: number; surface: Surface; colors: string[]; rough: number; metal: number; shadow: boolean; weight: number }

const cyl = (r: number, h: number, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg);
const KINDS: Kind[] = [
  { geo: () => cyl(0.033, 0.12), half: [0.033, 0.06, 0.033], mass: 0.05, bounce: 0.45, surface: 'metal', colors: ['#b8231d', '#d6d8da', '#1f5fa8', '#e0b020'], rough: 0.35, metal: 0.8, shadow: false, weight: 3 },
  { geo: () => new THREE.CylinderGeometry(0.012, 0.036, 0.28, 10).translate(0, 0, 0), half: [0.036, 0.14, 0.036], mass: 0.4, bounce: 0.3, surface: 'tile', colors: ['#2f5a2a', '#5a3a18', '#c9d9c9'], rough: 0.08, metal: 0.1, shadow: false, weight: 2 },
  { geo: () => new THREE.CylinderGeometry(0.15, 0.12, 0.3, 14, 1, true), half: [0.15, 0.15, 0.15], mass: 0.6, bounce: 0.35, surface: 'tile', colors: ['#1d5fb0', '#d8302a', '#e7c228', '#3a3a3a'], rough: 0.6, metal: 0, shadow: true, weight: 2 },
  { geo: () => new THREE.ConeGeometry(0.16, 0.5, 12).translate(0, 0.02, 0), half: [0.18, 0.25, 0.18], mass: 1.2, bounce: 0.25, surface: 'tile', colors: ['#f05a14'], rough: 0.6, metal: 0, shadow: true, weight: 1 },
  { geo: () => new THREE.BoxGeometry(0.42, 0.3, 0.32), half: [0.21, 0.15, 0.16], mass: 0.8, bounce: 0.1, surface: 'wood', colors: ['#a98a5d', '#b89a6a', '#8f744c'], rough: 0.95, metal: 0, shadow: true, weight: 2 },
  { geo: () => new THREE.BoxGeometry(0.42, 0.28, 0.3), half: [0.21, 0.14, 0.15], mass: 1.5, bounce: 0.2, surface: 'tile', colors: ['#e7c228', '#c4161c', '#1d5fb0'], rough: 0.55, metal: 0, shadow: true, weight: 1 },
];

interface Prop { k: number; i: number; pos: THREE.Vector3; q: THREE.Quaternion; vel: THREE.Vector3; spin: THREE.Vector3; awake: boolean; col: RAPIER.Collider; rest: number }

const G = 9.8, UP = new THREE.Vector3(0, 1, 0), FLAGS = RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;

/**
 * Loose street objects with their own light rigid-body physics (no Rapier dynamics, which tunnel through the big
 * height field): gravity, bounces and friction on the ground found by rays, wall hits along the motion, tumbling,
 * and settling on their flattest face before sleeping. Bullets (sensor colliders), blasts and anything kinematic
 * walking or driving into them (characters, vehicles) knock them about. One instanced mesh per kind.
 */
export class LooseProps {
  readonly group = new THREE.Group();
  readonly props: Prop[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private body: RAPIER.RigidBody;
  private m = new THREE.Matrix4();
  private last = performance.now();

  constructor(graph: StreetGraph, private world: RAPIER.World, lighting: Lighting, perTen: number, private sfx: Sfx, private camera: THREE.Camera) {
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const r = mulberry32(6060), total = KINDS.reduce((t, k) => t + k.weight, 0), spots: { k: number; p: THREE.Vector3; yaw: number; lying: boolean }[] = [];
    for (const [a, b] of graph.edges) {
      const A = graph.nodes[a], B = graph.nodes[b], n = Math.round((A.distanceTo(B) / 10) * perTen * (0.4 + r()));
      const side = new THREE.Vector3(-(B.z - A.z), 0, B.x - A.x).normalize();
      for (let i = 0; i < n; i++) {
        const p = A.clone().lerp(B, r()).addScaledVector(side, (r() - 0.5) * 6);
        const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 2, z: p.z }, { x: 0, y: -1, z: 0 }), 4, true, FLAGS);
        if (!hit || world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.6, z: p.z }, UP), 3, true, FLAGS)) continue;
        p.y = surfaceTop(p.x, p.y + 2 - hit.timeOfImpact, p.z);
        let w = r() * total, k = 0;
        while ((w -= KINDS[k].weight) > 0) k++;
        spots.push({ k, p, yaw: r() * 6.28, lying: k < 2 && r() < 0.6 });
      }
    }
    KINDS.forEach((kind, k) => {
      const mine = spots.filter((s) => s.k === k);
      if (!mine.length) return;
      const mat = lighting.setup(new THREE.MeshStandardMaterial({ roughness: kind.rough, metalness: kind.metal, side: k === 2 ? THREE.DoubleSide : THREE.FrontSide }), `prop-${k}`);
      const mesh = new THREE.InstancedMesh(kind.geo(), mat, mine.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = kind.shadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.meshes[k] = mesh;
      if (!this.group.children.length) mesh.onBeforeRender = () => this.update();
      if (shotMode) Object.assign(window, { __props: this });
      this.group.add(mesh);
      mine.forEach((s, i) => {
        mesh.setColorAt(i, new THREE.Color(kind.colors[Math.floor(r() * kind.colors.length)]));
        const q = new THREE.Quaternion().setFromAxisAngle(UP, s.yaw);
        if (s.lying) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
        const col = world.createCollider(RAPIER.ColliderDesc.cuboid(...kind.half).setSensor(true), this.body);
        const prop: Prop = { k, i, pos: s.p.clone(), q, vel: new THREE.Vector3(), spin: new THREE.Vector3(), awake: false, col, rest: 0 };
        prop.pos.y += this.support(prop);
        this.place(prop);
        setSurface(col.handle, kind.surface);
        onHit(col.handle, (dmg, at) => (this.shot(prop, dmg, new THREE.Vector3(at.x, at.y, at.z)), true));
        this.props.push(prop);
      });
    });
  }

  /** Height of the centre above the floor for the current orientation (projection of the half-extents on up). */
  private support(p: Prop): number {
    const [hx, hy, hz] = KINDS[p.k].half, e = this.m.makeRotationFromQuaternion(p.q).elements;
    return Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz;
  }

  private place(p: Prop): void {
    this.meshes[p.k].setMatrixAt(p.i, this.m.compose(p.pos, p.q, new THREE.Vector3(1, 1, 1)));
    this.meshes[p.k].instanceMatrix.needsUpdate = true;
    p.col.setTranslationWrtParent(p.pos);
    p.col.setRotationWrtParent(p.q);
  }

  private kick(p: Prop, dv: THREE.Vector3, spin: number): void {
    p.vel.add(dv);
    p.spin.add(new THREE.Vector3((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin));
    p.awake = true;
    p.rest = 0;
  }

  private shot(p: Prop, dmg: number, at: THREE.Vector3): void {
    const dir = at.clone().sub(this.camera.position).normalize(), m = KINDS[p.k].mass;
    this.kick(p, dir.multiplyScalar(Math.min(8 / Math.sqrt(1 + m), (dmg * 0.09) / m)).add(new THREE.Vector3(0, Math.min(3, (dmg * 0.04) / m), 0)), Math.min(25, 14 / Math.sqrt(m)));
    this.sfx.impact(KINDS[p.k].surface, at.distanceTo(this.camera.position) + 8);
  }

  explosion(at: THREE.Vector3, radius: number): void {
    for (const p of this.props) {
      const d = p.pos.distanceTo(at);
      if (d > radius * 1.4) continue;
      const f = Math.pow(1 - d / (radius * 1.4), 1.1) * 10 / Math.sqrt(1 + KINDS[p.k].mass);
      this.kick(p, p.pos.clone().sub(at).setY(0).normalize().multiplyScalar(f).add(new THREE.Vector3(0, f * 0.6, 0)), 18);
    }
  }

  /** Characters and vehicles (kinematic colliders) overlapping a prop shove it out of the way. */
  private shove(p: Prop): void {
    const half = KINDS[p.k].half, probe = new RAPIER.Cuboid(half[0] + 0.12, half[1] + 0.3, half[2] + 0.12);
    this.world.intersectionsWithShape(p.pos, p.q, probe, (c) => {
      const b = c.parent();
      if (!b?.isKinematic() || c.isSensor()) return true;
      const t = b.translation(), away = new THREE.Vector3(p.pos.x - t.x, 0, p.pos.z - t.z);
      if (away.lengthSq() < 1e-4) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      const v = b.linvel(), speed = Math.max(1.5, Math.hypot(v.x, v.z));
      this.kick(p, away.normalize().multiplyScalar(speed * 0.9 / Math.max(0.6, KINDS[p.k].mass)).add(new THREE.Vector3(0, 0.6, 0)), 6);
      return false;
    });
  }

  /** Runs from the first mesh's onBeforeRender (once per frame: later passes in the same frame are skipped). */
  update(step?: number): void {
    const now = performance.now(), dt = step ?? Math.min(0.05, (now - this.last) / 1000), cam = this.camera.position;
    if (dt < 0.004) return;
    this.last = now;
    for (const p of this.props) {
      if (p.pos.distanceToSquared(cam) > 3600) continue;
      this.shove(p);
      if (!p.awake) continue;
      this.step(p, dt);
      this.place(p);
    }
  }

  private step(p: Prop, dt: number): void {
    const kind = KINDS[p.k], move = p.vel.clone().multiplyScalar(dt);
    p.vel.y -= G * dt;
    const flat = Math.hypot(move.x, move.z);
    if (flat > 1e-4) {
      const wall = this.world.castRayAndGetNormal(new RAPIER.Ray({ x: p.pos.x, y: p.pos.y + 0.05, z: p.pos.z }, { x: move.x / flat, y: 0, z: move.z / flat }), flat + 0.12, true, FLAGS);
      if (wall && Math.abs(wall.normal.y) < 0.5) {
        const n = new THREE.Vector3(wall.normal.x, 0, wall.normal.z).normalize();
        p.vel.addScaledVector(n, -(1 + kind.bounce) * p.vel.dot(n));
        move.set(0, move.y, 0);
      }
    }
    p.pos.add(move);
    const spinLen = p.spin.length();
    if (spinLen > 1e-3) p.q.premultiply(new THREE.Quaternion().setFromAxisAngle(p.spin.clone().divideScalar(spinLen), spinLen * dt)).normalize();
    const hit = this.world.castRay(new RAPIER.Ray({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, { x: 0, y: -1, z: 0 }), 4, true, FLAGS);
    const floor = hit ? surfaceTop(p.pos.x, p.pos.y + 1 - hit.timeOfImpact, p.pos.z) : -Infinity, lift = this.support(p);
    if (p.pos.y - lift > floor + 0.005) return;
    p.pos.y = floor + lift;
    if (p.vel.y < -1.5) this.sfx.impact(kind.surface, p.pos.distanceTo(this.camera.position) + 14);
    if (p.vel.y < 0) p.vel.y = -p.vel.y * kind.bounce;
    if (p.vel.y < 0.4) p.vel.y = 0;
    const fr = Math.exp(-dt * 4.5);
    p.vel.x *= fr;
    p.vel.z *= fr;
    p.spin.multiplyScalar(Math.exp(-dt * 3.5));
    if (p.vel.lengthSq() < 0.02 && p.spin.lengthSq() < 0.05) this.settle(p, dt);
  }

  /** Slow and on the ground: turn towards the nearest face-down pose, then sleep. */
  private settle(p: Prop, dt: number): void {
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((a) => a.applyQuaternion(p.q));
    let best = axes[1], dot = 0;
    for (const a of axes) if (Math.abs(a.y) > dot) (dot = Math.abs(a.y)), (best = a.clone().multiplyScalar(Math.sign(a.y)));
    p.q.premultiply(new THREE.Quaternion().setFromUnitVectors(best, UP).slerp(new THREE.Quaternion(), 1 - Math.min(1, dt * 8))).normalize();
    p.vel.set(0, 0, 0);
    p.spin.set(0, 0, 0);
    if ((p.rest += dt) > 0.4) p.awake = false;
  }
}
