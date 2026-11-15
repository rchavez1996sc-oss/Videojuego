import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Builder } from './buildingKit';
import type { Lighting } from '../render/lighting';
import { onHit, setSurface } from './surfaces';
import { lampSpots } from '../render/nightLights';
import { worldFx } from '../fx/worldFx';
import { shotMode } from '../core/settings';

export interface GasStationDef { x: number; brand?: string; w?: number; d?: number }
interface Pump { at: THREE.Vector3; hp: number; burn: number; mesh: number; puffT: number; gone: boolean }

const PUMP: [number, number, number] = [0.85, 1.9, 0.5];

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Sunburst mark + brand name, the fascia and totem artwork (own design in the brand's colours). */
function mark(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ['#ff7a00', '#e8262b', '#ffc20e'].forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r, Math.PI + i * 0.9, Math.PI + i * 0.9 + 0.85);
    g.fill();
  });
}

function fascia(brand: string): THREE.CanvasTexture {
  return canvas(1024, 128, (g) => {
    g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#ff7a00'; g.fillRect(0, 104, 1024, 12);
    g.fillStyle = '#e8262b'; g.fillRect(0, 116, 1024, 12);
    mark(g, 120, 92, 70);
    g.fillStyle = '#e8262b'; g.font = '800 84px "Barlow Condensed", Arial'; g.fillText(brand.toUpperCase(), 210, 90);
  });
}

function totem(brand: string): THREE.CanvasTexture {
  return canvas(256, 1024, (g) => {
    g.fillStyle = '#20242a'; g.fillRect(0, 0, 256, 1024);
    g.fillStyle = '#f6f6f2'; g.fillRect(12, 12, 232, 240);
    mark(g, 128, 160, 90);
    g.fillStyle = '#e8262b'; g.font = '800 54px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.fillText(brand.toUpperCase(), 128, 226, 220);
    [['G-90', '16.49'], ['G-95', '17.89'], ['G-97', '19.29'], ['DB5', '16.99'], ['GLP', '8.49']].forEach(([k, p], i) => {
      const y = 290 + i * 140;
      g.fillStyle = ['#2f9e44', '#e8262b', '#1f5fae', '#f2c230', '#8a8d90'][i]; g.fillRect(12, y, 232, 120);
      g.fillStyle = '#ffffff'; g.font = '700 38px "Barlow Condensed", Arial'; g.textAlign = 'left'; g.fillText(k, 24, y + 46);
      g.fillStyle = '#111'; g.fillRect(24, y + 58, 208, 52);
      g.fillStyle = '#ffb21c'; g.font = '700 48px "Barlow Condensed", Arial'; g.textAlign = 'right'; g.fillText(`S/ ${p}`, 226, y + 102);
    });
  });
}

function pumpFace(): THREE.CanvasTexture {
  return canvas(256, 512, (g) => {
    g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#e8262b'; g.fillRect(0, 0, 256, 70);
    g.fillStyle = '#ff7a00'; g.fillRect(0, 70, 256, 10);
    g.fillStyle = '#15181c'; g.fillRect(28, 110, 200, 120);
    g.fillStyle = '#8ef08a'; g.font = '700 40px monospace'; g.fillText('000.00', 52, 160); g.fillText(' 00.000', 40, 212);
    ['#2f9e44', '#e8262b', '#1f5fae'].forEach((c, i) => { g.fillStyle = c; g.fillRect(28 + i * 70, 260, 60, 60); });
    g.fillStyle = '#9a9ea3'; g.fillRect(0, 380, 256, 132);
    g.fillStyle = 'rgba(60,50,40,0.35)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, 380 + Math.random() * 130, 3 + Math.random() * 18, 2 + Math.random() * 8);
  });
}

/**
 * A fuel station on the avenue (Av. Venezuela on Street View has them both sides): forecourt slab, white canopy with
 * the brand fascia and lights, two islands of pumps, a totem with today's prices, a small shop and walls at the back.
 * Pumps take bullets: a holed pump catches fire, burns a couple of seconds and blows up (real blast), setting off
 * any pump next to it.
 */
export class GasStation {
  readonly group = new THREE.Group();
  readonly lot: { x0: number; x1: number; z0: number; z1: number };
  private pumps: Pump[] = [];
  private mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();

  constructor(b: Builder, world: RAPIER.World, lighting: Lighting, def: GasStationDef, front: number, toward: 1 | -1) {
    const W = def.w ?? 30, D = def.d ?? 22, cx = def.x, Q = new THREE.Quaternion(), brand = def.brand ?? 'Repsol';
    const at = (x: number, y: number, z: number) => new THREE.Vector3(cx + x, y, front + toward * z);
    this.lot = { x0: cx - W / 2, x1: cx + W / 2, z0: Math.min(front, front + toward * D), z1: Math.max(front, front + toward * D) };
    b.box('concrete', [W, 0.1, D], at(0, 0.05, D / 2), Q, true);
    for (const s of [-1, 1]) b.box('brick', [0.25, 2.4, D], at(s * W / 2, 1.2, D / 2), Q, true);
    b.box('brick', [W, 2.4, 0.25], at(0, 1.2, D), Q, true);
    const cz = 8, cw = 16, cd = 10, ch = 5.2;
    for (const [x, z] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) b.box('alu', [0.4, ch, 0.4], at(x, ch / 2, cz + z), Q, true);
    b.box('plate', [cw, 0.7, cd], at(0, ch + 0.35, cz), Q, false);
    for (const x of [-5, -1.7, 1.7, 5]) for (const z of [-2.5, 2.5]) {
      b.box('globe', [1.1, 0.06, 0.5], at(x, ch - 0.02, cz + z), Q, false);
      lampSpots.push(at(x, ch - 0.2, cz + z));
    }
    const fasciaMat = lighting.setup(new THREE.MeshStandardMaterial({ map: fascia(brand), roughness: 0.5 }), 'gas-fascia');
    const faces: THREE.BufferGeometry[] = [];
    for (const [w, x, z, yaw] of [[cw, 0, -cd / 2, Math.PI], [cw, 0, cd / 2, 0], [cd, -cw / 2, 0, -Math.PI / 2], [cd, cw / 2, 0, Math.PI / 2]] as const) {
      const p = at(x, ch + 0.35, cz + z + (z ? Math.sign(z) * 0.01 : 0)).add(new THREE.Vector3(x ? Math.sign(x) * 0.01 : 0, 0, 0));
      faces.push(new THREE.PlaneGeometry(w, 0.7).rotateY(toward > 0 ? yaw : yaw + Math.PI).translate(p.x, p.y, p.z));
    }
    this.group.add(Object.assign(new THREE.Mesh(mergeGeometries(faces)!, fasciaMat), { castShadow: false }));
    for (const z of [-2, 2]) b.box('kerbYellow', [6, 0.2, 1.3], at(0, 0.2, cz + z), Q, true);
    const totemMat = lighting.setup(new THREE.MeshStandardMaterial({ map: totem(brand), roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.08 }), 'gas-totem');
    const tp = at(W / 2 - 2, 0, 1.2);
    b.box('lampPole', [0.3, 2, 0.3], tp.clone().setY(1), Q, true);
    const totemGeo = new THREE.BoxGeometry(1.4, 5.6, 0.35).translate(tp.x, 4.8, tp.z);
    this.group.add(Object.assign(new THREE.Mesh(totemGeo, totemMat), { castShadow: true }));
    b.box('none', [1.4, 5.6, 0.35], tp.clone().setY(4.8), Q, true);
    const shop = at(-W / 2 + 6, 0, D - 4.5);
    b.box('concrete', [10, 3.6, 7], shop.clone().setY(1.8), Q, true);
    b.box('glass', [7, 2.4, 0.05], shop.clone().add(new THREE.Vector3(0, 1.5, -toward * 3.53)), Q, false);
    b.box('facadeRed', [10.2, 0.6, 7.2], shop.clone().setY(3.9), Q, false);
    const face = pumpFace(), mat = lighting.setup(new THREE.MeshStandardMaterial({ map: face, roughness: 0.45, metalness: 0.2 }), 'gas-pump');
    const geo = new THREE.BoxGeometry(...PUMP).translate(0, PUMP[1] / 2 + 0.2, 0);
    const spots = [-1.8, 1.8].flatMap((x) => [-2, 2].map((z) => at(x, 0, cz + z)));
    this.mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    spots.forEach((p, i) => {
      this.mesh.setMatrixAt(i, this.m.makeTranslation(p.x, p.y, p.z));
      b.box('tankBlack', [0.06, 1.2, 0.06], p.clone().add(new THREE.Vector3(0.46, 1.0, 0)), Q, false);
      const col = world.createCollider(RAPIER.ColliderDesc.cuboid(PUMP[0] / 2, PUMP[1] / 2, PUMP[2] / 2).setTranslation(p.x, p.y + PUMP[1] / 2 + 0.2, p.z), body);
      setSurface(col.handle, 'metal');
      const pump: Pump = { at: p.clone().setY(p.y + 1.2), hp: 70, burn: 0, mesh: i, puffT: 0, gone: false };
      this.pumps.push(pump);
      onHit(col.handle, (dmg) => (this.hurt(pump, dmg), false));
    });
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    if (shotMode) Object.assign(window, { __gas: this });
  }

  private hurt(p: Pump, dmg: number): void {
    if (p.gone || p.burn > 0) return;
    p.hp -= dmg;
    if (p.hp <= 0) p.burn = 2.2 + Math.random() * 1.2;
  }

  update(dt: number): void {
    for (const p of this.pumps) {
      if (p.gone || p.burn <= 0) continue;
      p.burn -= dt;
      if ((p.puffT -= dt) <= 0) {
        p.puffT = 0.07;
        worldFx.puff(p.at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.8, (Math.random() - 0.5) * 0.4)), 1.6);
        if (Math.random() < 0.4) worldFx.puff(p.at.clone().add(new THREE.Vector3(0, 1.2, 0)), 0.15);
      }
      if (p.burn > 0) continue;
      p.gone = true;
      this.mesh.setMatrixAt(p.mesh, this.m.makeScale(0, 0, 0));
      this.mesh.instanceMatrix.needsUpdate = true;
      worldFx.blast(p.at);
      for (const q of this.pumps) if (!q.gone && q.burn <= 0 && q.at.distanceTo(p.at) < 4.5) q.burn = 0.6 + Math.random() * 0.8;
    }
  }
}
