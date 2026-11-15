import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';
import designs from '../data/roofBoards.json';

interface Design { top: string; big: string; sub: string; bg: string; ink: string; accent: string; face?: boolean }

/** Rooftop billboard spots registered by houses (`roofClutter`): front-centre of the roof, facing the street. */
export const roofBoardSpots: { pos: THREE.Vector3; yaw: number; w: number }[] = [];

const CW = 1024, CH = 384;

function atlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas'), list = designs as Design[];
  c.width = CW;
  c.height = CH * list.length;
  const g = c.getContext('2d')!;
  list.forEach((d, i) => {
    const y = i * CH;
    g.fillStyle = d.bg;
    g.fillRect(0, y, CW, CH);
    g.fillStyle = d.accent;
    g.fillRect(0, y + CH - 46, CW, 46);
    const x0 = d.face ? 330 : 40;
    if (d.face) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(30, y + 30, 270, CH - 90);
      g.fillStyle = '#c99a78';
      g.beginPath(); g.ellipse(165, y + 140, 70, 86, 0, 0, 7); g.fill();
      g.fillStyle = '#1d1b1a';
      g.beginPath(); g.ellipse(165, y + 82, 74, 40, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(70, y + CH - 60); g.quadraticCurveTo(165, y + 200, 260, y + CH - 60); g.fill();
    }
    g.fillStyle = d.ink;
    g.textBaseline = 'middle';
    g.font = '700 40px "Barlow Condensed", Arial, sans-serif';
    g.fillText(d.top, x0, y + 58, CW - x0 - 40);
    g.font = '800 104px "Barlow Condensed", Arial, sans-serif';
    g.fillText(d.big, x0, y + 160, CW - x0 - 40);
    g.font = '600 46px "Barlow Condensed", Arial, sans-serif';
    g.fillText(d.sub, x0, y + 262, CW - x0 - 40);
    g.fillStyle = d.ink === '#ffffff' ? '#ffffff' : '#ffffff';
    g.globalAlpha = 0.08;
    for (let k = 0; k < 60; k++) g.fillRect(Math.random() * CW, y + Math.random() * CH, 2 + Math.random() * 40, 1 + Math.random() * 3);
    g.globalAlpha = 1;
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Gigantografías on the roofs along the avenue (Street View of Huaycán): a vinyl print stretched on a steel frame
 * standing on two legs over the front parapet — academies, internet, hardware stores, candidates of the fictional
 * parties and the Junta's own slogans. Only roofs within `nearZ` of the avenue; one mesh for the prints, one for steel.
 */
export function roofBoards(lighting: Lighting, nearZ: number, rand: () => number): THREE.Group {
  const n = (designs as Design[]).length, prints: THREE.BufferGeometry[] = [], steel: THREE.BufferGeometry[] = [];
  for (const s of roofBoardSpots.splice(0)) {
    if (Math.abs(s.pos.z) > nearZ) continue;
    const w = Math.min(9, s.w - 0.6), h = w * 0.375, lift = 1.2 + rand() * 0.8, d = Math.floor(rand() * n);
    const m = new THREE.Matrix4().compose(s.pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw), new THREE.Vector3(1, 1, 1));
    const print = new THREE.PlaneGeometry(w, h), uv = print.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (d + 1 - uv.getY(i)) / n);
    prints.push(print.translate(0, lift + h / 2, 0.06).applyMatrix4(m));
    for (const x of [-w * 0.35, w * 0.35]) steel.push(new THREE.BoxGeometry(0.08, lift + h, 0.08).translate(x, (lift + h) / 2, 0).applyMatrix4(m));
    for (const y of [lift, lift + h]) steel.push(new THREE.BoxGeometry(w + 0.1, 0.06, 0.06).translate(0, y, 0).applyMatrix4(m));
    steel.push(new THREE.BoxGeometry(0.05, 1.6, 0.05).translate(0, lift * 0.6, -0.9).rotateX(0).applyMatrix4(m));
  }
  const g = new THREE.Group();
  if (!prints.length) return g;
  const vinyl = lighting.setup(new THREE.MeshStandardMaterial({ map: atlas(), roughness: 0.7, side: THREE.DoubleSide }), 'roofboard-print');
  const metal = lighting.setup(new THREE.MeshStandardMaterial({ color: '#4a4d50', roughness: 0.6, metalness: 0.6 }), 'roofboard-steel');
  g.add(Object.assign(new THREE.Mesh(mergeGeometries(prints)!, vinyl), { castShadow: true, receiveShadow: true }));
  g.add(Object.assign(new THREE.Mesh(mergeGeometries(steel.map((s) => s.toNonIndexed()))!, metal), { castShadow: true }));
  return g;
}
