import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../../render/lighting';

/** A gate leaf: hinge on the ground, closed direction (world, unit, horizontal), width, height, look. */
export interface LeafDef { hinge: THREE.Vector3; dir: THREE.Vector3; w: number; h: number; look: 'chevron' | 'bars' }

const UP = new THREE.Vector3(0, 1, 0), OPEN = 1.65, PUSH = 2.6, SETTLE = 0.25;

/** Black wrought-iron infill on transparent ground: nested chevrons (Puerta 1 leaves) or plain bars. */
function leafTexture(look: LeafDef['look']): THREE.CanvasTexture {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#141414';
  g.lineWidth = 7;
  g.strokeRect(4, 4, S - 8, S - 8);
  g.lineWidth = 4;
  if (look === 'bars') for (let x = 16; x < S; x += 18) g.strokeRect(x, 0, 0.5, S);
  else for (let k = -S; k < S * 2; k += 26) {
    g.beginPath();
    g.moveTo(0, k);
    g.lineTo(S / 2, k + S / 2);
    g.lineTo(S, k);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

interface Leaf { def: LeafDef; pivot: THREE.Group; body: RAPIER.RigidBody; base: number; angle: number }

/** Iron gate leaves that swing on their hinges when someone walks into them (player, squad, police, passers-by) and slowly fall closed. */
export class SwingGates {
  readonly group = new THREE.Group();
  private leaves: Leaf[] = [];
  private q = new THREE.Quaternion();

  constructor(defs: LeafDef[], world: RAPIER.World, lighting: Lighting) {
    const mats = { chevron: leafTexture('chevron'), bars: leafTexture('bars') };
    const mat = (look: LeafDef['look']) => lighting.setup(new THREE.MeshStandardMaterial({ map: mats[look], alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.55 }), `gate-${look}`);
    const shared = { chevron: mat('chevron'), bars: mat('bars') }, frame = lighting.setup(new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.5, metalness: 0.5 }), 'gate-frame');
    for (const d of defs) {
      const pivot = new THREE.Group(), base = Math.atan2(-d.dir.z, d.dir.x);
      pivot.position.copy(d.hinge);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), shared[d.look]);
      panel.position.set(d.w / 2, d.h / 2 + 0.05, 0);
      panel.castShadow = true;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, d.h + 0.1, 0.08), frame);
      post.position.set(0.04, d.h / 2 + 0.05, 0);
      pivot.add(panel, post);
      pivot.rotation.y = base;
      this.group.add(pivot);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(d.hinge.x, d.hinge.y, d.hinge.z).setRotation(this.q.setFromAxisAngle(UP, base)));
      world.createCollider(RAPIER.ColliderDesc.cuboid(d.w / 2 - 0.05, d.h / 2, 0.06).setTranslation(d.w / 2, d.h / 2 + 0.05, 0), body);
      this.leaves.push({ def: d, pivot, body, base, angle: 0 });
    }
  }

  /** `movers`: feet positions of everyone who can push. */
  update(dt: number, movers: THREE.Vector3[]): void {
    for (const l of this.leaves) {
      const a = l.base + l.angle, dx = Math.cos(a), dz = -Math.sin(a), h = l.def.hinge;
      let push = 0, near = false;
      for (const p of movers) {
        const rx = p.x - h.x, rz = p.z - h.z;
        if (Math.abs(p.y - h.y) > 2.2 || rx * rx + rz * rz > (l.def.w + 1.2) ** 2) continue;
        near = true;
        const u = rx * dx + rz * dz, v = rx * -dz + rz * dx;
        if (u > 0.1 && u < l.def.w + 0.15 && Math.abs(v) < 0.7) push += v > 0 ? 1 : -1;
      }
      if (push) l.angle = THREE.MathUtils.clamp(l.angle + Math.sign(push) * PUSH * dt, -OPEN, OPEN);
      else if (!near) l.angle -= Math.sign(l.angle) * Math.min(Math.abs(l.angle), SETTLE * dt);
      l.pivot.rotation.y = l.base + l.angle;
      l.body.setNextKinematicRotation(this.q.setFromAxisAngle(UP, l.base + l.angle));
    }
  }
}
