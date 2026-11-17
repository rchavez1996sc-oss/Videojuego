import * as THREE from 'three';
import type { Builder } from '../buildingKit';
import type { Heightfield } from '../heightfield';
import type { Lighting } from '../../render/lighting';
import { edgeZ, ravineCentre, ravineFloor, ravineHalf, type CoastDef } from '../coast';
import { ribbon, bench, type Plants } from '../malecon/park';
import { globeLamp } from './bridge';
import { muralSpan, ravineOf, type BarrancoDef } from './layout';

const UP = new THREE.Vector3(0, 1, 0);

/** Box from a to c, `w` wide and `h` tall, aligned with the line between them. */
function run(b: Builder, mat: string, a: THREE.Vector3, c: THREE.Vector3, w: number, h: number, collide = true): void {
  const d = c.clone().sub(a), len = d.length();
  b.box(mat, [w, h, len + 0.05], a.clone().lerp(c, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), collide);
}

/** Street-art vault: a sun, faces in profile, birds and the lettering over the arch (canvas). */
function muralTexture(): THREE.CanvasTexture {
  const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 512 }), g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 1024, 0);
  ['#f5c518', '#ef6c2f', '#d6246e', '#5a2d91', '#1f7fd1', '#20a67a'].forEach((col, i) => sky.addColorStop(i / 5, col));
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  const rnd = (() => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 14; i++) {
    g.fillStyle = ['#1c1c3c', '#f6e7c8', '#b8327a', '#2b9c5a', '#f2a03d'][i % 5];
    g.beginPath(); g.ellipse(rnd() * 1024, 220 + rnd() * 260, 40 + rnd() * 70, 60 + rnd() * 90, rnd() * 3, 0, 7); g.fill();
  }
  g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(512, 300, 120, 0, 7); g.fill();
  g.strokeStyle = '#ffd23a'; g.lineWidth = 10;
  for (let a = 0; a < 16; a++) { g.beginPath(); g.moveTo(512 + Math.cos(a / 2.55) * 140, 300 + Math.sin(a / 2.55) * 140); g.lineTo(512 + Math.cos(a / 2.55) * 200, 300 + Math.sin(a / 2.55) * 200); g.stroke(); }
  g.fillStyle = '#ffe14a'; g.fillRect(0, 0, 1024, 120);
  g.fillStyle = '#d7263d'; g.font = 'italic 800 74px "Permanent Marker", "Barlow Condensed", Arial'; g.textAlign = 'center';
  g.fillText('Hagamos un Perú que nos dé gusto', 512, 88, 980);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The Bajada de Baños (from the photos): a cobbled lane down the ravine floor between ochre walls, green four-globe
 * lamps, stone stairs up the planted banks, artisans' white stalls in the upper stretch, benches and trees, and the
 * street bridge whose vault is painted end to end. Returns the textured meshes (the vault mural).
 */
export function bajadaDeBanos(b: Builder, hf: Heightfield, def: BarrancoDef, c: CoastDef, plants: Plants, lighting: Lighting): THREE.Object3D {
  const r = ravineOf(c), mouth = edgeZ(c, r.x) + c.run, half = (r.floorHalf ?? 4) - 0.2, end = def.beachRoad.z - def.beachRoad.half;
  const centre: THREE.Vector2[] = [];
  for (let z = r.head - 8; z <= end; z += 1.5) centre.push(new THREE.Vector2(ravineCentre(r, Math.min(Math.max(z, r.head), mouth)), z));
  ribbon(b, hf, centre, half * 2, 'cobble', 0.1);
  for (const s of [-1, 1]) ribbon(b, hf, centre.map((p) => new THREE.Vector2(p.x + s * (half - 0.15), p.y)), 0.3, 'stairStone', 0.16);
  const group = new THREE.Group(), m = muralSpan(c, def);
  for (let z = r.head + 2, i = 0; z < mouth - 3; z += 4, i++) {
    const zn = z + 4, f = ravineFloor(c, r, z), fn = ravineFloor(c, r, zn);
    if (Math.abs(z - m.z) < def.mural.half + 3) continue;
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(ravineCentre(r, z) + s * (half + 0.35), f + 0.9, z), e = new THREE.Vector3(ravineCentre(r, zn) + s * (half + 0.35), fn + 0.9, zn);
      run(b, 'ochreWall', a.clone().setY(f + 0.4), e.clone().setY(fn + 0.4), 0.45, 2.4);
      run(b, 'creamCornice', a.clone().setY(f + 1.65), e.clone().setY(fn + 1.65), 0.6, 0.1, false);
      if (i % 3 === 1 && s === (i % 6 === 1 ? 1 : -1)) globeLamp(b, new THREE.Vector3(a.x - s * 0.7, f + 0.1, z));
      if (i % 7 === 4) bench(b, new THREE.Vector3(a.x - s * 0.9, f + 0.1, z + 1), s > 0 ? -Math.PI / 2 : Math.PI / 2);
      if (i % 7 === 4) plants.seats.push({ pos: new THREE.Vector3(a.x - s * 0.9, f + 0.55, z + 1), yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
      const bank = ravineHalf(c, r, z) - 2.5;
      if (i % 3 === s + 1) (i % 2 ? plants.trees : plants.palms).push(new THREE.Vector3(ravineCentre(r, z) + s * bank, hf.heightAt(ravineCentre(r, z) + s * bank, z), z));
      else if (bank > half + 3) {
        const bx = ravineCentre(r, z) + s * (half + 1.6 + (bank - half - 1.6) * ((i * 7) % 5) / 5), by = hf.heightAt(bx, z + 2);
        for (let k = 0; k < 6; k++) {
          const r0 = 0.35 + ((i * 3 + k * 5) % 7) * 0.08, ox = Math.sin(k * 2.4 + i) * 0.9, oz = Math.cos(k * 1.7 + i) * 1.1;
          b.geometry(k % 3 ? 'shrub' : 'hedge', new THREE.IcosahedronGeometry(r0, 1), new THREE.Matrix4().compose(new THREE.Vector3(bx + ox, hf.heightAt(bx + ox, z + 2 + oz) + r0 * 0.5, z + 2 + oz), new THREE.Quaternion().setFromEuler(new THREE.Euler(k, i, 0)), new THREE.Vector3(1.2, 0.8, 1.1)));
        }
        if (i % 2) plants.trees.push(new THREE.Vector3(bx, by, z - 1));
      }
    }
    if (z < def.bridge.z - 4 && i % 2 === 0) stall(b, new THREE.Vector3(ravineCentre(r, z) + (i % 4 ? 1 : -1) * (half - 1.2), f + 0.1, z), i % 4 ? -1 : 1, plants, i);
  }
  for (const [zs, s] of [[def.bridge.z - 9, 1], [def.bridge.z + 7, -1], [def.bridge.z + 26, 1], [def.bridge.z - 22, -1]] as const) stairs(b, hf, c, zs, s);
  group.add(muralVault(b, def, c, lighting));
  return group;
}

/** Artisan's stall: white canopy on four poles over a cloth-covered table, a vendor behind it. */
function stall(b: Builder, at: THREE.Vector3, side: number, plants: Plants, i: number): void {
  for (const [x, z] of [[-0.9, -1.2], [0.9, -1.2], [-0.9, 1.2], [0.9, 1.2]]) b.box('alu', [0.05, 2.2, 0.05], at.clone().add(new THREE.Vector3(x, 1.1, z)), new THREE.Quaternion(), false);
  b.box('tentWhite', [2.0, 0.06, 2.6], at.clone().add(new THREE.Vector3(0, 2.25, 0)), new THREE.Quaternion(), false);
  b.box(['awningRed', 'trimBlue', 'trimGreen'][i % 3], [1.6, 0.8, 2.2], at.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Quaternion());
  plants.standing.push({ pos: at.clone().add(new THREE.Vector3(side * -1.3, 0, 0)), yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, key: i % 3 ? 'civ_idle' : 'texting' });
}

/** Stone stairway up a bank from the floor to the plateau: treads with an invisible ramp, green handrail. */
function stairs(b: Builder, hf: Heightfield, c: CoastDef, z: number, side: number): void {
  const r = ravineOf(c), cx = ravineCentre(r, z), f = ravineFloor(c, r, z), from = (r.floorHalf ?? 4) + 0.6, to = ravineHalf(c, r, z) + 0.6;
  const a = new THREE.Vector3(cx + side * from, f + 0.1, z), e = new THREE.Vector3(cx + side * to, hf.heightAt(cx + side * to, z), z);
  const steps = Math.max(3, Math.round((e.y - a.y) / 0.17)), q = new THREE.Quaternion().setFromAxisAngle(UP, side > 0 ? Math.PI / 2 : -Math.PI / 2);
  for (let k = 0; k < steps; k++) {
    const t = (k + 0.5) / steps, p = a.clone().lerp(e, t), h = (e.y - a.y) / steps;
    b.box('stairStone', [1.8, h + 0.4, (to - from) / steps + 0.02], new THREE.Vector3(p.x, p.y - 0.2, z), q, false);
  }
  run(b, 'none', a.clone().add(new THREE.Vector3(0, -0.15, 0)), e.clone().add(new THREE.Vector3(0, -0.15, 0)), 1.8, 0.3);
  for (const s of [-1, 1]) run(b, 'lampPole', a.clone().add(new THREE.Vector3(0, 0.95, s * 1.0)), e.clone().add(new THREE.Vector3(0, 0.95, s * 1.0)), 0.06, 0.06, false);
}

/** Street bridge over the bajada: deck at street level on two ochre abutments, the painted barrel vault below. */
function muralVault(b: Builder, def: BarrancoDef, c: CoastDef, lighting: Lighting): THREE.Object3D {
  const r = ravineOf(c), m = muralSpan(c, def), f = ravineFloor(c, r, m.z), half = (r.floorHalf ?? 4) + 0.4, D = def.mural.half * 2 + 3;
  const cx = ravineCentre(r, m.z), rise = Math.min(half + 0.6, -f - 1.2);
  b.box('asphalt', [m.x1 - m.x0, 0.6, D], new THREE.Vector3((m.x0 + m.x1) / 2, -0.15, m.z), new THREE.Quaternion());
  for (const s of [-1, 1]) {
    b.box('ochreWall', [Math.max(0.6, (m.x1 - m.x0) / 2 - half), -f + 0.2, D], new THREE.Vector3(cx + s * ((m.x1 - m.x0) / 4 + half / 2), f / 2 - 0.1, m.z), new THREE.Quaternion());
    for (const e of [-1, 1]) b.box('trimWhite', [m.x1 - m.x0, 1.0, 0.25], new THREE.Vector3((m.x0 + m.x1) / 2, 0.6, m.z + e * (D / 2 - 0.12)), new THREE.Quaternion());
    b.box('ochreWall', [half * 2, -f - rise, 0.5], new THREE.Vector3(cx, f + rise + (-f - rise) / 2, m.z + s * (D / 2 - 0.25)), new THREE.Quaternion());
  }
  const vault = new THREE.CylinderGeometry(half, half, D, 24, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  vault.scale(1, rise / half, 1);
  vault.translate(cx, f + 0.1, m.z);
  const mat = lighting.setup(new THREE.MeshStandardMaterial({ map: muralTexture(), side: THREE.BackSide, roughness: 0.85 }), 'mural-vault');
  const mesh = new THREE.Mesh(vault, mat);
  mesh.receiveShadow = true;
  return mesh;
}
