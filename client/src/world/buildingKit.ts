import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { setSurface, type Surface } from './surfaces';
import { cover } from '../ai/cover';

const SURFACE: Record<string, Surface> = { adobe: 'adobe', plaster: 'adobe', stone: 'rock', none: 'rock', wood: 'wood', crate: 'wood', roof: 'tile' };

export interface Opening { x: number; w: number; y: number; h: number }

/** Accumulates world-space boxes per material, then emits merged meshes and box colliders. */
export class Builder {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  private tmp = new THREE.Object3D();

  constructor(private world: RAPIER.World, private body: RAPIER.RigidBody) {}

  box(mat: string, size: [number, number, number], pos: THREE.Vector3, quat: THREE.Quaternion, collide = true): void {
    const g = new THREE.BoxGeometry(...size);
    this.tmp.position.copy(pos);
    this.tmp.quaternion.copy(quat);
    this.tmp.updateMatrix();
    g.applyMatrix4(this.tmp.matrix);
    if (mat !== 'none') (this.parts.get(mat) ?? this.parts.set(mat, []).get(mat)!).push(g);
    if (collide) {
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
          .setTranslation(pos.x, pos.y, pos.z)
          .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
        this.body,
      );
      setSurface(col.handle, SURFACE[mat] ?? 'adobe');
      if (mat !== 'roof') cover.addBox(pos, size, quat);
    }
  }

  /** Triangular gable of base `base` and height `h`, extruded `thick` along local X (rotY=0) or Z (alongZ). */
  gable(mat: string, base: number, h: number, thick: number, pos: THREE.Vector3, quat: THREE.Quaternion, alongZ = false): void {
    const shape = new THREE.Shape([new THREE.Vector2(-base / 2, 0), new THREE.Vector2(base / 2, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }).deleteAttribute('uv');
    g.translate(0, 0, -thick / 2);
    if (!alongZ) g.rotateY(Math.PI / 2);
    this.tmp.position.copy(pos);
    this.tmp.quaternion.copy(quat);
    this.tmp.updateMatrix();
    g.applyMatrix4(this.tmp.matrix);
    g.setIndex([...Array(g.attributes.position.count).keys()]);
    (this.parts.get(mat) ?? this.parts.set(mat, []).get(mat)!).push(g);
  }

  /** Wall along local +X, centred at `origin` (bottom-centre), with rectangular openings. */
  wall(mat: string, len: number, height: number, thick: number, origin: THREE.Vector3, rotY: number, openings: Opening[] = []): void {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    const local = (x: number, y: number) => new THREE.Vector3(x, y, 0).applyQuaternion(q).add(origin);
    const sorted = [...openings].sort((a, b) => a.x - b.x);
    let cursor = -len / 2;
    for (const o of sorted) {
      const l = o.x - o.w / 2, r = o.x + o.w / 2;
      if (l > cursor) this.box(mat, [l - cursor, height, thick], local((cursor + l) / 2, height / 2), q);
      if (o.y > 0) this.box(mat, [o.w, o.y, thick], local(o.x, o.y / 2), q);
      const top = o.y + o.h;
      if (top < height) this.box(mat, [o.w, height - top, thick], local(o.x, (top + height) / 2), q);
      this.box('wood', [o.w + 0.25, 0.18, thick + 0.08], local(o.x, top + 0.09), q, false);
      cursor = r;
    }
    if (cursor < len / 2) this.box(mat, [len / 2 - cursor, height, thick], local((cursor + len / 2) / 2, height / 2), q);
  }

  build(materials: Record<string, THREE.Material>, uvScale = 0.4): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [key, geos] of this.parts) {
      const merged = mergeBoxes(geos);
      boxProjectUV(merged, uvScale);
      const m = new THREE.Mesh(merged, materials[key]);
      m.castShadow = m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }
}

function mergeBoxes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0, icount = 0;
  for (const g of geos) { count += g.attributes.position.count; icount += g.index!.count; }
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), idx = new Uint32Array(icount);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, vo * 3);
    nor.set(g.attributes.normal.array as Float32Array, vo * 3);
    const gi = g.index!.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count;
    io += gi.length;
    g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  m.computeBoundingSphere();
  return m;
}

export function boxProjectUV(g: THREE.BufferGeometry, scale: number): void {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay > ax && ay > az ? [p.getX(i), p.getZ(i)] : ax > az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
