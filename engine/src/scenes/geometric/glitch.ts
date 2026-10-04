import { shaderScene } from '../shaderScene';

// Rough and heavy: thick moving bars, sliced and jolted sideways by the hats, split into colour on the kick.
// Brightness flips happen per pixel, not per tile, so the flash limiter rarely has to step in.
export default shaderScene(
  { id: 'geometric-glitch', family: 'geometric' },
  `
float bars(float x, float width, float move) {
  float f = fract(x * width - move);
  return smoothstep(0.46, 0.5, f) - smoothstep(0.96, 1.0, f);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float rows = mix(12.0, 40.0, seeded(1.0));                // slice count
  float row = floor(gl_FragCoord.y / u_res.y * rows);
  float tick = floor(u_beat * 2.0);                          // new slice offsets every half beat
  float jolt = (hash(vec2(row, tick)) - 0.5) * (0.03 + 0.25 * u_highs) * step(0.55, hash(vec2(row * 1.7, tick)));
  float ang = mix(-0.6, 0.6, seeded(2.0));                  // bar angle
  vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (p + vec2(jolt, 0.0));
  float width = mix(5.0, 12.0, seeded(3.0));
  float move = u_beat * 0.5;                                 // half a bar width per beat
  float pulse = exp(-u_kick * 6.0);                          // 1 on the kick, gone in ~0.3 s
  float split = 0.015 * pulse;
  vec3 col = vec3(bars(q.x + split, width, move), bars(q.x, width, move), bars(q.x - split, width, move));
  vec3 hue = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + u_seed * 0.01));
  col *= mix(vec3(1.0), hue, 0.5);
  outColor = vec4(col * (0.45 + 0.2 * pulse) * smoothstep(1.3, 0.3, length(p)), 1.0);
}`,
);
