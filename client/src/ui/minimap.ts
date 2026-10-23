import * as THREE from 'three';
import type { Threat } from '../systems/sensing';

const W = 190, H = 124, SPAN = 135, SHOT = 1024, GRID = 50;
const PALETTE = { road: [150, 156, 162], block: [72, 79, 85], roof: [88, 95, 101], park: [76, 104, 70], sea: [44, 80, 106] };

/**
 * GTA-style heading-up minimap: a flat-coloured street plan derived once from a top-down render of the level
 * (roads, blocks, parks, sea) with a 50 m grid, plus enemies, civilians, squad, supplies and the objective.
 */
export class Minimap {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private map = document.createElement('canvas');
  private half: number;
  private frame = 0;

  /**
   * `roads`: asphalt materials, rendered alone in a mask pass to draw the street plan; `streets`: centre lines
   * painted `width` metres wide where the streets are part of the ground instead.
   */
  constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene, playable: number, private roads: THREE.Material[] = [], private streets?: { nodes: THREE.Vector3[]; edges: [number, number][]; width: number }) {
    this.half = playable / 2 + 15;
    const dpr = Math.min(devicePixelRatio, 2);
    this.canvas.id = 'minimap';
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    document.body.appendChild(this.canvas);
    this.capture(gl, scene);
  }

  private shoot(gl: THREE.WebGLRenderer, scene: THREE.Scene): Uint8Array {
    const h = this.half, cam = new THREE.OrthographicCamera(-h, h, h, -h, 1, 3000);
    cam.position.set(0, 1200, 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    const rt = new THREE.WebGLRenderTarget(SHOT, SHOT);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    gl.setRenderTarget(rt);
    gl.render(scene, cam);
    gl.setRenderTarget(null);
    const px = new Uint8Array(SHOT * SHOT * 4);
    gl.readRenderTargetPixels(rt, 0, 0, SHOT, SHOT, px);
    rt.dispose();
    return px;
  }

  /** White where asphalt is the topmost surface, black elsewhere; trees and decor lines left out. */
  private roadMask(gl: THREE.WebGLRenderer, scene: THREE.Scene): Uint8Array {
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' }), black = new THREE.MeshBasicMaterial({ color: '#000000' });
    const saved: [THREE.Object3D, THREE.Material | THREE.Material[] | null, boolean][] = [];
    const bg = scene.background;
    scene.background = new THREE.Color('#000000');
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Line).isLine && !(o as THREE.Points).isPoints) return;
      saved.push([o, m.material ?? null, o.visible]);
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) o.visible = false;
      else m.material = Array.isArray(m.material) ? m.material.map((x) => (this.roads.includes(x) ? white : black)) : this.roads.includes(m.material) ? white : black;
    });
    const px = this.shoot(gl, scene);
    for (const [o, mat, vis] of saved) {
      o.visible = vis;
      if (mat) (o as THREE.Mesh).material = mat;
    }
    scene.background = bg;
    return px;
  }

  private capture(gl: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const fog = scene.fog;
    scene.fog = null;
    const px = this.shoot(gl, scene), road = this.roads.length ? this.roadMask(gl, scene) : null;
    scene.fog = fog;
    this.map.width = this.map.height = SHOT;
    const mctx = this.map.getContext('2d')!, img = mctx.createImageData(SHOT, SHOT);
    for (let y = 0; y < SHOT; y++) for (let x = 0; x < SHOT; x++) {
      const i = ((SHOT - 1 - y) * SHOT + x) * 4, o = (y * SHOT + x) * 4;
      let kind = classify(px[i], px[i + 1], px[i + 2]);
      if (road) kind = road[i] > 128 ? 'road' : kind === 'road' ? 'block' : kind;
      img.data.set(PALETTE[kind], o);
      img.data[o + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
    const h = this.half, s = SHOT / (h * 2);
    if (this.streets) {
      const { nodes, edges, width } = this.streets;
      mctx.strokeStyle = `rgb(${PALETTE.road.join(',')})`;
      mctx.lineWidth = width * s;
      mctx.lineCap = 'round';
      mctx.beginPath();
      for (const [a, b] of edges) {
        mctx.moveTo((nodes[a].x + h) * s, (nodes[a].z + h) * s);
        mctx.lineTo((nodes[b].x + h) * s, (nodes[b].z + h) * s);
      }
      mctx.stroke();
    }
    mctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    mctx.lineWidth = 1;
    for (let m = Math.ceil(-h / GRID) * GRID; m <= h; m += GRID) {
      const p = (m + h) * s;
      mctx.beginPath();
      mctx.moveTo(p, 0); mctx.lineTo(p, SHOT);
      mctx.moveTo(0, p); mctx.lineTo(SHOT, p);
      mctx.stroke();
    }
  }

  /** `yaw`: camera yaw (0 looks towards −z). Threat angles are relative to the camera heading. */
  update(player: THREE.Vector3, yaw: number, threats: Threat[]): void {
    if (++this.frame % 2) return;
    const c = this.ctx, cx = W / 2, cy = H * 0.6, k = W / 2 / SPAN, img = SHOT / (this.half * 2);
    c.clearRect(0, 0, W, H);
    c.fillStyle = `rgb(${PALETTE.block.join(',')})`;
    c.fillRect(0, 0, W, H);
    c.save();
    c.translate(cx, cy);
    c.rotate(yaw);
    c.scale(k / img, k / img);
    c.drawImage(this.map, -(player.x + this.half) * img, -(player.z + this.half) * img);
    c.restore();
    const blip = (t: Threat, color: string, size: number, shape: 'dot' | 'square' | 'diamond' = 'dot', clamp = false) => {
      let x = Math.sin(t.angle) * t.dist * k, y = -Math.cos(t.angle) * t.dist * k;
      const lx = cx - 6, ly = y < 0 ? cy - 6 : H - cy - 6;
      if (Math.abs(x) > lx || Math.abs(y) > ly) {
        if (!clamp) return;
        const f = Math.min(lx / Math.abs(x), ly / Math.abs(y));
        x *= f;
        y *= f;
      }
      c.fillStyle = color;
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.lineWidth = 1.5;
      c.beginPath();
      if (shape === 'diamond') [[0, -size], [size, 0], [0, size], [-size, 0]].forEach(([a, b], i) => (i ? c.lineTo(cx + x + a, cy + y + b) : c.moveTo(cx + x + a, cy + y + b)));
      else if (shape === 'square') c.rect(cx + x - size, cy + y - size, size * 2, size * 2);
      else c.arc(cx + x, cy + y, size, 0, Math.PI * 2);
      c.closePath();
      c.fill();
      c.stroke();
    };
    for (const t of threats) {
      if (t.objective) continue;
      if (t.neutral) blip(t, 'rgba(235, 235, 225, 0.85)', 2.6);
      else if (t.supply) blip(t, t.supply === 'medkit' ? '#3fdf6a' : '#f0b43a', 3.8, 'square');
      else if (t.ally) blip(t, '#5aa8ff', 4.6);
      else blip(t, t.aware ? '#ff2a1f' : '#d0443a', 4.8, 'dot', t.dist >= 129);
    }
    const goal = threats.find((t) => t.objective);
    if (goal) blip(goal, '#ffb547', 7, 'diamond', true);
    c.fillStyle = '#f2ede2';
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.beginPath();
    c.moveTo(cx, cy - 7);
    c.lineTo(cx + 5, cy + 5);
    c.lineTo(cx, cy + 2);
    c.lineTo(cx - 5, cy + 5);
    c.closePath();
    c.fill();
    c.stroke();
  }

  set visible(v: boolean) {
    this.canvas.style.display = v ? '' : 'none';
  }
}

function classify(r: number, g: number, b: number): keyof typeof PALETTE {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), sat = max ? (max - min) / max : 0;
  if (b > r + 18 && b >= g) return 'sea';
  if (g > r * 1.06 && g > b * 1.12 && sat > 0.18) return 'park';
  if (max < 85 && sat < 0.2) return 'road';
  return max > 170 ? 'roof' : 'block';
}
