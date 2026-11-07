import * as THREE from 'three';
import { parkedCars } from '../world/parkedCars';
import { Rig } from '../entities/rig';
import type { CharKind } from '../render/characters';
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
      const tr = c.traffic?.() as unknown as { list: { x: number; z: number; y?: number; yaw: number; state: string }[] } | undefined;
      const v = tr?.list.find((o) => o.state === 'player') ?? tr?.list.find((o) => o.state === 'parked');
      return v ? [v.x, v.y ?? 0, v.yaw, v.z] : [0, 0, 0, 0];
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
      const spot = kind === 'parked' ? parkedCars.nearest(c.player.position, 999)?.spot : null;
      let v = spot ? null : tr?.list.find((o) => o.kind === kind && o.state === 'drive');
      if (!v && !spot) return 'no vehicle';
      c.setSkipRender(true);
      const [px, pz, yaw] = spot ? [spot.pos.x, spot.pos.z, spot.yaw] : [v!.x, v!.z, v!.yaw];
      c.player.respawn(new THREE.Vector3(px + Math.cos(yaw) * 1.8, c.hf.heightAt(px, pz), pz - Math.sin(yaw) * 1.8), 0);
      c.frame(1 / 30);
      key('KeyE', true); c.frame(1 / 30); key('KeyE', false);
      v ??= tr!.list.find((o) => o.state === 'player') ?? tr!.list[tr!.list.length - 1];
      if (spot) log0 = `parked ${spot.kind} ${spot.model} `;
      const prey = victim === true ? c.enemies.list.find((e) => e.alive) : undefined;
      const civ = victim === 'civ' ? c.civilians?.()[0] : undefined, civN = c.civilians?.().length ?? 0;
      const log = [`${log0}in: ${v.state}`];
      for (const [n, [keys, secs]] of plan.entries()) {
        if (civ && n === 1) civ.set(v.x + Math.sin(v.yaw) * 6, c.hf.heightAt(v.x, v.z), v.z + Math.cos(v.yaw) * 6);
        if (prey && n === 1) prey.teleport(new THREE.Vector3(v.x + Math.sin(v.yaw) * 6, c.hf.heightAt(v.x, v.z), v.z + Math.cos(v.yaw) * 6));
        keys.forEach((k) => key(k, true));
        for (let i = 0; i < Math.round(secs * 30); i++) c.frame(1 / 30);
        keys.forEach((k) => key(k, false));
        log.push(`${keys.join('+') || '-'} ${secs}s → ${v.x.toFixed(1)},${(v.y ?? 0).toFixed(2)},${v.z.toFixed(1)} yaw ${v.yaw.toFixed(2)} v ${v.speed.toFixed(1)} hp ${c.player.hp.toFixed(0)}`);
      }
      if (civ) log.push(`civilians ${civN} → ${c.civilians?.().length} (civ @${civ.x.toFixed(1)},${civ.z.toFixed(1)})`);
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
