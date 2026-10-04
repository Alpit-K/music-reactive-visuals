// Signed off on the wall 2026-10-01.
import { shaderScene } from '../shaderScene';

export default shaderScene(
  { id: 'geometric-rings', family: 'geometric' },
  `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float bars = u_beat / 4.0;
  float turn = (seeded(1.0) < 0.5 ? 1.0 : -1.0) * (seeded(2.0) < 0.5 ? 0.7854 : 0.5236);
  float a = turn * (floor(bars) + smoothstep(0.0, 0.25, fract(bars))) + u_seed; // eased 45° or 30° turn at each bar
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  float shape = floor(seeded(3.0) * 3.0);             // square, circle or hexagon
  float d = shape < 0.5 ? max(abs(p.x), abs(p.y)) : shape < 1.5 ? length(p) : max(abs(p.x) * 0.866 + abs(p.y) * 0.5, abs(p.y));
  float z = mix(0.08, 0.18, seeded(4.0)) / max(d, 0.02) + u_beat; // tunnel depth, moving one ring per beat
  float pulse = exp(-u_kick * 6.0);                   // 1 on the kick, gone in ~0.3 s
  float ring = smoothstep(0.0, 0.06, abs(fract(z) - 0.5) - (0.42 - 0.12 * pulse)); // rings thicken on the kick
  vec3 hue = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + floor(z) * mix(0.04, 0.12, seeded(5.0)) + u_seed * 0.01));
  vec3 col = ring * hue * (0.4 + 0.5 * pulse + 0.3 * u_highs) * smoothstep(0.0, 0.25, d);
  outColor = vec4(col, 1.0);
}`,
);
