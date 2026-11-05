import * as THREE from 'three';
import type { Lighting } from '../render/lighting';

const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'];
const UP = new THREE.Vector3(0, 1, 0), ray = new THREE.Raycaster();
let mat: THREE.Material | null = null, geos: THREE.BufferGeometry[] = [];

/** 2×2 atlas of bullet wounds soaked into cloth/skin: dark hole, ragged wet stain, runs downward (texture −v = down). */
function woundTexture(): THREE.CanvasTexture {
  const S = 256, cv = Object.assign(document.createElement('canvas'), { width: S * 2, height: S * 2 }), g = cv.getContext('2d')!;
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * S, oy = Math.floor(k / 2) * S, cx = ox + S / 2, cy = oy + S * 0.42;
    g.save(); g.beginPath(); g.rect(ox, oy, S, S); g.clip();
    for (let i = 0; i < 26; i++) {
      const a = r() * 6.28, d = r() * 34, rad = 10 + r() * 26;
      const gr = g.createRadialGradient(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0, cx + Math.cos(a) * d, cy + Math.sin(a) * d, rad);
      gr.addColorStop(0, 'rgba(70,6,6,0.85)'); gr.addColorStop(0.7, 'rgba(85,10,8,0.55)'); gr.addColorStop(1, 'rgba(85,10,8,0)');
      g.fillStyle = gr; g.fillRect(ox, oy, S, S);
    }
    for (let i = 0; i < 2 + k % 3; i++) {
      let x = cx + (r() - 0.5) * 40, y = cy + 10, w = 7 + r() * 6;
      g.fillStyle = 'rgba(78,8,7,0.8)';
      while (y < oy + S - 8 && w > 1.5) { g.beginPath(); g.ellipse(x, y, w / 2, 5, 0, 0, 6.28); g.fill(); y += 3; x += (r() - 0.5) * 1.5; w *= 0.985; }
      g.beginPath(); g.arc(x, y, w * 0.8, 0, 6.28); g.fill();
    }
    for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(60,4,4,0.8)'; g.beginPath(); g.arc(cx + (r() - 0.5) * 120, cy + (r() - 0.5) * 100, 1 + r() * 3, 0, 6.28); g.fill(); }
    const hole = g.createRadialGradient(cx, cy, 0, cx, cy, 13);
    hole.addColorStop(0, 'rgba(8,0,0,1)'); hole.addColorStop(0.55, 'rgba(30,2,2,1)'); hole.addColorStop(1, 'rgba(60,5,5,0)');
    g.fillStyle = hole; g.beginPath(); g.ellipse(cx, cy, 13, 11, r(), 0, 6.28); g.fill();
    g.restore();
  }
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 4 });
}

function setup(lighting: Lighting): void {
  mat = lighting.setup(new THREE.MeshStandardMaterial({ map: woundTexture(), alphaTest: 0.35, roughness: 0.28, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 'wound');
  geos = [0, 1, 2, 3].map((k) => {
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, -0.08, 0), uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((k % 2) + uv.getX(i)) / 2, 1 - (Math.floor(k / 2) + 1 - uv.getY(i)) / 2);
    return geo;
  });
}

/**
 * Blood wound decal on the actual body surface: a ray from just outside the hit towards the nearest bone finds the
 * skinned mesh (posed), the decal lies flat on that point facing out, its runs pointing down, and rides the bone.
 */
export function addWound(bones: Map<string, THREE.Bone>, meshes: THREE.SkinnedMesh[], at: THREE.Vector3, lighting: Lighting): void {
  let best: THREE.Bone | null = null, bestD = Infinity;
  const centre = new THREE.Vector3();
  for (const n of BONES) {
    const b = bones.get(`mixamorig${n}`), d = b ? b.getWorldPosition(new THREE.Vector3()).distanceToSquared(at) : Infinity;
    if (b && d < bestD) [best, bestD] = [b, d];
  }
  if (!best) return;
  best.getWorldPosition(centre);
  const out = at.clone().sub(centre);
  if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
  out.normalize();
  ray.set(at.clone().addScaledVector(out, 0.35), out.clone().negate());
  ray.far = 0.8;
  const hit = ray.intersectObjects(meshes.filter((m) => m.visible), false)[0];
  if (!hit) return;
  const normal = out.clone();
  if (hit.face) {
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.dot(out) > 0.2) normal.copy(n);
  }
  if (!mat) setup(lighting);
  const down = UP.clone().negate().projectOnPlane(normal);
  if (down.lengthSq() < 1e-4) down.set(1, 0, 0).projectOnPlane(normal);
  down.normalize();
  const xAxis = normal.clone().cross(down).normalize();
  const world = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, down.clone().negate(), normal));
  const m = new THREE.Mesh(geos[Math.floor(Math.random() * 4)], mat!);
  const boneQ = best.getWorldQuaternion(new THREE.Quaternion()), boneS = best.getWorldScale(new THREE.Vector3()).x;
  m.position.copy(best.worldToLocal(hit.point.clone().addScaledVector(normal, 0.006)));
  m.quaternion.copy(boneQ.invert().multiply(world));
  m.scale.setScalar((0.11 + Math.random() * 0.06) / boneS);
  m.castShadow = false;
  best.add(m);
}
