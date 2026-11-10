import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Lighting } from '../render/lighting';
import { PoliceTruck, vehicleMats } from '../entities/policeTruck';

/** Where people died, and when (filled by `Enemy.die`). */
export const deaths: { at: THREE.Vector3; t: number }[] = [];
export const clock = { now: 0 };

function tapeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2c814';
  g.fillRect(0, 0, 512, 32);
  g.fillStyle = '#141414';
  g.font = '800 20px "Barlow Condensed", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('POLICÍA · NO PASAR · POLICÍA · NO PASAR ·', 6, 17);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * After a fight dies down, the police come back for their dead: where bodies lie (≥ 25 s ago, no shooting for 30 s,
 * the player > 45 m away) a ring of stands strung with yellow POLICÍA · NO PASAR tape goes up around them, with a PNP
 * pickup parked beside it, its light bar flashing red and blue. At most 4 scenes per level.
 */
export class Cordons {
  readonly group = new THREE.Group();
  private done: THREE.Vector3[] = [];
  private check = 3;
  private mats: Record<string, THREE.Material>;
  private tape: THREE.Material;
  private stand: THREE.Material;
  private bars: THREE.MeshStandardMaterial[];
  calmSince = 0;

  constructor(lighting: Lighting, private world: RAPIER.World, private ground: (x: number, z: number) => number) {
    this.mats = vehicleMats(lighting);
    this.mats.red = (this.mats.red as THREE.MeshStandardMaterial).clone();
    this.mats.blue = (this.mats.blue as THREE.MeshStandardMaterial).clone();
    this.bars = [this.mats.red as THREE.MeshStandardMaterial, this.mats.blue as THREE.MeshStandardMaterial];
    this.tape = new THREE.MeshStandardMaterial({ map: tapeTexture(), roughness: 0.6, side: THREE.DoubleSide });
    this.stand = lighting.setup(new THREE.MeshStandardMaterial({ color: '#d8d6cf', roughness: 0.5, metalness: 0.4 }), 'cordon-stand');
  }

  update(dt: number, camera: THREE.Vector3): void {
    clock.now += dt;
    const blink = Math.floor(clock.now * 3) % 2;
    this.bars.forEach((m, i) => (m.emissiveIntensity = (i === blink ? 4 : 0.3)));
    if ((this.check -= dt) > 0 || this.done.length >= 4) return;
    this.check = 3;
    if (clock.now - this.calmSince < 30) return;
    const old = deaths.filter((d) => clock.now - d.t > 25 && !this.done.some((c) => c.distanceTo(d.at) < 18));
    if (!old.length) return;
    const near = old.filter((d) => d.at.distanceTo(old[0].at) < 15), centre = near.reduce((s, d) => s.add(d.at), new THREE.Vector3()).divideScalar(near.length);
    if (centre.distanceTo(camera) < 45) return;
    this.done.push(centre);
    const r = Math.max(3.5, ...near.map((d) => d.at.distanceTo(centre) + 2.2));
    this.build(centre, r);
  }

  private build(c: THREE.Vector3, r: number): void {
    const posts: THREE.Vector3[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3, x = c.x + Math.cos(a) * r * (0.9 + Math.random() * 0.2), z = c.z + Math.sin(a) * r * (0.9 + Math.random() * 0.2);
      posts.push(new THREE.Vector3(x, this.ground(x, z), z));
    }
    for (const p of posts) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6).translate(0, 0.5, 0), this.stand);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 12).translate(0, 0.025, 0), this.stand);
      s.position.copy(p);
      base.position.copy(p);
      s.castShadow = true;
      this.group.add(s, base);
    }
    posts.forEach((p, k) => {
      const q = posts[(k + 1) % posts.length], len = p.distanceTo(q), geo = new THREE.PlaneGeometry(len, 0.075, 8, 1);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) [pos.setY(i, pos.getY(i) - 0.06 * (1 - (2 * pos.getX(i) / len) ** 2)), uv.setX(i, uv.getX(i) * len / 3.2)];
      const m = new THREE.Mesh(geo, this.tape);
      m.position.copy(p).lerp(q, 0.5).setY((p.y + q.y) / 2 + 0.95);
      m.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
      this.group.add(m);
    });
    const out = c.clone().setY(0).normalize(), side = new THREE.Vector3(-out.z, 0, out.x);
    const at = c.clone().addScaledVector(side, r + 3.2);
    at.y = this.ground(at.x, at.z);
    const truck = new PoliceTruck(this.mats, [at, at.clone().addScaledVector(out, 0.2)], this.world);
    for (let i = 0; i < 4 && !truck.parked; i++) truck.update(0.5);
    this.group.add(truck.group);
  }
}
