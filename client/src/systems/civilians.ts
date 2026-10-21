import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Mannequin, type Palette } from '../entities/mannequin';
import { mulberry32 } from '../core/rng';
import { onHit } from '../world/surfaces';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import type { StreetGraph } from '../world/barrio';

type Mood = 'walk' | 'idle' | 'panic' | 'gone' | 'dead';

interface Civilian {
  model: Mannequin; body: RAPIER.RigidBody; collider: RAPIER.Collider;
  pos: THREE.Vector3; yaw: number; mood: Mood; node: number; target: number; exit: number;
  speed: number; timer: number; panicT: number; fallDir: THREE.Vector3; fallT: number; shadowed: boolean;
}

export const SHIRTS = ['#b8342b', '#2f5e9e', '#e0c24a', '#3f7a3c', '#d9d4c7', '#6b3c7a', '#1e1e22', '#c46a2c', '#7aa7c7'];
export const PANTS = ['#2b3442', '#1c1c1e', '#4a4038', '#5a5e66', '#3a2f28'];
export const SKIN = ['#8a5a3c', '#a06a48', '#7a4e33', '#b07a55', '#69442d'];
export const HAIR = ['#141210', '#1f1a16', '#2a2420', '#4a4a4a'];

/** Unarmed passers-by who wander the street graph and flee (then vanish) when shooting starts. */
export class Civilians {
  readonly group = new THREE.Group();
  readonly list: Civilian[] = [];
  onHurt: () => void = () => {};
  private neighbors: number[][];
  private calmT = 0;
  private recycleT = 0;

  constructor(private graph: StreetGraph, private hf: Heightfield, lighting: Lighting, world: RAPIER.World, count: number, seed: number, private camera: THREE.Camera) {
    this.neighbors = graph.nodes.map(() => []);
    for (const [a, b] of graph.edges) {
      this.neighbors[a].push(b);
      this.neighbors[b].push(a);
    }
    const rand = mulberry32(seed);
    const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    for (let i = 0; i < count; i++) {
      const pal: Palette = { id: `civ${i % 9}`, cloth: pick(PANTS), vest: pick(SHIRTS), skin: pick(SKIN), helmet: pick(HAIR) };
      const model = new Mannequin(lighting, pal, false);
      model.far = true;
      const node = Math.floor(rand() * graph.nodes.length);
      const target = pick(this.neighbors[node]);
      const t = rand();
      const pos = graph.nodes[node].clone().lerp(graph.nodes[target], t).add(new THREE.Vector3((rand() - 0.5) * 3, 0, (rand() - 0.5) * 3));
      pos.y = hf.heightAt(pos.x, pos.z);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + 0.9, pos.z));
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
      const c: Civilian = {
        model, body, collider, pos, yaw: 0, mood: rand() < 0.35 ? 'idle' : 'walk', node, target, exit: -1,
        speed: 1.1 + rand() * 0.5, timer: 2 + rand() * 6, panicT: 0, fallDir: new THREE.Vector3(), fallT: 0, shadowed: true,
      };
      this.list.push(c);
      this.group.add(model.root);
      onHit(collider.handle, (_dmg, p) => this.kill(c, new THREE.Vector3(p.x, p.y, p.z)));
    }
  }

  /** Gunfire or an explosion at `at`: everyone within `radius` panics and runs for the farthest exit. */
  alarm(at: THREE.Vector3, radius: number): void {
    this.calmT = 0;
    for (const c of this.list) {
      if (c.mood === 'gone' || c.mood === 'dead' || c.pos.distanceTo(at) > radius) continue;
      if (c.mood !== 'panic') {
        c.mood = 'panic';
        c.panicT = 0;
        c.speed = 4.6 + Math.random() * 1.2;
        c.target = this.fleeNeighbor(c.node, at);
      }
      c.exit = this.graph.exits.reduce((best, e) => (this.graph.nodes[e].distanceTo(at) > this.graph.nodes[best].distanceTo(at) ? e : best), this.graph.exits[0]);
    }
  }

  /** Grenade blast: civilians inside the radius are killed (and count as the player's fault). */
  explosion(at: THREE.Vector3, radius: number): void {
    for (const c of this.list) if (c.mood !== 'gone' && c.mood !== 'dead' && c.pos.distanceTo(at) < radius * 0.7) this.kill(c, at);
    this.alarm(at, radius * 15);
  }

  get present(): THREE.Vector3[] {
    return this.list.filter((c) => c.mood !== 'gone' && c.mood !== 'dead').map((c) => c.pos);
  }

  private kill(c: Civilian, from: THREE.Vector3): void {
    if (c.mood === 'dead' || c.mood === 'gone') return;
    c.mood = 'dead';
    c.collider.setEnabled(false);
    c.fallDir.copy(c.pos).sub(from).setY(0);
    if (c.fallDir.lengthSq() < 0.01) c.fallDir.set(1, 0, 0);
    c.fallDir.normalize();
    this.onHurt();
    this.alarm(c.pos, 60);
  }

  private fleeNeighbor(node: number, threat: THREE.Vector3): number {
    return this.neighbors[node].reduce((best, n) => (this.graph.nodes[n].distanceTo(threat) > this.graph.nodes[best].distanceTo(threat) ? n : best), this.neighbors[node][0]);
  }

  private towardExit(node: number, exit: number): number {
    const goal = this.graph.nodes[exit];
    return this.neighbors[node].reduce((best, n) => (this.graph.nodes[n].distanceTo(goal) < this.graph.nodes[best].distanceTo(goal) ? n : best), this.neighbors[node][0]);
  }

  /** Keeps the street busy where the player is: calm walkers far away (or long gone) reappear just out of sight nearby. */
  private recycle(dt: number): void {
    this.calmT += dt;
    if ((this.recycleT -= dt) > 0) return;
    this.recycleT = 0.5;
    const cam = this.camera.position;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize();
    const c = this.list.find((c) => ((c.mood === 'walk' || c.mood === 'idle') && c.pos.distanceTo(cam) > 110) || (c.mood === 'gone' && this.calmT > 40));
    if (!c) return;
    for (let k = 0; k < 12; k++) {
      const [a, b] = this.graph.edges[Math.floor(Math.random() * this.graph.edges.length)];
      const p = this.graph.nodes[a].clone().lerp(this.graph.nodes[b], Math.random());
      const to = p.clone().sub(cam).setY(0), d = to.length();
      if (d < 55 || d > 84 || to.divideScalar(d).dot(fwd) > 0.2) continue;
      p.x += (Math.random() - 0.5) * 3;
      p.z += (Math.random() - 0.5) * 3;
      p.y = this.hf.heightAt(p.x, p.z);
      Object.assign(c, { mood: 'walk', node: a, target: b, speed: 1.1 + Math.random() * 0.5, panicT: 0 });
      c.pos.copy(p);
      c.collider.setEnabled(true);
      return;
    }
  }

  update(dt: number, player: THREE.Vector3): void {
    this.recycle(dt);
    for (const c of this.list) {
      if (c.mood === 'gone') continue;
      if (c.mood === 'dead') {
        c.fallT = Math.min(1, c.fallT + dt / 0.7);
        const k = c.fallT * c.fallT;
        const axis = new THREE.Vector3(0, 1, 0).cross(c.fallDir).normalize();
        c.model.root.quaternion.setFromAxisAngle(axis, k * Math.PI * 0.49).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.yaw + Math.PI, 0)));
        c.model.root.position.copy(c.pos).addScaledVector(c.fallDir, k * 0.3).setY(c.pos.y + k * 0.15);
        continue;
      }
      let moving = c.mood !== 'idle';
      if (c.mood === 'idle') {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.mood = 'walk';
          c.timer = 0;
        }
      } else {
        const goal = this.graph.nodes[c.target];
        const to = new THREE.Vector3(goal.x - c.pos.x, 0, goal.z - c.pos.z);
        const d = to.length();
        if (d < 0.8) {
          c.node = c.target;
          if (c.mood === 'panic') {
            if (c.node === c.exit) c.mood = 'gone';
            else c.target = this.towardExit(c.node, c.exit);
          } else if (Math.random() < 0.3) {
            c.mood = 'idle';
            c.timer = 3 + Math.random() * 7;
            moving = false;
          } else {
            const options = this.neighbors[c.node];
            c.target = options[Math.floor(Math.random() * options.length)];
          }
        } else {
          c.pos.addScaledVector(to.divideScalar(d), Math.min(d, c.speed * dt));
          c.pos.y = this.hf.heightAt(c.pos.x, c.pos.z);
          const want = Math.atan2(-to.x, -to.z);
          c.yaw += Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)) * Math.min(1, dt * 8);
        }
        if (c.mood === 'panic') {
          c.panicT += dt;
          if (c.panicT > 7 && c.pos.distanceTo(player) > 90) c.mood = 'gone';
        }
      }
      if (c.mood === 'gone') {
        c.collider.setEnabled(false);
        c.model.root.visible = false;
        continue;
      }
      c.body.setNextKinematicTranslation({ x: c.pos.x, y: c.pos.y + 0.9, z: c.pos.z });
      const camD = c.pos.distanceToSquared(this.camera.position);
      c.model.root.visible = camD < 85 * 85;
      c.model.far = camD > 25 * 25;
      const near = camD < 30 * 30;
      if (near !== c.shadowed) c.model.castShadow = c.shadowed = near;
      c.model.root.position.copy(c.pos).setY(c.pos.y - 0.03);
      c.model.root.rotation.set(0, c.yaw + Math.PI, 0);
      c.model.animate(dt, moving ? c.speed : 0, 0, 0);
    }
  }
}
