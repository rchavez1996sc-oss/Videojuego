import * as THREE from 'three';
import {
  BlendFunction, BloomEffect, DepthOfFieldEffect, EffectComposer, EffectPass, LUT3DEffect, NoiseEffect,
  RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import { cinematicLut } from './grade';
import { SharpenEffect } from './sharpen';
import { N8AOPostPass } from 'n8ao';
import { onQuality, preset, quality } from '../core/settings';

/** Very faint animated film grain over everything. */
function grain(): NoiseEffect {
  const n = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
  n.blendMode.opacity.value = 0.12;
  return n;
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  private sharpen = new SharpenEffect(0.35);

  constructor(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera, exposure: number) {
    this.gl = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance', antialias: false, stencil: false, depth: true });
    this.gl.setPixelRatio(preset.pixelRatio);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = quality === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.gl.toneMappingExposure = exposure;
    this.composer = new EffectComposer(this.gl, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    {
      const ao = new N8AOPostPass(scene, camera);
      ao.configuration.aoRadius = 2.5;
      ao.configuration.distanceFalloff = 1.2;
      ao.configuration.intensity = 2.2;
      ao.configuration.halfRes = true;
      ao.configuration.depthAwareUpsampling = true;
      ao.setQualityMode(quality === 'ultra' ? 'Medium' : 'Low');
      Object.assign(ao, { autoDetectTransparency: false });
      ao.configuration.transparencyAware = false;
      ao.enabled = preset.ao;
      onQuality(() => (ao.enabled = preset.ao));
      this.composer.addPass(ao);
    }
    {
      const dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 30, worldFocusRange: 90, bokehScale: 1.1, resolutionScale: 0.5 });
      const pass = new EffectPass(camera, dof);
      pass.enabled = preset.ao;
      onQuality(() => (pass.enabled = preset.ao));
      this.composer.addPass(pass);
    }
    this.composer.addPass(new EffectPass(
      camera,
      new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.85, luminanceSmoothing: 0.2, mipmapBlur: true }),
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      new LUT3DEffect(cinematicLut()),
      new VignetteEffect({ offset: 0.28, darkness: 0.52 }),
      grain(),
    ));
    this.composer.addPass(new EffectPass(camera, new SMAAEffect()));
    this.composer.addPass(new EffectPass(camera, this.sharpen));
    this.resize(camera);
    addEventListener('resize', () => this.resize(camera));
  }

  /** Internal resolution scale; sharpening rises as it drops to offset the upscale blur. */
  setScale(scale: number): void {
    this.sharpen.strength = 0.35 + (1 - scale) * 2;
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
