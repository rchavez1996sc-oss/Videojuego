import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

let mats: { panel: THREE.Material; trim: THREE.Material } | null = null;

/**
 * The inside of a bus seen from its driving camera: the model's shell is drawn from outside only, so from within it
 * vanishes and leaves seats and handrails floating ("ghost bus"). This frame puts the cabin back around the camera —
 * floor, lower side panels up to the window line, a pillar between every pair of windows, the roof with its edge strips,
 * the windscreen frame and the dashboard, the rear wall — sized from the model's body (`userData.body`, group space). `userData.eye`: standing eye height over the floor.
 */
export function busCabin(group: THREE.Object3D, lighting: Lighting): THREE.Group {
  mats ??= {
    panel: lighting.setup(new THREE.MeshStandardMaterial({ color: '#c9c2ae', roughness: 0.8, side: THREE.DoubleSide }), 'bus-panel'),
    trim: lighting.setup(new THREE.MeshStandardMaterial({ color: '#2e2f31', roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }), 'bus-trim'),
  };
  const box: THREE.Box3 = group.userData.body?.clone() ?? new THREE.Box3(new THREE.Vector3(-1.15, 0, -4.3), new THREE.Vector3(1.15, 2.9, 4.3));
  const hw = Math.min(box.max.x, -box.min.x) - 0.07, z0 = box.min.z + 0.1, z1 = box.max.z - 0.15, top = box.max.y - 0.12;
  const floor = box.min.y + (top - box.min.y) * 0.28, belt = box.min.y + (top - box.min.y) * 0.5, winTop = top - 0.28;
  const panel: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [];
  const add = (list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number) => list.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const len = z1 - z0, mid = (z0 + z1) / 2;
  for (const s of [1, -1]) {
    add(panel, 0.04, belt - floor, len, s * hw, (belt + floor) / 2, mid);
    add(trim, 0.08, 0.06, len, s * (hw - 0.02), belt, mid);
    add(panel, 0.04, top - winTop, len, s * hw, (top + winTop) / 2, mid);
    const n = Math.max(3, Math.round(len / 1.15));
    for (let i = 0; i <= n; i++) add(trim, 0.07, winTop - belt, 0.09, s * (hw - 0.01), (winTop + belt) / 2, z0 + (len * i) / n);
  }
  add(panel, hw * 2, 0.04, len, 0, top, mid);
  for (const x of [-hw * 0.45, hw * 0.45]) add(trim, 0.05, 0.05, len, x, top - 0.05, mid);
  add(trim, hw * 2, 0.12, 0.08, 0, top - 0.06, z1);
  for (const s of [1, -1]) add(trim, 0.12, top - belt, 0.1, s * (hw - 0.06), (top + belt) / 2, z1);
  add(trim, hw * 2, 0.32, 0.55, 0, belt - 0.05, z1 - 0.3);
  add(panel, hw * 2, belt - floor, 0.04, 0, (belt + floor) / 2, z0);
  add(trim, hw * 2, 0.05, len, 0, floor, mid);
  add(trim, hw * 2, belt - floor, 0.05, 0, (belt + floor) / 2, z1);
  add(trim, hw * 2, 0.1, 0.06, 0, winTop, z0);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries(panel)!, mats.panel), new THREE.Mesh(mergeGeometries(trim)!, mats.trim));
  g.name = 'bus-cabin';
  g.userData.eye = floor + 1.55;
  return g;
}
