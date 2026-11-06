import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';

/** A hinged door: hinge at floor level on one jamb, `yaw` = facing of the wall (door closes along its +x), width, height, look. */
export interface DoorDef { hinge: THREE.Vector3; yaw: number; w: number; h: number; look: 'wood' | 'red' | 'metal' }

/** Doors registered while a level is built (houses add theirs); `Doors` takes them over. */
export const doorDefs: DoorDef[] = [];

const T = 0.05, REACH = 1.5, SWING = 1.75, LOOKS = { wood: '#6b4a2e', red: '#8e1b14', metal: '#5b6066' };

interface Door { def: DoorDef; angle: number; target: number; col: RAPIER.Collider; inst: number; mesh: THREE.InstancedMesh; centre: THREE.Vector3 }

/**
 * Doors that open and close with E (the nearest within reach of the player): the leaf swings ~100° away
 * from whoever opens it, its collider turns with it, and it never swings through the player. One instanced mesh per look.
 */
export class Doors {
  readonly group = new THREE.Group();
  readonly list: Door[] = [];
  private prompt = document.createElement('div');
  private want = false;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();

  constructor(defs: DoorDef[], lighting: Lighting, world: RAPIER.World) {
    const geo = new THREE.BoxGeometry(1, 1, T).translate(0.5, 0.5, 0);
    for (const look of Object.keys(LOOKS) as DoorDef['look'][]) {
      const mine = defs.filter((d) => d.look === look);
      if (!mine.length) continue;
      const mat = lighting.setup(new THREE.MeshStandardMaterial({ color: LOOKS[look], roughness: look === 'metal' ? 0.45 : 0.7, metalness: look === 'metal' ? 0.6 : 0 }), `door-${look}`);
      const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      mesh.castShadow = mesh.receiveShadow = true;
      mine.forEach((def, inst) => {
        const col = world.createCollider(RAPIER.ColliderDesc.cuboid(def.w / 2, def.h / 2, T / 2));
        const centre = new THREE.Vector3(def.w / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.yaw).add(def.hinge);
        const d: Door = { def, angle: 0, target: 0, col, inst, mesh, centre };
        this.list.push(d);
        this.pose(d);
      });
      this.group.add(mesh);
    }
    this.prompt.className = 'prompt';
    this.prompt.style.opacity = '0';
    document.body.append(this.prompt);
    addEventListener('keydown', (e) => e.code === 'KeyE' && !e.repeat && document.pointerLockElement && (this.want = true));
    if (location.search.includes('shot')) Object.assign(window, { __doors: this });
  }

  private pose(d: Door): void {
    const { hinge, yaw, w, h } = d.def, a = yaw + d.angle;
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    d.mesh.setMatrixAt(d.inst, this.m.compose(hinge, this.q, new THREE.Vector3(w, h, 1)));
    d.mesh.instanceMatrix.needsUpdate = true;
    const mid = new THREE.Vector3(w / 2, h / 2, 0).applyQuaternion(this.q).add(hinge);
    d.col.setTranslation(mid);
    d.col.setRotation(this.q);
  }

  /** `player`: feet of the one who can open doors. */
  tick(dt: number, player: THREE.Vector3): void {
    let near: Door | null = null, best = REACH;
    for (const d of this.list) {
      const dist = Math.hypot(d.centre.x - player.x, d.centre.z - player.z);
      if (dist < best && Math.abs(player.y - d.def.hinge.y) < 1.2) [near, best] = [d, dist];
    }
    this.prompt.style.opacity = near ? '1' : '0';
    if (near) this.prompt.innerHTML = `<kbd>E</kbd> ${near.target ? 'CERRAR' : 'ABRIR'} PUERTA`;
    if (near && this.want) {
      const n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), near.def.yaw);
      const outside = player.clone().sub(near.def.hinge).dot(n) > 0;
      near.target = near.target ? 0 : outside ? SWING : -SWING;
    }
    this.want = false;
    for (const d of this.list) {
      if (Math.abs(d.angle - d.target) < 1e-3) continue;
      d.angle = THREE.MathUtils.damp(d.angle, d.target, 5, dt);
      if (Math.abs(d.angle - d.target) < 0.01) d.angle = d.target;
      this.pose(d);
    }
  }
}
