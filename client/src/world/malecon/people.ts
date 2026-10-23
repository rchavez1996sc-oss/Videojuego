import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { onHit } from '../surfaces';
import { mulberry32 } from '../../core/rng';
import type { Lighting } from '../../render/lighting';
import { Rig } from '../../entities/rig';
import { characters, type CharKind } from '../../render/characters';
import type { CoastDef } from '../coast';
import type { Extra } from './park';

const KINDS: CharKind[] = ['civ_a', 'civ_b', 'civ_c'];

/** Invisible mesh whose onBeforeRender drives per-frame work of static decor (no hook in the game loop needed). */
function ticker(tick: (camera: THREE.Camera) => void): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  m.frustumCulled = false;
  m.onBeforeRender = (_r, _s, camera) => tick(camera);
  return m;
}

const SEATED = ['sit', 'sit', 'sit_talk'];

/** A Mixamo civilian looping `key`; seated clips put the hips `seat` metres above `at`, standing ones the feet on it. */
function extra(lighting: Lighting, rand: () => number, at: THREE.Vector3, yaw: number, key: string, seat = 0.47): Rig {
  const rig = new Rig(KINDS[Math.floor(rand() * KINDS.length)], lighting, false);
  rig.loop(key);
  rig.root.updateMatrixWorld(true);
  const seated = key.startsWith('sit'), hips = rig.hips();
  let turn = 0;
  if (seated) {
    const knees = ['Left', 'Right'].map((s) => rig.root.getObjectByName(`mixamorig${s}Leg`)!.getWorldPosition(new THREE.Vector3()));
    const ahead = knees[0].add(knees[1]).multiplyScalar(0.5).sub(hips);
    turn = Math.atan2(ahead.x, ahead.z);
  }
  rig.root.position.set(at.x, at.y + (seated ? seat - hips.y + 0.06 : 0), at.z);
  rig.root.rotation.y = yaw - turn;
  if (seated) {
    rig.root.updateMatrixWorld(true);
    const h = rig.hips(), back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-0.08);
    rig.root.position.x += at.x + back.x - h.x;
    rig.root.position.z += at.z + back.z - h.z;
  }
  rig.castShadow = false;
  return rig;
}

/** Called when a bystander (extra, paraglider) is shot; set by the populace. */
export interface Bystanders { onHurt: (p: THREE.Vector3) => void }

/** A seated body going limp in place: the sitting pose freezes, the torso folds forward, the head drops, it leans a little. */
interface Slump { rig: Rig; t: number; bones: [THREE.Object3D, THREE.Quaternion, number, number][]; fold: THREE.Vector3; lean: THREE.Vector3 }

const SLUMP: [string, number, number][] = [['mixamorigSpine', 0.2, 0.06], ['mixamorigSpine1', 0.26, 0.08], ['mixamorigSpine2', 0.2, 0.06], ['mixamorigNeck', 0.3, 0.05], ['mixamorigHead', 0.45, 0.12]];

/** Bends each bone about world axes (so the fold is forward whatever the rig's local bone axes are). */
function slumpStep(s: Slump, dt: number): boolean {
  s.t = Math.min(1, s.t + dt * 1.8);
  const k = 1 - (1 - s.t) ** 3, pq = new THREE.Quaternion(), d = new THREE.Quaternion();
  for (const [bone, base, fwd, lean] of s.bones) {
    bone.quaternion.copy(base);
    bone.parent!.updateWorldMatrix(true, false);
    bone.parent!.getWorldQuaternion(pq);
    d.setFromAxisAngle(s.fold, fwd * k).multiply(new THREE.Quaternion().setFromAxisAngle(s.lean, lean * k));
    bone.quaternion.premultiply(pq.clone().invert().multiply(d).multiply(pq));
  }
  return s.t < 1;
}

/** Static capsule collider on an extra; standing ones play a death clip on the ground, seated ones slump on the seat. */
function shootable(world: RAPIER.World, rig: Rig, floor: number, seated: boolean, hurt: Bystanders, slumps: Slump[], limp: Set<Rig>): void {
  const p = rig.root.position, y = seated ? rig.hips().y : floor + 0.9;
  const col = world.createCollider(RAPIER.ColliderDesc.capsule(seated ? 0.3 : 0.55, 0.32).setTranslation(p.x, y, p.z));
  onHit(col.handle, () => {
    col.setEnabled(false);
    rig.far = false;
    if (seated) {
      rig.dead = true;
      limp.add(rig);
      const bones = SLUMP.flatMap(([n, fwd, lean]) => {
        const o = rig.root.getObjectByName(n);
        return o ? [[o, o.quaternion.clone(), fwd, lean] as [THREE.Object3D, THREE.Quaternion, number, number]] : [];
      });
      const knees = ['Left', 'Right'].map((n) => rig.root.getObjectByName(`mixamorig${n}Leg`)!.getWorldPosition(new THREE.Vector3()));
      const facing = knees[0].add(knees[1]).multiplyScalar(0.5).sub(rig.hips()).setY(0).normalize();
      slumps.push({ rig, t: 0, bones, fold: new THREE.Vector3(0, 1, 0).cross(facing).normalize(), lean: facing.multiplyScalar(Math.random() < 0.5 ? 1 : -1) });
    } else {
      rig.root.position.y = floor;
      rig.die(Math.random() < 0.5 ? 'fall_back' : 'dying');
    }
    hurt.onHurt(new THREE.Vector3(p.x, y, p.z));
  });
}

/** Seated and standing extras (benches, café tables, chats, railing); built a few per frame once characters load; animated only up close. */
export function crowd(seats: { pos: THREE.Vector3; yaw: number }[], standing: Extra[], lighting: Lighting, world: RAPIER.World, hurt: Bystanders): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(12);
  let rigs: Rig[] | null = null, last = 0, prev = performance.now();
  const near = new Set<Rig>(), slumps: Slump[] = [], limp = new Set<Rig>();
  g.add(ticker((camera) => {
    const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    if (!rigs) {
      if (!characters.ready || !characters.clips.has('sit')) return;
      rigs = [];
    }
    for (let n = 0; n < 4 && rigs.length < seats.length + standing.length; n++) {
      const i = rigs.length, seated = i < seats.length, spot = seated ? seats[i] : standing[i - seats.length];
      const x = extra(lighting, r, spot.pos, spot.yaw, seated ? SEATED[Math.floor(r() * SEATED.length)] : (spot as Extra).key);
      x.root.updateMatrixWorld(true);
      shootable(world, x, spot.pos.y, seated, hurt, slumps, limp);
      x.root.visible = false;
      rigs.push(x);
      g.add(x.root);
    }
    for (let i = slumps.length - 1; i >= 0; i--) if (!slumpStep(slumps[i], dt)) slumps.splice(i, 1);
    for (const x of near) if (!limp.has(x)) x.tick(dt);
    if (now - last < 400) return;
    last = now;
    near.clear();
    for (const x of rigs) {
      const d = x.root.position.distanceTo(camera.position);
      x.root.visible = d < 48;
      if (!x.dead) x.far = d > 16;
      if (d < 28) near.add(x);
    }
  }));
  return g;
}

/** Surfers waiting for a set beyond the break, bobbing on the swell. */
export function surfers(count: number, c: CoastDef, lighting: Lighting): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(29), list: { obj: THREE.Group; phase: number }[] = [];
  const boards = ['#f2f0ea', '#f2c230', '#2d6fd1', '#e8462c'].map((col) => lighting.setup(new THREE.MeshStandardMaterial({ color: col, roughness: 0.35 }), `board-${col}`));
  const geo = new THREE.CapsuleGeometry(0.28, 1.6, 4, 10).rotateX(Math.PI / 2).scale(1, 0.18, 1);
  for (let i = 0; i < count; i++) {
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(geo, boards[i % boards.length]));
    obj.position.set((r() - 0.5) * 420, c.sea, c.shore + 30 + r() * 60);
    obj.rotation.y = (r() - 0.5) * 0.8;
    g.add(obj);
    list.push({ obj, phase: r() * 6.28 });
  }
  const boardsGroup = g.clone(false);
  boardsGroup.add(...g.children);
  boardsGroup.visible = false;
  g.add(boardsGroup);
  let seated = false;
  g.add(ticker(() => {
    if (!seated && characters.ready) {
      seated = true;
      boardsGroup.visible = characters.clips.has('sit');
      if (!boardsGroup.visible) return;
      for (const s of list) {
        const rig = extra(lighting, r, new THREE.Vector3(0, 0, -0.2), 0, 'sit', 0.12);
        rig.far = true;
        s.obj.add(rig.root);
      }
    }
    const t = performance.now() / 1000;
    for (const s of list) {
      s.obj.position.y = c.sea + Math.sin(t * 1.1 + s.phase) * 0.3;
      s.obj.rotation.x = Math.sin(t * 1.1 + s.phase + 1) * 0.08;
    }
  }));
  return g;
}
