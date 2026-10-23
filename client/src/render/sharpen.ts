import * as THREE from 'three';
import { Effect, EffectAttribute } from 'postprocessing';

/** Contrast-adaptive sharpening (after AMD's CAS): restores edge detail lost to AA and dynamic resolution. */
const FRAG = /* glsl */ `
uniform float strength;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  vec3 n = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;
  vec3 s = texture2D(inputBuffer, uv - vec2(0.0, texelSize.y)).rgb;
  vec3 e = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;
  vec3 w = texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0)).rgb;
  vec3 mn = min(c, min(min(n, s), min(e, w)));
  vec3 mx = max(c, max(max(n, s), max(e, w)));
  vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
  vec3 wt = -amp / mix(8.0, 4.5, strength);
  outputColor = vec4(max((c + (n + s + e + w) * wt) / (1.0 + 4.0 * wt), 0.0), inputColor.a);
}
`;

export class SharpenEffect extends Effect {
  constructor(strength = 0.4) {
    super('SharpenEffect', FRAG, { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map([['strength', new THREE.Uniform(strength)]]) });
  }

  set strength(v: number) {
    this.uniforms.get('strength')!.value = v;
  }
}
