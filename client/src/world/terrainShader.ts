import { NOISE_GLSL, PERTURB_GLSL } from '../render/glsl';

export const TERRAIN_VERT_PARS = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNormal;
`;

export const TERRAIN_VERT_MAIN = /* glsl */ `
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normal;
`;

export const TERRAIN_FRAG_PARS = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNormal;
uniform sampler2D uMask;
uniform sampler2D uSoil;
uniform sampler2D uRock;
uniform sampler2D uLawn;
uniform sampler2D uDryG;
uniform float uPhoto;
uniform float uSize;
uniform float uSnowLine;
uniform vec3 uGrassLush, uGrassDry, uDirt, uRoad, uRockTint, uSnow;
${NOISE_GLSL}
${PERTURB_GLSL}
vec3 triplanar(sampler2D t, vec3 p, vec3 n, float s) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= dot(w, vec3(1.0));
  return texture2D(t, p.yz * s).rgb * w.x + texture2D(t, p.xz * s).rgb * w.y + texture2D(t, p.xy * s).rgb * w.z;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

export const TERRAIN_FRAG_MAP = /* glsl */ `
vec2 muv = vWPos.xz / uSize + 0.5;
vec4 m = texture2D(uMask, muv);
vec3 wn = normalize(vWNormal);
float slope = 1.0 - wn.y;
float camDist = length(vWPos - cameraPosition);
float n1 = tq_fbm(vWPos.xz * 0.03);
float n2 = tq_fbm(vWPos.xz * 0.35);
float n3 = tq_noise(vWPos.xz * 3.1) * (1.0 - smoothstep(4.0, 18.0, camDist));

vec3 soilA = texture2D(uSoil, vWPos.xz * 0.33).rgb;
vec3 soilB = texture2D(uSoil, vWPos.xz * 0.047).rgb;
vec3 soilC = mix(soilA, soilB, smoothstep(3.0, 18.0, camDist));
vec3 rockC = triplanar(uRock, vWPos, wn, 0.11) * mix(vec3(1.0), triplanar(uRock, vWPos, wn, 0.013) * 1.6, 0.5);

float dryness = smoothstep(-0.25, 0.45, n1 + vWPos.y * 0.008);
vec3 grass = mix(uGrassLush, uGrassDry, dryness);
float far = smoothstep(5.0, 30.0, camDist);
vec3 lawnC = mix(triplanar(uLawn, vWPos, wn, 0.42), triplanar(uLawn, vWPos, wn, 0.071), far * 0.6);
vec3 dryC = mix(triplanar(uDryG, vWPos, wn, 0.38), triplanar(uDryG, vWPos, wn, 0.063), far * 0.6);
vec3 blades = mix(lawnC, dryC, dryness) * 4.6;
grass = mix(grass * (0.78 + 0.28 * n2 + 0.12 * n3), grass * blades * (0.86 + 0.2 * n2), uPhoto);
grass = mix(grass, grass * soilC * 2.0, 0.25 * (1.0 - uPhoto));

float bareK = m.b * m.a * 0.16;
float rockW = smoothstep(0.24 - bareK, 0.4 - bareK, slope + n2 * 0.08) * m.a;
float dirtW = max(m.b * 0.85, (1.0 - m.g) * 0.55) * (1.0 - rockW);
vec3 col = mix(grass, uDirt * soilC * 2.1, dirtW);
col = mix(col, uRoad * soilC * 2.2, m.r * (1.0 - rockW));
col = mix(col, uRockTint * rockC * 2.0, rockW);
float snow = smoothstep(uSnowLine, uSnowLine + 25.0, vWPos.y + n1 * 30.0) * (1.0 - smoothstep(0.45, 0.7, slope));
col = mix(col, uSnow * (0.92 + 0.08 * n3), snow);
float cavity = 0.82 + 0.18 * smoothstep(-0.6, 0.4, n2);
diffuseColor.rgb = col * cavity;

float tBump = (mix(lum(soilC), lum(blades) * 0.25, uPhoto * (1.0 - dirtW)) * (1.0 - rockW) + lum(rockC) * rockW * 2.0 + n3 * 0.05) * (1.0 - snow * 0.8);
tBump *= 1.0 - smoothstep(6.0, 35.0, camDist);
float tRough = mix(mix(0.97, 0.9, m.r), 0.82, rockW);
tRough = mix(tRough, 0.55, snow);
`;

export const TERRAIN_FRAG_ROUGH = /* glsl */ `
float roughnessFactor = tRough;
`;

export const TERRAIN_FRAG_NORMAL = /* glsl */ `
normal = tq_perturb(-vViewPosition, normal, vec2(dFdx(tBump), dFdy(tBump)) * 0.8);
`;
