import * as THREE from 'three';
import type { Builder } from './buildingKit';
import type { Heightfield } from './heightfield';
import type { DoorDef } from './doors';
import type { ParkedSpot } from './parkedCars';
import type { SceneLife } from './streetScenes';
import { sweep, wash, Kickabout } from './neighborActs';
import { addWetSpot } from './puddles';

const UP = new THREE.Vector3(0, 1, 0);

/** Losa deportiva: a concrete slab with faded court lines and two small goals of welded pipe. */
function losa(b: Builder, hf: Heightfield, c: THREE.Vector3): THREE.Vector3[] {
  const q = new THREE.Quaternion(), L = 20, W = 11, hs: number[] = [];
  for (let i = -1; i <= 1; i += 0.5) for (let j = -1; j <= 1; j += 0.5) hs.push(hf.heightAt(c.x + (i * L) / 2, c.z + (j * W) / 2));
  const top = Math.max(...hs) + 0.16, low = Math.min(...hs) - 0.3, y = top - 0.08;
  b.box('concrete', [L, top - low, W], new THREE.Vector3(c.x, (top + low) / 2, c.z), q, true);
  const line = (w: number, d: number, x: number, z: number) => b.box('roadFaded', [w, 0.01, d], new THREE.Vector3(c.x + x, y + 0.085, c.z + z), q, false);
  for (const s of [-1, 1]) [line(L, 0.08, 0, s * W / 2 * 0.95), line(0.08, W * 0.95, s * L / 2 * 0.95, 0)];
  line(0.08, W * 0.95, 0, 0);
  for (const s of [-1, 1]) {
    const gx = c.x + s * (L / 2 - 0.4);
    for (const z of [-1.5, 1.5]) b.box('bars', [0.07, 1.2, 0.07], new THREE.Vector3(gx, y + 0.68, c.z + z), q, true);
    b.box('bars', [0.07, 0.07, 3.07], new THREE.Vector3(gx, y + 1.28, c.z), q, false);
  }
  return [[-6, -2.5], [-5.5, 2.8], [-1.5, 0.5], [2, -3], [3, 2.6], [6.5, 0]].map(([x, z]) => new THREE.Vector3(c.x + x, y + 0.08, c.z + z));
}

/**
 * Neighbours going about their day (cap. 1): a woman leaning in her doorway, someone sweeping the pavement in front
 * of their house, a man washing his parked car (bucket, wet patch, sponge), and a kick-about on a concrete court.
 * People are crowd extras (shootable, they flee); returns the props that live outside the extras (balls, buckets).
 */
export function neighborScenes(b: Builder, hf: Heightfield, life: SceneLife, doors: DoorDef[], parked: ParkedSpot[], courts: [number, number][], rand: () => number): THREE.Group {
  const props = new THREE.Group();
  const front = doors.filter(() => rand() < 0.14);
  front.forEach((d, i) => {
    const out = new THREE.Vector3(Math.sin(d.yaw), 0, Math.cos(d.yaw)), centre = d.hinge.clone().add(new THREE.Vector3(d.w / 2, 0, 0).applyAxisAngle(UP, d.yaw));
    if (i % 3 === 0) {
      const p = centre.addScaledVector(out, 0.35);
      life.standing.push({ pos: p.setY(hf.heightAt(p.x, p.z)), yaw: d.yaw + (rand() - 0.5) * 0.6, key: 'civ_idle' });
    } else {
      const p = centre.addScaledVector(out, 1.3 + rand() * 0.8).add(new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5));
      life.standing.push({ pos: p.setY(hf.heightAt(p.x, p.z)), yaw: rand() * Math.PI * 2, key: 'civ_idle', act: sweep });
    }
  });
  const cars = parked.filter((s) => (s.kind === 'sedan' || s.kind === 'tico' || s.kind === 'wagon') && rand() < 0.12).slice(0, 6);
  const bucketMat = new THREE.MeshStandardMaterial({ color: '#2f6fb8', roughness: 0.5 });
  for (const s of cars) {
    const side = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw)).multiplyScalar(rand() < 0.5 ? 1 : -1);
    const p = s.pos.clone().addScaledVector(side, 1.55).add(new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar((rand() - 0.5) * 1.6));
    p.y = hf.heightAt(p.x, p.z);
    life.standing.push({ pos: p.clone(), yaw: Math.atan2(-side.x, -side.z), key: 'civ_idle', act: (r) => wash(r, 0.6) });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 14), bucketMat);
    bucket.position.copy(p).addScaledVector(side, 0.55).setY(p.y + 0.15);
    bucket.castShadow = true;
    props.add(bucket);
    addWetSpot(p.clone().addScaledVector(side, -0.6), 1.8 + rand() * 0.8);
  }
  for (const [x, z] of courts) {
    const spots = losa(b, hf, new THREE.Vector3(x, 0, z)), game = new Kickabout(spots);
    props.add(game.ball);
    spots.forEach((p) => life.standing.push({ pos: p.clone(), yaw: 0, key: rand() < 0.5 ? 'civ_idle' : 'look_around', act: (r) => game.join(r) }));
  }
  return props;
}
