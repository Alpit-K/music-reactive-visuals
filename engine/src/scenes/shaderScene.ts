import { FULLSCREEN_VERT, program } from '../render/gl';
import type { Features, RenderSize, Scene } from './types';

/** Uniforms and helpers shared by every scene shader, fragment or vertex. */
export const COMMON = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time, u_seed, u_sub, u_bass, u_swell, u_mids, u_highs, u_kick, u_beat, u_phase, u_bar;
// Noise takes its seed from the caller, not u_seed: during a morph one program draws two swarms with two seeds.
float hash(vec2 p, float sd) { return fract(sin(dot(p + sd, vec2(127.1, 311.7))) * 43758.5453); }
// 0..1, fixed for one showing of a scene; each k is an independent draw. Scenes take their shape from it.
float seeded(float k) { return fract(sin(u_seed * 0.731 + k * 12.9898) * 43758.5453); }
float noise(vec2 p, float sd) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i, sd), hash(i + vec2(1, 0), sd), u.x), mix(hash(i + vec2(0, 1), sd), hash(i + vec2(1, 1), sd), u.x), u.y);
}
float fbm(vec2 p, float sd) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p, sd); p *= 2.02; a *= 0.5; }
  return v;
}
`;

/** Prepended to every scene's fragment shader. Scenes write only main(). */
export const PRELUDE = `${COMMON}out vec4 outColor;
`;

const UNIFORMS = ['u_res', 'u_time', 'u_seed', 'u_sub', 'u_bass', 'u_swell', 'u_mids', 'u_highs', 'u_kick', 'u_beat', 'u_phase', 'u_bar', 'u_gain'] as const;
type Locations = Record<string, WebGLUniformLocation | null>;

export interface SceneOpts { timeScale?: number; gain?: number; deaf?: boolean }

export const uniformLocations = (g: WebGL2RenderingContext, prog: WebGLProgram): Locations =>
  Object.fromEntries(UNIFORMS.map((u) => [u, g.getUniformLocation(prog, u)]));

/** Keeps hash() inputs in a range where float precision holds. */
export const shaderSeed = (s: number) => (s % 1000) + 0.5;

/** Feeds the shared uniforms; the program must be in use. */
export function setUniforms(gl: WebGL2RenderingContext, loc: Locations, seed: number, time: number, f: Features, size: RenderSize, opts: SceneOpts) {
  const a = opts.deaf ? null : f;
  const timeScale = opts.timeScale ?? 1;
  gl.uniform2f(loc.u_res, size.width, size.height);
  gl.uniform1f(loc.u_time, time * timeScale);
  gl.uniform1f(loc.u_seed, seed);
  gl.uniform1f(loc.u_sub, a?.sub ?? 0);
  gl.uniform1f(loc.u_bass, a?.bass ?? 0);
  gl.uniform1f(loc.u_swell, a?.swell ?? 0);
  gl.uniform1f(loc.u_mids, a?.mids ?? 0);
  gl.uniform1f(loc.u_highs, a?.highs ?? 0);
  gl.uniform1f(loc.u_kick, Math.min(a?.sinceKick ?? 99, 99));
  gl.uniform1f(loc.u_beat, a?.beat ?? time * timeScale * 2);
  gl.uniform1f(loc.u_phase, a?.beatPhase ?? 0);
  gl.uniform1f(loc.u_bar, a?.bar ?? 0);
  gl.uniform1f(loc.u_gain, opts.gain ?? 1);
}

export function shaderScene(
  meta: { id: string; source?: string; licence?: string; enabled?: boolean },
  frag: string,
  opts: SceneOpts = {},
): Scene {
  let gl: WebGL2RenderingContext | null = null;
  let prog: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let loc: Locations = {};
  let seed = 0;

  return {
    id: meta.id,
    source: meta.source ?? 'original',
    licence: meta.licence ?? 'project',
    enabled: meta.enabled ?? true,
    init(g, s) {
      gl = g;
      // gain is applied in the wrapper so every scene's main() stays plain.
      const src = `${PRELUDE}uniform float u_gain;\n${frag.replace(/void\s+main\s*\(\s*\)/, 'void sceneMain()')}
void main() { sceneMain(); outColor.rgb *= u_gain; outColor.a = 1.0; }`;
      prog = program(g, FULLSCREEN_VERT, src);
      vao = g.createVertexArray();
      loc = uniformLocations(g, prog);
      seed = shaderSeed(s);
    },
    render(time: number, f: Features, size: RenderSize) {
      if (!gl || !prog) return;
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      setUniforms(gl, loc, seed, time, f, size, opts);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      if (gl && prog) gl.deleteProgram(prog);
      if (gl && vao) gl.deleteVertexArray(vao);
      prog = null;
      vao = null;
    },
  };
}
