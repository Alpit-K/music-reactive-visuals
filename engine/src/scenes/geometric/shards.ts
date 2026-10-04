import { shaderScene } from '../shaderScene';

// Bold, angular: a field of triangular shards, a different set lit on every beat, punching in on the kick.
export default shaderScene(
  { id: 'geometric-shards', family: 'geometric' },
  `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float pulse = exp(-u_kick * 5.0);                          // 1 on the kick, gone in ~0.4 s
  float a = u_seed + 0.04 * u_beat * (seeded(1.0) < 0.5 ? 1.0 : -1.0); // slow spin, either way
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  p *= mix(3.0, 7.0, seeded(2.0)) * (1.0 - 0.06 * pulse);   // shard size; the field punches in on the kick
  vec2 s = vec2(p.x + p.y * 0.57735, p.y * 1.1547);          // skewed onto a lattice of equilateral triangles
  vec2 c = floor(s), f = fract(s);
  float up = step(f.x + f.y, 1.0);                           // which triangle of the rhombus
  vec2 id = c * 2.0 + vec2(up, 0.0);
  float lit = step(mix(0.45, 0.7, seeded(3.0)), hash(id + floor(u_beat)));
  float shade = 0.2 + 0.8 * hash(id);
  float e = up > 0.5 ? min(min(f.x, f.y), 1.0 - f.x - f.y) : min(min(1.0 - f.x, 1.0 - f.y), f.x + f.y - 1.0);
  float edge = smoothstep(0.0, 0.05, e);
  vec3 hue = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.1, 0.2) + 0.15 * hash(id + 3.0) + u_seed * 0.01));
  outColor = vec4(hue * shade * (0.1 + lit * (0.5 + 0.4 * pulse)) * edge, 1.0);
}`,
);
