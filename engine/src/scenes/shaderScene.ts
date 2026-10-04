import { FULLSCREEN_VERT, program } from '../render/gl';
import type { Family, Features, RenderSize, Scene } from './types';

/** Prepended to every scene's fragment shader. Scenes write only main(). */
export const PRELUDE = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time, u_seed, u_sub, u_bass, u_mids, u_highs, u_kick, u_beat, u_phase, u_bar;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p + u_seed, vec2(127.1, 311.7))) * 43758.5453); }
// 0..1, fixed for one showing of a scene; each k is an independent draw. Scenes take their shape from it.
float seeded(float k) { return fract(sin(u_seed * 0.731 + k * 12.9898) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
`;

const UNIFORMS = ['u_res', 'u_time', 'u_seed', 'u_sub', 'u_bass', 'u_mids', 'u_highs', 'u_kick', 'u_beat', 'u_phase', 'u_bar', 'u_gain'] as const;

export function shaderScene(
  meta: { id: string; family: Family; source?: string; licence?: string; enabled?: boolean },
  frag: string,
  opts: { timeScale?: number; gain?: number; deaf?: boolean } = {},
): Scene {
  let gl: WebGL2RenderingContext | null = null;
  let prog: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let loc: Record<string, WebGLUniformLocation | null> = {};
  let seed = 0;
  const timeScale = opts.timeScale ?? 1;
  const gain = opts.gain ?? 1;

  return {
    id: meta.id,
    family: meta.family,
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
      loc = Object.fromEntries(UNIFORMS.map((u) => [u, g.getUniformLocation(prog!, u)]));
      seed = (s % 1000) + 0.5; // keeps hash() inputs in a range where float precision holds
    },
    render(time: number, f: Features, size: RenderSize) {
      if (!gl || !prog) return;
      const a = opts.deaf ? null : f;
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform2f(loc.u_res, size.width, size.height);
      gl.uniform1f(loc.u_time, time * timeScale);
      gl.uniform1f(loc.u_seed, seed);
      gl.uniform1f(loc.u_sub, a?.sub ?? 0);
      gl.uniform1f(loc.u_bass, a?.bass ?? 0);
      gl.uniform1f(loc.u_mids, a?.mids ?? 0);
      gl.uniform1f(loc.u_highs, a?.highs ?? 0);
      gl.uniform1f(loc.u_kick, Math.min(a?.sinceKick ?? 99, 99));
      gl.uniform1f(loc.u_beat, a?.beat ?? time * timeScale * 2);
      gl.uniform1f(loc.u_phase, a?.beatPhase ?? 0);
      gl.uniform1f(loc.u_bar, a?.bar ?? 0);
      gl.uniform1f(loc.u_gain, gain);
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
