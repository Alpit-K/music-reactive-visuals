// Synthetic test signals only — never real audio in the repo.
import { rng } from '../director/rng';

export { rng };
export const FPS = 60;
export const BEAT = 60 / 128;

/** Standard normal via Box–Muller. */
export function normal(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

/**
 * Sub-band energy with a pulse on every beat at 128 BPM, held for the whole beat:
 * in the captured set a kick's sub body is sustained (peaks ~2–4x the minute's median),
 * which is what the kick gate keys on.
 */
export function syntheticSub(
  seconds: number,
  opts: { silent?: [number, number]; baseline?: number; seed?: number } = {},
): { t: number[]; sub: number[] } {
  const rand = rng(opts.seed ?? 1);
  const baseline = opts.baseline ?? 0.05;
  const t: number[] = [];
  const sub: number[] = [];
  for (let i = 0; i < seconds * FPS; i++) {
    const ti = i / FPS;
    const beatStart = Math.floor(ti / BEAT) * BEAT;
    const silent = opts.silent && beatStart >= opts.silent[0] && beatStart < opts.silent[1];
    t.push(ti);
    sub.push(baseline + 0.001 * normal(rand) + (silent ? 0 : Math.exp(-(ti - beatStart) / 0.25)));
  }
  return { t, sub };
}

/**
 * A drum loop as raw samples, for the onset front end and beat tracker. Steps are 16ths of a 4-beat bar. The kick is a
 * decaying 50 Hz burst, the snare noise over a 200 Hz body, the hat a few ms of bright noise. `kickOut` mutes the
 * kick between two times (a breakdown); `bpmAt` lets the tempo change.
 */
export function drums(
  seconds: number,
  bpm: number | ((t: number) => number),
  steps: { kick?: number[]; snare?: number[]; hat?: number[]; bass?: number[] },
  opts: { sampleRate?: number; seed?: number; kickOut?: [number, number] } = {},
): { audio: Float32Array; kicks: number[]; beats: number[] } {
  const sr = opts.sampleRate ?? 44100;
  const rand = rng(opts.seed ?? 3);
  const audio = new Float32Array(Math.floor(seconds * sr));
  const kicks: number[] = [];
  const beats: number[] = [];
  const add = (at: number, len: number, f: (t: number) => number) => {
    const start = Math.round(at * sr);
    for (let i = 0; i < len * sr && start + i < audio.length; i++) audio[start + i] += f(i / sr);
  };
  let last = 0;
  const noise = () => rand() * 2 - 1;
  for (let t = 0, step = 0; t < seconds; step++) {
    const s = step % 16;
    if (s % 4 === 0) beats.push(t);
    if (steps.kick?.includes(s) && !(opts.kickOut && t >= opts.kickOut[0] && t < opts.kickOut[1])) {
      kicks.push(t);
      add(t, 0.3, (x) => 0.8 * Math.sin(2 * Math.PI * 50 * x) * Math.exp(-x / 0.08));
    }
    if (steps.bass?.includes(s)) add(t, 0.2, (x) => 0.5 * Math.sin(2 * Math.PI * 80 * x) * Math.exp(-x / 0.06));
    if (steps.snare?.includes(s)) add(t, 0.2, (x) => (0.35 * noise() + 0.3 * Math.sin(2 * Math.PI * 200 * x)) * Math.exp(-x / 0.05));
    if (steps.hat?.includes(s)) add(t, 0.05, (x) => { const n = noise(), h = n - last; last = n; return 0.12 * h * Math.exp(-x / 0.012); });
    t += 60 / (typeof bpm === 'function' ? bpm(t) : bpm) / 4;
  }
  for (let i = 0; i < audio.length; i++) audio[i] += 0.005 * noise();
  return { audio, kicks, beats };
}
