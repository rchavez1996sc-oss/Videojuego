import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Heightfield } from '../world/heightfield';
import type { Lighting } from '../render/lighting';

/** Signalised crossings on one straight road along x: centre `z`, half width, cross-street centres `x`, cross half width. */
export interface LightRoad { z: number; half: number; x: number[]; cross?: number }

const GREEN = 15, AMBER = 3, RED = 12, CYCLE = GREEN + AMBER + RED, WAVE = 3.5;
type Phase = 'g' | 'y' | 'r';
const ON: Record<Phase, THREE.Color> = { r: new THREE.Color(14, 0.8, 0.4), y: new THREE.Color(9, 5, 0.3), g: new THREE.Color(0.3, 7, 2.8) };
const OFF: Record<Phase, THREE.Color> = { r: new THREE.Color(0.09, 0.02, 0.02), y: new THREE.Color(0.09, 0.07, 0.02), g: new THREE.Color(0.02, 0.08, 0.05) };
const ORDER: Phase[] = ['r', 'y', 'g'];

interface Head { road: number; cross: number; inverse: boolean }

/**
 * Traffic signals at the crossings of the avenues (Lima style: grey pole, black heads on a yellow backplate, one head
 * facing the oncoming lane and one the cross street). The avenue cycles green 15 s / amber 3 s / red 12 s with a green
 * wave along the road; cross-street heads show the opposite. `stopLine` tells traffic where to wait on red.
 */
export class TrafficLights {
  readonly group = new THREE.Group();
  private heads: Head[] = [];
  private lamps: THREE.InstancedMesh;
  private shown: string[] = [];
  private t = 0;

  constructor(private roads: LightRoad[], hf: Heightfield, lighting: Lighting, world: RAPIER.World) {
    const parts: Record<'pole' | 'head' | 'plate', THREE.BufferGeometry[]> = { pole: [], head: [], plate: [] };
    const lampAt: THREE.Matrix4[] = [];
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    roads.forEach((r, ri) => r.x.forEach((cx, ci) => {
      for (const dir of [1, -1]) {
        const x = cx - dir * ((r.cross ?? 4.5) + 1.3), z = r.z + dir * (r.half + 0.55), y = hf.heightAt(x, z);
        parts.pole.push(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 10).translate(x, y + 2.3, z));
        world.createCollider(RAPIER.ColliderDesc.cylinder(2.3, 0.1).setTranslation(x, y + 2.3, z), body);
        for (const [face, inverse, h] of [[-dir, false, 3.7], [dir, true, 2.6]] as const) {
          const along = inverse ? new THREE.Vector3(0, 0, face) : new THREE.Vector3(face, 0, 0);
          const yaw = Math.atan2(along.x, along.z), m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h, z).addScaledVector(along, 0.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
          parts.plate.push(new THREE.BoxGeometry(0.52, 1.18, 0.03).translate(0, 0, -0.14).applyMatrix4(m));
          parts.head.push(new THREE.BoxGeometry(0.32, 0.98, 0.24).applyMatrix4(m));
          for (let k = 0; k < 3; k++) {
            parts.head.push(new THREE.BoxGeometry(0.26, 0.03, 0.16).translate(0, 0.37 - k * 0.31, 0.19).applyMatrix4(m));
            lampAt.push(new THREE.Matrix4().makeTranslation(0, 0.3 - k * 0.31, 0.125).premultiply(m));
            this.heads.push({ road: ri, cross: ci, inverse });
          }
        }
      }
    }));
    const mat = (key: string, color: string, rough: number, metal = 0) => lighting.setup(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }), key);
    const add = (geos: THREE.BufferGeometry[], m: THREE.Material) => geos.length && this.group.add(Object.assign(new THREE.Mesh(mergeGeometries(geos)!, m), { castShadow: true, receiveShadow: true }));
    add(parts.pole, mat('signal-pole', '#8a8d8f', 0.55, 0.6));
    add(parts.head, mat('signal-head', '#141516', 0.5));
    add(parts.plate, mat('signal-plate', '#d9b21f', 0.6));
    this.lamps = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, lampAt.length));
    lampAt.forEach((m, i) => this.lamps.setMatrixAt(i, m));
    this.lamps.count = lampAt.length;
    this.group.add(this.lamps);
    this.shown = lampAt.map(() => '');
    this.update(0);
  }

  private phase(road: number, cross: number, inverse: boolean): Phase {
    const t = (this.t + cross * WAVE + road * 7) % CYCLE;
    const avenue: Phase = t < GREEN ? 'g' : t < GREEN + AMBER ? 'y' : 'r';
    if (!inverse) return avenue;
    return avenue === 'r' ? (t < CYCLE - AMBER ? 'g' : 'y') : 'r';
  }

  update(dt: number): void {
    this.t += dt;
    let dirty = false;
    this.heads.forEach((h, i) => {
      const p = this.phase(h.road, h.cross, h.inverse), lamp = ORDER[i % 3], key = p === lamp ? 'on' : 'off';
      if (this.shown[i] === key) return;
      this.shown[i] = key;
      this.lamps.setColorAt(i, (key === 'on' ? ON : OFF)[lamp]);
      dirty = true;
    });
    if (dirty && this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
  }

  /** Where a vehicle at `x` heading `dir` on the road centred at `base` must stop (red, or amber with room to brake); null to go on. */
  stopLine(x: number, dir: number, base: number, speed: number): number | null {
    const ri = this.roads.findIndex((r) => Math.abs(r.z - base) < 0.5);
    if (ri < 0) return null;
    const r = this.roads[ri];
    let best = -1, bd = Infinity;
    r.x.forEach((cx, ci) => {
      const d = (cx - x) * dir - (r.cross ?? 4.5);
      if (d > 0 && d < bd) [best, bd] = [ci, d];
    });
    if (best < 0 || bd > 60) return null;
    const p = this.phase(ri, best, false), line = r.x[best] - dir * ((r.cross ?? 4.5) + 1.5);
    if (p === 'g' || (p === 'y' && (line - x) * dir < speed * speed / 10 + 2)) return null;
    return line;
  }
}
