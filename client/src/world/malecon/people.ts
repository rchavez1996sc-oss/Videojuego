import * as THREE from 'three';
import { mulberry32 } from '../../core/rng';
import type { Lighting } from '../../render/lighting';
import { Rig } from '../../entities/rig';
import { characters, type CharKind } from '../../render/characters';
import type { CoastDef } from '../coast';

const KINDS: CharKind[] = ['civ_a', 'civ_b', 'civ_c'];

/** Invisible mesh whose onBeforeRender drives per-frame work of static decor (no hook in the game loop needed). */
function ticker(tick: (camera: THREE.Camera) => void): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  m.frustumCulled = false;
  m.onBeforeRender = (_r, _s, camera) => tick(camera);
  return m;
}

/** A Mixamo civilian frozen in a seated pose, hips `seat` metres above `at`. */
function sitter(lighting: Lighting, rand: () => number, at: THREE.Vector3, yaw: number, seat: number): Rig {
  const rig = new Rig(KINDS[Math.floor(rand() * KINDS.length)], lighting, false);
  rig.sit();
  rig.root.updateMatrixWorld(true);
  const hips = rig.hips().y;
  rig.root.position.set(at.x, at.y + seat - hips + 0.06, at.z);
  rig.root.rotation.y = yaw;
  rig.castShadow = false;
  return rig;
}

/** People sitting on benches and at café tables (needs the Mixamo `sit` clip); built once the characters have loaded, near/far LOD by camera distance. */
export function seatedCrowd(seats: { pos: THREE.Vector3; yaw: number }[], lighting: Lighting): THREE.Group {
  const g = new THREE.Group(), r = mulberry32(12);
  let rigs: Rig[] | null = null, last = 0;
  g.add(ticker((camera) => {
    if (!rigs) {
      if (!characters.ready) return;
      rigs = !characters.clips.has('sit') ? [] : seats.map((s) => sitter(lighting, r, s.pos, s.yaw, 0.47));
      if (rigs.length) g.add(...rigs.map((x) => x.root));
    }
    const now = performance.now();
    if (now - last < 400) return;
    last = now;
    for (const x of rigs) {
      const d = x.root.position.distanceTo(camera.position);
      x.root.visible = d < 70;
      x.far = d > 22;
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
        const rig = sitter(lighting, r, new THREE.Vector3(0, 0, -0.2), 0, 0.12);
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
