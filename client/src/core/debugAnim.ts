import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { isGhost } from '../world/surfaces';
import { parkedCars } from '../world/parkedCars';
import { dent } from '../fx/dents';
import { Rig } from '../entities/rig';
import { characters, type CharKind } from '../render/characters';
import type { DebugContext } from './debug';

/** Test hooks for weapon handling: reload frames and grenade flight traces. */
export function animDebug(c: DebugContext) {
  const frameOn = (side: number, dist: number, h = 1.3) => {
    const p = c.player.position, yaw = c.player.yaw + side;
    c.setFreeCam(true);
    c.tpc.place(p.clone().add(new THREE.Vector3(-Math.sin(yaw) * dist, h + 0.2, -Math.cos(yaw) * dist)), p.clone().setY(p.y + h));
    c.frame(1 / 60);
  };
  const key = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  return {
    /** The car the player drives or just left: x, y, yaw, z. */
    carAt() {
      const tr = c.traffic?.() as unknown as { list: { x: number; z: number; y?: number; yaw: number; state: string; hp: number; speed: number; tilt?: THREE.Quaternion }[] } | undefined;
      const v = tr?.list.find((o) => o.state === 'player') ?? tr?.list.filter((o) => o.state !== 'drive' && o.state !== 'off').sort((a, b) => Math.hypot(a.x - c.player.position.x, a.z - c.player.position.z) - Math.hypot(b.x - c.player.position.x, b.z - c.player.position.z))[0];
      return v ? [v.x, v.y ?? 0, v.yaw, v.z, v.hp, v.speed, v.tilt ? new THREE.Vector3(0, 1, 0).applyQuaternion(v.tilt).y : 1] : [0, 0, 0, 0];
    },
    /** Downs ally `i` (as if shot), then lets `seconds` pass; reports how far it crawled toward the player. */
    downAlly(i: number, seconds: number) {
      const a = c.squad!.list[i];
      a.unit.teleport(c.player.position.clone().add(new THREE.Vector3(9, 0, 0)));
      const p0 = a.unit.position.clone();
      c.squad!.hurt(a, 1e6, a.unit.position.clone().add(new THREE.Vector3(1, 0, 0)));
      this.advance(seconds);
      return `ally ${i} moved ${a.unit.position.distanceTo(p0).toFixed(2)} m, to player ${a.unit.position.distanceTo(c.player.position).toFixed(2)} m (was ${p0.distanceTo(c.player.position).toFixed(2)})`;
    },
    /** Knocks enemy `i` down (pushed along +x) and frames it after `seconds`. */
    knockTest(i: number, seconds: number) {
      const e = c.enemies.list[i];
      e.knockDown(new THREE.Vector3(1, 0, 0.2));
      this.advance(seconds);
      return `stunned ${e.stunned}`;
    },
    /** Bodies more than 1.5 m above the terrain: what collider holds them (shape, size, visible skin or not). */
    floaters() {
      const out: string[] = [];
      for (const e of c.enemies.list) {
        const p = e.position, h = c.hf.heightAt(p.x, p.z);
        if (p.y - h < 1.5) continue;
        const hit = c.world!.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }), 3, true, undefined, undefined, undefined, undefined, (col) => col.handle !== e.handle);
        const col = hit?.collider, t = col?.translation();
        out.push(`e${e.id} ${e.alive ? 'alive' : 'dead'} @${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)} terrain ${h.toFixed(2)} below: ${col ? `${col.shapeType()} ${JSON.stringify((col.shape as unknown as { halfExtents?: unknown }).halfExtents)} @${t!.x.toFixed(1)},${t!.y.toFixed(2)},${t!.z.toFixed(1)} toi ${hit!.timeOfImpact.toFixed(2)} skin ${!isGhost(col.handle)} sensor ${col.isSensor()} kin ${!!col.parent()?.isKinematic()}` : 'nothing'}`);
      }
      return out.join('\n');
    },
    /** Debug: a traffic vehicle of `kind` stopped across the road `dist` m ahead of the driven car (for crash tests). */
    /** Drives `kind` a bit, stops, gets out with E, then walks with `keys`: logs body, model, flags and camera every 0.2 s. */
    exitTest(kind: string, keys: string[] = ['KeyW']) {
      const out = [this.driveTest(kind, [[['KeyW'], 1.2], [['Space'], 2.5], [[], 2]])];
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
    /** San Marcos: clears traffic off Av. Venezuela, puts the driven `kind` at its west end and floors it: 0–100 time and speeds. */
    accelTest(kind: string, secs = 22) {
      const how = this.driveTest(kind, []);
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
    placeAhead(kind: string, dist: number) {
      const tr = c.traffic?.() as unknown as { list: { kind: string; x: number; z: number; yaw: number; state: string; speed: number }[] };
      const me = tr.list.find((o) => o.state === 'player'), v = tr.list.find((o) => o.kind === kind && o.state === 'drive');
      if (!me || !v) return 'none';
      Object.assign(v, { state: 'parked', speed: 0, x: me.x + Math.sin(me.yaw) * dist, z: me.z + Math.cos(me.yaw) * dist, yaw: me.yaw + Math.PI / 2 });
      (window as unknown as { __victimCar: unknown }).__victimCar = v;
      return `${kind} placed`;
    },
    /** Debug: dents the nearest non-traffic vehicle at its front-left corner by `depth` m; reports moved meshes. */
    dentTest(depth: number) {
      const tr = c.traffic?.() as unknown as { list: { x: number; z: number; y?: number; yaw: number; state: string; group: THREE.Group }[] };
      const v = tr.list.filter((o) => o.state !== 'drive' && o.state !== 'off').sort((a, b) => Math.hypot(a.x - c.player.position.x, a.z - c.player.position.z) - Math.hypot(b.x - c.player.position.x, b.z - c.player.position.z))[0];
      if (!v) return 'none';
      const at = new THREE.Vector3(v.x + Math.sin(v.yaw) * 2 + Math.cos(v.yaw) * 0.6, (v.y ?? 0) + 0.7, v.z + Math.cos(v.yaw) * 2 - Math.sin(v.yaw) * 0.6);
      dent(v.group, at, depth);
      let n = 0;
      v.group.traverse((o) => { if (o.userData.dentable) n++; });
      return `dented meshes ${n}`;
    },
    /** The vehicle `placeAhead` put in the way: state, position, terrain height under it, visibility. */
    victimCar() {
      const v = (window as unknown as { __victimCar?: { x: number; y?: number; z: number; state: string; group: THREE.Group; body: { isDynamic(): boolean; linvel(): { x: number; y: number; z: number } } } }).__victimCar;
      if (!v) return 'none';
      const l = v.body.linvel();
      return `${v.state} dyn ${v.body.isDynamic()} @${v.x.toFixed(1)},${(v.y ?? 0).toFixed(2)},${v.z.toFixed(1)} ground ${c.hf.heightAt(v.x, v.z).toFixed(2)} vis ${v.group.visible} vel ${Math.hypot(l.x, l.y, l.z).toFixed(1)}`;
    },
    /** Simulates `seconds` without rendering (follow camera), then renders one frame. */
    advance(seconds: number) {
      c.setFreeCam(false);
      c.setSkipRender(true);
      for (let i = 0; i < Math.round(seconds * 30); i++) c.frame(1 / 30);
      c.setSkipRender(false);
      c.frame(1 / 60);
    },
    /** Debug: `key` frozen at each fraction of its length, in a row along +x from (x, z) facing +z (the camera looks from +z). */
    /** Drives `kind` at ~`kmh` into a policeman or civilian placed ahead; per frame: distance bumper→victim, victim hips height and state. */
    hitTimeline(kind: string, who: 'police' | 'civ', kmh = 40) {
      const out: string[] = [];
      this.driveTest(kind, [[['KeyW'], 0.1]]);
      const tr = c.traffic?.() as unknown as { list: { x: number; z: number; yaw: number; speed: number; state: string; len: number; body: { setLinvel(v: object, w: boolean): void } }[] };
      const v = tr.list.find((o) => o.state === 'player')!, f = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
      v.body.setLinvel({ x: f.x * kmh / 3.6, y: 0, z: f.z * kmh / 3.6 }, true);
      const at = new THREE.Vector3(v.x, 0, v.z).addScaledVector(f, 9);
      at.y = c.hf.heightAt(at.x, at.z);
      const civs = (window as unknown as { __civs?: { list: { pos: THREE.Vector3; mood: string; model: { hips(): THREE.Vector3 } }[] } }).__civs;
      const e = who === 'police' ? c.enemies.list.find((x) => x.alive) : undefined, cv = who === 'civ' ? civs?.list.find((x) => x.mood === 'walk' || x.mood === 'idle') : undefined;
      if (e) e.teleport(at); else if (cv) cv.pos.copy(at);
      key('KeyW', true);
      for (let i = 0; i < 75; i++) {
        c.frame(1 / 30);
        const p = e ? e.position : cv!.pos, hips = (e ? e.model : cv!.model).hips();
        const gap = (p.x - v.x) * f.x + (p.z - v.z) * f.z - v.len / 2;
        if (i % 2 === 0 || Math.abs(gap) < 1.5) out.push(`${i} gap ${gap.toFixed(2)} hipsY ${(hips.y - p.y).toFixed(2)} v ${v.speed.toFixed(1)} ${e ? `hp ${e.hp.toFixed(0)} alive ${e.alive} stun ${e.stunned}` : cv!.mood}`);
      }
      key('KeyW', false);
      return out.join('\n');
    },
    /** Presses `keys` one frame each, then fires `shots` real shots (mouse); reports weapons, ammo, what the hands hold. */
    weaponTest(keys: string[], shots = 0) {
      for (const k of keys) { key(k, true); c.frame(1 / 30); key(k, false); c.frame(1 / 30); }
      for (let i = 0; i < 20; i++) c.frame(1 / 30);
      if (c.input) c.input.locked = true;
      for (let i = 0; i < shots; i++) {
        dispatchEvent(new MouseEvent('mousedown', { button: 0 })); c.frame(1 / 30);
        dispatchEvent(new MouseEvent('mouseup', { button: 0 })); for (let j = 0; j < 8; j++) c.frame(1 / 30);
      }
      const cb = c.combat, w = c.player.model.weapon;
      return `slot ${cb.slot} ${cb.gun.def.name} | ${cb.guns.map((g) => `${g.def.slot} ${g.ammo}+${g.reserve}`).join(' · ')} | weapon visible ${w.visible} from ${!!cb.from}`;
    },
    wheelInfo() {
      const tr = c.traffic?.() as unknown as { list: { kind: string; group: THREE.Group }[] } | undefined, seen = new Set<string>(), out: string[] = [];
      for (const v of tr?.list ?? []) {
        if (seen.has(v.kind)) continue;
        seen.add(v.kind);
        const w = (v.group.userData.wheels ?? []) as THREE.Object3D[];
        v.group.updateMatrixWorld(true);
        const off = w.map((o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).distanceTo(o.getWorldPosition(new THREE.Vector3())).toFixed(2));
        out.push(`${v.kind}: ${w.length} wheels [${w.map((o) => o.name).join(',')}] pivot-off ${off.join(',')} R ${v.group.userData.wheelR?.toFixed?.(2)}`);
      }
      return out.join('\n');
    },
    clipLen(key: string) { return characters.clips.get(key)?.duration ?? -1; },
    poseSheet(key: string, fracs: number[], x: number, z: number, kind: CharKind = 'fls') {
      const out: string[] = [];
      fracs.forEach((f, i) => {
        const r = new Rig(kind, c.lighting!, false);
        r.hold(key, 0, true, f);
        r.tick(0);
        r.root.updateMatrixWorld(true);
        const k = ['LeftLeg', 'RightLeg'].map((n) => r.root.getObjectByName(`mixamorig${n}`)!.getWorldPosition(new THREE.Vector3()));
        out.push(`${f}: hips ${r.hips().toArray().map((v) => v.toFixed(2))} knees y ${k.map((v) => v.y.toFixed(2))} z ${k.map((v) => v.z.toFixed(2))}`);
        r.root.position.set(x + i * 2.2, c.hf.heightAt(x + i * 2.2, z), z);
        c.scene!.add(r.root);
      });
      return out.join('\n');
    },
    /** Puts the player beside a traffic vehicle of `kind`, presses E, then plays `plan` ([keys, seconds][]) and logs the car. */
    driveTest(kind: string, plan: [string[], number][], victim: boolean | 'civ' = false) {
      let log0 = '';
      c.setFreeCam(false);
      const tr = c.traffic?.() as unknown as { list: { kind: string; x: number; z: number; yaw: number; speed: number; state: string; y?: number }[] } | undefined;
      const want = kind.startsWith('parked:') ? kind.slice(7) : null, me = c.player.position;
      const spot = want ? parkedCars.spots.filter((s) => s.kind === want && !s.taken).sort((a, b) => a.pos.distanceTo(me) - b.pos.distanceTo(me))[0] ?? null : kind === 'parked' ? parkedCars.nearest(me, 999)?.spot : null;
      let v = spot ? null : tr?.list.find((o) => o.kind === kind && o.state === 'drive');
      if (!v && !spot) return 'no vehicle';
      c.setSkipRender(true);
      const [px, pz, yaw] = spot ? [spot.pos.x, spot.pos.z, spot.yaw] : [v!.x, v!.z, v!.yaw];
      c.player.respawn(new THREE.Vector3(px + Math.cos(yaw) * 1.8, c.hf.heightAt(px, pz), pz - Math.sin(yaw) * 1.8), 0);
      c.frame(1 / 30);
      c.frame(1 / 30);
      key('KeyE', true); c.frame(1 / 30); key('KeyE', false);
      for (let i = 0; i < 90; i++) c.frame(1 / 30);
      v ??= tr!.list.find((o) => o.state === 'player') ?? tr!.list[tr!.list.length - 1];
      if (spot) log0 = `parked ${spot.kind} ${spot.model} `;
      const prey = victim === true ? c.enemies.list.find((e) => e.alive) : undefined;
      const civ = victim === 'civ' ? c.civilians?.()[0] : undefined, civN = c.civilians?.().length ?? 0;
      const log = [`${log0}in: ${v.state}`];
      for (const [n, [keys, secs]] of plan.entries()) {
        if (civ && n === 1) civ.set(v.x + Math.sin(v.yaw) * 6, c.hf.heightAt(v.x, v.z), v.z + Math.cos(v.yaw) * 6);
        if (prey && n === 1) prey.teleport(new THREE.Vector3(v.x + Math.sin(v.yaw) * 5, c.hf.heightAt(v.x, v.z), v.z + Math.cos(v.yaw) * 6));
        keys.forEach((k) => key(k, true));
        for (let i = 0; i < Math.round(secs * 30); i++) c.frame(1 / 30);
        keys.forEach((k) => key(k, false));
        if (prey) log.push(`  prey hp ${prey.hp.toFixed(0)} stunned ${prey.stunned} @${prey.position.x.toFixed(1)},${prey.position.z.toFixed(1)}`);
        log.push(`${keys.join('+') || '-'} ${secs}s → ${v.x.toFixed(1)},${(v.y ?? 0).toFixed(2)},${v.z.toFixed(1)} yaw ${v.yaw.toFixed(2)} v ${v.speed.toFixed(1)} hp ${c.player.hp.toFixed(0)}`);
      }
      if (civ) log.push(`civilians ${civN} → ${c.civilians?.().length} (civ @${civ.x.toFixed(1)},${civ.z.toFixed(1)})`);
      if (prey) log.push(`prey stunned ${prey.stunned}`);
      if (prey) log.push(`prey alive ${prey.alive} hp ${prey.hp.toFixed(0)} at ${prey.position.x.toFixed(2)} ${prey.position.y.toFixed(2)} ${prey.position.z.toFixed(2)}`);
      c.setSkipRender(false);
      c.frame(1 / 60);
      return log.join('\n');
    },
    /** Left wrist to handguard distance (m) and IK weight for the player and each ally. */
    gripGap() {
      const rigs = [c.player.model, ...(c.squad?.list.map((a) => a.unit.model) ?? [])] as unknown as { inst: { bones: Map<string, THREE.Bone> }; grip?: { weapon: THREE.Object3D; pos: THREE.Vector3 }; ikW: number }[];
      return rigs.map((r) => {
        const h = r.inst.bones.get('mixamorigLeftHand')!.getWorldPosition(new THREE.Vector3());
        return r.grip ? `${h.distanceTo(r.grip.weapon.localToWorld(r.grip.pos.clone())).toFixed(3)}m w${r.ikW.toFixed(2)} pos ${r.grip.pos.toArray().map((x) => x.toFixed(2))} ws ${r.grip.weapon.getWorldScale(new THREE.Vector3()).x.toFixed(2)}` : 'no grip';
      }).join(' | ');
    },
    /** Empties the magazine, plays the reload up to `progress` (0..1) and frames the player from `side`. */
    reloadAt(progress: number, side = 1.2, dist = 3) {
      c.setFreeCam(false);
      const g = c.combat.gun;
      g.ammo = 0;
      for (let i = 0; i < 4 && g.reloading <= 0; i++) c.frame(1 / 30);
      const total = g.reloading;
      while (g.reloading > 0 && 1 - g.reloading / total < progress) c.frame(1 / 30);
      frameOn(side, dist);
      return `total ${total.toFixed(2)} at ${(1 - g.reloading / total).toFixed(2)}`;
    },
    /** Grenade drawn, then the real throw (as on a click) run for `t` seconds of game time, framed from `side`. */
    throwAt(t: number, side = 0.9, dist = 2.6) {
      c.setFreeCam(false);
      const gm = c.grenadeMode!;
      c.grenades.count = 3;
      gm.equipped = true;
      for (let i = 0; i < 12; i++) c.frame(1 / 30);
      gm.startThrow();
      for (let k = 0; k < Math.round(t * 30); k++) c.frame(1 / 30);
      frameOn(side, dist);
      return `thrown ${3 - c.grenades.count} live ${c.grenades.group.children.length}`;
    },
    /** Throws along the view at `pitch` and samples the grenade every 0.1 s until it explodes. */
    nadeTrace(pitch = 0) {
      c.setFreeCam(false);
      c.setSkipRender(true);
      c.tpc.pitch = pitch;
      c.grenades.count = 3;
      c.frame(1 / 30);
      const g = c.grenades.group, out: string[] = [];
      c.throwGrenade();
      for (let t = 0; t < 4.2 && g.children.length; t += 1 / 30) {
        c.frame(1 / 30);
        if (Math.round(t * 30) % 3 === 0 && g.children[0]) out.push(g.children[0].position.toArray().map((v) => v.toFixed(2)).join(','));
      }
      c.setSkipRender(false);
      return out.join(' | ');
    },
  };
}
