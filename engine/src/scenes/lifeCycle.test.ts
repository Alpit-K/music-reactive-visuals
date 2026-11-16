import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { LifeCycle, lastPick, pickExcept, REST } from './lifeCycle';
import { SILENT, type Features } from './types';

const BAR = 240 / 128;
const L = CONFIG.life;

/** Plays a kick every beat up to `stop` s, none until `back` s, then every beat again; returns life at each frame. */
function play(lc: LifeCycle, stop: number, back: number, end: number, extra: Partial<Features> = {}) {
  const lives: { t: number; life: number }[] = [];
  let lastKick = -Infinity, dropT = -Infinity;
  for (let t = 0; t <= end; t += 1 / 60) {
    const playing = t < stop || t >= back;
    const kick = playing && t - lastKick >= BAR / 4;
    if (kick) {
      if (t - lastKick >= CONFIG.motion.burstGapBars * BAR) dropT = t;
      lastKick = t;
    }
    lc.update(t, { ...SILENT, idle: false, bpm: 128, kick, sinceKick: t - lastKick, sinceDrop: t - dropT, ...extra });
    lives.push({ t, life: lc.life });
  }
  return lives;
}
const at = (lives: { t: number; life: number }[], t: number) => lives.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)).life;

describe('pickExcept', () => {
  it('never returns the last pick while another is allowed', () => {
    for (let r = 0; r < 1; r += 0.01) expect(pickExcept({ a: 1, b: 1, c: 1 }, 'b', r)).not.toBe('b');
  });
  it('falls back to the last pick when it is the only one allowed', () => {
    expect(pickExcept({ a: 0, b: 1 }, 'b', 0.5)).toBe('b');
  });
  it('follows the weights', () => {
    const n = { a: 0, b: 0 };
    for (let r = 0; r < 1; r += 0.001) n[pickExcept({ a: 3, b: 1 }, null, r)]++;
    expect(n.a / (n.a + n.b)).toBeCloseTo(0.75, 1);
  });
});

describe('LifeCycle', () => {
  beforeEach(() => {
    lastPick.breakdown = null;
    lastPick.drop = null;
  });

  // The first breakdown picked for seed `s`, with the picks before cleared.
  const firstBreakdown = (s: number) => {
    lastPick.breakdown = null;
    const lc = new LifeCycle(s, 0, true, true);
    play(lc, 10, 10 + 10 * BAR, 10 + 6 * BAR);
    return lc;
  };

  it('stays whole while the kick plays, and before any kick', () => {
    const lc = new LifeCycle(1, 0, true, true);
    lc.update(0, { ...SILENT, idle: false });
    expect(lc.life).toBe(1);
    expect(play(lc, 100, 100, 60).every((x) => x.life === 1)).toBe(true);
  });

  it('comes apart once the kick has been out 4 bars, gone by 8, and is whole 0.1 s after the drop', () => {
    let seed = 1;
    while (firstBreakdown(seed).breakdown === 'hold') seed++;
    lastPick.breakdown = null;
    const lc = new LifeCycle(seed, 0, true, true);
    const back = 10 + 12 * BAR;
    const lives = play(lc, 10, back, back + 3 * BAR);
    expect(at(lives, 10 + 3.7 * BAR)).toBe(1); // the last kick lands up to a beat before 10 s
    expect(at(lives, 10 + 6 * BAR)).toBeGreaterThan(0.3);
    expect(at(lives, 10 + 6 * BAR)).toBeLessThan(0.7);
    expect(at(lives, 10 + 8.1 * BAR)).toBe(0);
    expect(at(lives, back - 0.1)).toBe(0);
    expect(at(lives, back + L.dropBackS + 0.05)).toBe(1);
  });

  it('what is left gathers through a build: nothing at 4 bars out, all of it by 12', () => {
    let seed = 1;
    while (firstBreakdown(seed).breakdown === 'hold') seed++;
    lastPick.breakdown = null;
    const gatherAt = (bars: number) => {
      lastPick.breakdown = null;
      const lc = new LifeCycle(seed, 0, true, true);
      play(lc, 10, 100, 10 + bars * BAR);
      return lc.gather;
    };
    expect(gatherAt(4)).toBeLessThan(0.05);
    expect(gatherAt(8)).toBeGreaterThan(0.3);
    expect(gatherAt(8)).toBeLessThan(0.7);
    expect(gatherAt(12.5)).toBe(1);
  });

  it('a hold breakdown keeps the form whole', () => {
    let seed = 1;
    while (firstBreakdown(seed).breakdown !== 'hold') seed++;
    lastPick.breakdown = null;
    const lc = new LifeCycle(seed, 0, true, true);
    expect(play(lc, 10, 10 + 12 * BAR, 10 + 14 * BAR).every((x) => x.life === 1)).toBe(true);
  });

  it('builds back before it is gone when the kick returns early, unchanged', () => {
    let seed = 1;
    while (firstBreakdown(seed).breakdown === 'hold') seed++;
    lastPick.breakdown = null;
    const lc = new LifeCycle(seed, 0, true, true);
    const lives = play(lc, 10, 10 + 6 * BAR, 10 + 8 * BAR);
    expect(at(lives, 10 + 6 * BAR - 0.05)).toBeGreaterThan(0.3);
    expect(at(lives, 10 + 7.1 * BAR)).toBe(1);
    expect(lc.copies).toBe(0);
  });

  it('always leaves dust or a point when a form comes apart', () => {
    const rests = new Set<number>();
    for (let s = 1; s < 40; s++) {
      const lc = firstBreakdown(s);
      rests.add(lc.rest);
      if (lc.breakdown !== 'hold') expect(lc.rest).toBe(lc.breakdown === 'dust' ? REST.dust : REST.point);
      rests.add(lc.rest);
    }
    expect(rests.has(REST.dust) && rests.has(REST.point)).toBe(true);
  });

  it('never takes a set apart the same way twice running, across showings', () => {
    let last: string | null = null;
    for (let s = 1; s < 60; s++) {
      const lc = new LifeCycle(s, 0, true, true);
      play(lc, 10, 10 + 12 * BAR, 10 + 14 * BAR);
      expect(lc.breakdown).not.toBe(last);
      last = lc.breakdown;
    }
  });

  it('may come back from a full dissolve as copies or larger, only where they fit', () => {
    const seen = new Set<number>();
    for (let s = 1; s < 80; s++) {
      const lc = new LifeCycle(s, 0, true, true);
      play(lc, 10, 10 + 12 * BAR, 10 + 14 * BAR);
      seen.add(lc.copies);
      if (lc.breakdown === 'hold') expect(lc.copies).toBe(0);
      const fills = new LifeCycle(s, 0, false, false);
      play(fills, 10, 10 + 12 * BAR, 10 + 14 * BAR);
      expect(fills.copies).toBe(0);
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
    expect([...seen].some((n) => L.copies.includes(n as (typeof L.copies)[number]))).toBe(true);
  });

  it('never comes apart in an interlude or silence, and builds back past 32 bars out', () => {
    const calm = new LifeCycle(1, 0, true, true);
    expect(play(calm, 10, 10 + 12 * BAR, 10 + 14 * BAR, { interlude: true }).every((x) => x.life === 1)).toBe(true);
    let seed = 1;
    while (firstBreakdown(seed).breakdown === 'hold') seed++;
    lastPick.breakdown = null;
    const long = new LifeCycle(seed, 0, true, true);
    const lives = play(long, 10, 10 + 40 * BAR, 10 + 34 * BAR);
    expect(at(lives, 10 + 20 * BAR)).toBe(0);
    expect(at(lives, 10 + 33.2 * BAR)).toBe(1);
  });
});
