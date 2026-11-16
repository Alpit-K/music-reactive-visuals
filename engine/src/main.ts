import { Analysis } from './analysis/analysis';
import { openBlackHole, reopenBlackHole, type Capture } from './audio/capture';
import { showNoAudioNote, streamAction, type GuardState } from './audio/streamGuard';
import { CONFIG } from './config';
import { Director, type Decision, type DirectorInput } from './director/director';
import { overlayText } from './overlay';
import { Compositor } from './render/compositor';
import { FrameWatch } from './render/frameWatch';
import { POOLS, poolsOf } from './scenes/pools';
import { loadShaderScenes } from './scenes/registry';
import { SILENT, type Features, type Scene } from './scenes/types';
import { loadCarry, saveCarry } from './session/carry';
import { Ears, type EarsReading } from './audio/ears';
import { LogSink } from './session/logSink';
import { sessionId } from './session/session';

const params = new URLSearchParams(location.search);
const $ = (id: string) => document.getElementById(id)!;
const session = sessionId();
const sceneLog = new LogSink(session, 'scene-log');
const frameLog = new LogSink(session, 'frames');
// What the engine heard, every frame, every session (2026-11-16) — six band levels and loudness, not audio. Replayed
// through the analysis (analysis/replay.test.ts) it shows what any rule did on the night, or would do changed. It was
// opt-in until the 2026-11-15 set, whose black build-ups could not be measured afterwards.
const featureLog = new LogSink(session, 'features');
// The second hearing's hops, a row a second (audio/ears.ts): what replays the beat tracker on a set afterwards.
const hopLog = new LogSink(session, 'hops');
setInterval(() => [sceneLog, frameLog, featureLog, hopLog].forEach((s) => void s.flush()), 5000);

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
  let input: DirectorInput = { time: 0, bar: 0, barLine: false, bpm: null, character: 'main', breakdown: false, idle: true, interlude: false };
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
    compositor.setEcho(dec.echo);
    compositor.show(scenes.get(dec.sceneId)!, dec.seed, dec.crossfadeS, nowS(), dec.colour, dec.transition);
  }

  for (const s of loadShaderScenes()) if (s.enabled) scenes.set(s.id, s);
  compositor.warmUp([...scenes.values()]);
  const idle = scenes.get(POOLS.idle[0])!;
  compositor.show(idle, 1, 0, 0); // drift until audio and the director are up

  // A lost context (GPU process crash): any scene set up meanwhile would fail and be disabled. Reloading
  // rebuilds everything.
  canvas.addEventListener('webglcontextlost', () => {
    running = false;
    sceneLog.push({ time: nowS(), event: 'context-lost' });
    void sceneLog.flush().then(() => location.reload());
  });

  let capture: Capture | null = null;
  let ears: Ears | null = null;
  const analysis = new Analysis();
  let features: Features = SILENT;
  let heard: EarsReading | null = null;
  let freq = new Float32Array(CONFIG.fftSize / 2);
  let wave = new Float32Array(CONFIG.fftSize);

  async function tryAudio() {
    try {
      capture = await openBlackHole();
      // Listens only; the wall goes on without it if the worklet will not load.
      const second = new Ears(capture.ctx, (row) => hopLog.push(row));
      second.listen(capture.source).then(() => (ears = second), (e) => sceneLog.push({ time: nowS(), event: 'ears-unavailable', error: String(e) }));
      navigator.mediaDevices.addEventListener('devicechange', () => {
        guard.lastAudioS = Math.min(guard.lastAudioS ?? 0, nowS() - CONFIG.stream.silentS); // recheck now
      });
      director = new Director([...scenes.values()].map((s) => ({ id: s.id, pools: poolsOf(s.id), swarm: s.morphFrom !== undefined })), Number(session.replace(/\D/g, '').slice(-9)), CONFIG.echo.live);
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
      void Promise.all([sceneLog, frameLog, featureLog, hopLog].map((s) => s.flush())).then(() => fetch('/quit', { method: 'POST' }));
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
      heard = ears?.read() ?? null;
      // e: the second hearing at this frame — tempo, beat, confidence, share of beats with a kick, kicks since the last frame.
      featureLog.push({ t: +t.toFixed(4), rms: +features.rmsDb.toFixed(1), bands: analysis.bands.map((b) => Number(b.toPrecision(4))),
        ...(heard && { e: [heard.bpm === null ? null : +heard.bpm.toFixed(1), +heard.beat.toFixed(2), +heard.confidence.toFixed(2), +heard.kickPresence.toFixed(2), heard.kicks] }) });
    }
    if (streamAction(t, guard) === 'reopen' && capture) {
      guard.lastReopenS = t;
      sceneLog.push({ time: t, event: 'reopen' });
      reopenBlackHole(capture).catch((e) => sceneLog.push({ time: nowS(), event: 'reopen-failed', error: String(e) }));
    }
    $('note').textContent = showNoAudioNote(t, guard) ? 'No audio from BlackHole — is PC MASTER OUT on?' : '';

    input = { time: t, bar: features.bar, barLine: features.barLine, bpm: features.bpm, character: features.character, breakdown: features.breakdown, idle: features.idle, interlude: features.interlude };
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
      frameLog.push({ ...watch.lastSecond, scale: watch.scale, scene: compositor.currentId, dampedFrames, bpm: features.bpm === null ? null : +features.bpm.toFixed(1) });
      watch.lastSecond = null;
      dampedFrames = 0;
    }
    if (compositor.damped) dampedFrames++; // this frame opens the new second, so count it after the reset
    if (overlayOn) $('overlay').textContent = overlayText(features, compositor.currentId, watch.scale, compositor.damped, heard);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (params.get('autostart') === '1') void start();
else $('start').addEventListener('click', () => void start());
