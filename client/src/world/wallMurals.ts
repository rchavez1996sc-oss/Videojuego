import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

/** A blank side wall offered to the street-art murals: centre at the foot, facing, room across and up. */
interface Wall { foot: THREE.Vector3; quat: THREE.Quaternion; w: number; h: number }
const walls: Wall[] = [];

/** Offers a blank wall (bottom centre `foot`, facing `quat`, at most `w` × `h` m) for a photographed mural. */
export function muralWall(foot: THREE.Vector3, quat: THREE.Quaternion, w: number, h: number): void {
  walls.push({ foot: foot.clone(), quat: quat.clone(), w, h });
}

/**
 * Real Lima street art (Release scans flattened to transparent pictures, `manifest.murals` {key: {img, aspect}})
 * painted onto the offered walls, each mural as large as its wall allows keeping its proportions (at least 2.2 m
 * tall), cycling through the murals; one merged mesh per mural. Loads after the level, like the other photo props.
 */
export async function placeMurals(scene: THREE.Object3D, lighting: Lighting): Promise<void> {
  if (!walls.length) return;
  const base = `${import.meta.env.BASE_URL}assets/`;
  const manifest = await fetch(`${base}manifest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  const murals = Object.entries((manifest?.murals ?? {}) as Record<string, { img: string; aspect: number }>);
  if (!murals.length) return;
  const quads = new Map<string, number[][]>(murals.map(([k]) => [k, []]));
  let turn = 0;
  for (const wall of walls) {
    for (let t = 0; t < murals.length; t++) {
      const [key, m] = murals[(turn + t) % murals.length], w = Math.min(wall.w, wall.h * m.aspect), h = w / m.aspect;
      if (h < 2.2) continue;
      quads.get(key)!.push([wall.foot.x, wall.foot.y, wall.foot.z, ...wall.quat.toArray(), w, h]);
      turn = (turn + t + 1) % murals.length;
      break;
    }
  }
  if (location.search.includes('shot')) (window as unknown as { __murals: unknown }).__murals = [...quads];
  const loader = new THREE.TextureLoader();
  for (const [key, m] of murals) {
    const list = quads.get(key)!;
    if (!list.length) continue;
    const tex = weathered((await loader.loadAsync(`${base}${m.img}?v=${manifest.version}`)).image as HTMLImageElement);
    const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
    for (const [x, y, z, qx, qy, qz, qw, w, h] of list) {
      const q = new THREE.Quaternion(qx, qy, qz, qw), n = new THREE.Vector3(0, 0, 1).applyQuaternion(q), o = pos.length / 3;
      for (const [sx, sy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
        const p = new THREE.Vector3((sx * w) / 2, sy * h, 0).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
        pos.push(p.x, p.y, p.z); uv.push((sx + 1) / 2, sy); nrm.push(n.x, n.y, n.z);
      }
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3 }), 'murals');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = `mural-${key}`;
    scene.add(mesh);
  }
  walls.length = 0;
}

/**
 * The photo made to sit in the wall instead of on it: ragged edges feathered into the plaster, colours pulled
 * toward the dusty Lima palette (less saturation and contrast, a warm grey cast like the walls around it), and the
 * same grime the walls get — sun fade at the top, damp and splashes at the foot, flakes where the paint came off.
 */
function weathered(img: HTMLImageElement): THREE.CanvasTexture {
  const w = img.width, h = img.height, cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = cv.getContext('2d')!;
  const mask = Object.assign(document.createElement('canvas'), { width: w, height: h }), mg = mask.getContext('2d')!;
  mg.filter = `blur(${Math.round(w / 70)}px)`;
  mg.drawImage(img, 0, 0);
  g.filter = 'saturate(0.72) contrast(0.86) brightness(0.93) sepia(0.12)';
  g.drawImage(img, 0, 0);
  g.filter = 'none';
  let seed = w * 7 + h;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const fade = g.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(222,214,198,0.22)'); fade.addColorStop(0.55, 'rgba(222,214,198,0.04)'); fade.addColorStop(0.8, 'rgba(70,58,44,0.06)'); fade.addColorStop(1, 'rgba(60,48,36,0.35)');
  g.fillStyle = fade; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * w * 0.012;
    g.fillStyle = rnd() < 0.6 ? `rgba(214,206,190,${0.35 + rnd() * 0.5})` : `rgba(60,50,40,${0.1 + rnd() * 0.25})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.4 + rnd()), rnd() * 3, 0, 6.28); g.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w, y0 = rnd() * h * 0.6, len = h * (0.1 + rnd() * 0.35);
    const drip = g.createLinearGradient(0, y0, 0, y0 + len);
    drip.addColorStop(0, 'rgba(80,66,50,0.16)'); drip.addColorStop(1, 'rgba(80,66,50,0)');
    g.fillStyle = drip; g.fillRect(x, y0, 1 + rnd() * 4, len);
  }
  const data = g.getImageData(0, 0, w, h), a = mg.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.data.length; i += 4) data.data[i] = Math.min(data.data[i], Math.max(0, (a[i] - 40) * 1.4)) * 0.92;
  g.putImageData(data, 0, 0);
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
}
