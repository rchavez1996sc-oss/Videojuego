import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';
import type { StreetGraph } from '../world/barrio';

interface Dog { node: number; queue: THREE.Vector3[]; root: THREE.Group; legs: THREE.Object3D[]; tail: THREE.Object3D; pos: THREE.Vector3; target: THREE.Vector3; yaw: number; speed: number; idle: number; phase: number; panic: number; gone: boolean }

const COATS = ['#5b4630', '#2a2622', '#b59a72', '#8a6a48', '#e3dccd', '#3d3128'];

function colored(g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const n = (g = g.toNonIndexed().deleteAttribute('uv')).attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

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

  constructor(private graph: StreetGraph, private hf: Heightfield, lighting: Lighting, count: number) {
    this.neighbors = graph.nodes.map(() => []);
    for (const [a, b] of graph.edges) {
      this.neighbors[a].push(b);
      this.neighbors[b].push(a);
    }
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 'dog');
    for (let i = 0; i < count; i++) {
      const coat = new THREE.Color(COATS[i % COATS.length]), dark = coat.clone().multiplyScalar(0.6);
      const body = mergeGeometries([
        colored(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8).rotateX(Math.PI / 2), coat),
        colored(new THREE.BoxGeometry(0.2, 0.2, 0.26).translate(0, 0.14, 0.4), coat),
        colored(new THREE.BoxGeometry(0.12, 0.1, 0.14).translate(0, 0.1, 0.58), dark),
        colored(new THREE.ConeGeometry(0.05, 0.1, 4).translate(-0.07, 0.29, 0.38), dark),
        colored(new THREE.ConeGeometry(0.05, 0.1, 4).translate(0.07, 0.29, 0.38), dark),
      ]);
      const root = new THREE.Group();
      const torso = new THREE.Mesh(body, mat);
      torso.position.y = 0.42;
      torso.castShadow = true;
      root.add(torso);
      const legGeo = colored(new THREE.CylinderGeometry(0.035, 0.03, 0.36, 5).translate(0, -0.18, 0), dark);
      const legs = [[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.22], [0.09, -0.22]].map(([x, z]) => {
        const l = new THREE.Mesh(legGeo, mat);
        l.position.set(x, 0.38, z);
        root.add(l);
        return l;
      });
      const tail = new THREE.Mesh(colored(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5).translate(0, 0.15, 0), coat), mat);
      tail.position.set(0, 0.5, -0.32);
      tail.rotation.x = -0.9;
      root.add(tail);
      this.group.add(root);
      const node = (i * 7) % graph.nodes.length;
      const pos = graph.nodes[node].clone().add(new THREE.Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1));
      this.dogs.push({ node, queue: [], root, legs, tail, pos, target: pos.clone(), yaw: 0, speed: 0, idle: Math.random() * 4, phase: 0, panic: 0, gone: false });
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
        d.speed = THREE.MathUtils.damp(d.speed, d.panic > 0 ? 7.5 : 1.6, 4, dt);
        d.pos.addScaledVector(to.divideScalar(dist), Math.min(dist, d.speed * dt));
        const want = Math.atan2(to.x, to.z);
        d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 6);
      }
      d.pos.y = this.groundAt(d.pos.x, d.pos.z);
      d.phase += dt * (4 + d.speed * 3);
      const swing = Math.min(1, d.speed / 2) * 0.7;
      d.legs.forEach((l, i) => (l.rotation.x = Math.sin(d.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
      d.tail.rotation.z = Math.sin(d.phase * (d.panic > 0 ? 0.5 : 2)) * 0.4;
      d.root.position.copy(d.pos);
      d.root.rotation.y = d.yaw;
      d.root.visible = d.pos.distanceToSquared(camera) < 90 * 90;
      if (this.barkT <= 0 && d.root.visible && Math.random() < 0.15) {
        this.barkT = 5 + Math.random() * 10;
        this.onBark(d.pos.clone());
      }
    }
  }
}
