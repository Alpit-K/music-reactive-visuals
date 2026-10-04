import { describe, expect, it } from 'vitest';
import { BeatClock, type ClockState } from './clock';
import { BEAT, FPS } from './synthetic';

/** Run the clock at 60 fps with kicks at the given times; returns every frame's state. */
function run(kickTimes: number[], seconds: number): ClockState[] {
  const clock = new BeatClock();
  const out: ClockState[] = [];
  let k = 0;
  for (let i = 0; i < seconds * FPS; i++) {
    const t = i / FPS;
    let kick = false;
    while (k < kickTimes.length && kickTimes[k] <= t) {
      kick = true;
      k++;
    }
    out.push(clock.update(t, kick));
  }
  return out;
}

const beats = (from: number, to: number) => {
  const out: number[] = [];
  for (let t = from; t < to; t += BEAT) out.push(t);
  return out;
};

describe('BeatClock', () => {
  it('locks to a 128 BPM click within ±0.5 BPM', () => {
    const states = run(beats(0, 30), 30);
    expect(states.at(-1)!.bpm!).toBeGreaterThan(127.5);
    expect(states.at(-1)!.bpm!).toBeLessThan(128.5);
  });

  it('has no tempo before four intervals', () => {
    expect(run(beats(0, 1.5), 1.5).at(-1)!.bpm).toBeNull();
  });

  it('survives every third kick missing (1.5-beat median trap)', () => {
    const kicks = beats(0, 30).filter((_, i) => i % 3 !== 2);
    const bpm = run(kicks, 30).at(-1)!.bpm!;
    expect(Math.abs(bpm - 128)).toBeLessThan(1);
  });

  it('folds a half-time or double-time reading into range', () => {
    const half = run(beats(0, 30).filter((_, i) => i % 2 === 0), 30).at(-1)!.bpm!;
    expect(Math.abs(half - 128)).toBeLessThan(1);
  });

  it('fires one bar line every 4 beats', () => {
    const lines = run(beats(0, 60), 60).filter((s) => s.barLine).length;
    expect(Math.abs(lines - 60 / (4 * BEAT))).toBeLessThanOrEqual(3); // ~32 bars, minus lock-in
  });

  it('keeps kicks on whole beats once locked', () => {
    const clock = new BeatClock();
    const kicks = beats(0, 60);
    const errs: number[] = [];
    let k = 0;
    for (let i = 0; i < 60 * FPS; i++) {
      const t = i / FPS;
      let kick = false;
      while (k < kicks.length && kicks[k] <= t) {
        kick = true;
        k++;
      }
      const s = clock.update(t, kick);
      if (kick && t > 20) errs.push(Math.abs(s.beat - Math.round(s.beat)));
    }
    expect(Math.max(...errs)).toBeLessThan(0.1);
  });

  it('free-runs through a breakdown at the last tempo', () => {
    const states = run([...beats(0, 20), ...beats(36, 40)], 40);
    const inBreakdown = states.slice(25 * FPS, 35 * FPS);
    expect(inBreakdown.filter((s) => s.barLine).length).toBeGreaterThanOrEqual(4);
    expect(inBreakdown.every((s) => s.bpm !== null)).toBe(true);
  });

  it('never fires a bar line twice for the same bar when a correction pulls the beat back', () => {
    // Kicks slightly early each time: corrections pull the count backwards across bar lines.
    const kicks = beats(0, 30).map((t, i) => t - (i % 4 === 0 ? 0.03 : 0));
    const bars = run(kicks, 30).filter((s) => s.barLine).map((s) => s.bar);
    expect(new Set(bars).size).toBe(bars.length);
  });
});
