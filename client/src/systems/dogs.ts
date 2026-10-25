import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import type { StreetGraph } from '../world/barrio';
import { pets, type Pet } from '../render/pets';

interface Dog { node: number; queue: THREE.Vector3[]; root: THREE.Group; beast: Pet; pos: THREE.Vector3; target: THREE.Vector3; yaw: number; speed: number; idle: number; panic: number; gone: boolean }


/** Stray dogs trotting around the streets; they bark now and then and run off when shooting starts. */
export class Dogs {
  readonly group = new THREE.Group();
  private dogs: Dog[] = [];
  onBark: (at: THREE.Vector3) => void = () => {};
  private barkT = 4;
  private neighbors: number[][];

  private groundAt(x: number, z: number): number {
    return this.graph.ground?.(x, z) ?? this.hf.heightAt(x, z);
  }

  constructor(private graph: StreetGraph, private hf: Heightfield, count: number) {
    this.neighbors = graph.nodes.map(() => []);
    for (const [a, b] of graph.edges) {
      this.neighbors[a].push(b);
      this.neighbors[b].push(a);
    }
    for (let i = 0; i < count; i++) {
      const kind = i % 3 === 2 && pets.has('cat') ? 'cat' : 'dog', beast = pets.make(kind, kind === 'dog' ? 0.85 + Math.random() * 0.3 : 0.9 + Math.random() * 0.2);
      if (!beast) continue;
      const root = beast.root;
      this.group.add(root);
      const node = (i * 7) % graph.nodes.length;
      const pos = graph.nodes[node].clone().add(new THREE.Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1));
      this.dogs.push({ node, queue: [], root, beast, pos, target: pos.clone(), yaw: 0, speed: 0, idle: Math.random() * 4, panic: 0, gone: false });
    }
  }

  alarm(at: THREE.Vector3, radius: number): void {
    for (const d of this.dogs) {
      if (d.gone || d.pos.distanceTo(at) > radius) continue;
      d.panic = 6;
      d.target = this.graph.nodes[d.node].clone();
      d.node = this.neighbors[d.node].reduce((best, n) => (this.graph.nodes[n].distanceTo(at) > this.graph.nodes[best].distanceTo(at) ? n : best), this.neighbors[d.node][0]);
      d.queue = [this.graph.nodes[d.node].clone()];
    }
  }

  update(dt: number, camera: THREE.Vector3): void {
    this.barkT -= dt;
    for (const d of this.dogs) {
      if (d.gone) continue;
      const to = d.target.clone().sub(d.pos).setY(0), dist = to.length();
      if (d.panic > 0) {
        d.panic -= dt;
        if (d.panic <= 0 && d.pos.distanceTo(camera) > 50) {
          d.gone = true;
          d.root.visible = false;
          continue;
        }
      }
      if (dist < 0.5 && d.queue.length) {
        d.target = d.queue.shift()!;
        d.idle = 0;
        continue;
      }
      if (d.panic > 0 && dist < 0.5) {
        const away = this.neighbors[d.node];
        d.node = away[Math.floor(Math.random() * away.length)];
        d.target = this.graph.nodes[d.node].clone();
      }
      if (dist < 0.5 || (d.panic <= 0 && d.idle > 0)) {
        d.idle -= dt;
        d.speed = THREE.MathUtils.damp(d.speed, 0, 6, dt);
        if (d.idle <= 0 && dist < 0.5) {
          const opts = this.neighbors[d.node];
          const next = opts[Math.floor(Math.random() * opts.length)];
          const t = 0.25 + Math.random() * 0.75;
          const corner = this.graph.nodes[d.node].clone();
          d.queue = [this.graph.nodes[d.node].clone().lerp(this.graph.nodes[next], t).add(new THREE.Vector3(Math.random() * 1.6 - 0.8, 0, Math.random() * 1.6 - 0.8))];
          d.target = corner;
          if (t > 0.6) d.node = next;
          d.idle = 2 + Math.random() * 6;
        }
      } else {
        d.speed = THREE.MathUtils.damp(d.speed, d.panic > 0 ? 4.2 : 0.9, 4, dt);
        d.pos.addScaledVector(to.divideScalar(dist), Math.min(dist, d.speed * dt));
        const want = Math.atan2(to.x, to.z);
        d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 6);
      }
      d.pos.y = this.groundAt(d.pos.x, d.pos.z);
      if (d.pos.distanceToSquared(camera) < 45 * 45) d.beast.update(dt, d.speed);
      d.root.position.copy(d.pos);
      d.root.rotation.y = d.yaw;
      d.root.visible = d.pos.distanceToSquared(camera) < 90 * 90;
      if (this.barkT <= 0 && d.root.visible && d.beast.kind === 'dog' && Math.random() < 0.15) {
        this.barkT = 5 + Math.random() * 10;
        this.onBark(d.pos.clone());
      }
    }
  }
}
