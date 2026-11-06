import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import type { StreetGraph } from './barrio';
import { mulberry32 } from '../core/rng';
import { surfaceTop } from './groundStrips';
import { setSurface } from './surfaces';

const C = 256, UP = new THREE.Vector3(0, 1, 0);

function octagon(g: CanvasRenderingContext2D, rad: number, fill: string): void {
  g.fillStyle = fill; g.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28 + Math.PI / 8; g.lineTo(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad); }
  g.closePath(); g.fill();
}

/** Peruvian road signs (PARE, CEDA EL PASO, NO ESTACIONAR) and blue street-name plates, one atlas cell each. */
function atlas(names: string[]): THREE.CanvasTexture {
  const n = 3 + names.length, cv = Object.assign(document.createElement('canvas'), { width: C * n, height: C }), g = cv.getContext('2d')!;
  const cell = (i: number, draw: () => void) => { g.save(); g.translate(i * C, 0); draw(); g.restore(); };
  cell(0, () => {
    octagon(g, 124, '#f4f4f0'); octagon(g, 112, '#c4161c');
    g.fillStyle = '#f4f4f0'; g.font = '800 70px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PARE', 128, 132);
  });
  cell(1, () => {
    g.fillStyle = '#c4161c'; g.beginPath(); g.moveTo(8, 20); g.lineTo(248, 20); g.lineTo(128, 236); g.closePath(); g.fill();
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.moveTo(44, 40); g.lineTo(212, 40); g.lineTo(128, 192); g.closePath(); g.fill();
    g.fillStyle = '#c4161c'; g.font = '800 26px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.fillText('CEDA EL', 128, 82); g.fillText('PASO', 128, 112);
  });
  cell(2, () => {
    g.fillStyle = '#c4161c'; g.beginPath(); g.arc(128, 128, 122, 0, 6.28); g.fill();
    g.fillStyle = '#1d4a9e'; g.beginPath(); g.arc(128, 128, 98, 0, 6.28); g.fill();
    g.strokeStyle = '#c4161c'; g.lineWidth = 22; g.beginPath(); g.moveTo(58, 58); g.lineTo(198, 198); g.stroke();
  });
  names.forEach((t, i) => cell(3 + i, () => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 76, C, 104);
    g.fillStyle = '#1d4a9e'; g.fillRect(6, 82, C - 12, 92);
    g.fillStyle = '#f2f2ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let px = 46; do g.font = `700 ${px--}px "Barlow Condensed", Arial`; while (g.measureText(t).width > C - 28 && px > 16);
    g.fillText(t, 128, 128);
  }));
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
}

/**
 * Sign posts at street corners (graph nodes where three or more streets meet): a galvanised pole with a stop,
 * give-way or no-parking sign, often topped by the street-name plate. Placed only on open, level paving; each pole
 * collides (thin cylinder). Only corners with a road within 5 m, at most `max` posts. Plates and poles are instanced: a few draws for the whole level.
 */
export function streetSigns(graph: StreetGraph, world: RAPIER.World, lighting: Lighting, names: string[], paved: (x: number, z: number) => boolean, area?: [number, number, number, number], share = 0.55, max = 45): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(5150), tex = atlas(names), cells = 3 + names.length;
  const front = lighting.setup(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.5, metalness: 0.2 }), 'road-signs');
  const back = lighting.setup(new THREE.MeshStandardMaterial({ map: tex, color: '#5a5c5e', alphaTest: 0.5, roughness: 0.55, metalness: 0.5, side: THREE.BackSide }), 'road-signs-back');
  const pole = lighting.setup(new THREE.MeshStandardMaterial({ color: '#9aa0a3', roughness: 0.45, metalness: 0.7 }), 'sign-pole');
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed()), degree = graph.nodes.map(() => 0);
  for (const [a, b] of graph.edges) (degree[a]++, degree[b]++);
  const poles: THREE.Matrix4[] = [], plates: THREE.Matrix4[][] = Array.from({ length: cells }, () => []);
  graph.nodes.forEach((n, i) => {
    if (area && (n.x < area[0] || n.z < area[1] || n.x > area[2] || n.z > area[3])) return;
    if (degree[i] < 3 || r() > share || poles.length >= max || ![0, 1.57, 3.14, 4.71].some((a) => paved(n.x + Math.cos(a) * 5, n.z + Math.sin(a) * 5))) return;
    const a = r() * 6.28, p = n.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9));
    const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 2, z: p.z }, { x: 0, y: -1, z: 0 }), 4, true);
    if (!hit) return;
    p.y = surfaceTop(p.x, p.y + 2 - hit.timeOfImpact, p.z);
    if (Math.abs(p.y - n.y) > 0.5 || world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: 1, z: 0 }), 3.2, true)) return;
    let blocked = false;
    world.intersectionsWithShape({ x: p.x, y: p.y + 1.3, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Cylinder(1.1, 0.35), () => ((blocked = true), false));
    if (blocked) return;
    const yaw = r() * 6.28, q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    poles.push(new THREE.Matrix4().compose(p.clone().setY(p.y + 1.35), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    const kind = r() < 0.45 ? 0 : r() < 0.5 ? 1 : 2, size = kind === 0 ? 0.72 : kind === 1 ? 0.8 : 0.6;
    plates[kind].push(new THREE.Matrix4().compose(p.clone().add(new THREE.Vector3(Math.sin(yaw) * 0.05, 2.0, Math.cos(yaw) * 0.05)), q, new THREE.Vector3(size, size, 1)));
    if (names.length && r() < 0.7) {
      const q2 = new THREE.Quaternion().setFromAxisAngle(UP, yaw + Math.PI / 2);
      plates[3 + Math.floor(r() * names.length)].push(new THREE.Matrix4().compose(p.clone().setY(p.y + 2.62), q2, new THREE.Vector3(1.1, 1.1, 1)));
    }
    setSurface(world.createCollider(RAPIER.ColliderDesc.cylinder(1.35, 0.045).setTranslation(p.x, p.y + 1.35, p.z), body).handle, 'metal');
  });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], shadow: boolean) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = shadow;
    inst.receiveShadow = true;
    g.add(inst);
  };
  add(new THREE.CylinderGeometry(0.035, 0.04, 2.7, 8), pole, poles, true);
  plates.forEach((list, k) => {
    const geo = new THREE.PlaneGeometry(1, 1), uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / cells);
    add(geo, front, list, true);
    add(geo, back, list, false);
  });
  return g;
}
