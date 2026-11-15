import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Builder } from '../buildingKit';
import type { Lighting } from '../../render/lighting';
import { WIND } from '../../render/wind';
import { shotMode } from '../../core/settings';

/** Plots `buildTowers` gave to a building site instead of a finished tower. */
export const constructionSites: { x: number; w: number; zFace: number; d: number; s: 1 | -1; floors: number }[] = [];

const FLOOR = 3, Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);

function sign(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#1d4f9c';
  g.fillRect(0, 0, 1024, 70);
  g.fillStyle = '#ffffff';
  g.font = '800 46px "Barlow Condensed", Arial, sans-serif';
  g.fillText('OBRA EN EJECUCIÓN · LICENCIA N.º 0347-2036-MML', 24, 52, 976);
  g.fillStyle = '#1d2a3a';
  g.font = '800 96px "Barlow Condensed", Arial, sans-serif';
  g.fillText('RESIDENCIAL MIRAMAR', 24, 160, 976);
  g.font = '600 42px "Barlow Condensed", Arial, sans-serif';
  g.fillText('DEPARTAMENTOS DE 2 Y 3 DORMITORIOS · VISTA AL MAR', 24, 225, 976);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A lattice box (four chords and zig-zag bracing on each face), `len` long along +Y. */
function lattice(len: number, size: number, step: number, out: THREE.BufferGeometry[], m: THREE.Matrix4): void {
  const h = size / 2;
  for (const [x, z] of [[-h, -h], [h, -h], [h, h], [-h, h]]) out.push(new THREE.BoxGeometry(0.08, len, 0.08).translate(x, len / 2, z).applyMatrix4(m));
  for (let y = 0; y < len - 0.01; y += step) for (const [ax, az, bx, bz] of [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h]]) {
    const a = new THREE.Vector3(ax, y, az), b = new THREE.Vector3(bx, y + step, bz), mid = a.clone().lerp(b, 0.5), l = a.distanceTo(b);
    out.push(new THREE.BoxGeometry(0.05, l, 0.05).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())).translate(mid.x, mid.y, mid.z).applyMatrix4(m));
  }
}

/**
 * Building sites like the ones all over Miraflores (Street View, 2025): a bare concrete frame (slabs on columns, the
 * top floor still only starter bars), blue shade netting hung on the lower floors that billows in the wind, a blue
 * plywood hoarding with the project board along the pavement, and a tower crane whose jib slews slowly while the hook
 * swings on its cable. Slabs and hoarding collide.
 */
export function buildConstruction(b: Builder, lighting: Lighting, rand: () => number): THREE.Group {
  const g = new THREE.Group(), net: THREE.BufferGeometry[] = [], ply: THREE.BufferGeometry[] = [], boards: THREE.BufferGeometry[] = [];
  const yellow = lighting.setup(new THREE.MeshStandardMaterial({ color: '#e0b21c', roughness: 0.6, metalness: 0.3 }), 'crane-yellow');
  const sites = constructionSites.splice(0);
  if (shotMode) Object.assign(window, { __sites: sites });
  for (const site of sites) {
    const { x, w, zFace, d, s, floors } = site, cx = x + w / 2, cz = zFace - s * d / 2, done = floors - 1;
    for (let f = 0; f <= done; f++) b.box('concrete', [w, 0.24, d], new THREE.Vector3(cx, f * FLOOR + 0.12, cz), Q, true);
    for (let i = 0; i <= Math.round(w / 6); i++) for (let j = 0; j <= Math.round(d / 6); j++) {
      const px = x + 0.3 + (i * (w - 0.6)) / Math.round(w / 6), pz = cz - d / 2 + 0.3 + (j * (d - 0.6)) / Math.round(d / 6);
      b.box('concrete', [0.45, done * FLOOR, 0.45], new THREE.Vector3(px, (done * FLOOR) / 2, pz), Q, true);
      for (const o of [-0.12, 0.12]) b.box('bars', [0.025, 1.4, 0.025], new THREE.Vector3(px + o, done * FLOOR + 0.7, pz + o), Q, false);
    }
    const netTop = Math.max(2, Math.floor(done * 0.75)) * FLOOR;
    for (const [px, pz, len, yaw] of [[cx, zFace + s * 0.4, w, 0], [cx, cz - s * (d / 2 + 0.4), w, 0], [x - 0.4, cz, d, Math.PI / 2], [x + w + 0.4, cz, d, Math.PI / 2]] as const)
      net.push(new THREE.PlaneGeometry(len, netTop, Math.ceil(len / 2), Math.ceil(netTop / 2)).translate(0, netTop / 2 + FLOOR, 0).rotateY(yaw).translate(px, 0, pz));
    const fz = zFace + s * 1.2;
    for (let px = x; px < x + w - 0.1; px += 2.4) if (Math.abs(px - cx) > 3) ply.push(new THREE.BoxGeometry(2.38, 2.4, 0.05).translate(px + 1.2, 1.2, fz));
    b.box('none', [w, 2.4, 0.1], new THREE.Vector3(cx, 1.2, fz), Q, true);
    boards.push(new THREE.PlaneGeometry(6, 1.5).rotateY(s > 0 ? 0 : Math.PI).translate(cx - w * 0.3, 1.45, fz + s * 0.04));
    const top = done * FLOOR + 14, base = new THREE.Vector3(x + w - 3, 0, cz), mast: THREE.BufferGeometry[] = [];
    lattice(top, 1.6, 2, mast, new THREE.Matrix4().makeTranslation(base.x, 0, base.z));
    g.add(Object.assign(new THREE.Mesh(mergeGeometries(mast)!, yellow), { castShadow: true }));
    const jib = new THREE.Group(), parts: THREE.BufferGeometry[] = [], arm = 28 + rand() * 10;
    lattice(arm, 1.2, 2, parts, new THREE.Matrix4().makeRotationZ(-Math.PI / 2).setPosition(0, 0.6, 0));
    lattice(10, 1.2, 2, parts, new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0, 0.6, 0));
    parts.push(new THREE.BoxGeometry(2.2, 1.6, 1.6).translate(-9, 0.2, 0), new THREE.BoxGeometry(1.4, 1.6, 1.6).translate(1.4, -0.6, 1.2), new THREE.BoxGeometry(0.15, 5, 0.15).translate(0, 3.1, 0));
    jib.add(Object.assign(new THREE.Mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!, yellow), { castShadow: true }));
    const trolley = arm * (0.4 + rand() * 0.45), hookLen = 6 + rand() * (top - 10), hook = new THREE.Group();
    hook.position.set(trolley, 0, 0);
    hook.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, hookLen, 4).translate(0, -hookLen / 2, 0), new THREE.MeshStandardMaterial({ color: '#222222' })));
    hook.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3).translate(0, -hookLen - 0.35, 0), yellow));
    jib.add(hook);
    jib.position.set(base.x, top, base.z);
    g.add(jib);
    const speed = (rand() < 0.5 ? -1 : 1) * (0.03 + rand() * 0.04), phase = rand() * 6;
    jib.rotation.y = phase;
    jib.children[0].onBeforeRender = () => {
      const t = performance.now() / 1000;
      jib.rotation.y = phase + Math.sin(t * speed * 2) * 1.6;
      hook.rotation.set(Math.sin(t * 0.9 + phase) * 0.025, 0, Math.sin(t * 0.7) * 0.03);
    };
  }
  if (net.length) {
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#22407a', roughness: 0.95, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }), 'site-net', (sh) => {
      sh.uniforms.uWind = WIND;
      sh.vertexShader = `uniform float uWind;\n${sh.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
  float bill = sin(uWind * 1.3 + position.y * 0.45 + position.x * 0.31 + position.z * 0.27) * 0.5 + sin(uWind * 2.1 + position.x * 0.9) * 0.25;
  transformed += normal * bill * 0.22 * smoothstep(0.0, 6.0, position.y);`);
    });
    g.add(Object.assign(new THREE.Mesh(mergeGeometries(net)!, mat), { receiveShadow: true }));
    const wood = lighting.setup(new THREE.MeshStandardMaterial({ color: '#2b5aa0', roughness: 0.85 }), 'site-hoarding');
    g.add(Object.assign(new THREE.Mesh(mergeGeometries(ply)!, wood), { castShadow: true, receiveShadow: true }));
    g.add(new THREE.Mesh(mergeGeometries(boards)!, lighting.setup(new THREE.MeshStandardMaterial({ map: sign(), roughness: 0.7 }), 'site-board')));
  }
  return g;
}
