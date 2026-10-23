import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { preset, quality } from '../core/settings';
import { weathering } from './weathering';
import type { BiomeDef } from '../data/types';

type Hook = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => void;

export class Lighting {
  readonly csm: CSM;
  readonly sunDir = new THREE.Vector3();

  constructor(private scene: THREE.Scene, camera: THREE.PerspectiveCamera, gl: THREE.WebGLRenderer, biome: BiomeDef) {
    const phi = THREE.MathUtils.degToRad(90 - biome.sunElevation);
    const theta = THREE.MathUtils.degToRad(biome.sunAzimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);

    const sky = new Sky();
    sky.scale.setScalar(20000);
    const u = sky.material.uniforms;
    u.turbidity.value = biome.turbidity;
    u.rayleigh.value = biome.rayleigh;
    u.mieCoefficient.value = biome.mieCoefficient;
    u.mieDirectionalG.value = biome.mieDirectionalG;
    u.sunPosition.value.copy(this.sunDir);
    scene.add(sky);

    const envScene = new THREE.Scene();
    const envSky = sky.clone();
    envScene.add(envSky);
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = biome.ambient * 2.2;
    pmrem.dispose();

    scene.fog = new THREE.FogExp2(biome.fogColor, biome.fogDensity);
    scene.add(new THREE.HemisphereLight('#c9d6e8', '#5a4a38', biome.ambient * 0.6));

    this.csm = new CSM({
      camera,
      parent: scene,
      cascades: preset.cascades,
      maxFar: preset.shadowFar,
      mode: 'practical',
      shadowMapSize: preset.shadowMapSize,
      shadowBias: -0.0002,
      lightDirection: this.sunDir.clone().negate(),
      lightIntensity: biome.sunIntensity,
      lightMargin: 120,
      lightFar: 1200,
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) {
      l.color.set(biome.sunColor);
      l.shadow.normalBias = 0.04;
    }
  }

  /** Registers a material with CSM; optional hook runs after CSM's own shader patch. */
  setup<T extends THREE.Material>(mat: T, key: string, hook?: Hook): T {
    this.csm.setupMaterial(mat);
    mat.customProgramCacheKey = () => key;
    const csmHook = mat.onBeforeCompile.bind(mat), wear = quality !== 'low';
    mat.onBeforeCompile = (shader, r) => {
      csmHook(shader, r);
      hook?.(shader, r);
      if (wear) weathering(shader, key);
    };
    return mat;
  }

  private lastCam = new THREE.Matrix4();
  private tick = 0;

  /**
   * Outer cascades re-render every other frame only while the camera holds still: CSM moves their light frustums
   * every frame, so a skipped re-render while turning would sample a stale map and make the shadows jump.
   */
  update(camera: THREE.Camera): void {
    this.csm.update();
    const e = camera.matrixWorld.elements, l = this.lastCam.elements;
    let moved = false;
    for (let i = 0; i < 16 && !moved; i++) moved = Math.abs(e[i] - l[i]) > (i >= 12 ? 0.6 : 0.004);
    if (moved) this.lastCam.copy(camera.matrixWorld);
    const odd = ++this.tick % 2 === 1;
    this.csm.lights.forEach((l, i) => {
      l.shadow.autoUpdate = i === 0;
      if (i > 0) l.shadow.needsUpdate = moved || odd;
    });
  }

  get fogColor(): THREE.Color {
    return (this.scene.fog as THREE.FogExp2).color;
  }
}
