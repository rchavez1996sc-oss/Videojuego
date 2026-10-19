import * as THREE from 'three';

function flashTexture(): THREE.CanvasTexture {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.translate(s / 2, s / 2);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3 + Math.random() * 0.3);
    const g = ctx.createLinearGradient(0, 0, s / 2, 0);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(s / 2 * (0.6 + Math.random() * 0.4), 0);
    ctx.lineTo(0, 5);
    ctx.fill();
  }
  const r = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 4);
  r.addColorStop(0, 'rgba(255,250,230,1)');
  r.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = r;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  return new THREE.CanvasTexture(c);
}

export class MuzzleFlash {
  readonly group = new THREE.Group();
  readonly light = new THREE.PointLight('#ffb366', 0, 9, 2);
  private planes: THREE.Mesh[] = [];
  private t = 0;

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ map: flashTexture(), color: new THREE.Color(5, 3.6, 2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), mat);
    const side1 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.42).translate(0, 0.17, 0).rotateX(Math.PI / 2), mat);
    const side2 = side1.clone();
    side2.rotation.z = Math.PI / 2;
    this.planes = [front, side1, side2];
    this.group.add(...this.planes, this.light);
    this.group.visible = false;
  }

  fire(muzzle: THREE.Object3D): void {
    muzzle.getWorldPosition(this.group.position);
    muzzle.getWorldQuaternion(this.group.quaternion);
    this.group.rotateZ(Math.random() * Math.PI);
    this.group.scale.setScalar(0.8 + Math.random() * 0.5);
    this.group.visible = true;
    this.light.intensity = 10;
    this.t = 0.05;
  }

  update(dt: number): void {
    if (this.t <= 0) return;
    this.t -= dt;
    if (this.t <= 0) {
      this.group.visible = false;
      this.light.intensity = 0;
    }
  }
}
