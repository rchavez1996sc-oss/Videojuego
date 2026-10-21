import * as THREE from 'three';
import {
  BloomEffect, BrightnessContrastEffect, EffectComposer, EffectPass, HueSaturationEffect,
  RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { preset, quality } from '../core/settings';

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly composer: EffectComposer;

  constructor(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera, exposure: number) {
    this.gl = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance', antialias: false, stencil: false, depth: true });
    this.gl.setPixelRatio(preset.pixelRatio);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMappingExposure = exposure;
    this.composer = new EffectComposer(this.gl, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    if (preset.ao) {
      const ao = new N8AOPostPass(scene, camera);
      ao.configuration.aoRadius = 2.5;
      ao.configuration.distanceFalloff = 1.2;
      ao.configuration.intensity = 2.2;
      ao.configuration.halfRes = true;
      ao.configuration.depthAwareUpsampling = true;
      ao.setQualityMode(quality === 'medium' ? 'Low' : 'Medium');
      this.composer.addPass(ao);
    }
    this.composer.addPass(new EffectPass(
      camera,
      new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.85, luminanceSmoothing: 0.2, mipmapBlur: true }),
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      new HueSaturationEffect({ saturation: 0.08 }),
      new BrightnessContrastEffect({ contrast: 0.06 }),
      new VignetteEffect({ offset: 0.3, darkness: 0.45 }),
    ));
    this.composer.addPass(new EffectPass(camera, new SMAAEffect()));
    this.resize(camera);
    addEventListener('resize', () => this.resize(camera));
  }

  setScale(scale: number): void {
    this.gl.setPixelRatio(preset.pixelRatio * scale);
    this.composer.setSize(innerWidth, innerHeight, false);
  }

  private resize(camera: THREE.PerspectiveCamera): void {
    const w = innerWidth, h = innerHeight;
    this.gl.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
