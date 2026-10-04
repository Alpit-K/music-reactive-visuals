import { describe, expect, it } from 'vitest';
import { Interlude } from './interlude';

const SMOOTH = () => [1e-2, 1e-2, 1e-2, 1e-2, 1e-2, 1e-2];
// Every band jumps 12 dB on one frame in eight (7.5 Hz, like hats): 1.5 dB of rise per frame on average.
const BUSY = (frame: number) => Array(6).fill(frame % 8 === 0 ? 10 ** (-28 / 20) : 10 ** (-40 / 20));

/** 60 frames a second; returns the state at any time. */
function drive(seconds: number, bands: (t: number, frame: number) => number[], rms: (t: number) => number = () => -20) {
  const il = new Interlude();
  const out: { interlude: boolean; busyness: number | null }[] = [];
  for (let i = 0; i < seconds * 60; i++) out.push(il.update(i / 60, bands(i / 60, i), rms(i / 60)));
  return (t: number) => out[Math.round(t * 60)];
}

describe('Interlude', () => {
  it('has no busyness before 30 playing seconds', () => {
    const at = drive(40, SMOOTH);
    expect(at(29).busyness).toBeNull();
    expect(at(32).busyness).not.toBeNull();
  });

  it('reads 1.5 for bands that jump 12 dB every eighth frame, and never calls it an interlude', () => {
    const at = drive(120, (_, f) => BUSY(f));
    expect(at(60).busyness!).toBeCloseTo(1.5, 1);
    expect(at(119).interlude).toBe(false);
  });

  it('enters once smooth sound has filled the window and held 15 s more', () => {
    const at = drive(60, SMOOTH);
    expect(at(40).interlude).toBe(false);
    expect(at(47).interlude).toBe(true);
  });

  it('ends within 8 s of the music turning busy again', () => {
    const at = drive(90, (t, f) => (t < 60 ? SMOOTH() : BUSY(f)));
    expect(at(59).interlude).toBe(true);
    expect(at(69).interlude).toBe(false);
  });

  it('ignores a smooth stretch of 20 s (one needs about 25 s)', () => {
    // The 30 s mean falls below 0.9 ~13 s into the smooth stretch, and the hold needs 15 s more; the 8 s mean
    // turns busy again ~5 s after it ends.
    const at = drive(130, (t, f) => (t >= 60 && t < 80 ? SMOOTH() : BUSY(f)));
    for (let t = 60; t < 130; t++) expect(at(t).interlude).toBe(false);
  });

  it('leaves silent seconds out, so silence does not read as smooth music', () => {
    const at = drive(120, (t, f) => (t >= 30 && t < 90 ? SMOOTH() : BUSY(f)), (t) => (t >= 30 && t < 90 ? -120 : -20));
    for (let t = 30; t < 120; t++) expect(at(t).interlude).toBe(false);
  });
});
