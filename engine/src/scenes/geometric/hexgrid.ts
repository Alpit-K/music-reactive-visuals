// Off since 2026-10-02: the dimmest scene and the least different between showings. Rework before enabling.
import { shaderScene } from '../shaderScene';

export default shaderScene(
  { id: 'geometric-hexgrid', family: 'geometric', enabled: false },
  `
vec4 hex(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * mix(6.0, 13.0, seeded(1.0)); // cell size
  vec4 h = hex(p);
  vec2 q = abs(h.xy);
  float edge = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
  float line = smoothstep(0.5, 0.46, edge) - smoothstep(0.44, 0.40, edge);
  float mode = floor(seeded(2.0) * 3.0);               // the beat travels out in rings, across in rows or along diagonals
  float ring = floor((mode < 0.5 ? length(h.zw) : mode < 1.5 ? abs(h.w) : abs(h.z + h.w) * 0.7) * 0.9);
  float lit = step(abs(ring - mod(floor(u_beat), 8.0)), 0.5) * exp(-u_phase * 3.0);
  vec3 hue = 0.5 + 0.5 * cos(6.2832 * (vec3(0.6, 0.7, 0.9) + mix(0.03, 0.12, seeded(3.0)) * ring + u_seed * 0.01));
  outColor = vec4(hue * (0.12 * line + 0.6 * lit * line + 0.12 * lit) * (0.8 + 0.4 * u_highs), 1.0);
}`,
);
