import { CONFIG } from '../config';
import { SILENT, type Echo, type Features, type Scene, type Transition } from '../scenes/types';
import { FlashLimiter } from './flashLimiter';
import { FULLSCREEN_VERT, createTarget, deleteTarget, program, type Target } from './gl';

const DECODE = `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }`;

// Mix two textures in linear light: crossfades (u_t = progress) and the limiter's damping (u_t = alpha).
const MIX_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_a, u_b;
uniform float u_t;
uniform vec2 u_res;
out vec4 outColor;
${DECODE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 a = toLinear(texture(u_a, uv).rgb), b = toLinear(texture(u_b, uv).rgb);
  outColor = vec4(toSrgb(mix(a, b, u_t)), 1.0);
}`;

// One output pixel per tile: mean linear RGB over a 16 × 12 sample grid.
const TILES_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_src;
out vec4 outColor;
${DECODE}
void main() {
  vec2 tile = floor(gl_FragCoord.xy);
  vec2 size = vec2(${CONFIG.flash.tilesX}.0, ${CONFIG.flash.tilesY}.0);
  vec3 sum = vec3(0.0);
  for (int y = 0; y < 12; y++) for (int x = 0; x < 16; x++) {
    vec2 uv = (tile + (vec2(x, y) + 0.5) / vec2(16.0, 12.0)) / size;
    sum += toLinear(texture(u_src, uv).rgb);
  }
  outColor = vec4(sum / 192.0, 1.0);
}`;

// The echo (CONFIG.echo): the brighter of the new picture and the last echo — zoomed about the centre, dimmed in linear
// light, less the floor. Inward, what the zoom pulls in from past the edges is black, not the edge pixels smeared.
const ECHO_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_new, u_old;
uniform float u_zoom, u_keep, u_floor;
uniform vec2 u_res;
out vec4 outColor;
${DECODE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 from = (uv - 0.5) / u_zoom + 0.5;
  vec3 old = vec3(0.0);
  if (all(greaterThanEqual(from, vec2(0.0))) && all(lessThanEqual(from, vec2(1.0)))) {
    old = max(toSrgb(toLinear(texture(u_old, from).rgb) * u_keep) - u_floor, 0.0);
  }
  outColor = vec4(max(texture(u_new, uv).rgb, old), 1.0);
}`;

/** One frame of an echo style `dt` seconds long: how much the echo grows, and the share of its light it keeps. `length`
 *  scales the half-life — and with it how far the wake reaches — 1 in full, falling to 0 as the echo is let go. */
export function echoStep(echo: Exclude<Echo, 'off'>, dt: number, length = 1): { zoom: number; keep: number } {
  const s = CONFIG.echo.styles[echo];
  return { zoom: Math.exp(s.zoomPerS * dt), keep: length > 0 ? 0.5 ** (dt / (s.halfLifeS * length)) : 0 };
}

const BLIT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_res;
out vec4 outColor;
void main() { outColor = vec4(texture(u_src, gl_FragCoord.xy / u_res).rgb, 1.0); }`;

interface Slot {
  scene: Scene;
  target: Target;
}

/** Renders scenes, crossfades, applies the flash limiter and the render scale (design §4, §6, §7). */
export class Compositor {
  currentId: string | null = null;
  damped = false;
  private limiter = new FlashLimiter();
  private scale = 1;
  private a: Slot | null = null;
  private b: Slot | null = null;
  private fadeStart = 0;
  private fadeS = 0;
  private cand!: Target;
  private out!: [Target, Target];
  private outIdx = 0;
  private echo: Echo = 'off'; // the echo drawn, which stays on while it is let go
  private release: number | null = null; // 0..1 through letting the echo go, or null when it is not going
  private echoes!: [Target, Target];
  private echoIdx = 0;
  private lastTime: number | null = null;
  private tiles: Target;
  private tileBuf = new Uint8Array(CONFIG.flash.tilesX * CONFIG.flash.tilesY * 4);
  private tileLin = new Float32Array(CONFIG.flash.tilesX * CONFIG.flash.tilesY * 3);
  private mixProg: WebGLProgram;
  private tilesProg: WebGLProgram;
  private blitProg: WebGLProgram;
  private echoProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private black: Target;

  constructor(private gl: WebGL2RenderingContext, private onSceneError: (id: string, err: unknown) => void) {
    this.mixProg = program(gl, FULLSCREEN_VERT, MIX_FRAG);
    this.tilesProg = program(gl, FULLSCREEN_VERT, TILES_FRAG);
    this.blitProg = program(gl, FULLSCREEN_VERT, BLIT_FRAG);
    this.echoProg = program(gl, FULLSCREEN_VERT, ECHO_FRAG);
    this.vao = gl.createVertexArray()!;
    this.tiles = createTarget(gl, CONFIG.flash.tilesX, CONFIG.flash.tilesY);
    this.black = createTarget(gl, 1, 1);
    this.allocate();
  }

  private get size() {
    return { width: Math.round(CONFIG.base.width * this.scale), height: Math.round(CONFIG.base.height * this.scale) };
  }

  private allocate(): void {
    const { width, height } = this.size;
    this.cand = createTarget(this.gl, width, height);
    this.out = [createTarget(this.gl, width, height), createTarget(this.gl, width, height)];
    this.echoes = [createTarget(this.gl, width, height), createTarget(this.gl, width, height)];
  }

  setScale(scale: number): void {
    const gl = this.gl;
    this.scale = scale;
    [this.cand, ...this.out, ...this.echoes].forEach((t) => deleteTarget(gl, t));
    this.allocate();
    for (const slot of [this.a, this.b]) {
      if (!slot) continue;
      deleteTarget(gl, slot.target);
      slot.target = createTarget(gl, this.size.width, this.size.height);
    }
  }

  /** The echo from now on. Turned on, it starts from black, not from whatever it last held. Turned off, its wake shrinks
   *  away over CONFIG.echo.releaseBeats rather than in one frame — an out halo can cover most of the screen. */
  get drawnEcho(): Echo {
    return this.echo;
  }

  setEcho(echo: Echo): void {
    const gl = this.gl;
    if (echo === 'off') {
      if (this.echo !== 'off') this.release ??= 0;
      return;
    }
    this.release = null;
    if (this.echo === 'off') {
      for (const t of this.echoes) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    this.echo = echo;
  }

  show(scene: Scene, seed: number, crossfadeS: number, time: number, colour: 'near' | 'own' = 'near', transition: Transition = { kind: 'morph', style: 0 }): void {
    const gl = this.gl;
    if (this.b) this.finishFade(); // a new decision mid-fade: the incoming scene becomes current at once
    if (this.a?.scene === scene) {
      // Already showing (e.g. idle drift at start): a Scene object holds one GL program, so never init it twice.
      this.currentId = scene.id;
      return;
    }
    const slot: Slot = { scene, target: createTarget(gl, this.size.width, this.size.height) };
    if (!this.safe(scene, () => scene.init(gl, seed))) {
      deleteTarget(gl, slot.target);
      return;
    }
    this.currentId = scene.id;
    if (!this.a || crossfadeS <= 0) {
      if (this.a) this.drop(this.a);
      this.a = slot;
      return;
    }
    // Swarm to swarm: the points flow from one scene into the next, instead of two pictures crossfading.
    if (scene.morphFrom?.(this.a.scene, time, crossfadeS, colour, transition)) {
      this.drop(this.a);
      this.a = slot;
      return;
    }
    this.b = slot;
    this.fadeStart = time;
    this.fadeS = crossfadeS;
  }

  /**
   * Before the set, runs each scene through what a live switch does — init, one frame, dispose — so its
   * shaders compile and its GPU pipelines are built now, not on the frame it first appears (spike-findings §6).
   * Never pass a scene that is showing: dispose would take its program.
   */
  warmUp(scenes: Scene[]): void {
    const gl = this.gl;
    const size = this.size;
    const target = createTarget(gl, size.width, size.height);
    scenes.forEach((scene, i) => {
      this.safe(scene, () => {
        scene.init(gl, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        gl.viewport(0, 0, size.width, size.height);
        gl.bindVertexArray(this.vao);
        scene.render(-(i + 1), SILENT, size); // negative: distinct per scene, never a session time
        scene.dispose();
      });
    });
    deleteTarget(gl, target);
  }

  render(time: number, f: Features): void {
    const gl = this.gl;
    const size = this.size;
    gl.bindVertexArray(this.vao);
    for (const slot of [this.a, this.b]) {
      if (!slot) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, slot.target.fb);
      gl.viewport(0, 0, size.width, size.height);
      if (!this.safe(slot.scene, () => slot.scene.render(time, f, size))) {
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    gl.bindVertexArray(this.vao);

    const progress = this.b ? Math.min(1, (time - this.fadeStart) / this.fadeS) : 0;
    this.mix(this.a?.target ?? this.black, this.b?.target ?? this.black, progress, this.cand);
    const dt = this.lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastTime)); // a stalled page is no reason to jump
    this.lastTime = time;
    if (this.release !== null) {
      this.release += dt / ((CONFIG.echo.releaseBeats * 60) / (f.bpm ?? CONFIG.motion.fallbackBpm));
      if (this.release >= 1) {
        this.echo = 'off';
        this.release = null;
      }
    }
    const picture = this.echo === 'off' ? this.cand : this.echoPass(this.echo, dt, 1 - (this.release ?? 0));

    // Tile stats → limiter → damped output.
    gl.useProgram(this.tilesProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tiles.fb);
    gl.viewport(0, 0, CONFIG.flash.tilesX, CONFIG.flash.tilesY);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, picture.tex);
    gl.uniform1i(gl.getUniformLocation(this.tilesProg, 'u_src'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, CONFIG.flash.tilesX, CONFIG.flash.tilesY, gl.RGBA, gl.UNSIGNED_BYTE, this.tileBuf);
    for (let i = 0; i < this.tileLin.length / 3; i++) {
      for (let c = 0; c < 3; c++) this.tileLin[i * 3 + c] = this.tileBuf[i * 4 + c] / 255;
    }
    const alpha = this.limiter.step(time, this.tileLin);
    this.damped = this.limiter.damped;

    const prev = this.out[this.outIdx];
    this.outIdx = 1 - this.outIdx;
    const next = this.out[this.outIdx];
    this.mix(prev, picture, alpha, next);

    gl.useProgram(this.blitProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, next.tex);
    gl.uniform1i(gl.getUniformLocation(this.blitProg, 'u_src'), 0);
    gl.uniform2f(gl.getUniformLocation(this.blitProg, 'u_res'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (this.b && progress >= 1) this.finishFade();
  }

  // Before the limiter, so it judges the picture with its echo: an echo only ever adds light that was on screen a moment ago.
  private echoPass(echo: Exclude<Echo, 'off'>, dt: number, length: number): Target {
    const gl = this.gl;
    const { zoom, keep } = echoStep(echo, dt, length);
    const old = this.echoes[this.echoIdx];
    this.echoIdx = 1 - this.echoIdx;
    const into = this.echoes[this.echoIdx];
    gl.useProgram(this.echoProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.fb);
    gl.viewport(0, 0, into.width, into.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cand.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, old.tex);
    gl.uniform1i(gl.getUniformLocation(this.echoProg, 'u_new'), 0);
    gl.uniform1i(gl.getUniformLocation(this.echoProg, 'u_old'), 1);
    gl.uniform1f(gl.getUniformLocation(this.echoProg, 'u_zoom'), zoom);
    gl.uniform1f(gl.getUniformLocation(this.echoProg, 'u_keep'), keep);
    gl.uniform1f(gl.getUniformLocation(this.echoProg, 'u_floor'), CONFIG.echo.floor);
    gl.uniform2f(gl.getUniformLocation(this.echoProg, 'u_res'), into.width, into.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return into;
  }

  private mix(a: Target, b: Target, t: number, into: Target): void {
    const gl = this.gl;
    gl.useProgram(this.mixProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.fb);
    gl.viewport(0, 0, into.width, into.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b.tex);
    gl.uniform1i(gl.getUniformLocation(this.mixProg, 'u_a'), 0);
    gl.uniform1i(gl.getUniformLocation(this.mixProg, 'u_b'), 1);
    gl.uniform1f(gl.getUniformLocation(this.mixProg, 'u_t'), t);
    gl.uniform2f(gl.getUniformLocation(this.mixProg, 'u_res'), into.width, into.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private finishFade(): void {
    if (this.a) this.drop(this.a);
    this.a = this.b;
    this.b = null;
  }

  private drop(slot: Slot): void {
    this.safe(slot.scene, () => slot.scene.dispose());
    deleteTarget(this.gl, slot.target);
  }

  /** Runs a scene call; on error reports it and removes the scene from both slots. */
  private safe(scene: Scene, fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (err) {
      if (this.a?.scene === scene) this.a = null;
      if (this.b?.scene === scene) this.b = null;
      this.onSceneError(scene.id, err);
      return false;
    }
  }
}
