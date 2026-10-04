// Signed off on the wall 2026-10-01.
import { shaderScene } from '../shaderScene';

export default shaderScene(
  { id: 'organic-cells', family: 'organic' },
  `
const vec3 DARK[3] = vec3[3](vec3(0.03, 0.08, 0.10), vec3(0.08, 0.03, 0.10), vec3(0.10, 0.06, 0.02));
const vec3 BODY[3] = vec3[3](vec3(0.20, 0.45, 0.40), vec3(0.40, 0.20, 0.50), vec3(0.50, 0.32, 0.12));
const vec3 EDGE[3] = vec3[3](vec3(0.75, 0.85, 0.70), vec3(0.85, 0.75, 0.90), vec3(0.95, 0.85, 0.65));
vec2 cellPoint(vec2 i) {
  return 0.5 + 0.4 * sin(u_time * mix(0.08, 0.25, seeded(2.0)) + 6.2832 * vec2(hash(i), hash(i + 17.0)));
}
void main() {
  int pal = int(seeded(3.0) * 3.0);                       // teal, violet or amber
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * (mix(2.5, 6.0, seeded(1.0)) - 0.8 * u_mids);
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(x, y);
    float d = length(o + cellPoint(i + o) - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  float edge = smoothstep(0.0, 0.08, d2 - d1);
  vec3 body = mix(DARK[pal], BODY[pal], 1.0 - d1);
  vec3 col = mix(EDGE[pal] * (0.4 + 0.4 * u_highs), body, edge);
  outColor = vec4(col * (0.6 + 0.3 * u_mids), 1.0);
}`,
);
