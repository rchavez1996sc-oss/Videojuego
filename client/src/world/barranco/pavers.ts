import * as THREE from 'three';

/**
 * Grey concrete pavers of the Bajada de Baños (Street View 2013): 20 × 10 cm blocks laid in running bond with the long
 * side down the lane, sand joints, a slight bevel, each block a touch lighter or darker, worn paler in the middle of
 * the run and stained near the edges. One 2 m tile (1024 px) of colour and a normal map from the same height field.
 */
export function paverTextures(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const N = 1024, px = N / 2, bw = 0.1 * px, bl = 0.2 * px, joint = 2.2;
  const col = new Uint8ClampedArray(N * N * 4), h = new Float32Array(N * N);
  let s = 77;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tone = new Map<string, number>();
  const k = (Math.PI * 2) / N, blob = (x: number, y: number) => Math.sin(x * k * 3 + Math.sin(y * k * 2) * 2) * Math.cos(y * k * 4 + x * k);
  for (let y = 0; y < N; y++) {
    const row = Math.floor(y / bl), fy = y - row * bl;
    for (let x = 0; x < N; x++) {
      const shift = row % 2 ? bw / 2 : 0, cx = Math.floor((x + shift) / bw), fx = (x + shift) - cx * bw;
      const key = `${(cx + 20) % 20},${row}`;
      if (!tone.has(key)) tone.set(key, rnd());
      const t = tone.get(key)!, edge = Math.min(fx, bw - fx, fy, bl - fy);
      const grit = (rnd() - 0.5) * 18, stain = blob(x, y) * 10;
      let v: number, warm = 0;
      if (edge < joint) {
        v = 58 + rnd() * 14;
        warm = 6;
        h[y * N + x] = 0;
      } else {
        const bevel = Math.min(1, (edge - joint) / 3.5);
        v = 104 + t * 34 + grit + stain - (1 - bevel) * 22;
        warm = (t - 0.5) * 8;
        h[y * N + x] = 0.35 + bevel * 0.65 + (rnd() - 0.5) * 0.04;
      }
      const i = (y * N + x) * 4;
      col[i] = v + warm; col[i + 1] = v + warm * 0.4; col[i + 2] = v - warm * 0.3; col[i + 3] = 255;
    }
  }
  const nrm = new Uint8ClampedArray(N * N * 4), at = (x: number, y: number) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    nrm[i] = (-dx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (dy / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const tex = (data: Uint8ClampedArray, srgb: boolean) => {
    const c = Object.assign(document.createElement('canvas'), { width: N, height: N });
    c.getContext('2d')!.putImageData(new ImageData(data, N, N), 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(col, true), normalMap: tex(nrm, false) };
}
