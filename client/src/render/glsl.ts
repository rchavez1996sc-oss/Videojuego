export const NOISE_GLSL = /* glsl */ `
float tq_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tq_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tq_hash(i), tq_hash(i + vec2(1, 0)), u.x), mix(tq_hash(i + vec2(0, 1)), tq_hash(i + vec2(1, 1)), u.x), u.y) * 2.0 - 1.0;
}
float tq_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += tq_noise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

export const PERTURB_GLSL = /* glsl */ `
vec3 tq_perturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy) {
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;
