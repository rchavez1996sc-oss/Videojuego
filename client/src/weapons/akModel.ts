import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import { wood } from '../render/textures';

/** Side-profile shape (x = forward, y = up) extruded `width` across. */
function profile(points: [number, number][], width: number, curves: Record<number, [number, number]> = {}): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) {
    const c = curves[i];
    if (c) s.quadraticCurveTo(c[0], c[1], ...points[i]);
    else s.lineTo(...points[i]);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

export function buildAK(lighting: Lighting): { group: THREE.Group; muzzle: THREE.Object3D; ejector: THREE.Object3D } {
  const wd = wood();
  const metal = lighting.setup(new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 0.42, metalness: 0.85 }), 'ak-metal');
  const worn = lighting.setup(new THREE.MeshStandardMaterial({ color: '#3a3936', roughness: 0.55, metalness: 0.7 }), 'ak-worn');
  const timber = lighting.setup(new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, color: '#b0623a', roughness: 0.45 }), 'ak-wood');
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const cyl = (r: number, len: number, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);

  add(new THREE.BoxGeometry(0.048, 0.07, 0.34), metal, 0, 0, 0.02);
  add(new THREE.CylinderGeometry(0.024, 0.024, 0.3, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), worn, 0, 0.035, 0.0);
  add(new THREE.BoxGeometry(0.012, 0.012, 0.06), worn, 0.03, 0.02, 0.1);
  add(cyl(0.011, 0.44), metal, 0, 0.012, 0.4);
  add(cyl(0.013, 0.26), worn, 0, 0.045, 0.3);
  add(new THREE.BoxGeometry(0.03, 0.05, 0.035), metal, 0, 0.03, 0.6);
  add(new THREE.BoxGeometry(0.006, 0.045, 0.006), metal, 0, 0.065, 0.6);
  add(cyl(0.017, 0.055), metal, 0, 0.012, 0.645);
  add(new THREE.BoxGeometry(0.03, 0.02, 0.05), metal, 0, 0.045, 0.17);
  add(profile([[0.13, -0.035], [0.35, -0.035], [0.35, 0.03], [0.13, 0.03]], 0.058), timber, 0, 0, 0).position.set(0, 0, 0);
  add(profile([[0.18, 0.03], [0.36, 0.03], [0.36, 0.062], [0.18, 0.062]], 0.04), timber, 0, 0, 0);
  add(profile([[-0.035, 0], [0.035, 0], [0.11, -0.2], [0.05, -0.215], [-0.035, 0]], 0.028, { 2: [0.06, -0.1], 4: [-0.005, -0.11] }), worn, 0, -0.035, 0.06);
  add(profile([[0, 0], [0.04, 0], [0.01, -0.11], [-0.035, -0.11]], 0.032), timber, 0, -0.03, -0.07);
  add(new THREE.TorusGeometry(0.03, 0.004, 6, 12, Math.PI).rotateY(Math.PI / 2), metal, 0, -0.04, 0.0, Math.PI);
  add(profile([[-0.15, 0.03], [-0.15, -0.035], [-0.56, -0.09], [-0.57, -0.02], [-0.56, 0.035]], 0.045, { 2: [-0.35, -0.04] }), timber, 0, 0, 0);
  add(new THREE.BoxGeometry(0.05, 0.13, 0.012), metal, 0, -0.025, -0.565);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.012, 0.68);
  g.add(muzzle);
  const ejector = new THREE.Object3D();
  ejector.position.set(0.03, 0.03, 0.05);
  g.add(ejector);
  return { group: g, muzzle, ejector };
}
