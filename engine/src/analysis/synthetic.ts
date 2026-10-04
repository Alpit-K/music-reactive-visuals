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
