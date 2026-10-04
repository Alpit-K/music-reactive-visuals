import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';
import { FULLSCREEN_VERT, program } from '../../render/gl';
import type { RenderSize, Scene } from '../types';
import { ENABLED_PRESETS, PRESET_GAIN } from './presets';

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_res;
uniform float u_gain;
out vec4 outColor;
// Canvas rows upload top-first; GL's y runs bottom-up.
void main() { vec2 uv = gl_FragCoord.xy / u_res; outColor = vec4(texture(u_src, vec2(uv.x, 1.0 - uv.y)).rgb * u_gain, 1.0); }`;

const BLEND_S = 4;

/**
 * Butterchurn presets as scenes (design §6). One shared visualiser draws into its own canvas; each
 * frame that canvas is uploaded as a texture, so the compositor's flash limiter still governs it.
 * Butterchurn runs its own audio analysis and uses unseeded randomness internally — accepted for V1 (§8).
 */
export function createButterchurnScenes(audio: { ctx: AudioContext; source: AudioNode }, names: string[] = ENABLED_PRESETS): Scene[] {
  const all = butterchurnPresets.getPresets();
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const viz = butterchurn.default.createVisualizer(audio.ctx, canvas, { width: 1920, height: 1080 });
  viz.connectAudio(audio.source); // Butterchurn's graph ends at its analysers, never ctx.destination
  let renderedAt = -1;
  let size = { width: 1920, height: 1080 };

  // Per wall GL context: the texture and program, shared by all preset scenes.
  let gl: WebGL2RenderingContext | null = null;
  let tex: WebGLTexture | null = null;
  let prog: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let uploadedAt = -1;

  function ensureGl(g: WebGL2RenderingContext) {
    if (gl === g) return; // a lost context reloads the page (main.ts), so one context per page
    gl = g;
    prog = program(g, FULLSCREEN_VERT, FRAG);
    vao = g.createVertexArray();
    tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  }

  function frame(time: number, s: RenderSize) {
    if (s.width !== size.width || s.height !== size.height) {
      size = s;
      canvas.width = s.width;
      canvas.height = s.height;
      viz.setRendererSize(s.width, s.height);
    }
    if (renderedAt !== time) {
      viz.render(); // both crossfade slots may hold a preset: advance the shared visualiser once
      renderedAt = time;
    }
  }

  return names
    .filter((n) => n in all)
    .map((name) => ({
      id: `bc:${name}`,
      family: 'psychedelic' as const,
      source: 'butterchurn-presets 2.4.7',
      licence: 'MIT',
      enabled: true,
      init(g: WebGL2RenderingContext) {
        ensureGl(g);
        viz.loadPreset(all[name], BLEND_S);
      },
      render(time: number, _f: unknown, s: RenderSize) {
        const g = gl!;
        frame(time, s);
        g.useProgram(prog);
        g.bindVertexArray(vao);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, tex);
        if (uploadedAt !== time) {
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, canvas);
          uploadedAt = time;
        }
        g.uniform1i(g.getUniformLocation(prog!, 'u_src'), 0);
        g.uniform2f(g.getUniformLocation(prog!, 'u_res'), s.width, s.height);
        g.uniform1f(g.getUniformLocation(prog!, 'u_gain'), PRESET_GAIN[name] ?? 1);
        g.drawArrays(g.TRIANGLES, 0, 3);
      },
      dispose() {
        // The visualiser, texture and program are shared by every preset and live as long as the page.
      },
    }));
}
