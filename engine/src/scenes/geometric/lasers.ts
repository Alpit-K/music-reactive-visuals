// Signed off on the wall 2026-10-01.
import { shaderScene } from '../shaderScene';

export default shaderScene(
  { id: 'geometric-lasers', family: 'geometric' },
  `
void main() {
  float origin = floor(seeded(1.0) * 3.0);                 // beams fan from the bottom, the top or the centre
  vec2 o = origin < 0.5 ? vec2(0.5, -0.1) : origin < 1.5 ? vec2(0.5, 1.1) : vec2(0.5);
  vec2 p = (gl_FragCoord.xy - o * u_res) / u_res.y;
  if (origin > 0.5 && origin < 1.5) p.y = -p.y;            // from the top: mirrored, so the beams point into the picture
  float a = atan(p.x, p.y);
  float base = 4.0 + 2.0 * floor(seeded(2.0) * 3.0), stride = 2.0 + floor(seeded(3.0) * 3.0);
  float beams = base + stride * mod(u_bar, 3.0);            // 4–16 beams, changing at each bar line
  float sweep = mix(0.2, 0.6, seeded(4.0)) * sin(1.5708 * u_beat + u_seed); // one sweep across and back every four beats
  float x = (a + sweep) * beams / 3.1416 + 0.5;
  float s = fract(x) - 0.5;
  float pulse = exp(-u_kick * 7.0);                        // 1 on the kick, gone in ~0.3 s
  float beam = exp(-abs(s) * (mix(60.0, 30.0, pulse) - 20.0 * u_highs)); // beams fatten on the kick
  float chase = mod(floor(x) + floor(u_beat), 2.0);        // alternate beams take the beat in turn
  float lvl = 0.2 + 0.8 * chase * exp(-u_phase * 2.5);
  vec3 hue = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + 0.12 * u_bar + u_seed * 0.01));
  float fade = smoothstep(1.4, 0.2, length(p));
  outColor = vec4(beam * hue * fade * lvl * (0.5 + 0.5 * pulse), 1.0);
}`,
);
