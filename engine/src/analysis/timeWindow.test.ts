import { describe, expect, it } from 'vitest';
import { TimeWindow } from './timeWindow';

describe('TimeWindow', () => {
  it('keeps only the trailing span', () => {
    const w = new TimeWindow(2);
    [0, 1, 2, 3, 4].forEach((t) => w.push(t, t * 10));
    w.prune(4);
    expect(w.count).toBe(3); // t = 2, 3, 4
    expect(w.mean()).toBeCloseTo(30);
    expect(w.min()).toBe(20);
    expect(w.max()).toBe(40);
  });

  it('computes population std and numpy-style median', () => {
    const w = new TimeWindow(100);
    [1, 2, 3, 4].forEach((x, i) => w.push(i, x));
    expect(w.std()).toBeCloseTo(Math.sqrt(1.25));
    expect(w.median()).toBe(2.5);
  });

  it('returns 0 when empty rather than NaN', () => {
    const w = new TimeWindow(1);
    expect([w.mean(), w.std(), w.median(), w.min(), w.max()]).toEqual([0, 0, 0, 0, 0]);
  });

  it('stays accurate over a two-hour stream', () => {
    const w = new TimeWindow(2);
    for (let i = 0; i < 2 * 3600 * 60; i++) {
      w.push(i / 60, 0.5 + 0.01 * Math.sin(i));
      w.prune(i / 60);
    }
    expect(w.mean()).toBeCloseTo(0.5, 3);
    expect(w.count).toBeLessThanOrEqual(121);
  });
});
