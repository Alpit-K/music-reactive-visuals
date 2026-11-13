import { Analysis } from './analysis/analysis';
import { openBlackHole } from './audio/capture';
import { CONFIG } from './config';
import { Compositor } from './render/compositor';
import { poolsOf } from './scenes/pools';
import { loadShaderScenes } from './scenes/registry';
import { MORPH_STYLES, SILENT, type Features, type Pool, type Scene, type Transition } from './scenes/types';

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
  // ?only=<text> narrows the list to scenes whose id contains it, e.g. ?selected=1&only=particles; commas for several.
  const only = (new URLSearchParams(location.search).get('only') ?? '').split(',');
  // Each form of a swarm of several forms is its own entry (idle's are not curated), so a form can be judged alone.
  const list = loadShaderScenes()
    .filter((s) => !selected || s.enabled)
    .flatMap((s) => (poolsOf(s.id).includes('idle') ? [s] : (s.forms?.() ?? [s])))
    .filter((s) => only.some((o) => s.id.includes(o)));
  const analysis = new Analysis();
  const freq = new Float32Array(CONFIG.fftSize / 2);
  const wave = new Float32Array(CONFIG.fftSize);
  const t0 = performance.now();
  let i = 0;
  let features: Features = SILENT;
  // ?seed=<n>: the seed each scene shows with — its palette, arrangement, dance path and build style (default 1).
  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 1);
  // t cycles how ← → change scene: a quick morph in each style (as before, 0.5 s), through nothing at its length on
  // the wall, or a cut.
  const WAYS: Transition[] = [...MORPH_STYLES.map((_, style) => ({ kind: 'morph' as const, style })), { kind: 'nothing' }, { kind: 'cut' }];
  const wayName = (w: Transition) => (w.kind === 'morph' ? `morph: ${MORPH_STYLES[w.style]}` : w.kind === 'nothing' ? 'through nothing' : 'cut');
  let way = 0;
  const show = () => {
    const w = WAYS[way];
    const seconds = w.kind === 'cut' ? 0 : w.kind === 'nothing' ? (CONFIG.director.transition.nothingBeats * 60) / (features.bpm ?? 128) : 0.5;
    compositor.show(list[i], seed, seconds, (performance.now() - t0) / 1000, 'near', w);
  };
  // k fakes a breakdown and its drop, so each scene's life cycle shows without waiting for one in the music: the kick
  // stops (out from then on) until k again, which is the drop if the kick was out 4 bars.
  const sim = { outAt: null as number | null, back: null as number | null, dropAt: -Infinity };

  // ?pair=<a>,<b>: the two scenes take turns every 16 bars, each change a morph as on the wall — to judge how one
  // scene flows into another (design §6).
  const byId = new Map(loadShaderScenes().map((s) => [s.id, s]));
  const pair = new URLSearchParams(location.search).get('pair')?.split(',').map((id) => byId.get(id)!);
  const turn = { end: 0, bars: 0, seed: 1 };
  const showPair = (t: number) => {
    compositor.show(pair![turn.end], turn.seed++, (CONFIG.director.morphBeats * 60) / (features.bpm ?? 128), t);
  };
  if (pair) showPair(0);
  else show();

  // Edits made on the page, nothing saved: c copies them, to apply to pools.ts and the scene files.
  // Pools belong to a scene, so a pool key on one form of a swarm changes the whole swarm; x turns off one form.
  const KEYS: Record<string, Pool> = { m: 'main', d: 'dark', p: 'peak', b: 'breakdown', i: 'interlude' };
  const sceneOf = (id: string) => id.split(' › ')[0];
  const poolEdits = new Map<string, Set<Pool>>();
  const offEdits = new Map<string, boolean>();
  const poolsNow = (id: string) => poolEdits.get(sceneOf(id)) ?? new Set(poolsOf(sceneOf(id)));
  const offNow = (s: Scene) => offEdits.get(s.id) ?? !s.enabled;
  const changes = () => {
    const lines: string[] = [];
    for (const [id, set] of poolEdits) {
      const now = [...set].sort().join(', ') || 'none';
      if (now !== ([...poolsOf(id)].sort().join(', ') || 'none')) lines.push(`${id}: ${now}`);
    }
    for (const s of list) if (offEdits.has(s.id) && offEdits.get(s.id) !== !s.enabled) lines.push(`${s.id}: ${offNow(s) ? 'off' : 'on'}`);
    return lines;
  };
  let note = '';

  window.addEventListener('keydown', async (e) => {
    if (pair) {
      if (e.key === 'f') await document.documentElement.requestFullscreen();
      return;
    }
    const pool = KEYS[e.key];
    if (pool) {
      const set = new Set(poolsNow(list[i].id));
      if (!set.delete(pool)) set.add(pool);
      poolEdits.set(sceneOf(list[i].id), set);
      return;
    }
    if (e.key === 'x') {
      offEdits.set(list[i].id, !offNow(list[i]));
      return;
    }
    if (e.key === 'k') {
      const t = (performance.now() - t0) / 1000;
      if (sim.outAt === null) sim.outAt = t;
      else {
        if (t - sim.outAt >= (CONFIG.motion.burstGapBars * 240) / (features.bpm ?? CONFIG.motion.fallbackBpm)) sim.dropAt = t;
        sim.outAt = null;
        sim.back = t;
      }
      return;
    }
    if (e.key === 't') {
      way = (way + 1) % WAYS.length;
      return;
    }
    if (e.key === 'c') {
      const lines = changes();
      await navigator.clipboard.writeText(lines.join('\n'));
      note = `copied ${lines.length} change${lines.length === 1 ? '' : 's'}`;
      return;
    }
    note = '';
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
    // The faked breakdown overrides the kick; its drop is one kick, then the music's own kicks again.
    const faked = sim.outAt !== null || (sim.back !== null && t - sim.back < 0.05);
    if (faked) {
      const drop = sim.outAt === null;
      features = { ...features, idle: false, interlude: false, kick: drop, sinceKick: drop ? 0 : t - sim.outAt!, sinceDrop: drop ? t - sim.dropAt : features.sinceDrop };
    } else if (t - sim.dropAt < 5) features = { ...features, sinceDrop: t - sim.dropAt };
    compositor.render(t, features);
    if (pair) {
      if (features.barLine) turn.bars++;
      if (turn.bars >= 16) {
        turn.bars = 0;
        turn.end = 1 - turn.end;
        showPair(t);
      }
      $('hud').textContent = [
        pair.map((p) => p.id).join('  ⇄  '),
        `now: ${pair[turn.end].id}  bar ${turn.bars} of 16`,
        `bpm ${features.bpm?.toFixed(1) ?? '—'}${compositor.damped ? '  FLASH-DAMPED' : ''}`,
        'f fullscreen',
        ...errors.slice(-3),
      ].join('\n');
      requestAnimationFrame(frame);
      return;
    }
    const s = list[i];
    const order = Object.keys(KEYS).map((k) => KEYS[k]);
    const pools = [...poolsNow(s.id)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    $('hud').textContent = [
      `${i + 1}/${list.length}  ${s.id}  [${offNow(s) ? 'OFF' : 'on'}]  pools: ${pools.join(', ') || 'none'}`,
      `bpm ${features.bpm?.toFixed(1) ?? '—'}  ${features.character}${features.breakdown ? ' BREAKDOWN' : ''}${features.interlude ? ' INTERLUDE' : ''}${compositor.damped ? '  FLASH-DAMPED' : ''}`,
      s.describe?.() ?? '',
      `← → step (t: ${wayName(WAYS[way])})   k ${sim.outAt === null ? 'breakdown' : `drop (kick out ${(t - sim.outAt).toFixed(0)} s)`}   m d p b i main/dark/peak/breakdown/interlude   x on/off   f fullscreen`,
      `c copy changes (${changes().length})${note ? `  — ${note}` : ''}`,
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
