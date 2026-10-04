import { describe, expect, it } from 'vitest';
import { Analysis } from './analysis';

/** A dB spectrum with energy only in the 20–60 Hz bins, at `levelDb`. */
function subSpectrum(levelDb: number, sampleRate = 44100): Float32Array {
  const db = new Float32Array(1024).fill(-120);
  const binHz = sampleRate / 2048;
  for (let i = Math.ceil(20 / binHz); i < Math.ceil(60 / binHz); i++) db[i] = levelDb;
  return db;
}

describe('Analysis', () => {
  it('turns a 128 BPM sub pulse into kicks, tempo and 0..1 bands', () => {
    const a = new Analysis();
    const wave = new Float32Array(2048).fill(0.1);
    let kicks = 0;
    let last = a.frame(0, subSpectrum(-60), wave, 44100);
    for (let i = 1; i < 30 * 60; i++) {
      const t = i / 60;
      const sinceBeat = t % (60 / 128);
      const f = a.frame(t, subSpectrum(-60 + 40 * Math.exp(-sinceBeat / 0.25)), wave, 44100);
      if (f.kick) kicks++;
      last = f;
    }
    expect(Math.abs(kicks - 64)).toBeLessThanOrEqual(3);
    expect(Math.abs(last.bpm! - 128)).toBeLessThan(0.5);
    for (const b of [last.sub, last.bass, last.mids, last.highs]) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
    expect(last.idle).toBe(false);
  });
});
