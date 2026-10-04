// Signed off on the wall 2026-10-01.
import { shaderScene } from '../shaderScene';

export default shaderScene(
  { id: 'organic-curves', family: 'organic' },
  `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float r = length(p), a = atan(p.y, p.x);
  float k = 3.0 + floor(mod(u_seed, 4.0));                // petals, fixed per showing
  vec3 col = vec3(0.0);
  for (int n = 0; n < 4; n++) {
    float fn = float(n);
    float phase = u_time * (0.05 + 0.02 * fn);
    float rose = mix(0.24, 0.36, seeded(1.0)) * cos(k * a + phase) + 0.05 * fn * sin(u_time * 0.1 + fn);
    float d = abs(r - abs(rose) - 0.04 * fn);
    vec3 hue = 0.5 + 0.5 * cos(6.2832 * (vec3(0.55, 0.65, 0.8) + 0.08 * fn + seeded(2.0)));
    col += hue * 0.0035 / (d + 0.002) * (0.5 + 0.5 * u_mids);
  }
  col *= smoothstep(0.75, 0.2, r);
  outColor = vec4(min(col, vec3(1.0)) * 0.8, 1.0);
}`,
);
