import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mulberry32 } from '../core/rng';
import type { Lighting } from '../render/lighting';
import { onHit } from '../world/surfaces';

const COLORS = ['#f2f2ee', '#e8462c', '#2d6fd1', '#f2c230', '#e2e2dc', '#13a37a'];
const WING_HITS = 3;

interface Flier {
  obj: THREE.Group; wing: THREE.Mesh; pilot: THREE.Mesh; lines: THREE.LineSegments; x: number; span: number; z: number; y: number; speed: number; phase: number;
  body: RAPIER.RigidBody; hits: number; state: 'fly' | 'fall' | 'down'; vy: number; spin: number;
}

/**
 * Paragliders soaring the cliff lift (long figure-eights above the clifftop, wings banking into the turns).
 * They can be shot: a hit on the pilot, or three on the wing, collapses the canopy and they spiral down.
 */
export class Paragliders {
  readonly group = new THREE.Group();
  /** Fires once per glider brought down. */
  onDown: (p: THREE.Vector3) => void = () => {};
  private fliers: Flier[] = [];
  private last = 0;

  constructor(count: number, edge: number, lighting: Lighting, world: RAPIER.World, private ground: (x: number, z: number) => number) {
    const r = mulberry32(61);
    const wingGeo = new THREE.TorusGeometry(4.6, 0.32, 4, 20, Math.PI * 0.8).rotateZ(Math.PI * 0.1).scale(1, 0.42, 3.4);
    const pilotMat = lighting.setup(new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.8 }), 'pg-pilot');
    const lineMat = new THREE.LineBasicMaterial({ color: '#d8d8d8', transparent: true, opacity: 0.5 });
    for (let i = 0; i < count; i++) {
      const obj = new THREE.Group();
      const wing = new THREE.Mesh(wingGeo, lighting.setup(new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], roughness: 0.6, side: THREE.DoubleSide }), `pg-wing${i % COLORS.length}`));
      wing.position.y = 1.2;
      const pilot = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 3, 6).rotateX(1.1), pilotMat);
      pilot.position.y = -5.2;
      const pts = [-4, -2, 2, 4].flatMap((x) => [new THREE.Vector3(0, -4.9, 0), new THREE.Vector3(x, 1.3 + (Math.abs(x) < 3 ? 0.9 : 0), 0)]);
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
      obj.add(wing, pilot, lines);
      obj.traverse((o) => (o.castShadow = o instanceof THREE.Mesh));
      this.group.add(obj);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -80, 0));
      const pilotCol = world.createCollider(RAPIER.ColliderDesc.ball(0.55).setTranslation(0, -5.2, 0), body);
      const wingCol = world.createCollider(RAPIER.ColliderDesc.cuboid(4.4, 0.45, 1.1).setTranslation(0, 2.9, 0), body);
      const f: Flier = { obj, wing, pilot, lines, x: (r() - 0.5) * 300, span: 60 + r() * 90, z: edge + (i % 2 ? 6 + r() * 25 : -40 + r() * 35), y: 22 + r() * 30, speed: 0.04 + r() * 0.03, phase: r() * 6.28, body, hits: 0, state: 'fly', vy: 0, spin: 0 };
      this.fliers.push(f);
      onHit(pilotCol.handle, () => this.collapse(f));
      onHit(wingCol.handle, (_d, p) => {
        this.hole(f, p);
        if (++f.hits >= WING_HITS) this.collapse(f);
        return false;
      });
    }
    const anchor = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    anchor.frustumCulled = false;
    anchor.onBeforeRender = () => this.tick();
    this.group.add(anchor);
  }

  private holeGeo = new THREE.SphereGeometry(0.16, 6, 4);
  private holeMat = new THREE.MeshBasicMaterial({ color: '#111111' });

  /** A torn hole where the bullet went through the canopy. */
  private hole(f: Flier, p: { x: number; y: number; z: number }): void {
    const h = new THREE.Mesh(this.holeGeo, this.holeMat);
    f.obj.updateMatrixWorld(true);
    h.position.copy(f.wing.worldToLocal(new THREE.Vector3(p.x, p.y, p.z)));
    h.scale.set(0.7 + Math.random() * 0.6, 0.5, 0.7 + Math.random() * 0.6);
    f.wing.add(h);
  }

  private collapse(f: Flier): void {
    if (f.state !== 'fly') return;
    f.state = 'fall';
    f.spin = (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random());
    f.wing.scale.set(0.55, 0.6, 0.7);
    f.wing.rotation.z = 0.5;
    this.onDown(f.obj.position.clone());
  }

  private tick(): void {
    const now = performance.now() / 1000, dt = Math.min(0.1, now - (this.last || now));
    this.last = now;
    for (const f of this.fliers) {
      if (f.state === 'down') continue;
      if (f.state === 'fall') {
        f.vy = Math.min(f.vy + 9.8 * dt, 16);
        f.obj.position.y -= f.vy * dt;
        f.obj.rotateY(f.spin * dt);
        f.obj.position.addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(f.obj.quaternion), 6 * dt);
        const floor = this.ground(f.obj.position.x, f.obj.position.z) + 5.5;
        if (f.obj.position.y <= floor) {
          f.obj.position.y = floor - 0.1;
          f.obj.rotation.set(0, f.obj.rotation.y, 0);
          f.pilot.rotation.x = 0.47;
          f.wing.position.set(0, -5.35, -3);
          f.wing.scale.set(0.8, 0.08, 1.4);
          f.wing.rotation.set(0, 0.4, 0);
          f.lines.visible = false;
          f.state = 'down';
        }
      } else {
        const a = now * f.speed + f.phase;
        const vx = Math.cos(a) * f.span, vz = Math.cos(a * 2) * 18;
        f.obj.position.set(f.x + Math.sin(a) * f.span, f.y + Math.sin(a * 0.7) * 6, f.z + Math.sin(a * 2) * 9);
        f.obj.rotation.set(0, Math.atan2(vx, vz), 0);
        f.obj.rotateZ(-Math.sin(a * 2) * 0.25 * Math.sign(vx));
      }
      if (f.state === 'down') f.body.setNextKinematicTranslation({ x: 0, y: -80, z: 0 });
      else {
        f.body.setNextKinematicTranslation(f.obj.position);
        f.body.setNextKinematicRotation(f.obj.quaternion);
      }
    }
  }
}
