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
        shutters: ((l) => `${l.filter((x) => x.t >= 1).length} cerradas / ${l.filter((x) => x.closing).length} cerrando / ${l.length}`)((window as unknown as { __shutters?: { t: number; closing: boolean }[] }).__shutters ?? []),
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
        const at = new THREE.Vector3(v.x, c.hf.heightAt(v.x, v.z) + 1.2, v.z);
        c.setFreeCam(true);
        c.tpc.place(clearView(c, at, 7, v.yaw + 1.2), at);
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
          out.push(`${(yaw * 57.3).toFixed(0)}°/${(hand.getWorldPosition(v).y - e.position.y).toFixed(2)} ${e.model.root.userData.gesture ?? 'nohook'}`);
        }
      }
      return `${e.state} ${out.join(' ')}`;
    },
    /** Drives a sedan at `kmh` over a fallen policeman placed ahead; car height/pitch every 3 frames near the body. */
    bumpTest(kmh = 30, frames = 45) {
      const g = (window as unknown as { __game: { driveTest(k: string, p: [string[], number][]): string } }).__game;
      g.driveTest('sedan', [[['KeyW'], 0.1]]);
      const tr = c.traffic?.() as unknown as { list: { x: number; y: number; z: number; yaw: number; tilt: number; speed: number; state: string; group: THREE.Object3D; body: { setLinvel(v: object, w: boolean): void } }[] };
      const v = tr.list.find((o) => o.state === 'player')!, fw = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)), right = new THREE.Vector3(fw.z, 0, -fw.x);
      const e = c.enemies.list.find((x) => x.alive)!, at = new THREE.Vector3(v.x, 0, v.z).addScaledVector(fw, 9).addScaledVector(right, 0.5);
      e.teleport(at.setY(c.hf.heightAt(at.x, at.z)));
      e.die(right.clone());
      for (let i = 0; i < 60; i++) (v.body.setLinvel({ x: 0, y: 0, z: 0 }, true), c.frame(1 / 30));
      v.body.setLinvel({ x: fw.x * kmh / 3.6, y: 0, z: fw.z * kmh / 3.6 }, true);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      const out: string[] = [], q = new THREE.Euler();
      for (let i = 0; i < frames; i++) {
        c.frame(1 / 30);
        q.setFromQuaternion(v.group.quaternion, 'YXZ');
        const h = e.model.bones.get('mixamorigHips')!.getWorldPosition(new THREE.Vector3()), rel = h.clone().sub(v.group.position);
        if (i % 3 === 0) out.push(`hips along ${rel.dot(fw).toFixed(1)} lat ${rel.dot(right).toFixed(2)} dy ${rel.y.toFixed(2)} · ${i} y ${(v.y - c.hf.heightAt(v.x, v.z)).toFixed(2)} pitch ${(q.x * 57.3).toFixed(1)} roll ${(q.z * 57.3).toFixed(1)} v ${v.speed.toFixed(1)}`);
      }
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      return out.join('\n');
    },
    /** Bike riders: hands, feet and shoulders in the rider holder's frame (hips at the origin). */
    bikeHands() {
      const out: string[] = [];
      c.scene?.traverse((o) => {
        if (o.name !== 'rider' || !o.userData.bike || out.length > 3) return;
        const r = o.userData.rig as { bones: Map<string, THREE.Bone> }, b = (n: string) => o.worldToLocal(r.bones.get(`mixamorig${n}`)!.getWorldPosition(new THREE.Vector3()));
        out.push(['LeftHand', 'RightHand', 'LeftShoulder', 'LeftFoot', 'Head'].map((n) => `${n} ${f(b(n))}`).join(' | '));
      });
      return out.join('\n');
    },
    /** Shows/hides every mesh whose material name matches `re` (to find what makes a visual artefact). */
    hideMat(re: string, show = false) {
      let n = 0;
      c.scene?.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && !Array.isArray(m) && new RegExp(re).test(m.name)) [o.visible = show, n++];
      });
      return n;
    },
    /** Camera 3.5 m from pigeon flock `i` (looking at it) for `frames`; returns pigeons still on the ground. */
    pigeonView(i: number, frames = 20, dist = 3.5) {
      const pg = (window as unknown as { __pigeons?: { homes: THREE.Vector3[]; count: number; grounded(i: number): number } }).__pigeons;
      const home = pg?.homes[i];
      if (!home) return 'no flock';
      const at = home.clone().add(new THREE.Vector3(0, 0.3, 0));
      for (let k = 0; k < frames; k++) [c.setFreeCam(true), c.tpc.place(clearView(c, at, dist, 0.7).setY(home.y + 1.2), at), c.frame(1 / 30)];
      return `flock ${pg!.grounded(i)} · all ${pg!.count} on ground @${f(home)}`;
    },
    /** Camera `dist` m from puddle `i` (or the wind-blown piece nearest the camera when i < 0), looking at it. */
    wetView(i: number, dist = 3, frames = 3) {
      const w = window as unknown as { __puddles?: THREE.InstancedMesh; __litter?: { spots: THREE.Vector3[] } };
      const m = new THREE.Matrix4(), cam = c.tpc.camera.position;
      const at = i >= 0 ? (w.__puddles?.getMatrixAt(i, m), new THREE.Vector3().setFromMatrixPosition(m)) : w.__litter?.spots.slice().sort((a, b) => a.distanceTo(cam) - b.distanceTo(cam))[0]?.clone();
      if (!at) return 'none';
      for (let k = 0; k < frames; k++) [c.setFreeCam(true), c.tpc.place(clearView(c, at.clone().setY(at.y + 0.2), dist, 0.6).setY(at.y + dist * 0.6), at), c.frame(1 / 30)];
      return f(at);
    },
    /** Shoots the window pane nearest to (x, z) `n` times from 6 m in front, then frames it; returns panes found. */
    glassTest(x: number, z: number, n = 1) {
      const g = (window as unknown as { __glass?: { panes: THREE.Mesh[]; trace(f: THREE.Vector3, d: THREE.Vector3, l: number): void } }).__glass;
      if (!g) return 'no glass';
      let best: { p: THREE.Vector3; n: THREE.Vector3 } | null = null, bd = 1e9;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), ref = new THREE.Vector3(x, 0, z);
      for (const m of g.panes) {
        const pos = m.geometry.attributes.position, idx = m.geometry.index;
        for (let t = 0; t < (idx ? idx.count : pos.count) / 3; t++) {
          const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); cc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
          const ctr = a.clone().add(b).add(cc).divideScalar(3), d = Math.hypot(ctr.x - x, ctr.z - z);
          const nn = b.clone().sub(a).cross(cc.clone().sub(a)).normalize();
          if (nn.x * (x - ctr.x) + nn.z * (z - ctr.z) < 0) nn.negate();
          if (d < bd && Math.abs(nn.y) < 0.2 && ctr.y - ref.y > 0.5) { bd = d; best = { p: ctr, n: nn }; }
        }
      }
      if (!best) return `panes ${g.panes.length}, none near`;
      const from = best.p.clone().addScaledVector(best.n, 6);
      for (let k = 0; k < n; k++) g.trace(from, best.p.clone().sub(from).normalize(), 7);
      for (let k = 0; k < 20; k++) [c.setFreeCam(true), c.tpc.place(best.p.clone().addScaledVector(best.n, 3.5).add(new THREE.Vector3(0.5, 0.3, 0.5)), best.p), c.frame(1 / 30)];
      return `panes ${g.panes.length} hit @${f(best.p)} dist ${bd.toFixed(1)}`;
    },
    /** Material names in the scene matching `re`, with mesh counts (instanced marked *). */
    matNames(re: string) {
      const out = new Map<string, number>();
      c.scene?.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && !Array.isArray(m) && new RegExp(re, 'i').test(m.name)) out.set(m.name + ((o as THREE.InstancedMesh).isInstancedMesh ? '*' : ''), (out.get(m.name) ?? 0) + 1);
      });
      return [...out].map(([k, v]) => `${k}:${v}`).join(' ');
    },
    /** Shoots cable span `i` at mid-span from 5 m below/beside (`n` rounds), frames it; reports spans. */
    cableTest(i: number, n = 1, frames = 30) {
      const w = (window as unknown as { __wires?: { count: number; trace(f: THREE.Vector3, d: THREE.Vector3, l: number): void } }).__wires;
      const spans = (w as unknown as { constructor: unknown }) && (window as unknown as { __spans?: { a: THREE.Vector3; c: THREE.Vector3; sag: number }[] }).__spans;
      const s = spans?.filter((x) => x.a.distanceTo(x.c) > 25)[i];
      if (!w || !s) return `spans ${w?.count ?? 0}`;
      const mid = s.a.clone().lerp(s.c, 0.5).add(new THREE.Vector3(0, -s.sag, 0)), from = mid.clone().add(new THREE.Vector3(0, -4, 3));
      for (let k = 0; k < n; k++) w.trace(from, mid.clone().sub(from).normalize(), 10);
      for (let k = 0; k < frames; k++) [c.setFreeCam(true), c.tpc.place(mid.clone().add(new THREE.Vector3(0, -3.5, mid.z > 0 ? -9 : 9)), mid.clone().add(new THREE.Vector3(0, -2.2, 0))), c.frame(1 / 30)];
      return `spans ${w.count} cut ${spans!.filter((x) => (x as unknown as { cut: number }).cut >= 0).length} mid ${f(mid)}`;
    },
    run,
  };
}
