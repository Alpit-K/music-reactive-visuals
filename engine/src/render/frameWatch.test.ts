import { describe, expect, it } from 'vitest';
import { FrameWatch, type WatchAction } from './frameWatch';

function feed(w: FrameWatch, seconds: number, ms: number, t0 = 0): WatchAction[] {
  const actions: WatchAction[] = [];
  let t = t0;
  for (let i = 0; i < Math.round((seconds * 1000) / ms); i++) {
    t += ms / 1000;
    actions.push(w.frame(t, ms));
  }
  return actions.filter((a) => a !== 'none');
}

describe('FrameWatch', () => {
  it('does nothing at 60 fps', () => {
    expect(feed(new FrameWatch(), 60, 16.7)).toEqual([]);
  });

  it('steps down after 10 bad seconds, then again, then disables the scene', () => {
    const w = new FrameWatch();
    expect(feed(w, 11, 25)).toEqual(['downscale']);
    expect(w.scale).toBe(0.83);
    expect(feed(w, 11, 25, 11)).toEqual(['downscale']);
    expect(w.scale).toBe(0.67);
    expect(feed(w, 11, 25, 22)).toEqual(['disable-scene']);
    expect(w.scale).toBe(0.67); // never back up, never below the floor
  });

  it('resumes at a carried scale after a reload, never back up (design §7)', () => {
    const w = new FrameWatch(0.67);
    expect(w.scale).toBe(0.67);
    expect(feed(w, 11, 25)).toEqual(['disable-scene']);
  });

  it('does not act on 9 bad seconds followed by a good one', () => {
    const w = new FrameWatch();
    expect([...feed(w, 9, 25), ...feed(w, 2, 16.7, 9)]).toEqual([]);
  });

  it('counts a 12 s gap in the frame clock as 12 bad seconds', () => {
    const w = new FrameWatch();
    feed(w, 5, 16.7);
    expect(w.frame(5 + 12, 12000)).toBe('downscale');
  });

  it('reports per-second stats like the spike perf log', () => {
    const w = new FrameWatch();
    feed(w, 1.05, 16.7);
    expect(w.lastSecond!.frames).toBeGreaterThanOrEqual(59);
    expect(w.lastSecond!.over20).toBe(0);
  });
});
