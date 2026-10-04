import { shaderScene } from '../shaderScene';

export const FLOW_FRAG = `
const vec3 DEEP[3] = vec3[3](vec3(0.02, 0.05, 0.12), vec3(0.06, 0.02, 0.10), vec3(0.02, 0.08, 0.05));
const vec3 WARM[3] = vec3[3](vec3(0.85, 0.55, 0.30), vec3(0.80, 0.35, 0.55), vec3(0.80, 0.75, 0.35));
const vec3 TINT[3] = vec3[3](vec3(0.10, 0.45, 0.55), vec3(0.25, 0.20, 0.60), vec3(0.15, 0.50, 0.30));
void main() {
  int pal = int(seeded(2.0) * 3.0);                       // ocean, dusk or moss
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * mix(1.8, 3.2, seeded(1.0));
  float t = u_time * 0.08;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + 0.6 * t), fbm(p + 3.5 * q + vec2(8.3, 2.8) - 0.6 * t));
  float f = fbm(p + (3.0 + 1.5 * u_mids) * r);
  vec3 col = mix(DEEP[pal], WARM[pal], f);
  col = mix(col, TINT[pal], clamp(length(q) * 0.6, 0.0, 1.0));
  outColor = vec4(col * (0.55 + 0.35 * u_mids + 0.15 * u_highs), 1.0);
}`;

export default shaderScene({ id: 'organic-flow', family: 'organic' }, FLOW_FRAG);
