import * as THREE from 'three';
import type { Lighting } from '../render/lighting';
import type { Rig } from './rig';
import { seatedRig } from './occupants';
import { twoBoneIk } from './handIk';

const GEAR = { pod: '#1d2228', strap: '#c9a227', helmet: ['#e8e8e6', '#d6302a', '#f2c618', '#2a6fd6'] };

/**
 * A paraglider pilot that reads as a person (Mixamo sitting pose): sitting back in a harness pod with the legs out,
 * a helmet on, both hands raised to the brake handles on the risers. Pose frozen like the riders in traffic.
 * The holder's origin is the hips; it faces −z (the wing's direction of flight). Null before characters load.
 */
export function paraPilot(lighting: Lighting, rand: () => number): THREE.Group | null {
  const holder = seatedRig(lighting, rand);
  if (!holder) return null;
  const rig = holder.userData.rig as Rig;
  holder.rotation.y = Math.PI;
  holder.updateMatrixWorld(true);
  rig.root.updateMatrixWorld(true);
  const bone = (n: string) => rig.bones.get(`mixamorig${n}`)!;
  const spine = bone('Spine');
  spine.rotateX(-0.25);
  rig.root.updateMatrixWorld(true);
  for (const [side, x] of [['Left', 1], ['Right', -1]] as const) {
    const shoulder = bone(`${side}Arm`).getWorldPosition(new THREE.Vector3());
    const target = shoulder.clone().add(new THREE.Vector3(x * 0.12, 0.42, 0.05).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
    twoBoneIk(bone(`${side}Arm`), bone(`${side}ForeArm`), bone(`${side}Hand`), target, 1);
    bone(`${side}ForeArm`).updateMatrixWorld(true);
  }
  rig.tick = () => {};
  const mat = (c: string, rough = 0.7) => lighting.setup(new THREE.MeshStandardMaterial({ color: c, roughness: rough }), `pg-gear-${c}`);
  const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 10).rotateX(Math.PI / 2 - 0.15).translate(0, -0.1, 0.22), mat(GEAR.pod));
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.12).translate(0, 0.25, -0.18), mat(GEAR.pod));
  holder.add(pod, back);
  const head = bone('Head'), helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(GEAR.helmet[Math.floor(rand() * GEAR.helmet.length)], 0.35));
  const k = 1 / head.getWorldScale(new THREE.Vector3()).x;
  helmet.position.set(0, 0.1 * k, 0.01 * k);
  helmet.scale.setScalar(k);
  head.add(helmet);
  holder.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh));
  return holder;
}
