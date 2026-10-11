import { Analysis } from './analysis/analysis';
import { openBlackHole } from './audio/capture';
import { CONFIG } from './config';
import { Compositor } from './render/compositor';
import { motionOf, POOLS, poolsOf } from './scenes/pools';
import { loadShaderScenes } from './scenes/registry';
import { SILENT, type Features } from './scenes/types';

const $ = (id: string) => document.getElementById(id)!;

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
  // ?selected=1 lists only what the wall can show, for reviewing the current selection.
  const selected = new URLSearchParams(location.search).has('selected');
  // ?only=<text> narrows the list to scenes whose id contains it, e.g. ?selected=1&only=particles.
  const only = new URLSearchParams(location.search).get('only') ?? '';
  // Each form of a swarm of several forms is its own entry (idle's are not curated), so a form can be judged alone.
  const list = loadShaderScenes()
    .filter((s) => !selected || s.enabled)
    .flatMap((s) => (poolsOf(s.id).includes('idle') ? [s] : (s.forms?.() ?? [s])))
    .filter((s) => s.id.includes(only));
  const analysis = new Analysis();
  const freq = new Float32Array(CONFIG.fftSize / 2);
  const wave = new Float32Array(CONFIG.fftSize);
  const t0 = performance.now();
  let i = 0;
  let features: Features = SILENT;
  const show = () => compositor.show(list[i], 1, 0.5, (performance.now() - t0) / 1000);

  // ?pair=<a>,<b>: the two scenes take turns every 16 bars, each change through a moving interlude scene shown for
  // the bridge length — b cycles it, 0 being straight across — to judge how a still ↔ moving change should go (design §6).
  const byId = new Map(loadShaderScenes().map((s) => [s.id, s]));
  const pair = new URLSearchParams(location.search).get('pair')?.split(',').map((id) => byId.get(id)!);
  const bridges = POOLS.interlude.filter((id) => motionOf(id) === 'moving').map((id) => byId.get(id)!);
  const lengths = [0, 4, 8, 16, CONFIG.director.rotateBars];
  let li = lengths.indexOf(CONFIG.director.bridgeBars);
  const turn = { end: 0, bridging: false, bridges: 0, bars: 0, seed: 1 };
  const bridge = () => bridges[(turn.bridges - 1) % bridges.length];
  const showPair = (t: number) => {
    compositor.show(turn.bridging ? bridge() : pair![turn.end], turn.seed++, (CONFIG.director.morphBeats * 60) / (features.bpm ?? 128), t);
  };
  if (pair) showPair(0);
  else show();

  window.addEventListener('keydown', async (e) => {
    if (pair) {
      if (e.key === 'b') li = (li + 1) % lengths.length;
      if (e.key === 'f') await document.documentElement.requestFullscreen();
      return;
    }
    if (e.key === 'ArrowRight') i = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + list.length) % list.length;
    else if (e.key === 'f') {
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
    if (pair) {
      if (features.barLine) turn.bars++;
      if (turn.bars >= (turn.bridging ? lengths[li] : 16)) {
        turn.bars = 0;
        turn.bridging = !turn.bridging && lengths[li] > 0;
        if (turn.bridging) turn.bridges++;
        else turn.end = 1 - turn.end;
        showPair(t);
      }
      const now = turn.bridging ? `bridge ${bridge().id}` : pair[turn.end].id;
      $('hud').textContent = [
        `${pair.map((p) => `${p.id} (${motionOf(p.id)})`).join('  ⇄  ')}`,
        `now: ${now}  bar ${turn.bars}  bridge ${lengths[li] || 'none — straight across'}${lengths[li] ? ' bars' : ''}`,
        `bpm ${features.bpm?.toFixed(1) ?? '—'}${compositor.damped ? '  FLASH-DAMPED' : ''}`,
        'b bridge length   f fullscreen',
        ...errors.slice(-3),
      ].join('\n');
      requestAnimationFrame(frame);
      return;
    }
    const s = list[i];
    const on = s.enabled ? 'enabled' : 'disabled';
    $('hud').textContent = [
      `${i + 1}/${list.length}  ${s.id}  [${on}]  pools: ${poolsOf(s.id.split(' › ')[0]).join(', ') || 'none'}`,
      `bpm ${features.bpm?.toFixed(1) ?? '—'}  ${features.character}${features.breakdown ? ' BREAKDOWN' : ''}${features.interlude ? ' INTERLUDE' : ''}${compositor.damped ? '  FLASH-DAMPED' : ''}`,
      '← → step   f fullscreen',
      ...errors.slice(-3),
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
