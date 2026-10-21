import * as THREE from 'three';
import { Cast, skyTexture, puffTexture, type Kind } from './stage';
import { generalPortrait } from './portrait';
import { block, tank, truck, flag, beam, smoke, motes, rain, ground, dark } from './props';

export interface Shot { scene: THREE.Scene; camera: THREE.PerspectiveCamera; grade: string; sketch?: boolean }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function base(top: string, mid: string, bottom: string, fog: string, density: number): THREE.Scene {
  const s = new THREE.Scene();
  s.background = skyTexture(top, mid, bottom);
  s.fog = new THREE.FogExp2(fog, density);
  return s;
}

function cam(fov: number, from: THREE.Vector3, at: THREE.Vector3): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 800);
  c.position.copy(from);
  c.lookAt(at);
  return c;
}

function key(s: THREE.Scene, color: string, intensity: number, pos: THREE.Vector3, target = V(0, 0, 0), shadow = false): void {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.copy(pos);
  l.target.position.copy(target);
  if (shadow) {
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    Object.assign(l.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 200 });
  }
  s.add(l, l.target);
}

function spot(s: THREE.Scene, color: string, intensity: number, pos: THREE.Vector3, target: THREE.Vector3, angle: number): void {
  const l = new THREE.SpotLight(color, intensity, 0, angle, 0.5, 1.2);
  l.position.copy(pos);
  l.target.position.copy(target);
  s.add(l, l.target);
}

/** The general on the palace balcony, arm raised, under searchlights and banners. */
export function general(cast: Cast): Shot {
  const s = base('#0d0b0a', '#3a2a20', '#120e0c', '#2a1d16', 0.025);
  s.add(new THREE.HemisphereLight('#6a5a50', '#100c0a', 0.4));
  key(s, '#bcd0ff', 5, V(-3, 8, -10));
  spot(s, '#ffb070', 12, V(3.5, 3.5, 6), V(0, 1.7, 0), 0.3);
  spot(s, '#d8e2ff', 900, V(-1.2, 3.2, -2.2), V(0.2, 1.6, 0.3), 0.7);
  spot(s, '#ff6a3a', 500, V(2.2, 2.5, -2.0), V(0, 1.6, 0.3), 0.7);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 1), dark('#221c18'));
  wall.position.set(0, 8, -4);
  s.add(wall);
  for (const x of [-4.2, 4.2]) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 9), new THREE.MeshStandardMaterial({ color: '#6e1012', roughness: 0.9, emissive: '#3a0606', emissiveIntensity: 0.4 }));
    banner.position.set(x, 4.6, -3.4);
    s.add(banner);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(9, 0.95, 0.5), dark('#1c1916'));
  rail.position.set(0, 0.47, 0.7);
  s.add(rail);
  s.add(cast.actor('fls', 'idle', 0.3, V(0, 0, 0), 0.3, (h) => cast.cap(h), false, 'fist'));
  s.add(beam(V(-9, -4, -6), V(-30, 60, -60), 6, '#cfd8ff', 0.09), beam(V(9, -4, -6), V(22, 60, -70), 6, '#cfd8ff', 0.09));
  const plaza = ground('#0e0c0b');
  plaza.position.y = -5;
  s.add(plaza);
  const kinds: Kind[] = ['civ_a', 'civ_b', 'fls'];
  for (let i = 0; i < 26; i++) s.add(cast.actor(kinds[i % 3], 'idle', Math.random(), V(rnd(-9, 9), -5, rnd(3, 8)), Math.PI + rnd(-0.3, 0.3)));
  s.add(motes(V(0, 3, -1), V(20, 12, 8), 260, '#ffb070', 0.08), smoke(V(0, 6, -8), 10, 14, '#3a302a', 0.35, [8, 16]));
  return { scene: s, camera: cam(30, V(0.75, 1.05, 2.7), V(-0.05, 1.82, 0)), grade: '#7a3c1c' };
}

/** A column of tanks rolling down the avenue at dusk, troops alongside, a car burning. */
export function tanks(cast: Cast): Shot {
  const s = base('#2a2a30', '#8a6a52', '#2a2420', '#6a584a', 0.02);
  s.add(new THREE.HemisphereLight('#8a8a9a', '#201a16', 0.6));
  key(s, '#ffb780', 3.2, V(-20, 12, -80), V(0, 0, 0), true);
  s.add(ground('#24221f', 0.35));
  for (const side of [-1, 1]) for (let z = 10; z > -170; z -= rnd(9, 16)) s.add(block(side * rnd(12, 14), z, rnd(8, 14), rnd(8, 28), 10, 0.15));
  const zs = [-6, -26, -50, -78];
  zs.forEach((z, i) => {
    const t = tank();
    t.position.set(i % 2 ? 2.6 : -2.4, 0, z);
    t.rotation.y = -Math.PI / 2 + rnd(-0.05, 0.05);
    s.add(t);
  });
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    s.add(cast.actor('pnp', i % 3 ? 'walk_f' : 'aim', Math.random(), V(side * rnd(5.2, 7.5), 0, -2 - i * 3.2), rnd(-0.1, 0.1), undefined, true));
  }
  const fire = new THREE.PointLight('#ff7a2a', 120, 30, 1.6);
  fire.position.set(-8.5, 1.5, -14);
  s.add(fire, smoke(V(-8.5, 4, -14), 3, 18, '#1d1a18', 0.6, [4, 9]), motes(V(-8.5, 4, -14), V(4, 8, 4), 140, '#ff8a3a', 0.12));
  s.add(beam(V(-12, 28, -40), V(30, 120, -160), 5, '#e8eeff', 0.06), beam(V(12, 30, -60), V(-40, 120, -200), 5, '#e8eeff', 0.05));
  s.add(smoke(V(0, 2, -40), 18, 24, '#5a5048', 0.25, [10, 22]), motes(V(0, 6, -10), V(30, 14, 40), 400, '#c9b8a8', 0.06, false));
  return { scene: s, camera: cam(36, V(5.5, 1.3, 13), V(-1.5, 2.6, -20)), grade: '#3b4b5e' };
}

/** Night raid in the rain: neighbours, hands up, marched to an army truck under a floodlight. */
export function detentions(cast: Cast): Shot {
  const s = base('#030406', '#141a20', '#07090b', '#1a2228', 0.035);
  s.add(new THREE.HemisphereLight('#4a5a6a', '#080a0c', 0.35));
  s.add(ground('#15191c', 0.22));
  for (let x = -40; x < 40; x += rnd(9, 14)) s.add(block(x, -24, rnd(8, 13), rnd(7, 16), 8, 0.12, dark('#121518')));
  const t = truck();
  t.position.set(7, 0, -7);
  t.rotation.y = Math.PI + 0.25;
  s.add(t);
  spot(s, '#dfe8ff', 900, V(12, 7, -16), V(0, 0, -4), 0.5);
  s.add(beam(V(12, 7, -16), V(-2, 0, 0), 7, '#dfe8ff', 0.14));
  for (let i = 0; i < 9; i++) s.add(cast.actor(i % 2 ? 'civ_a' : 'civ_b', 'civ_walk', Math.random(), V(-9 + i * 1.3 + rnd(-0.2, 0.2), 0, -5 + rnd(-0.4, 0.4)), Math.PI / 2 + rnd(-0.2, 0.2), undefined, false, 'up'));
  for (const [x, z, yaw] of [[-4, -2, 2.6], [1, -8.6, 0.3], [4.5, -2.4, -2.4], [-8, -8, 0.9]] as const) s.add(cast.actor('pnp', 'aim', 0.5, V(x, 0, z), yaw, undefined, true));
  s.add(rain(V(0, 5, -5), V(40, 14, 30), 1800), smoke(V(0, 1, -6), 14, 16, '#4a5660', 0.2, [6, 12]));
  return { scene: s, camera: cam(40, V(-3.5, 1.5, 8), V(1.5, 1.6, -5)), grade: '#24405e' };
}

/** A crowd from behind, fists and red flags up against a burning dusk. */
export function voices(cast: Cast): Shot {
  const s = base('#1a0c0a', '#b4562a', '#2a120c', '#7a3a22', 0.022);
  s.add(new THREE.HemisphereLight('#c87a50', '#1a0c08', 0.5));
  key(s, '#ff9a50', 6, V(0, 6, -60));
  s.add(ground('#140b08'));
  for (let x = -70; x < 70; x += rnd(8, 14)) s.add(block(x, -70, rnd(8, 14), rnd(6, 22), 8, 0.08, dark('#1c100c')));
  const kinds: Kind[] = ['fls', 'civ_a', 'civ_b'];
  for (let i = 0; i < 46; i++) {
    const z = rnd(-26, 2), raised = Math.random() < 0.6;
    s.add(cast.actor(kinds[i % 3], 'idle', Math.random(), V(rnd(-14, 14), 0, z), Math.PI + rnd(-0.35, 0.35), undefined, false, raised ? 'fist' : null));
  }
  for (const [x, z] of [[-6, -6], [3, -12], [9, -4], [-11, -16], [0, -22]]) {
    const f = flag('#a8141a', rnd(2.6, 3.6), rnd(1.7, 2.2), rnd(5.5, 7.5));
    f.position.set(x, 0, z);
    f.rotation.y = rnd(-0.6, 0.6);
    s.add(f);
  }
  s.add(smoke(V(0, 8, -55), 40, 26, '#3a1a10', 0.45, [16, 30]), motes(V(0, 6, -15), V(40, 14, 30), 420, '#ff9a4a', 0.1));
  return { scene: s, camera: cam(42, V(1, 2.3, 9), V(0, 2.8, -20)), grade: '#8a3a16' };
}

/** Two FLS fighters on a rooftop above the lit hills at night, a red flag over them. */
export function barrio(cast: Cast): Shot {
  const s = base('#04060c', '#16223c', '#2a3658', '#141c34', 0.006);
  s.add(new THREE.HemisphereLight('#3a4a6a', '#05060a', 0.5));
  key(s, '#8aa4ff', 1.6, V(10, 20, -40));
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 10), dark('#14161a'));
  roof.position.set(0, -0.2, 0);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(14, 0.9, 0.3), dark('#14161a'));
  parapet.position.set(0, 0.45, -5);
  s.add(roof, parapet);
  const lights: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const x = rnd(-260, 260), z = rnd(-260, -40), hill = Math.max(0, Math.sin((x + 300) / 90) * 30 + Math.cos(x / 47) * 12) * Math.min(1, (-z - 40) / 120);
    lights.push(x, -9 + hill + rnd(0, 2), z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
  s.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffb060', map: puffTexture(), size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  s.add(motes(V(0, 80, -300), V(900, 120, 50), 500, '#ffffff', 1.2));
  s.add(cast.actor('fls', 'aim', 0.5, V(-1.2, 0, -3.6), Math.PI + 0.25, undefined, true), cast.actor('fls', 'idle', 0.2, V(1.4, 0, -3.2), Math.PI - 0.2));
  const f = flag('#b3121b', 2.8, 1.8, 5.5);
  f.position.set(2.6, 0, -4.4);
  s.add(f, beam(V(60, -15, -150), V(10, 90, -260), 5, '#dfe8ff', 0.06));
  spot(s, '#ff9a6a', 40, V(-2, 4, 3), V(0, 1, -4), 0.6);
  return { scene: s, camera: cam(40, V(-2.2, 2.4, 4.5), V(1.5, 0.4, -30)), grade: '#1d2a48' };
}

export const SCENES = [generalPortrait, tanks, detentions, voices, barrio];
