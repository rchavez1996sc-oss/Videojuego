import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/** Offline stray-dog FBX → glTF (scaled to metres, textures re-encoded, take split into walk / idle), driven by scripts/pets.mjs. */
function image(url: string, size: number, mime: string): Promise<THREE.Texture> {
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d')!.drawImage(img, 0, 0, size, size);
      const t = new THREE.CanvasTexture(c);
      t.flipY = true;
      t.userData.mimeType = mime;
      done(t);
    };
    img.src = url;
  });
}

async function dog(fbx: string, color: string, normal: string, scale: number, cuts: Record<string, [number, number]>): Promise<{ data: string; info: string }> {
  const src = await new FBXLoader().loadAsync(fbx);
  const map = await image(color, 1024, 'image/jpeg'), nrm = await image(normal, 1024, 'image/jpeg');
  map.colorSpace = THREE.SRGBColorSpace;
  let tris = 0;
  src.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const m = o as THREE.SkinnedMesh;
    m.material = new THREE.MeshStandardMaterial({ name: 'dog', map, normalMap: nrm, roughness: 0.85 });
    tris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
  });
  src.scale.setScalar(scale);
  const take = src.animations[0], fps = 30;
  const clips = Object.entries(cuts).map(([name, [a, b]]) => {
    const c = THREE.AnimationUtils.subclip(take, name, Math.round(a * fps), Math.round(b * fps), fps);
    c.tracks = c.tracks.filter((t) => !/^Bip001\.position/.test(t.name) && !/\.scale$/.test(t.name));
    return c;
  });
  const wrap = new THREE.Group();
  wrap.add(src);
  const buf = (await new GLTFExporter().parseAsync(wrap, { binary: true, animations: clips })) as ArrayBuffer;
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return { data: btoa(s), info: `tris ${tris}, clips ${clips.map((c) => `${c.name} ${c.duration.toFixed(2)}s`).join(', ')}` };
}

Object.assign(window, { dog, ready: true });
