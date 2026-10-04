import { describe, expect, it } from 'vitest';
import { KickDetector } from './kicks';
import { BEAT, FPS, normal, rng, syntheticSub } from './synthetic';

function detect(t: number[], sub: number[]): number[] {
  const d = new KickDetector();
  return t.filter((ti, i) => d.push(ti, sub[i]));
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe('KickDetector', () => {
  it('finds kicks at 128 BPM', () => {
    const { t, sub } = syntheticSub(60);
    const kicks = detect(t, sub);
    expect(Math.abs(kicks.length - 128)).toBeLessThanOrEqual(2);
    const iv = kicks.slice(1).map((k, i) => k - kicks[i]);
    expect(Math.abs(median(iv) - BEAT)).toBeLessThan(1 / FPS);
  });

  it('finds nothing in steady bass', () => {
    const rand = rng(2);
    const t = Array.from({ length: 30 * FPS }, (_, i) => i / FPS);
    const sub = t.map(() => 0.5 + 0.005 * normal(rand));
    expect(detect(t, sub)).toHaveLength(0);
  });

  it('finds no kicks in a breakdown, and picks the drop up again', () => {
    const { t, sub } = syntheticSub(40, { silent: [20, 30] });
    const kicks = detect(t, sub);
    expect(kicks.some((k) => k > 20.5 && k < 30)).toBe(false);
    expect(kicks.some((k) => k >= 30)).toBe(true);
  });

  it('does not count a breakdown bassline as kicks', () => {
    const { t, sub } = syntheticSub(80, { silent: [50, 60] });
    for (let note = 50 + BEAT / 2; note < 60; note += BEAT) {
      t.forEach((ti, i) => {
        if (ti >= note && ti < note + 0.2) sub[i] += 0.1 * Math.exp(-(ti - note) / 0.08);
      });
    }
    const kicks = detect(t, sub);
    expect(kicks.some((k) => k > 50.5 && k < 60)).toBe(false);
    expect(kicks.some((k) => k >= 60)).toBe(true);
  });
});
