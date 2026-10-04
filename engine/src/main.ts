import { Analysis } from './analysis/analysis';
import { openBlackHole, reopenBlackHole, type Capture } from './audio/capture';
import { showNoAudioNote, streamAction, type GuardState } from './audio/streamGuard';
import { CONFIG } from './config';
import { Director, type Decision, type DirectorInput } from './director/director';
import { overlayText } from './overlay';
import { Compositor } from './render/compositor';
import { FrameWatch } from './render/frameWatch';
import { interludeRole, WALL_PRESETS } from './scenes/interlude';
import { createButterchurnScenes } from './scenes/psychedelic/butterchurn';
import { loadShaderScenes } from './scenes/registry';
import { SILENT, type Features, type Scene } from './scenes/types';
import { loadCarry, saveCarry } from './session/carry';
import { LogSink } from './session/logSink';
import { sessionId } from './session/session';

const params = new URLSearchParams(location.search);
const $ = (id: string) => document.getElementById(id)!;
const session = sessionId();
const sceneLog = new LogSink(session, 'scene-log');
const frameLog = new LogSink(session, 'frames');
const featureLog = params.get('features') === '1' ? new LogSink(session, 'features') : null;
setInterval(() => [sceneLog, frameLog, featureLog].forEach((s) => void s?.flush()), 5000);

const t0 = performance.now();
const nowS = () => (performance.now() - t0) / 1000;
// Survives a reload within the session (a lost context): render scale, disabled scenes.
const carry = loadCarry(sessionStorage);
const guard: GuardState = { sessionStartS: 0, lastAudioS: null, lastReopenS: null };
const keep = () => saveCarry(sessionStorage, carry);

async function start() {
  $('start').remove();
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen().catch(() => {});

  const canvas = $('wall') as HTMLCanvasElement;
  let running = true;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false })!;
  let director: Director | null = null;
  let input: DirectorInput = { time: 0, bar: 0, barLine: false, bpm: null, character: 'main', breakdown: false, idle: true, surge: false, interlude: false };
  const scenes = new Map<string, Scene>();

  const onSceneError = (id: string, err: unknown) => {
    sceneLog.push({ time: nowS(), event: 'scene-error', sceneId: id, error: String(err) });
    if (!carry.disabled.includes(id)) carry.disabled.push(id);
    keep();
    const dec = director?.disable(id, input);
    if (dec) apply(dec);
  };
  const compositor = new Compositor(gl, onSceneError);
  const watch = new FrameWatch(carry.scale);
  if (watch.scale < 1) compositor.setScale(watch.scale);

  function apply(dec: Decision) {
    sceneLog.push(dec);
    compositor.show(scenes.get(dec.sceneId)!, dec.seed, dec.crossfadeS, nowS());
  }

  for (const s of loadShaderScenes()) if (s.enabled) scenes.set(s.id, s);
  compositor.warmUp([...scenes.values()]);
  const idle = [...scenes.values()].find((s) => s.family === 'idle')!;
  compositor.show(idle, 1, 0, 0); // drift until audio and the director are up

  // A lost context (GPU process crash) also takes Butterchurn's own context, which never recovers, and any
  // scene set up meanwhile would fail and be disabled. Reloading rebuilds everything.
  canvas.addEventListener('webglcontextlost', () => {
    running = false;
    sceneLog.push({ time: nowS(), event: 'context-lost' });
    void sceneLog.flush().then(() => location.reload());
  });

  let capture: Capture | null = null;
  const analysis = new Analysis();
  let features: Features = SILENT;
  let freq = new Float32Array(CONFIG.fftSize / 2);
  let wave = new Float32Array(CONFIG.fftSize);

  async function tryAudio() {
    try {
      capture = await openBlackHole();
      navigator.mediaDevices.addEventListener('devicechange', () => {
        guard.lastAudioS = Math.min(guard.lastAudioS ?? 0, nowS() - CONFIG.stream.silentS); // recheck now
      });
      try {
        const bc = createButterchurnScenes(capture, WALL_PRESETS);
        compositor.warmUp(bc);
        for (const s of bc) scenes.set(s.id, s);
      } catch (e) {
        // Unmaintained dependency (design §3): without it, peaks fall back to idle drift.
        sceneLog.push({ time: nowS(), event: 'butterchurn-unavailable', error: String(e) });
      }
      director = new Director([...scenes.values()].map((s) => ({ id: s.id, family: s.family, interlude: interludeRole(s.id) })), Number(session.replace(/\D/g, '').slice(-9)));
      for (const id of carry.disabled) director.disable(id, input);
    } catch (e) {
      sceneLog.push({ time: nowS(), event: 'audio-unavailable', error: String(e) });
      setTimeout(tryAudio, CONFIG.stream.retryS * 1000);
    }
  }
  await tryAudio();

  let overlayOn = false;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'q') {
      void Promise.all([sceneLog, frameLog, featureLog].map((s) => s?.flush())).then(() => fetch('/quit', { method: 'POST' }));
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      running = false;
    } else if (e.key === 'd') {
      overlayOn = !overlayOn;
      $('overlay').style.display = overlayOn ? 'block' : 'none';
    }
  });

  let last = performance.now();
  let dampedFrames = 0; // frames the flash limiter held back in the current second
  function frame(now: number) {
    if (!running) return;
    const t = (now - t0) / 1000;
    const action = watch.frame(t, now - last);
    last = now;

    if (capture) {
      capture.analyser.getFloatFrequencyData(freq);
      capture.analyser.getFloatTimeDomainData(wave);
      features = analysis.frame(t, freq, wave, capture.ctx.sampleRate);
      if (features.rmsDb > CONFIG.idle.db) guard.lastAudioS = t;
      featureLog?.push({ t: +t.toFixed(4), rms: +features.rmsDb.toFixed(1), bands: analysis.bands.map((b) => Number(b.toPrecision(4))) });
    }
    if (streamAction(t, guard) === 'reopen' && capture) {
      guard.lastReopenS = t;
      sceneLog.push({ time: t, event: 'reopen' });
      reopenBlackHole(capture).catch((e) => sceneLog.push({ time: nowS(), event: 'reopen-failed', error: String(e) }));
    }
    $('note').textContent = showNoAudioNote(t, guard) ? 'No audio from BlackHole — is PC MASTER OUT on?' : '';

    input = { time: t, bar: features.bar, barLine: features.barLine, bpm: features.bpm, character: features.character, breakdown: features.breakdown, idle: features.idle, surge: features.surge, interlude: features.interlude };
    const dec = director?.update(input);
    if (dec) apply(dec);

    if (action === 'downscale') {
      compositor.setScale(watch.scale);
      carry.scale = watch.scale;
      keep();
      sceneLog.push({ time: t, event: 'downscale', scale: watch.scale });
    } else if (action === 'disable-scene' && compositor.currentId) {
      onSceneError(compositor.currentId, 'frame time over budget at the lowest render scale');
    }

    compositor.render(t, features);
    if (watch.lastSecond) {
      frameLog.push({ ...watch.lastSecond, scale: watch.scale, scene: compositor.currentId, dampedFrames });
      watch.lastSecond = null;
      dampedFrames = 0;
    }
    if (compositor.damped) dampedFrames++; // this frame opens the new second, so count it after the reset
    if (overlayOn) $('overlay').textContent = overlayText(features, compositor.currentId, watch.scale, compositor.damped);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (params.get('autostart') === '1') void start();
else $('start').addEventListener('click', () => void start());
