import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Plants } from '../malecon/park';
import { framer, yawQ, type CampusBuilding } from './layout';
import type { NameSign } from './pavilion';

/**
 * Instituto de Investigación y Unidad de Posgrado de Ciencias Físicas (from the user's photos): a white block with a
 * blank front carrying gold letters, strip windows on the side, a glazed entrance and a curved glass drum ringed by
 * white round columns under a curved white roof band. In front, lawns bordered by golden hedges along the walk to
 * the door, a stepping-stone path between hedges, round flower beds, papyrus at the foot of the wall, palms and
 * eucalyptus. Local +z faces the garden.
 */
export function fisInst(b: Builder, def: CampusBuilding, plants: Plants, rand: () => number): NameSign {
  const at = framer(def), q = yawQ(def.yaw), W = def.w / 2, F = def.d / 2, H = def.floors * 3.6 + 0.6;
  const box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide = false) => b.box(mat, size, at(x, y, z), q, collide);
  const geo = (mat: string, g: THREE.BufferGeometry, x: number, z: number) => b.geometry(mat, g, new THREE.Matrix4().compose(at(x, 0, z), q, new THREE.Vector3(1, 1, 1)));
  const split = 2;
  box('uniWhite', [split + W, H, def.d], (split - W) / 2, H / 2, 0, true);
  box('uniWhite', [W - split, H, def.d - 3.5], (split + W) / 2, H / 2, -1.75, true);
  for (let f = 0; f < def.floors; f++) for (const z of [-F + 4, 0, F - 4]) box('winGlass', [0.06, 1, 3.4], -W - 0.03, f * 3.6 + 2.2, z);
  for (let x = -W + 3; x < split - 2; x += 5) box('winGlass', [3.2, 0.9, 0.06], x, H - 2.2, -F - 0.03);
  box('uniWhite', [def.w + 0.3, 0.7, def.d + 0.3], 0, H + 0.1, 0);
  for (let x = -W + 1.5; x < split - 1; x += 3.4) box('steelGrey', [2.4, 0.5, 0.5], x, 0.75, F + 0.3);

  const gz = F - 3;
  box('winGlass', [7, H - 1.4, 0.08], split + 3.5, (H - 1.4) / 2, gz);
  for (let x = split; x <= split + 7.01; x += 1.4) box('mullion', [0.06, H - 1.4, 0.12], x, (H - 1.4) / 2, gz + 0.04);
  for (let y = 3.6; y < H - 1.4; y += 3.6) box('mullion', [7, 0.08, 0.12], split + 3.5, y, gz + 0.04);
  box('darkGlass', [2.4, 2.6, 0.1], split + 2.2, 1.3, gz + 0.06);
  box('uniWhite', [1.8, 0.6, 0.05], split + 2.2, 3, gz + 0.1);
  const R = (W - split - 7) / 2, cx = split + 7 + R, half = (r: number, h: number, open = true) => new THREE.CylinderGeometry(r, r, h, 40, 1, open, -Math.PI / 2, Math.PI);
  geo('winGlass', half(R, H - 1.4).translate(0, (H - 1.4) / 2, 0), cx, gz);
  geo('uniWhite', half(R + 1.2, 1.1, false).translate(0, H - 0.75, 0), cx, gz);
  geo('uniWhite', new THREE.CylinderGeometry(R + 1.2, R + 1.2, 0.2, 40, 1, false, -Math.PI / 2, Math.PI).translate(0, H - 1.25, 0), cx, gz);
  for (let k = 0; k <= 6; k++) {
    const a = -Math.PI / 2 + (k / 6) * Math.PI, x = cx + Math.sin(a) * (R + 0.7), z = gz + Math.cos(a) * (R + 0.7);
    geo('uniWhite', new THREE.CylinderGeometry(0.28, 0.28, H - 1.3, 14).translate(0, (H - 1.3) / 2, 0), x, z);
    box('none', [0.56, H, 0.56], x, H / 2, z, true);
  }
  box('none', [R * 2, H, R], cx, H / 2, gz + R / 2, true);

  const lime = (x0: number, z0: number, x1: number, z1: number) => {
    const a = new THREE.Vector2(x0, z0), c = new THREE.Vector2(x1, z1), len = a.distanceTo(c), m = a.clone().lerp(c, 0.5);
    b.box('hedgeLime', [0.55, 0.5, len], at(m.x, 0.25, m.y), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(c.x - a.x, c.y - a.y))), false);
  };
  const door = split + 2.2, end = F + 13;
  box('parkPath', [2.6, 0.12, end - gz], door, 0.06, (gz + end) / 2);
  for (const s of [-1, 1]) lime(door + s * 1.7, gz + 1, door + s * 1.7, end);
  lime(-W, F + 1.2, split - 0.5, F + 1.2);
  const sx = -W + 7;
  for (let z = F + 2.5; z < end; z += 0.75) box('pavers', [0.5, 0.08, 0.45], sx, 0.04, z);
  for (const s of [-1, 1]) lime(sx + s * 0.7, F + 2.2, sx + s * 0.7, end);
  for (const [x, z, r, mat] of [[-W + 12, F + 6, 1.6, 'flowerPurple'], [door + 6, F + 7, 2.2, 'flowerRed'], [door + 9, F + 3.5, 1.8, 'flowerSilver']] as const) {
    geo('concrete', new THREE.CylinderGeometry(r + 0.15, r + 0.15, 0.2, 24).translate(0, 0.1, 0), x, z);
    geo(mat, new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.32, 1).translate(0, 0.18, 0), x, z);
  }
  for (let x = -W + 1; x < split - 1; x += 1.3) for (let k = 0; k < 5; k++) {
    const a = rand() * Math.PI * 2, h = 1.1 + rand() * 0.6;
    b.box('hedge', [0.03, h, 0.03], at(x + Math.cos(a) * 0.25, h / 2 + 0.9, F + 0.9 + Math.sin(a) * 0.2), q, false);
    b.box('hedge', [0.35, 0.05, 0.35], at(x + Math.cos(a) * 0.25, h + 0.9, F + 0.9 + Math.sin(a) * 0.2), q, false);
  }
  for (const [x, z] of [[-W + 3, F + 9], [-W + 10, F + 11], [door - 4, F + 10], [door + 4, F + 12]]) plants.trees.push(at(x, 0, z));
  for (const [x, z] of [[cx + R + 4, F + 4], [cx + 1, F + 11], [-W - 3, F + 6]]) plants.palms.push(at(x, 0, z));
  return { pos: at((-W + split) / 2, H - 3.3, F + 0.04), q, w: Math.min(14, W + split - 2), text: 'FACULTAD DE CIENCIAS FÍSICAS\nINSTITUTO DE INVESTIGACIÓN\nUNIDAD DE POSGRADO', ink: '#d6ad48' };
}
