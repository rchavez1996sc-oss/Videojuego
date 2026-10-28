import * as THREE from 'three';
import type { Builder } from '../buildingKit';

type Box = (mat: string, size: [number, number, number], x: number, y: number, z: number, collide?: boolean) => void;
type At = (x: number, y: number, z: number) => THREE.Vector3;

const UP = new THREE.Vector3(0, 1, 0);

/** Steel bicycle leaning in a rack: two tyres with rims, a diamond frame, bars and saddle. */
function bike(b: Builder, at: At, q: THREE.Quaternion, x: number, z: number, frame: string): void {
  const yz = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2));
  for (const u of [-0.52, 0.52]) {
    b.geometry('mullion', new THREE.TorusGeometry(0.33, 0.035, 6, 20), new THREE.Matrix4().compose(at(x, 0.36, z + u), yz, new THREE.Vector3(1, 1, 1)));
    b.geometry('alu', new THREE.TorusGeometry(0.29, 0.012, 4, 16), new THREE.Matrix4().compose(at(x, 0.36, z + u), yz, new THREE.Vector3(1, 1, 1)));
  }
  const bar = (len: number, y: number, v: number, tilt: number) =>
    b.geometry(frame, new THREE.CylinderGeometry(0.022, 0.022, len, 6), new THREE.Matrix4().compose(at(x, y, z + v), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt)), new THREE.Vector3(1, 1, 1)));
  bar(0.62, 0.62, 0.02, Math.PI / 2 - 0.12);
  bar(0.58, 0.52, -0.2, 0.6);
  bar(0.55, 0.5, 0.25, -0.5);
  bar(0.5, 0.42, -0.36, 1.2);
  bar(0.3, 0.86, 0.46, 0.2);
  b.box('mullion', [0.5, 0.03, 0.04], at(x, 1.0, z + 0.48), q);
  b.box('mullion', [0.12, 0.05, 0.25], at(x, 0.88, z - 0.27), q);
}

/**
 * East entrance of Química (from the user's photo): a tiled ramp with steel tube railings runs to glass doors with a
 * frosted band; over it a beige portal carries a vaulted dark roof on beige ribs, and a long beige fascia beam runs
 * along the front. To one side a barred bay with orange curtains between tall yellow pilasters and white panels,
 * a bike rack with bicycles, hedges and an agave. `x0` is the outer face of the glass wall. Returns the doorstep.
 */
export function quimicaEntry(b: Builder, box: Box, at: At, q: THREE.Quaternion, x0: number, rand: () => number): THREE.Vector3 {
  const L = 9, w = 3.2, mid = x0 + L / 2;
  box('tileCream', [L, 0.14, w], mid, 0.07, 0);
  for (const s of [-1, 1]) {
    for (const y of [0.5, 0.95]) box('alu', [L, 0.045, 0.045], mid, y, s * (w / 2 + 0.05));
    for (let k = 0; k <= 6; k++) box('alu', [0.045, 0.95, 0.045], x0 + 0.6 + k * ((L - 1) / 6), 0.48, s * (w / 2 + 0.05));
    box('none', [L, 1.1, 0.1], mid, 0.55, s * (w / 2 + 0.05), true);
    for (const x of [x0 + 2.2, x0 + L - 0.3]) box('socBeige', [0.4, 4.4, 0.4], x, 2.2, s * (w / 2 + 0.55), true);
    box('socBeige', [L - 1.8, 0.4, 0.4], x0 + 1.4 + (L - 1.8) / 2 + 0.6, 4.2, s * (w / 2 + 0.55));
  }
  box('socBeige', [0.45, 0.6, w + 1.6], x0 + 2.2, 3.4, 0);
  box('socBeige', [0.45, 0.6, w + 1.6], x0 + L - 0.3, 4.1, 0);
  for (let k = 0; k < 5; k++) {
    const x = x0 + 2.2 + k * ((L - 2.5) / 4);
    b.geometry('socBeige', new THREE.TorusGeometry(w / 2 + 0.55, 0.09, 6, 18, Math.PI), new THREE.Matrix4().compose(at(x, 4.2, 0), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2)), new THREE.Vector3(1, 0.45, 1)));
  }
  const vault = new THREE.CylinderGeometry(w / 2 + 0.6, w / 2 + 0.6, L - 1.9, 20, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2);
  for (const flip of [1, -1]) b.geometry('mullion', vault.clone(), new THREE.Matrix4().compose(at(x0 + 2.2 + (L - 2.5) / 2, 4.2, 0), q, new THREE.Vector3(flip, 0.45, 1)));
  box('socBeige', [0.5, 0.55, 18], x0 + 0.4, 3.35, 0);
  box('uniWhite', [0.06, 0.28, 9], x0 + 0.02, 1.35, 0);

  box('uniYellow', [1.1, 7.2, 1.1], x0 + 0.55, 3.6, -w / 2 - 5.6, true);
  box('uniYellow', [1.1, 7.8, 1.1], x0 + 0.55, 3.9, -w / 2 - 9.4, true);
  box('uniWhite', [0.3, 4.2, 2.7], x0 + 0.3, 5.3, -w / 2 - 7.5, true);
  box('uniWhite', [0.5, 0.9, 6.4], x0 + 0.5, 0.45, -w / 2 - 3.4, true);
  box('uniOrange', [0.06, 2.3, 4.6], x0 + 0.12, 2.1, -w / 2 - 3.2);
  for (let k = 0; k <= 16; k++) box('steelGrey', [0.05, 2.5, 0.05], x0 + 0.65, 2.15, -w / 2 - 0.8 - k * 0.3);
  box('steelGrey', [0.08, 0.08, 5], x0 + 0.65, 3.4, -w / 2 - 3.2);
  box('uniCream', [0.7, 0.35, 6.6], x0 + 0.6, 3.6, -w / 2 - 3.3);

  for (let k = 0; k < 6; k++) b.geometry('steelGrey', new THREE.TorusGeometry(0.38, 0.025, 4, 14, Math.PI), new THREE.Matrix4().compose(at(x0 + 3.2, 0.02, -w / 2 - 1.6 - k * 0.55), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
  bike(b, at, q, x0 + 3.2, -w / 2 - 2.3, 'uniBlue');
  bike(b, at, q, x0 + 3.2, -w / 2 - 3.9, 'mullion');
  box('none', [1.2, 1.0, 3.6], x0 + 3.2, 0.5, -w / 2 - 3.1, true);

  box('hedge', [L - 1, 1.05, 1.6], mid + 0.5, 0.52, w / 2 + 1.5, true);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, p = at(x0 + 5.6, 0, -w / 2 - 0.9);
    const leaf = new THREE.ConeGeometry(0.07, 1.1 + rand() * 0.3, 4).translate(0, 0.55, 0);
    b.geometry('hedge', leaf, new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0.1, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7)), new THREE.Vector3(1, 1, 1)));
  }
  return at(x0 + L + 1.5, 0, 0);
}
