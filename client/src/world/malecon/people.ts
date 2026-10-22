import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../core/rng';
import type { Lighting } from '../../render/lighting';
import { seatedPerson } from '../../entities/occupants';
import type { CoastDef } from '../coast';

/** People sitting on benches and at café tables, merged into one static mesh (hips at seat height). */
export function seated(seats: { pos: THREE.Vector3; yaw: number }[], lighting: Lighting, seatH = 0.47): THREE.Mesh | null {
  if (!seats.length) return null;
  const r = mulberry32(12), geos: THREE.BufferGeometry[] = [];
  let mat: THREE.Material | null = null;
  for (const s of seats) {
    const p = seatedPerson(lighting, r);
    mat = p.material as THREE.Material;
    const m = new THREE.Matrix4().compose(s.pos.clone().setY(s.pos.y + seatH - 0.95), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw), new THREE.Vector3(1, 1, 1));
    geos.push(p.geometry.clone().applyMatrix4(m));
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat!);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Surfers waiting for a set beyond the break, bobbing on the swell. */
export function surfers(count: number, c: CoastDef, lighting: Lighting): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(29), list: { obj: THREE.Group; phase: number }[] = [];
  const boards = ['#f2f0ea', '#f2c230', '#2d6fd1', '#e8462c'].map((col) => lighting.setup(new THREE.MeshStandardMaterial({ color: col, roughness: 0.35 }), `board-${col}`));
  const geo = new THREE.CapsuleGeometry(0.28, 1.6, 4, 10).rotateX(Math.PI / 2).scale(1, 0.18, 1);
  for (let i = 0; i < count; i++) {
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(geo, boards[i % boards.length]));
    const p = seatedPerson(lighting, r);
    p.position.y = 0.12 - 0.95;
    p.position.z = -0.25;
    obj.add(p);
    obj.position.set((r() - 0.5) * 420, c.sea, c.shore + 30 + r() * 60);
    obj.rotation.y = (r() - 0.5) * 0.8;
    g.add(obj);
    list.push({ obj, phase: r() * 6.28 });
  }
  const anchor = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  anchor.frustumCulled = false;
  anchor.onBeforeRender = () => {
    const t = performance.now() / 1000;
    for (const s of list) {
      s.obj.position.y = c.sea + Math.sin(t * 1.1 + s.phase) * 0.3;
      s.obj.rotation.x = Math.sin(t * 1.1 + s.phase + 1) * 0.08;
    }
  };
  g.add(anchor);
  return g;
}
