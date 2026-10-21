import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { sketch } from './portrait';

export const W = 1280, H = 720;
const BASE = `${import.meta.env.BASE_URL}assets/`;
export type Kind = 'pnp' | 'fls' | 'civ_a' | 'civ_b' | 'civ_c';

/** Characters and clips for the prologue, loaded on their own so the plates don't wait for the game. */
export class Cast {
  private protos = new Map<Kind, THREE.Object3D>();
  private clips = new Map<string, THREE.AnimationClip>();
  readonly ink = new THREE.MeshStandardMaterial({ color: '#080707', roughness: 0.5, metalness: 0.15 });

  async load(): Promise<void> {
    const manifest = await (await fetch(`${BASE}manifest.json`, { cache: 'no-cache' })).json();
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const v = `?v=${manifest.version ?? 0}`;
    const kinds: Kind[] = ['pnp', 'fls', 'civ_a', 'civ_b'];
    const [anims, ...models] = await Promise.all([manifest.animations, ...kinds.map((k) => manifest.characters[k].near)].map((u: string) => loader.loadAsync(BASE + u + v)));
    for (const c of anims.animations) this.clips.set(c.name, c);
    kinds.forEach((k, i) => this.protos.set(k, models[i].scene));
  }

  /** A posed silhouette: `clip` frozen at `frac` of its length, feet at `pos`, facing `yaw`. */
  actor(kind: Kind, clip: string, frac: number, pos: THREE.Vector3, yaw: number, extra?: (head: THREE.Bone) => void, armed = false, arms: 'fist' | 'up' | null = null, textured = false): THREE.Object3D {
    const o = SkeletonUtils.clone(this.protos.get(kind)!);
    o.traverse((m) => {
      if (m instanceof THREE.SkinnedMesh) {
        if (!textured) m.material = this.ink;
        m.frustumCulled = false;
        m.castShadow = true;
      }
    });
    const c = this.clips.get(clip) ?? this.clips.get('idle')!;
    const mixer = new THREE.AnimationMixer(o);
    mixer.clipAction(c).play();
    mixer.setTime(c.duration * frac);
    o.position.copy(pos);
    o.rotation.y = yaw;
    let head: THREE.Bone | undefined;
    o.traverse((b) => b instanceof THREE.Bone && b.name === 'mixamorigHead' && (head = b));
    if (head && extra) extra(head);
    if (armed) this.rifle(o);
    if (arms === 'fist') this.raise(o, 'Right', new THREE.Vector3(-0.22, 1, 0.12), yaw);
    if (arms === 'up') for (const [side, x] of [['Right', -0.5], ['Left', 0.5]] as const) this.raise(o, side, new THREE.Vector3(x, 1, 0.2), yaw);
    return o;
  }

  /** Straightens an arm to point along `dir` (actor space): a raised fist or hands up. */
  private raise(o: THREE.Object3D, side: 'Right' | 'Left', dir: THREE.Vector3, yaw: number): void {
    o.updateMatrixWorld(true);
    const bone = (n: string) => {
      let b: THREE.Object3D | undefined;
      o.traverse((x) => x.name === `mixamorig${side}${n}` && (b = x));
      return b!;
    };
    const arm = bone('Arm'), want = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    arm.quaternion.copy(arm.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
    bone('ForeArm').quaternion.identity();
    bone('Hand').quaternion.identity();
  }

  /** Rifle laid between the hands of an aiming pose (stock behind the right hand, muzzle past the left). */
  private rifle(o: THREE.Object3D): void {
    o.updateMatrixWorld(true);
    const hand = (n: string) => {
      let b: THREE.Object3D | undefined;
      o.traverse((x) => x.name === `mixamorig${n}Hand` && (b = x));
      return b!.getWorldPosition(new THREE.Vector3());
    };
    const rh = hand('Right'), lh = hand('Left'), dir = lh.clone().sub(rh).normalize();
    const g = new THREE.Group();
    const part = (l: number, h: number, w: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, w), this.ink);
      m.position.set(x, y, 0);
      g.add(m);
    };
    part(0.32, 0.1, 0.05, -0.28, -0.02);
    part(0.42, 0.08, 0.06, 0.08, 0.0);
    part(0.42, 0.025, 0.025, 0.5, 0.01);
    part(0.06, 0.2, 0.04, 0.12, -0.13);
    g.position.copy(rh);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    o.attach(g);
  }

  /** Peaked officer's cap on a head bone (rig space in centimetres). */
  cap(head: THREE.Bone): void {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(16, 12, 7, 24).scale(1, 1, 1.12), this.ink);
    crown.position.set(0, 18, 0.5);
    crown.rotation.x = 0.18;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(12.2, 12.2, 3.2, 24), this.ink);
    band.position.set(0, 14.5, 0.8);
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.8, 16, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.75), this.ink);
    visor.position.set(0, 13.4, 9.5);
    visor.rotation.x = 0.35;
    head.add(crown, band, visor);
  }

  /** Steel helmet for soldiers seen far off. */
  helmet(head: THREE.Bone): void {
    const h = new THREE.Mesh(new THREE.SphereGeometry(13.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), this.ink);
    h.position.y = 12;
    head.add(h);
  }
}

/** Off-screen renderer shared by the plates; `shoot` returns a graded JPEG of the current scene. */
export class Stage {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });

  constructor() {
    this.renderer.setSize(W, H, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  shoot(scene: THREE.Scene, camera: THREE.PerspectiveCamera, grade: string, ink = false): string {
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    this.renderer.render(scene, camera);
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d')!;
    c.drawImage(this.renderer.domElement, 0, 0);
    if (ink) sketch(c, W, H);
    else finish(c, grade);
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    });
    return cv.toDataURL('image/jpeg', 0.88);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Colour wash, film grain, faint chromatic fringe and a heavy vignette. */
function finish(c: CanvasRenderingContext2D, grade: string): void {
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = grade;
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
  const img = c.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i] += n + 2;
    d[i + 1] += n;
    d[i + 2] += n - 2;
  }
  c.putImageData(img, 0, 0);
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.68);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.78)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}

/** Vertical sky gradient as a scene background. */
export function skyTexture(top: string, mid: string, bottom: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 256;
  const c = cv.getContext('2d')!, g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft round sprite texture for smoke, haze and embers. */
export const puffTexture = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d')!, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return (t = new THREE.CanvasTexture(cv));
  };
})();
