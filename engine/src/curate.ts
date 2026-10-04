import butterchurnPresets from 'butterchurn-presets';
import { Analysis } from './analysis/analysis';
import { openBlackHole } from './audio/capture';
import { CONFIG } from './config';
import { Compositor } from './render/compositor';
import { createButterchurnScenes } from './scenes/psychedelic/butterchurn';
import { ENABLED_PRESETS, PRESET_GAIN } from './scenes/psychedelic/presets';
import { loadShaderScenes } from './scenes/registry';
import { SILENT, type Features } from './scenes/types';

const $ = (id: string) => document.getElementById(id)!;
const SWEEP_S = 20; // seconds per preset in a sweep; the first second (warm-up) is not counted

async function fromFile(file: File) {
  const ctx = new AudioContext();
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = CONFIG.fftSize;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  // Curation only: the file must be heard. Safe because this mode does not capture BlackHole —
  // keep the Mac output off BlackHole while curating from a file.
  source.connect(ctx.destination);
  source.start();
  return { ctx, source, analyser };
}

async function run(audio: { ctx: AudioContext; source: AudioNode; analyser: AnalyserNode }) {
  $('pick').remove();
  const gl = ($('wall') as HTMLCanvasElement).getContext('webgl2', { antialias: false, alpha: false })!;
  const errors: string[] = [];
  const compositor = new Compositor(gl, (id, err) => errors.push(`${id}: ${err}`));
  const allPresets = Object.keys(butterchurnPresets.getPresets()).sort();
  const bc = createButterchurnScenes(audio, allPresets);
  const list = [...loadShaderScenes(), ...bc];
  const enabled = new Set(ENABLED_PRESETS);
  const analysis = new Analysis();
  const freq = new Float32Array(CONFIG.fftSize / 2);
  const wave = new Float32Array(CONFIG.fftSize);
  const t0 = performance.now();
  let i = 0;
  let features: Features = SILENT;
  // Sweep: plays each enabled preset in turn and tallies limiter holds and slow frames per preset.
  let sweep: number[] | null = null;
  let sweepTotal = 0;
  let switchedAt = 0;
  let lastNow = 0;
  const tally = new Map<string, { frames: number; damped: number; slow: number }>();
  const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(d, 1))}%`.padStart(4);
  const report = () =>
    [...tally]
      .sort(([, a], [, b]) => b.damped / b.frames - a.damped / a.frames)
      .map(([id, x]) => `damped ${pct(x.damped, x.frames)}  slow ${pct(x.slow, x.frames)}  ${id.slice(3)}`);
  const next = () => {
    i = sweep!.shift()!;
    switchedAt = performance.now();
    show();
  };

  const show = () => compositor.show(list[i], 1, 0.5, (performance.now() - t0) / 1000);
  show();

  window.addEventListener('keydown', async (e) => {
    if (e.key.startsWith('Arrow')) sweep = null;
    if (e.key === 'ArrowRight') i = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + list.length) % list.length;
    else if (e.key === 's' || e.key === 'S') {
      const pick = (name: string) => enabled.has(name) && (e.key === 's' || name in PRESET_GAIN);
      sweep = list.flatMap((s, k) => (s.id.startsWith('bc:') && pick(s.id.slice(3)) ? [k] : []));
      sweepTotal = sweep.length;
      tally.clear();
      next();
      return;
    } else if (e.key === 'r') {
      await navigator.clipboard.writeText(report().join('\n') + '\n');
      errors.push('copied sweep report to clipboard');
      return;
    } else if (e.key === 'e' && list[i].id.startsWith('bc:')) {
      const name = list[i].id.slice(3);
      if (enabled.has(name)) enabled.delete(name);
      else enabled.add(name);
      return;
    } else if (e.key === 'c') {
      await navigator.clipboard.writeText(`export const ENABLED_PRESETS: string[] = ${JSON.stringify([...enabled].sort(), null, 2)};\n`);
      errors.push('copied enabled list to clipboard');
      return;
    } else if (e.key === 'f') {
      await document.documentElement.requestFullscreen();
      return;
    } else return;
    show();
  });

  function frame(now: number) {
    const t = (now - t0) / 1000;
    audio.analyser.getFloatFrequencyData(freq);
    audio.analyser.getFloatTimeDomainData(wave);
    features = analysis.frame(t, freq, wave, audio.ctx.sampleRate);
    compositor.render(t, features);
    const s = list[i];
    if (sweep && now - switchedAt > 1000) {
      const x = tally.get(s.id) ?? { frames: 0, damped: 0, slow: 0 };
      x.frames++;
      if (compositor.damped) x.damped++;
      if (now - lastNow > CONFIG.frame.badMs) x.slow++;
      tally.set(s.id, x);
      if (now - switchedAt > SWEEP_S * 1000) {
        if (sweep.length) next();
        else sweep = null;
      }
    }
    lastNow = now;
    const on = s.id.startsWith('bc:') ? (enabled.has(s.id.slice(3)) ? 'ENABLED' : 'off') : s.enabled ? 'enabled' : 'disabled';
    $('hud').textContent = [
      `${i + 1}/${list.length}  ${s.family}  ${s.id}  [${on}]  enabled presets: ${enabled.size}`,
      `bpm ${features.bpm?.toFixed(1) ?? '—'}  ${features.character}${features.breakdown ? ' BREAKDOWN' : ''}${features.interlude ? ' INTERLUDE' : ''}${compositor.damped ? '  FLASH-DAMPED' : ''}`,
      '← → step   e toggle preset   c copy list   f fullscreen   s sweep enabled presets   S sweep dimmed ones   r copy sweep report',
      ...errors.slice(-3),
      ...(sweep ? [`SWEEP ${sweepTotal - sweep.length}/${sweepTotal}  ${Math.max(0, Math.ceil(SWEEP_S - (now - switchedAt) / 1000))} s left`] : []),
      ...(tally.size ? ['worst for flash holds:', ...report().slice(0, 12)] : []),
    ].join('\n');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

$('live').addEventListener('click', async () => run(await openBlackHole()));
$('file').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) run(await fromFile(f));
});
