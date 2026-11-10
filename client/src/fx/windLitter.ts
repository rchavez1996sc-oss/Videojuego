import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lighting } from '../render/lighting';

interface Piece { p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; bag: boolean; air: number }

const BAG_COLORS = ['#f2f1ec', '#1c1c1e', '#2f5aa8', '#d8d4c4', '#c43b2f', '#e9e6d8'];
const PAPER_COLORS = ['#ece7da', '#d9cfb8', '#f4f2ec', '#c9b48a'];

/** A loose plastic bag (a crumpled, puffed sack with two handles) — vertex coloured. */
function bagGeo(color: string): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.16, 2);
  const p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 31 + v.y * 17) * 0.025 + Math.sin(v.z * 23 - v.y * 29) * 0.02;
    v.multiplyScalar(1 + n / 0.16).multiply(new THREE.Vector3(1, 0.55, 0.8));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const handles = [-0.05, 0.05].map((x) => new THREE.TorusGeometry(0.045, 0.008, 4, 10, Math.PI).translate(x, 0.08, 0));
  const out = mergeGeometries([g.toNonIndexed(), ...handles.map((h) => h.toNonIndexed())])!;
  out.deleteAttribute('uv');
  const c = new THREE.Color(color);
  out.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: out.attributes.position.count * 3 }, (_, i) => c.toArray()[i % 3]), 3));
  out.computeVertexNormals();
  return out;
}

/** A sheet of paper or newspaper, gently curled. */
function paperGeo(color: string): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.28, 0.21, 4, 3).rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 9) * 0.02 + p.getZ(i) * p.getZ(i) * 0.4);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: p.count * 3 }, (_, i) => c.toArray()[i % 3]), 3));
  g.computeVertexNormals();
  return g;
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);

/**
 * Plastic bags and paper blown along the street around the camera: a slow wind that swells into gusts lifts them,
 * tumbles them and drops them to skid along the ground; pieces that drift too far are put back upwind out of
 * sight. One instanced mesh per look (6 bag colours, 4 papers).
 */
export class WindLitter {
  readonly group = new THREE.Group();
  private kinds: { mesh: THREE.InstancedMesh; pieces: Piece[] }[] = [];
  private t = Math.random() * 100;

  constructor(lighting: Lighting, count: number, private ground: (x: number, z: number) => number, private heading = Math.random() * Math.PI * 2) {
    const mat = lighting.setup(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), 'wind-litter');
    const looks = [...BAG_COLORS.map((c) => [bagGeo(c), true] as const), ...PAPER_COLORS.map((c) => [paperGeo(c), false] as const)];
    looks.forEach(([geo, bag]) => {
      const n = Math.max(1, Math.round(count / looks.length));
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.kinds.push({ mesh, pieces: Array.from({ length: n }, () => ({ p: new THREE.Vector3(0, -999, 0), v: new THREE.Vector3(), rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), spin: new THREE.Vector3(), bag, air: 0 })) });
      this.group.add(mesh);
    });
  }

  /** Positions of the pieces (debug). */
  get spots(): THREE.Vector3[] {
    return this.kinds.flatMap((k) => k.pieces.map((p) => p.p));
  }

  /** Wind velocity now (m/s, horizontal) and how gusty it is (0–1). */
  private wind(): [THREE.Vector3, number] {
    const g = Math.max(0, Math.sin(this.t * 0.23) * 0.6 + Math.sin(this.t * 0.61 + 1.3) * 0.4);
    const dir = this.heading + Math.sin(this.t * 0.05) * 0.5;
    return [new THREE.Vector3(Math.sin(dir), 0, Math.cos(dir)).multiplyScalar(1.2 + g * 5.5), g];
  }

  update(dt: number, camera: THREE.Vector3): void {
    this.t += dt;
    const [w, gust] = this.wind(), wd = w.clone().normalize();
    for (const { mesh, pieces } of this.kinds) {
      pieces.forEach((pc, i) => {
        const far = pc.p.y < -100 || Math.hypot(pc.p.x - camera.x, pc.p.z - camera.z) > 48;
        if (far) {
          const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 34;
          pc.p.set(camera.x - wd.x * r * 0.6 + Math.cos(a) * r * 0.8, 0, camera.z - wd.z * r * 0.6 + Math.sin(a) * r * 0.8);
          pc.p.y = this.ground(pc.p.x, pc.p.z) + 0.03;
          pc.v.set(0, 0, 0);
        }
        const floor = this.ground(pc.p.x, pc.p.z) + (pc.bag ? 0.06 : 0.01);
        const onGround = pc.p.y <= floor + 0.02;
        const drag = pc.bag ? 1.6 : 2.4;
        pc.v.x += (w.x - pc.v.x) * Math.min(1, dt * (onGround ? drag * 0.35 : drag));
        pc.v.z += (w.z - pc.v.z) * Math.min(1, dt * (onGround ? drag * 0.35 : drag));
        const lift = gust > 0.55 && Math.random() < dt * (pc.bag ? 2.5 : 1.2) ? 1.5 + gust * (pc.bag ? 3.5 : 2) : 0;
        pc.v.y += lift - (pc.bag ? 2.2 : 3.5) * dt + (pc.bag && !onGround ? Math.sin(this.t * 3 + i) * 1.2 * dt : 0);
        pc.p.addScaledVector(pc.v, dt);
        if (pc.p.y < floor) [pc.p.y = floor, pc.v.y = 0, pc.v.x *= 1 - Math.min(1, dt * 3), pc.v.z *= 1 - Math.min(1, dt * 3)];
        const speed = Math.hypot(pc.v.x, pc.v.z), airborne = pc.p.y > floor + 0.05;
        pc.spin.set(airborne ? 3 : speed * 2.5, airborne ? 2 : 0.3, airborne ? 2.5 : 0).multiplyScalar(pc.bag ? 1 : 1.6);
        pc.rot.x += pc.spin.x * dt * (airborne || pc.bag ? 1 : 0.2);
        pc.rot.y += pc.spin.y * dt;
        pc.rot.z += pc.spin.z * dt;
        if (!airborne && !pc.bag) [pc.rot.x = 0, pc.rot.z = 0];
        mesh.setMatrixAt(i, M.compose(pc.p, Q.setFromEuler(pc.rot), ONE));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
