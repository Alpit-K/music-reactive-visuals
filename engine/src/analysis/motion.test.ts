import { describe, expect, it } from 'vitest';
import type { Character } from '../scenes/types';
import { MotionFeatures } from './motion';

const FPS = 60;
const BPM = 128;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;

type Out = ReturnType<MotionFeatures['update']>;

/** Drives the features at 60 fps from `from` to `to` s; kicks on every beat while `playing(t)`. */
function run(m: MotionFeatures, from: number, to: number, opts: { playing: (t: number) => boolean; character?: Character; highs?: number; calm?: boolean; state: { lastKick: number; nextKick: number } }): Out[] {
  const out: Out[] = [];
  for (let f = Math.round(from * FPS); f < Math.round(to * FPS); f++) {
    const t = f / FPS;
    let kick = false;
    if (t >= opts.state.nextKick) {
      if (opts.playing(t)) {
        kick = true;
        opts.state.lastKick = t;
      }
      opts.state.nextKick += BEAT;
    }
    out.push(m.update(t, kick, t - opts.state.lastKick, BPM, opts.character ?? 'main', opts.highs ?? 0, opts.calm ?? false));
  }
  return out;
}

const fresh = () => ({ m: new MotionFeatures(), state: { lastKick: -Infinity, nextKick: 0 } });
const last = (xs: Out[]) => xs[xs.length - 1];

describe('MotionFeatures', () => {
  it('groove reaches 0.55 within 6 s of steady main kicks and falls to 0.05 within 8 s of them stopping', () => {
    const { m, state } = fresh();
    expect(last(run(m, 0, 6, { playing: () => true, state })).groove).toBeGreaterThanOrEqual(0.55);
    expect(last(run(m, 6, 14, { playing: () => false, state })).groove).toBeLessThanOrEqual(0.05);
  });

  it('groove eases toward 1.0 in peak and 0.85 in dark', () => {
    for (const [character, level] of [['peak', 1.0], ['dark', 0.85]] as const) {
      const { m, state } = fresh();
      expect(last(run(m, 0, 20, { playing: () => true, character, state })).groove).toBeCloseTo(level, 1);
    }
  });

  it('a lone kick lifts groove below 0.2', () => {
    const { m, state } = fresh();
    state.lastKick = 0;
    state.nextKick = 3;
    const out = run(m, 0.01, 6, { playing: (t) => t < 3.1, state });
    expect(Math.max(...out.map((o) => o.groove))).toBeLessThan(0.2);
  });

  it('a lone kick 3 s after the kick stopped fires no drop', () => {
    const { m, state } = fresh();
    run(m, 0, 10, { playing: () => true, state });
    const lone = 28 * BEAT;
    const out = run(m, 10, 16, { playing: (t) => Math.abs(t - lone) < 0.01, state });
    expect(out.some((o) => o.sinceDrop === 0)).toBe(false);
  });

  it('the first kick after 4 bars without one sets sinceDrop to 0; after 3 bars it does not', () => {
    for (const [gapBars, fires] of [[4, true], [3, false]] as const) {
      const { m, state } = fresh();
      run(m, 0, 10, { playing: () => true, state });
      const back = 10 + gapBars * BAR;
      const out = run(m, 10, back + 1, { playing: (t) => t >= back - 0.01, state });
      expect(out.some((o) => o.sinceDrop === 0)).toBe(fires);
    }
  });

  it('tension is 0 for the first bar out, rises with time out and with highs, and is gone within 1 s of kicks returning', () => {
    const tensionAt = (highs: number) => {
      const { m, state } = fresh();
      run(m, 0, 10, { playing: () => true, state });
      const out = run(m, 10, 10 + 12 * BAR, { playing: () => false, highs, state });
      const atBar = (b: number) => out[Math.round(b * BAR * FPS) - 1].tension;
      const back = run(m, 10 + 12 * BAR, 10 + 12 * BAR + 1, { playing: () => true, highs, state });
      return { firstBar: atBar(0.9), four: atBar(4), eight: atBar(8), after: last(back).tension };
    };
    const lo = tensionAt(0);
    const hi = tensionAt(1);
    expect(lo.firstBar).toBe(0);
    expect(lo.eight).toBeGreaterThan(lo.four);
    expect(hi.eight).toBeGreaterThan(lo.eight);
    expect(lo.after).toBeLessThan(0.02);
    expect(hi.after).toBeLessThan(0.02);
  });

  it('tensionTurn never decreases', () => {
    const { m, state } = fresh();
    const out = [
      ...run(m, 0, 10, { playing: () => true, state }),
      ...run(m, 10, 40, { playing: () => false, highs: 1, state }),
      ...run(m, 40, 50, { playing: () => true, state }),
    ];
    expect(out.every((o, i) => i === 0 || o.tensionTurn >= out[i - 1].tensionTurn)).toBe(true);
    expect(last(out).tensionTurn).toBeGreaterThan(0);
  });

  it('builds no tension before the first kick, nor in an interlude or silence', () => {
    const { m, state } = fresh();
    expect(last(run(m, 0, 20, { playing: () => false, highs: 1, state })).tensionTurn).toBe(0);
    run(m, 20, 30, { playing: () => true, state });
    const calm = run(m, 30, 60, { playing: () => false, highs: 1, calm: true, state });
    expect(Math.max(...calm.map((o) => o.tension))).toBe(0);
  });

  it('lets a build go after 32 bars without a kick: a long kick-free stretch is not a build', () => {
    const { m, state } = fresh();
    run(m, 0, 10, { playing: () => true, state });
    const out = run(m, 10, 10 + 40 * BAR, { playing: () => false, highs: 1, state });
    expect(out[Math.round(20 * BAR * FPS)].tension).toBeGreaterThan(0.5);
    expect(last(out).tension).toBe(0);
  });

  it('a fill kick in a breakdown does not rob the drop of its burst', () => {
    const { m, state } = fresh();
    run(m, 0, 10, { playing: () => true, state });
    const fill = 30;
    const drop = fill + 3 * BAR;
    const out = run(m, 10, drop + 2, { playing: (t) => Math.abs(t - fill) < 0.01 || t >= drop - 0.01, state });
    const back = out.findIndex((o, i) => i > 0 && (10 + i / FPS) >= drop - 0.02 && o.sinceDrop === 0);
    expect(back).toBeGreaterThan(-1);
  });
});
