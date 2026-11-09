import * as THREE from 'three';
import type { DebugContext } from './debug';
import { HP } from '../systems/traffic';

type Civ = { pos: THREE.Vector3; mood: string; act: string | null; reactT: number; cart?: THREE.Object3D | null; model: { root: THREE.Object3D } };
/** Tests set `on` to keep the town simulating while the camera is free (normally a free camera freezes it). */
export const simFree = { on: false };
const civs = () => ((window as unknown as { __civs?: { list: Civ[] } }).__civs?.list ?? []);
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
      let log = '';
      for (let k = 0; k < frames; k++) {
        const at = civ.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), from = at.clone().add(new THREE.Vector3(5, 0.6, 5));
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
        c.tpc.place(at.clone().addScaledVector(fwd, 3.5).add(new THREE.Vector3(fwd.z * 3.5, 1.4, -fwd.x * 3.5)), at.clone().addScaledVector(fwd, 0.8));
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
        c.tpc.place(at.clone().addScaledVector(fwd, 3.2).add(new THREE.Vector3(0, 0.3, 0)), at);
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
