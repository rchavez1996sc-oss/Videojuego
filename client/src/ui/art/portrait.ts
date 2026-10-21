import * as THREE from 'three';
import type { Cast } from './stage';
import type { Shot } from './scenes';

const KEY = new THREE.Color('#00ff00');

/** Dark aviator glasses and a heavy moustache on a head bone (centimetres). */
function dictator(cast: Cast, head: THREE.Bone): void {
  const ink = cast.ink;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 10.2, 5.5, 28).scale(1, 1, 1.18), ink);
  crown.position.set(0, 17.2, 0.6);
  crown.rotation.x = 0.1;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(10.4, 10.4, 3, 28).scale(1, 1, 1.12), ink);
  band.position.set(0, 14.4, 0.8);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.7, 20, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.7), ink);
  visor.position.set(0, 13.2, 10.2);
  visor.rotation.x = 0.4;
  const badge = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8).scale(1, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: '#d8b04a', metalness: 0.8, roughness: 0.3 }));
  badge.position.set(0, 17, 12.4);
  head.add(crown, band, visor, badge);
  let neck = head.parent;
  while (neck && !neck.name.endsWith('Neck')) neck = neck.parent;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 9, 7, 20, 1, true), ink);
  collar.position.y = 2;
  neck?.add(collar);
  const spine = neck?.parent;
  if (spine) {
    const gold = new THREE.MeshStandardMaterial({ color: '#c9a23a', metalness: 0.7, roughness: 0.35 });
    for (const x of [-17, 17]) {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(11, 2.2, 8), gold);
      ep.position.set(x, 14, -1);
      spine.add(ep);
      for (let k = 0; k < 6; k++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 4), gold);
        f.position.set(x + (x > 0 ? 5.5 : -5.5), 11.5, -3.5 + k * 1.4);
        spine.add(f);
      }
    }
    ['#a3161b', '#d8b04a', '#1f3a6b', '#a3161b', '#2a5a2a', '#d8b04a'].forEach((col, k) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.6), new THREE.MeshStandardMaterial({ color: col }));
      r.position.set(-9 + (k % 3) * 3.4, 6 - Math.floor(k / 3) * 1.5, 13);
      spine.add(r);
    });
  }
  const lens = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.08, metalness: 0.9 });
  for (const x of [-3.4, 3.4]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 10).scale(1.15, 0.9, 0.35), lens);
    l.position.set(x, 9.6, 11.2);
    head.add(l);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.3), lens);
  bridge.position.set(0, 10.2, 11.6);
  const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 4.6, 4, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0d0a08', roughness: 1 }));
  stache.position.set(0, 3.6, 11.4);
  head.add(bridge, stache);
}

/** The general's face from below under a hard key light, keyed on green for the sketch pass. */
export function generalPortrait(cast: Cast): Shot {
  const s = new THREE.Scene();
  s.background = KEY;
  s.add(new THREE.HemisphereLight('#bbbbbb', '#222222', 0.35));
  const key = new THREE.SpotLight('#ffffff', 60, 0, 0.5, 0.4, 1.5);
  key.position.set(-0.9, 0.9, 1.4);
  key.target.position.set(0, 1.62, 0);
  const rim = new THREE.DirectionalLight('#ffffff', 2.5);
  rim.position.set(1.5, 2.5, -1.5);
  s.add(key, key.target, rim);
  s.add(cast.actor('fls', 'idle', 0.3, new THREE.Vector3(0, 0, 0), 0.12, (h) => dictator(cast, h), false, null, true));
  const camera = new THREE.PerspectiveCamera(22, 16 / 9, 0.05, 50);
  camera.position.set(0.22, 1.36, 1.05);
  camera.lookAt(0.02, 1.58, 0);
  return { scene: s, camera, grade: '', sketch: true };
}

/** Ink drawing from a render: Sobel outlines, hatching by tone, aged paper and a red wash behind the figure. */
export function sketch(c: CanvasRenderingContext2D, w: number, h: number): void {
  const src = c.getImageData(0, 0, w, h), d = src.data, out = c.createImageData(w, h), o = out.data;
  const lum = new Float32Array(w * h), bg = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    bg[p] = g > 0.6 && r < 0.45 && b < 0.45 ? 1 : 0;
    lum[p] = Math.min(1, Math.max(0, (0.3 * r + 0.59 * g + 0.11 * b - 0.08) * 1.45));
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, i = p * 4;
    const grain = (Math.random() - 0.5) * 18;
    const paper = [233 + grain, 222 + grain, 199 + grain];
    let ink = 0;
    if (bg[p]) {
      const t = 0.55 + 0.45 * Math.hypot((x - w * 0.62) / w, (y - h * 0.4) / h) * 2;
      const hatch = (x + y * 2) % 9 < 2 && Math.random() < 0.85;
      const red = [150 - t * 60, 22, 26];
      const k = hatch ? 0.55 : 0;
      o.set([red[0] * (1 - k) + 20 * k, red[1], red[2], 255], i);
      continue;
    }
    const l = lum[p];
    const at = (dx: number, dy: number) => lum[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))];
    const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
    const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
    const edge = Math.hypot(gx, gy);
    const h1 = (x + y) % 6 < 2, h2 = (x - y + 9000) % 6 < 2, h3 = (x + 2 * y) % 4 < 2;
    if (l < 0.12) ink = 1;
    else if (l < 0.28) ink = h1 || h2 || h3 ? 1 : 0;
    else if (l < 0.45) ink = h1 || h2 ? 1 : 0;
    else if (l < 0.62) ink = h1 ? 0.85 : 0;
    if (edge > 0.32) ink = 1;
    else if (edge > 0.18) ink = Math.max(ink, 0.6);
    if (ink && Math.random() < 0.08) ink *= 0.5;
    o.set([paper[0] * (1 - ink) + 18 * ink, paper[1] * (1 - ink) + 14 * ink, paper[2] * (1 - ink) + 12 * ink, 255], i);
  }
  c.putImageData(out, 0, 0);
  const v = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,6,4,0.75)');
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
}
