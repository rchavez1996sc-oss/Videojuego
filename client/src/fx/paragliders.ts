import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import type { Lighting } from '../render/lighting';

const COLORS = ['#f2f2ee', '#e8462c', '#2d6fd1', '#f2c230', '#e2e2dc', '#13a37a'];

/** Paragliders soaring the cliff lift: long figure-eights above the clifftop, wings banking into the turns. */
export function paragliders(count: number, edge: number, lighting: Lighting): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(61);
  const wingGeo = new THREE.TorusGeometry(4.6, 0.32, 4, 20, Math.PI * 0.8).rotateZ(Math.PI * 0.1).scale(1, 0.42, 3.4);
  const pilotMat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.8 }), 'pg-pilot');
  const lineMat = new THREE.LineBasicMaterial({ color: '#d8d8d8', transparent: true, opacity: 0.5 });
  const fliers: { obj: THREE.Group; x: number; span: number; z: number; y: number; speed: number; phase: number }[] = [];
  for (let i = 0; i < count; i++) {
    const obj = new THREE.Group();
    const wing = new THREE.Mesh(wingGeo, lighting.setup(new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], roughness: 0.6, side: THREE.DoubleSide }), `pg-wing${i % COLORS.length}`));
    wing.position.y = 1.2;
    const pilot = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 3, 6).rotateX(1.1), pilotMat);
    pilot.position.y = -5.2;
    const pts = [-4, -2, 2, 4].flatMap((x) => [new THREE.Vector3(0, -4.9, 0), new THREE.Vector3(x, 1.3 + (Math.abs(x) < 3 ? 0.9 : 0), 0)]);
    obj.add(wing, pilot, new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    obj.traverse((o) => (o.castShadow = o instanceof THREE.Mesh));
    g.add(obj);
    fliers.push({ obj, x: (r() - 0.5) * 300, span: 60 + r() * 90, z: edge + 8 + r() * 25, y: 22 + r() * 30, speed: 0.04 + r() * 0.03, phase: r() * 6.28 });
  }
  const anchor = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  anchor.frustumCulled = false;
  anchor.onBeforeRender = () => {
    const t = performance.now() / 1000;
    for (const f of fliers) {
      const a = t * f.speed + f.phase;
      const x = f.x + Math.sin(a) * f.span, z = f.z + Math.sin(a * 2) * 9, y = f.y + Math.sin(a * 0.7) * 6;
      const vx = Math.cos(a) * f.span, vz = Math.cos(a * 2) * 18;
      f.obj.position.set(x, y, z);
      f.obj.rotation.set(0, Math.atan2(vx, vz), 0);
      f.obj.rotateZ(-Math.sin(a * 2) * 0.25 * Math.sign(vx));
    }
  };
  g.add(anchor);
  return g;
}
