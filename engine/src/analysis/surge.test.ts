import { describe, expect, it } from 'vitest';
import { Surge } from './surge';

// 60 frames a second; kicks every beat at 128 BPM unless kickless.
function drive(seconds: number, rms: (t: number) => number, kickless: (t: number) => boolean = () => false, highs: (t: number) => number = () => -40) {
  const s = new Surge();
  const out: boolean[] = [];
  let lastKick = -Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i / 60;
    if (!kickless(t) && Math.floor(t / (60 / 128)) !== Math.floor((t - 1 / 60) / (60 / 128))) lastKick = t;
    out.push(s.update(t, rms(t), highs(t), t - lastKick));
  }
  return (t: number) => out[Math.round(t * 60)];
}

describe('Surge', () => {
  it('fires a few seconds after the music gets 4 dB+ louder than the half-minute before', () => {
    const at = drive(60, (t) => (t < 40 ? -20 : -14));
    expect(at(39.5)).toBe(false);
    expect(at(41.5)).toBe(false);
    expect(at(44.5)).toBe(true);
  });

  it('fires on a 6 dB+ lift in the highs alone, with the loudness unchanged', () => {
    const at = drive(60, () => -20, undefined, (t) => (t < 40 ? -40 : -33));
    expect(at(39.5)).toBe(false);
    expect(at(44.5)).toBe(true);
  });

  it('ignores a highs lift under 6 dB', () => {
    const at = drive(60, () => -20, undefined, (t) => (t < 40 ? -40 : -35));
    for (let t = 1; t < 60; t += 0.5) expect(at(t)).toBe(false);
  });

  it('stays off for steady music and for a lift under the threshold', () => {
    const steady = drive(60, () => -20);
    const small = drive(60, (t) => (t < 40 ? -20 : -17));
    for (let t = 1; t < 60; t += 0.5) {
      expect(steady(t)).toBe(false);
      expect(small(t)).toBe(false);
    }
  });

  it('fades once the louder level becomes the new normal', () => {
    const at = drive(90, (t) => (t < 40 ? -20 : -14));
    expect(at(44.5)).toBe(true);
    expect(at(80)).toBe(false);
  });

  it('needs the kick: a loud kickless riser is not a surge', () => {
    const at = drive(60, (t) => (t < 40 ? -20 : -14), (t) => t >= 38);
    expect(at(44.5)).toBe(false);
  });

  it('does not fire when audio starts after silence', () => {
    const at = drive(60, (t) => (t < 20 ? -120 : -14));
    for (let t = 20; t < 60; t += 0.5) expect(at(t)).toBe(false);
  });
});
