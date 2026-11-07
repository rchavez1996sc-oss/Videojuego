import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Lighting } from '../render/lighting';

/**
 * Street food stalls (metal kiosk kit cut out of the Release's street scene: counter, awning, gas cylinder, fridge,
 * soda crates), registered while the level is built and placed once the model loads: one instanced mesh per part,
 * the sheet metal tinted per stall, and a painted name board over the counter (sanguchería, anticuchos…).
 */
const spots: { p: THREE.Vector3; yaw: number; kind: number }[] = [];
if (location.search.includes('shot')) (window as unknown as { __kiosks: unknown }).__kiosks = spots;

/** A stall at `p` (ground) whose counter faces `facing` (yaw of the street side). */
export function addKiosk(p: THREE.Vector3, facing: number, kind: number): void {
  spots.push({ p: p.clone(), yaw: facing + TURN, kind });
}
/** A stall registered at (x, z) on the ground, with a solid box for its counter and shed (the Builder's `none`). */
export function kioskAt(b: { box(m: string, s: [number, number, number], p: THREE.Vector3, q: THREE.Quaternion, solid: boolean): unknown }, hf: { heightAt(x: number, z: number): number }, x: number, z: number, facing: number, kind: number): void {
  const y = hf.heightAt(x, z);
  addKiosk(new THREE.Vector3(x, y, z), facing, kind);
  b.box('none', [5.4, 2.6, 2.4], new THREE.Vector3(x, y + 1.3, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing + TURN), true);
}
/** The kit's counter looks down its local +z. */
const TURN = 0;

const NAMES: [string, string, string][] = [
  ['SANGUCHERÍA', 'Pan con chicharrón · Butifarra', '#c8261d'],
  ['ANTICUCHOS', 'Doña Tomasa · desde 1998', '#1d4f9a'],
  ['SALCHIPAPAS', 'Hamburguesas · Alitas', '#d68a12'],
  ['EMOLIENTE', 'Quinua · Maca · Linaza', '#2f7a34'],
  ['CALDO DE GALLINA', 'Abierto toda la noche', '#7a2a6e'],
  ['JUGUERÍA', 'Surtido · Papaya · Fresa', '#d6421a'],
];
const TINTS = ['#2f5f9e', '#3a7a44', '#c9b52a', '#b8392c', '#d8d4c8', '#2c8a8a'];

function nameAtlas(): THREE.CanvasTexture {
  const W = 512, H = 128, cv = Object.assign(document.createElement('canvas'), { width: W, height: H * NAMES.length }), g = cv.getContext('2d')!;
  NAMES.forEach(([t, sub, col], i) => {
    const y = i * H;
    g.fillStyle = '#f4f0e4'; g.fillRect(0, y, W, H);
    g.fillStyle = col; g.fillRect(0, y, W, 10); g.fillRect(0, y + H - 10, W, 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = col; g.font = '900 64px "Barlow Condensed", Arial'; g.fillText(t, W / 2, y + 50, W - 30);
    g.fillStyle = '#222'; g.font = '600 26px "Barlow Condensed", Arial'; g.fillText(sub, W / 2, y + 96, W - 40);
  });
  return Object.assign(new THREE.CanvasTexture(cv), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
}

/** Places every registered stall (model `props/stall.glb` from the manifest; without it, nothing). */
export async function placeKiosks(scene: THREE.Object3D, lighting: Lighting): Promise<void> {
  if (!spots.length) return;
  const base = `${import.meta.env.BASE_URL}assets/`;
  const manifest = await fetch(`${base}manifest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  const url = manifest?.props?.stall;
  if (!url) return;
  const gltf = await new GLTFLoader().loadAsync(`${base}${url}?v=${manifest.version}`);
  gltf.scene.updateMatrixWorld(true);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const place = spots.map((s) => m4.clone().compose(s.p, q.setFromAxisAngle(up, s.yaw), one));
  const parts: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => (o as THREE.Mesh).isMesh && parts.push(o as THREE.Mesh));
  for (const part of parts) {
    const src = part.material as THREE.MeshStandardMaterial, metal = /^metal$/i.test(src.name);
    const fridge = /^refrigerator$/i.test(src.name);
    const mat = lighting.setup(Object.assign(src.clone(), fridge ? { map: null, emissiveMap: null, emissive: new THREE.Color('#000000'), color: new THREE.Color('#a8231b') } : {}, { roughness: Math.max(0.5, src.roughness), metalness: Math.min(0.4, src.metalness) }), `kiosk-${src.name || 'part'}`);
    const im = new THREE.InstancedMesh(part.geometry.clone().applyMatrix4(part.matrixWorld), mat, spots.length);
    place.forEach((p, i) => im.setMatrixAt(i, p));
    if (metal) spots.forEach((s, i) => im.setColorAt(i, new THREE.Color(TINTS[s.kind % TINTS.length])));
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;
    im.name = 'kiosks';
    scene.add(im);
  }
  const boards = spots.map((s, i) => {
    const k = s.kind % NAMES.length, g = new THREE.PlaneGeometry(BOARD[0], BOARD[1]), uv = g.attributes.uv as THREE.BufferAttribute;
    for (let j = 0; j < uv.count; j++) uv.setY(j, 1 - (k + 1 - uv.getY(j)) / NAMES.length);
    return g.translate(BOARD[2], BOARD[3], BOARD[4]).applyMatrix4(place[i]);
  });
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const signs = new THREE.Mesh(mergeGeometries(boards)!, lighting.setup(new THREE.MeshStandardMaterial({ map: nameAtlas(), roughness: 0.7, side: THREE.DoubleSide }), 'kiosk-names'));
  signs.name = 'kiosk-names';
  scene.add(signs);
}
/** Name board: width, height and centre (kit space) above the counter. */
const BOARD: [number, number, number, number, number] = [2.2, 0.55, 0, 2.6, 1.9];
