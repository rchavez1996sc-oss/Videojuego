import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { parkedCars } from '../world/parkedCars';
import type { DebugContext } from './debug';

/** Test hooks for driving: getting in and out (doors, clips), kerbs and acceleration. `drive` = the `driveTest` hook. */
export function driveDebug(c: DebugContext, drive: (kind: string, plan: [string[], number][]) => string) {
  const key = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  return {
    /** Puts the player by the nearest parked `kind` and presses E (getting in starts). */
    doorStart(kind: string) {
      c.setFreeCam(false);
      const me = c.player.position, spot = parkedCars.spots.filter((s) => s.kind === kind && !s.taken).sort((a, b) => a.pos.distanceTo(me) - b.pos.distanceTo(me))[0];
      if (!spot) return 'none';
      c.player.respawn(new THREE.Vector3(spot.pos.x + Math.cos(spot.yaw) * 1.9, c.hf.heightAt(spot.pos.x, spot.pos.z), spot.pos.z - Math.sin(spot.yaw) * 1.9), spot.yaw - Math.PI / 2);
      for (let i = 0; i < 3; i++) c.frame(1 / 30);
      key('KeyE', true); c.frame(1 / 30); key('KeyE', false);
      return `${spot.kind} ${spot.model}`;
    },
    /** Advances `frames` (E first if `press`), then frames the driven/last car from its driver's side. */
    doorStep(frames: number, press = false) {
      if (press) { key('KeyE', true); c.frame(1 / 30); key('KeyE', false); }
      for (let i = 0; i < frames; i++) c.frame(1 / 30);
      const tr = c.traffic?.() as unknown as { list: { state: string; kind: string; group: THREE.Group; x: number; z: number; yaw: number }[] };
      const v = tr.list.find((o) => o.state === 'player') ?? tr.list.filter((o) => o.state === 'parked').sort((a, b) => Math.hypot(a.x - c.player.position.x, a.z - c.player.position.z) - Math.hypot(b.x - c.player.position.x, b.z - c.player.position.z))[0];
      if (!v) return 'no car';
      const seat = Math.sign(v.group.userData.doors?.[0]?.side ?? 1);
      const f = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)), r = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)).multiplyScalar(seat);
      const at = new THREE.Vector3(v.x, c.hf.heightAt(v.x, v.z), v.z);
      c.tpc.place(at.clone().addScaledVector(r, 4.2).addScaledVector(f, 2.6).setY(at.y + 1.7), at.clone().addScaledVector(f, 0.3).setY(at.y + 0.9));
      return `${v.state} doors ${(v.group.userData.doors ?? []).map((d: { side: number; node: THREE.Object3D }) => `${d.side}:${d.node.quaternion.y.toFixed(2)}`).join(' ')}`;
    },
    /** Drives `kind` a bit, stops, gets out with E, then walks with `keys`: logs body, model, flags and camera every 0.2 s. */
    exitTest(kind: string, keys: string[] = ['KeyW']) {
      const out = [drive(kind, [[['KeyW'], 1.2], [['Space'], 2.5], [[], 2]])];
      c.setSkipRender(true);
      key('KeyE', true); c.frame(1 / 30); key('KeyE', false);
      const p = c.player as unknown as { position: THREE.Vector3; puppet: boolean; mantling: boolean; speed: number; model: { root: THREE.Object3D }; collisionHandle: number };
      const log = (tag: string) => {
        const col = c.world!.getCollider(p.collisionHandle), b = col.parent()!.translation(), m = p.model.root.position;
        out.push(`${tag} feet ${p.position.toArray().map((v) => v.toFixed(2))} body ${[b.x, b.y, b.z].map((v) => v.toFixed(2))} model ${m.toArray().map((v) => v.toFixed(2))} sp ${p.speed.toFixed(2)} pup ${p.puppet} mant ${p.mantling} col ${col.isEnabled()} cam ${c.tpc.camera.position.distanceTo(p.position).toFixed(1)} veh ${c.tpc.vehicle} held ${(p.model as unknown as { held?: { key: string } }).held?.key ?? '-'} low ${(p.model as unknown as { lowKey: string }).lowKey} t ${((p.model as unknown as { lower?: { time: number } }).lower?.time ?? -1).toFixed(2)} far ${(p.model as unknown as { far: boolean }).far} vis ${p.model.root.visible} gun ${(p.model as unknown as { weapon: THREE.Object3D }).weapon.visible}`);
      };
      for (let i = 0; i < 90; i++) { c.frame(1 / 30); if (i % 10 === 0) log(`out${i}`); }
      keys.forEach((k) => key(k, true));
      for (let i = 0; i < 60; i++) { c.frame(1 / 30); if (i % 10 === 0) log(`walk${i}`); }
      keys.forEach((k) => key(k, false));
      c.setSkipRender(false);
      return out.join('\n');
    },
    /** Drives `kind` from (x, z) heading `yaw` at `kmh`, W held: logs body height over the ground, speed and wheels on the ground. */
    curbTest(kind: string, x: number, z: number, yaw: number, kmh: number, secs = 3) {
      const how = drive(kind, []);
      const tr = c.traffic?.() as unknown as { list: { state: string; body: RAPIER.RigidBody; kind: string }[] };
      const v = tr.list.find((o) => o.state === 'player');
      if (!v) return `not driving (${how})`;
      v.body.setTranslation({ x, y: c.hf.heightAt(x, z) + 0.6, z }, true);
      v.body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), true);
      v.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      c.setSkipRender(true);
      const out: string[] = [];
      for (let i = 0; i < 45; i++) c.frame(1 / 30);
      const t0 = v.body.translation();
      out.push(`rest: origin ${(t0.y - c.hf.heightAt(t0.x, t0.z)).toFixed(3)} over ground`);
      v.body.setLinvel({ x: Math.sin(yaw) * kmh / 3.6, y: 0, z: Math.cos(yaw) * kmh / 3.6 }, true);
      key('KeyW', true);
      for (let i = 1; i <= secs * 30; i++) {
        c.frame(1 / 30);
        const t = v.body.translation(), l = v.body.linvel();
        if (i % 6 === 0) out.push(`${(i / 30).toFixed(1)}s x ${t.x.toFixed(2)} z ${t.z.toFixed(2)} y-g ${(t.y - c.hf.heightAt(t.x, t.z)).toFixed(2)} v ${(Math.hypot(l.x, l.z) * 3.6).toFixed(0)} km/h`);
      }
      key('KeyW', false);
      c.setSkipRender(false);
      return out.join('\n');
    },
    /** San Marcos: clears traffic off Av. Venezuela, puts the driven `kind` at its west end and floors it: 0–100 time and speeds. */
    accelTest(kind: string, secs = 22) {
      const how = drive(kind, []);
      const tr = c.traffic?.() as unknown as { list: { state: string; body: RAPIER.RigidBody; kind: string }[] };
      for (const o of tr.list) if (o.state === 'drive') o.state = 'off';
      const v = tr.list.find((o) => o.state === 'player');
      if (!v) return `not driving (${how})`;
      v.body.setTranslation({ x: -440, y: c.hf.heightAt(-440, 14) + 0.4, z: 14 }, true);
      v.body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), true);
      v.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      c.setSkipRender(true);
      for (let i = 0; i < 20; i++) c.frame(1 / 30);
      key('KeyW', true);
      let t100 = -1, top = 0;
      const marks: string[] = [];
      for (let i = 1; i <= secs * 30; i++) {
        c.frame(1 / 30);
        const l = v.body.linvel(), kmh = Math.hypot(l.x, l.z) * 3.6;
        top = Math.max(top, kmh);
        if (t100 < 0 && kmh >= 100) t100 = i / 30;
        if (i % 75 === 0) marks.push(`${i / 30}s ${kmh.toFixed(0)}`);
      }
      key('KeyW', false);
      c.setSkipRender(false);
      return `${v.kind}: 0-100 ${t100 < 0 ? '—' : t100.toFixed(1) + ' s'} · top ${top.toFixed(0)} km/h · ${marks.join(' · ')}`;
    },
  };
}
