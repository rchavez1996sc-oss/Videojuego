import * as THREE from 'three';
import { twoBoneIk } from '../entities/handIk';
import type { Rig } from '../entities/rig';

const MAT = {
  wood: new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.8 }),
  bristle: new THREE.MeshStandardMaterial({ color: '#c9a64a', roughness: 0.95 }),
  sponge: new THREE.MeshStandardMaterial({ color: '#e8d23a', roughness: 0.9 }),
};

/** Runs `step(dt, t)` after every mixer update of this extra (the crowd only ticks extras near the camera). */
function onTick(rig: Rig, step: (dt: number, t: number) => void): void {
  const tick = rig.tick.bind(rig);
  let t = Math.random() * 10;
  rig.tick = (dt: number) => {
    tick(dt);
    t += dt;
    rig.root.updateMatrixWorld(true);
    step(dt, t);
  };
}

const arm = (rig: Rig, side: 'Left' | 'Right') => ['Arm', 'ForeArm', 'Hand'].map((n) => rig.bones.get(`mixamorig${side}${n}`)!);
const W = new THREE.Vector3();

/** Sweeping the pavement: a broom swung left and right in front, both hands on the handle. */
export function sweep(rig: Rig): void {
  const broom = new THREE.Group();
  broom.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.25, 6).translate(0, 0.625, 0), MAT.wood));
  broom.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06).translate(0, -0.03, 0), MAT.bristle));
  rig.root.add(broom);
  const [ra, rf, rh] = arm(rig, 'Right'), [la, lf, lh] = arm(rig, 'Left');
  if (!ra || !la) return;
  onTick(rig, (_dt, t) => {
    const a = Math.sin(t * 2.3) * 0.55, foot = new THREE.Vector3(0.12 + Math.sin(a) * 0.45, 0.04, 0.72), top = new THREE.Vector3(0.18, 1.12, 0.22);
    broom.position.copy(foot);
    broom.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    twoBoneIk(ra, rf, rh, rig.root.localToWorld(W.copy(foot).lerp(top, 0.62)), 1);
    rf.updateMatrixWorld(true);
    twoBoneIk(la, lf, lh, rig.root.localToWorld(W.copy(foot).lerp(top, 0.92)), 1);
  });
}

/** Washing a car: the right hand scrubs circles on the bodywork in front with a sponge; the left rests on the roof line. */
export function wash(rig: Rig, reach = 0.62): void {
  const [ra, rf, rh] = arm(rig, 'Right'), [la, lf, lh] = arm(rig, 'Left');
  if (!ra || !la) return;
  rh.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.08).translate(0, 0.08, 0.02), MAT.sponge));
  onTick(rig, (_dt, t) => {
    const s = t * 3.1, base = 0.95 + Math.sin(t * 0.37) * 0.15;
    twoBoneIk(ra, rf, rh, rig.root.localToWorld(W.set(-0.15 + Math.cos(s) * 0.16, base + Math.sin(s) * 0.12, reach)), 1);
    rf.updateMatrixWorld(true);
    twoBoneIk(la, lf, lh, rig.root.localToWorld(W.set(0.32, 1.25, reach - 0.05)), 0.85);
  });
}

/** A kick-about: the ball arcs from player to player; everyone turns to follow it; one ball per game. */
export class Kickabout {
  readonly ball: THREE.Mesh;
  private players: Rig[] = [];
  private from = 0;
  private to = 1;
  private t = 0;

  constructor(private spots: THREE.Vector3[]) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f2f2ee';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#1b1b1d';
    for (let k = 0; k < 10; k++) [g.beginPath(), g.arc((k * 29) % 128, (k * 17) % 64, 8, 0, 7), g.fill()];
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.5 }));
    this.ball.castShadow = true;
    this.ball.position.copy(spots[0]).setY(spots[0].y + 0.11);
  }

  join(rig: Rig): void {
    const i = this.players.push(rig) - 1;
    onTick(rig, (dt) => {
      if (i === 0) this.roll(dt);
      const p = rig.root.position, want = Math.atan2(this.ball.position.x - p.x, this.ball.position.z - p.z);
      rig.root.rotation.y += Math.atan2(Math.sin(want - rig.root.rotation.y), Math.cos(want - rig.root.rotation.y)) * Math.min(1, dt * 4);
    });
  }

  private roll(dt: number): void {
    const a = this.spots[this.from], b = this.spots[this.to], d = a.distanceTo(b), dur = 0.5 + d * 0.09;
    this.t += dt / dur;
    if (this.t >= 1) {
      this.t = 0;
      this.from = this.to;
      do this.to = Math.floor(Math.random() * this.spots.length); while (this.to === this.from);
      return;
    }
    const lob = d > 7 && (this.from + this.to) % 2 === 0 ? d * 0.18 : 0.05;
    this.ball.position.lerpVectors(a, b, this.t).setY(THREE.MathUtils.lerp(a.y, b.y, this.t) + 0.11 + Math.sin(this.t * Math.PI) * lob);
    this.ball.rotation.x += dt * 12;
  }
}
