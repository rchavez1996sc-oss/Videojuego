import * as THREE from 'three';
import { puffTexture } from './stage';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const dark = (c = '#141311', rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.15 });

function profile(points: [number, number][], depth: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}

/** Block of flats along x with randomly lit windows facing +z. */
export function block(x: number, z: number, w: number, h: number, d: number, lit: number, mat = dark('#1b1917')): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  b.position.set(x, h / 2, z);
  g.add(b);
  const win = new THREE.PlaneGeometry(0.7, 0.9);
  for (let y = 2; y < h - 1; y += 2.8) for (let wx = -w / 2 + 1.2; wx < w / 2 - 1; wx += 2.2) {
    if (Math.random() > lit) continue;
    const m = new THREE.Mesh(win, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.08 + rnd(0, 0.04), 0.75, rnd(0.25, 0.45)).multiplyScalar(rnd(0.8, 1.6)) }));
    m.position.set(x + wx, y, z + d / 2 + 0.02);
    g.add(m);
  }
  return g;
}

/** Main battle tank, barrel along +x. */
export function tank(mat = dark('#191816', 0.7)): THREE.Group {
  const g = new THREE.Group();
  const hull = profile([[-4.6, 0.45], [4.3, 0.45], [4.9, 1.3], [4.4, 1.75], [-4.4, 1.75], [-4.8, 1.2]], 3.5, mat);
  const turret = profile([[-2.2, 1.75], [1.8, 1.75], [2.6, 2.3], [1.5, 2.75], [-2.0, 2.75], [-2.6, 2.3]], 2.9, mat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 5.4, 12).rotateZ(Math.PI / 2), mat);
  barrel.position.set(4.9, 2.3, 0);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 12).rotateZ(Math.PI / 2), mat);
  brake.position.set(7.5, 2.3, 0);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.3, 14), mat);
  hatch.position.set(-0.6, 2.9, 0.6);
  const mg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6).rotateZ(Math.PI / 2), mat);
  mg.position.set(0.1, 3.15, 0.6);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.2, 4), mat);
  ant.position.set(-1.8, 4.2, -1.0);
  ant.rotation.z = 0.25;
  g.add(hull, turret, barrel, brake, hatch, mg, ant);
  for (const s of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.9, 0.7), mat);
    track.position.set(0, 0.5, s * 1.75);
    g.add(track);
    for (let i = 0; i < 7; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 16).rotateX(Math.PI / 2), dark('#232120'));
      w.position.set(-3.6 + i * 1.2, 0.45, s * 2.13);
      g.add(w);
    }
  }
  g.traverse((o) => (o.castShadow = o.receiveShadow = true));
  return g;
}

/** Army truck with a canvas cover, cab towards -x, tailgate at +x. */
export function truck(mat = dark('#1a1917', 0.8)): THREE.Group {
  const g = new THREE.Group();
  const cab = profile([[-4.2, 0.9], [-2.2, 0.9], [-2.2, 3.0], [-3.2, 3.0], [-3.9, 2.0], [-4.3, 1.9]], 2.4, mat);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 2.5), mat);
  bed.position.set(0.6, 1.2, 0);
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 5.4, 18).rotateZ(Math.PI / 2), dark('#262420', 1));
  cover.position.set(0.6, 2.35, 0);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 2.5), dark('#262420', 1));
  walls.position.set(0.6, 1.9, 0);
  g.add(cab, bed, cover, walls);
  for (const x of [-3.2, 1.2, 2.6]) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 18).rotateX(Math.PI / 2), dark('#0f0e0d'));
    w.position.set(x, 0.55, s * 1.1);
    g.add(w);
  }
  g.traverse((o) => (o.castShadow = o.receiveShadow = true));
  return g;
}

/** Waving flag on a pole; cloth spans +x from the pole top. */
export function flag(color: string, w = 3, h = 1.9, pole = 7): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h, 24, 8);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2;
    p.setZ(i, Math.sin(x * 2.1 + p.getY(i) * 0.6) * 0.18 * (x / w));
    p.setY(i, p.getY(i) - x * 0.08);
  }
  geo.translate(w / 2, pole - h / 2, 0);
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.12 }));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, pole, 8), dark());
  stick.position.y = pole / 2;
  g.add(cloth, stick);
  return g;
}

/** Visible light shaft from `from` towards `to` (additive cone that fades with distance). */
export function beam(from: THREE.Vector3, to: THREE.Vector3, radius: number, color: string, strength = 0.12): THREE.Mesh {
  const len = from.distanceTo(to);
  const cv = document.createElement('canvas');
  cv.width = 2;
  cv.height = 128;
  const c = cv.getContext('2d')!, gr = c.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, 2, 128);
  const geo = new THREE.ConeGeometry(radius, len, 32, 1, true).translate(0, -len / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, alphaMap: new THREE.CanvasTexture(cv), transparent: true, opacity: strength, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
  return m;
}

/** Drifting smoke: big soft sprites around `at`. */
export function smoke(at: THREE.Vector3, spread: number, n: number, color: string, opacity: number, size: [number, number]): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, opacity: opacity * rnd(0.5, 1), depthWrite: false }));
    s.position.set(at.x + rnd(-spread, spread), at.y + rnd(0, spread * 0.5), at.z + rnd(-spread, spread));
    s.scale.setScalar(rnd(...size));
    g.add(s);
  }
  return g;
}

/** Floating ash, embers (additive) or rain streaks inside a box. */
export function motes(center: THREE.Vector3, size: THREE.Vector3, n: number, color: string, px: number, additive = true): THREE.Points {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([center.x + rnd(-0.5, 0.5) * size.x, center.y + rnd(-0.5, 0.5) * size.y, center.z + rnd(-0.5, 0.5) * size.z], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size: px, map: puffTexture(), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true }));
}

export function rain(center: THREE.Vector3, size: THREE.Vector3, n: number): THREE.LineSegments {
  const pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const x = center.x + rnd(-0.5, 0.5) * size.x, y = center.y + rnd(-0.5, 0.5) * size.y, z = center.z + rnd(-0.5, 0.5) * size.z;
    pos.set([x, y, z, x - 0.05, y - 0.7, z], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#9aa6b0', transparent: true, opacity: 0.35 }));
}

export function ground(color: string, rough = 0.6): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.2 }));
  m.receiveShadow = true;
  return m;
}
