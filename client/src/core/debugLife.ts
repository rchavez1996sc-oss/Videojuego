import * as THREE from 'three';
import type { DebugContext } from './debug';
import { HP } from '../systems/traffic';

type Civ = { pos: THREE.Vector3; mood: string; act: string | null; reactT: number; cart?: THREE.Object3D | null; model: { root: THREE.Object3D } };
/** Tests set `on` to keep the town simulating while the camera is free (normally a free camera freezes it). */
export const simFree = { on: false };
const civs = () => ((window as unknown as { __civs?: { list: Civ[] } }).__civs?.list ?? []);
import RAPIER from '@dimforge/rapier3d-compat';

/** A camera spot `dist` m from `at` (preferring direction `pref`) with a clear line of sight to it. */
function clearView(c: DebugContext, at: THREE.Vector3, dist: number, pref = 0): THREE.Vector3 {
  for (let k = 0; k < 16; k++) {
    const a = pref + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8), d = { x: Math.sin(a), y: 0.12, z: Math.cos(a) };
    const hit = c.world?.castRay(new RAPIER.Ray(at, d), dist + 0.5, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
    if (!hit) return at.clone().add(new THREE.Vector3(d.x, d.y, d.z).multiplyScalar(dist));
  }
  return at.clone().add(new THREE.Vector3(0, dist, 0));
}
const f = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(1));

/** Test hooks for the living city: where things are, aiming at a passer-by, vehicle wear stages. */
export function lifeDebug(c: DebugContext) {
  const run = (frames: number) => { for (let i = 0; i < frames; i++) c.frame(1 / 30); };
  return {
    simFree(v: boolean) { simFree.on = v; },
    /** Positions of carts, roof dogs, laundry, patrolling police and the passers-by's acts. */
    lifeSpots() {
      const dogs = (window as unknown as { __roofDogs?: { a: THREE.Vector3 }[] }).__roofDogs ?? [];
      const laundry = c.scene?.getObjectByName('laundry') as THREE.InstancedMesh | undefined, m = new THREE.Matrix4(), p = new THREE.Vector3();
      const cloth = laundry ? Array.from({ length: Math.min(4, laundry.count) }, (_, i) => (laundry.getMatrixAt(i * 37 % laundry.count, m), f(p.setFromMatrixPosition(m)))) : [];
      return JSON.stringify({
        carts: civs().filter((x) => x.cart).map((x) => f(x.pos)), dogs: dogs.slice(0, 4).map((d) => f(d.a)), cloth,
        police: c.enemies.list.filter((e) => e.alive && e.state === 'patrol' && !e.moveTarget).slice(0, 4).map((e) => f(e.position)),
        acts: civs().filter((x) => x.act).map((x) => `${x.act}@${f(x.pos)}`),
      });
    },
    /** Camera 7 m from passer-by `i` (calm, nearest to the camera when -1), aimed at their chest, holding aim for `frames`. */
    aimCiv(i: number, frames = 45) {
      const list = civs().filter((x) => x.mood === 'walk' || x.mood === 'idle');
      const cam = c.tpc.camera.position, civ = i < 0 ? list.sort((a, b) => a.pos.distanceTo(cam) - b.pos.distanceTo(cam))[0] : list[i];
      if (!civ) return 'no civilian';
      const input = c.input as unknown as { aiming: boolean };
      input.aiming = true;
      let log = '', view: THREE.Vector3 | undefined;
      for (let k = 0; k < frames; k++) {
        const at = civ.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), from = view ??= clearView(c, at, 6);
        c.setFreeCam(true);
        c.tpc.place(from, at);
        c.frame(1 / 30);
        if (k % 15 === 14) log += `${k}: ${civ.mood} ${civ.act} ${civ.reactT.toFixed(1)} · `;
      }
      input.aiming = false;
      return `${log}@${f(civ.pos)}`;
    },
    /** Nearest driving traffic vehicle set to wear `stage` (1–5) and watched for `frames`; returns where it is. */
    wearTest(stage: number, frames = 60) {
      const tr = c.traffic?.() as unknown as { list: { state: string; x: number; z: number; hp: number; speed: number; yaw: number }[] } | undefined;
      const cam = c.tpc.camera.position, v = tr?.list.filter((o) => o.state === 'drive').sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z) - Math.hypot(b.x - cam.x, b.z - cam.z))[0];
      if (!v) return 'no vehicle';
      v.hp = HP * [1, 0.9, 0.7, 0.5, 0.3, 0.1][stage];
      for (let i = 0; i < frames; i++) {
        const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)), at = new THREE.Vector3(v.x, c.hf.heightAt(v.x, v.z) + 1, v.z);
        c.setFreeCam(true);
        c.tpc.place(at.clone().addScaledVector(side, 7).add(new THREE.Vector3(Math.sin(v.yaw) * 2, 1.5, Math.cos(v.yaw) * 2)), at);
        c.frame(1 / 30);
      }
      return `hp ${v.hp.toFixed(0)} speed ${v.speed.toFixed(1)} at ${v.x.toFixed(1)},${v.z.toFixed(1)} yaw ${v.yaw.toFixed(2)}`;
    },
    /** Camera following passer-by `i` among those pushing a cart (from beside and behind) for `frames`. */
    watchCart(i: number, frames = 20) {
      const civ = civs().filter((x) => x.cart)[i];
      if (!civ) return 'no cart';
      for (let k = 0; k < frames; k++) {
        const yaw = civ.model.root.rotation.y, fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), at = civ.pos.clone().add(new THREE.Vector3(0, 1, 0));
        c.setFreeCam(true);
        c.tpc.place(clearView(c, at, 5, Math.atan2(fwd.x, fwd.z) + 0.6), at.clone().addScaledVector(fwd, 0.8));
        c.frame(1 / 30);
      }
      return `cart civ ${civ.mood} @${f(civ.pos)}`;
    },
    /** Watches patrolling officer `i` for `frames` from in front: head yaw relative to the body and left-hand height every 10 frames. */
    gestureTest(i: number, frames = 240) {
      const e = c.enemies.list.filter((x) => x.alive && x.state === 'patrol' && !x.moveTarget)[i];
      if (!e) return 'no officer';
      const b = e.model.bones, head = b.get('mixamorigHead')!, hips = b.get('mixamorigHips')!, hand = b.get('mixamorigLeftHand')!, q = new THREE.Quaternion(), r = new THREE.Quaternion(), v = new THREE.Vector3();
      const out: string[] = [];
      for (let k = 0; k < frames; k++) {
        const fwd = e.model.root.getWorldDirection(new THREE.Vector3()), at = e.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        c.setFreeCam(true);
        c.tpc.place(clearView(c, at, 3.4, Math.atan2(fwd.x, fwd.z)), at);
        c.frame(1 / 30);
        if (k % 10 === 9) {
          head.getWorldQuaternion(q); hips.getWorldQuaternion(r);
          const yaw = new THREE.Euler().setFromQuaternion(r.invert().multiply(q), 'YXZ').y;
          out.push(`${(yaw * 57.3).toFixed(0)}°/${(hand.getWorldPosition(v).y - e.position.y).toFixed(2)}`);
        }
      }
      return `${e.state} ${out.join(' ')}`;
    },
    run,
  };
}
