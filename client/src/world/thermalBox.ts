import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Lighting } from '../render/lighting';

/** Delivery apps seen on Lima's streets: name, box colour, lettering colour, drawn mark. */
const APPS: { name: string; bg: string; ink: string; mark: 'smile' | 'pin' | 'bolt' }[] = [
  { name: 'rappi', bg: '#ff4f1f', ink: '#ffffff', mark: 'smile' },
  { name: 'PedidosYa', bg: '#e8173e', ink: '#ffffff', mark: 'pin' },
  { name: 'DiDi Food', bg: '#fc6c13', ink: '#ffffff', mark: 'bolt' },
];

/** Side panel: app colour, logo and mark, reflective band, zip line, scuffs and road grime toward the bottom. */
function panel(app: (typeof APPS)[number], seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = app.bg;
  g.fillRect(0, 0, 512, 512);
  const shade = g.createLinearGradient(0, 0, 0, 512);
  shade.addColorStop(0, 'rgba(255,255,255,0.08)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#1b1b1d';
  g.fillRect(0, 92, 512, 10);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = 0; x < 512; x += 8) g.fillRect(x, 95, 4, 4);
  g.fillStyle = '#c9cdd1';
  g.fillRect(0, 430, 512, 26);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let x = 0; x < 512; x += 14) g.fillRect(x, 434, 7, 18);
  g.fillStyle = app.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${app.name.length > 6 ? 76 : 120}px "Barlow Condensed", Arial, sans-serif`;
  g.fillText(app.name, 256, 300);
  g.lineWidth = 12;
  g.strokeStyle = app.ink;
  if (app.mark === 'smile') {
    g.beginPath();
    g.arc(256, 196, 52, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  } else if (app.mark === 'pin') {
    g.beginPath();
    g.arc(256, 180, 34, Math.PI, 0);
    g.lineTo(256, 236);
    g.closePath();
    g.fill();
    g.fillStyle = app.bg;
    g.beginPath();
    g.arc(256, 180, 13, 0, 7);
    g.fill();
  } else {
    g.beginPath();
    g.moveTo(270, 140); g.lineTo(226, 206); g.lineTo(258, 206); g.lineTo(240, 250); g.lineTo(290, 182); g.lineTo(258, 182);
    g.closePath();
    g.fill();
  }
  for (let k = 0; k < 40; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,30,25'},${0.05 + r() * 0.12})`;
    g.fillRect(r() * 512, r() * 512, 2 + r() * 40, 1 + r() * 3);
  }
  const grime = g.createLinearGradient(0, 330, 0, 512);
  grime.addColorStop(0, 'rgba(70,58,45,0)');
  grime.addColorStop(1, 'rgba(70,58,45,0.45)');
  g.fillStyle = grime;
  g.fillRect(0, 330, 512, 182);
  return c;
}

const looks = new Map<number, { body: THREE.Material; lid: THREE.Material; dark: THREE.Material; metal: THREE.Material }>();
let geo: Record<'body' | 'lid' | 'strap' | 'rack', THREE.BufferGeometry> | null = null;

function geometries() {
  const t = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);
  const tube = (len: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z') => {
    const g = new THREE.CylinderGeometry(0.012, 0.012, len, 6);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return t(g, x, y, z);
  };
  return {
    body: new RoundedBoxGeometry(0.5, 0.4, 0.46, 3, 0.04),
    lid: t(new RoundedBoxGeometry(0.53, 0.06, 0.49, 2, 0.025), 0, 0.22, 0),
    strap: mergeGeometries([-0.13, 0.13].map((x) => t(new THREE.BoxGeometry(0.035, 0.405, 0.475), x, -0.005, 0))),
    rack: mergeGeometries([
      ...[-0.2, 0.2].map((x) => tube(0.5, x, -0.215, 0, 'z')),
      ...[-0.2, 0.2].map((z) => tube(0.42, 0, -0.215, z, 'x')),
      ...[-0.2, 0.2].map((x) => tube(0.28, x, -0.33, 0.12, 'y')),
    ]),
  };
}

/** A courier's thermal box on its rack, as one small group (shared geometry and per-app materials). Origin at the box centre. */
export function thermalBoxMesh(lighting: Lighting, i: number): THREE.Group {
  geo ??= geometries();
  const k = i % APPS.length;
  if (!looks.has(k)) {
    const tex = new THREE.CanvasTexture(panel(APPS[k], k + 3));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    looks.set(k, {
      body: lighting.setup(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 }), `thermal-${k}`),
      lid: lighting.setup(new THREE.MeshStandardMaterial({ color: new THREE.Color(APPS[k].bg).multiplyScalar(0.85), roughness: 0.55 }), `thermal-lid-${k}`),
      dark: lighting.setup(new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.8 }), 'thermal-strap'),
      metal: lighting.setup(new THREE.MeshStandardMaterial({ color: '#8d9196', roughness: 0.35, metalness: 0.8 }), 'thermal-rack'),
    });
  }
  const m = looks.get(k)!, g = new THREE.Group();
  g.add(new THREE.Mesh(geo.body, m.body), new THREE.Mesh(geo.lid, m.lid), new THREE.Mesh(geo.strap, m.dark), new THREE.Mesh(geo.rack, m.metal));
  g.traverse((o) => ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = (o as THREE.Mesh).receiveShadow = true)));
  return g;
}
