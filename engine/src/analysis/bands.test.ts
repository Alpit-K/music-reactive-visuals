import { describe, expect, it } from 'vitest';
import { bandEnergies, rmsDb } from './bands';

// A dB spectrum that is silent except for one bin at 0 dB.
function tone(hz: number, sampleRate: number, fftSize = 2048): Float32Array {
  const db = new Float32Array(fftSize / 2).fill(-120);
  db[Math.round(hz / (sampleRate / fftSize))] = 0;
  return db;
}

const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));

describe('bandEnergies', () => {
  for (const sampleRate of [44100, 48000]) {
    it(`assigns tones to the right band at ${sampleRate} Hz`, () => {
      expect(argmax(bandEnergies(tone(45, sampleRate), sampleRate))).toBe(0); // 20–60
      expect(argmax(bandEnergies(tone(100, sampleRate), sampleRate))).toBe(1); // 60–150
      expect(argmax(bandEnergies(tone(1000, sampleRate), sampleRate))).toBe(3); // 500–2k
      expect(argmax(bandEnergies(tone(4000, sampleRate), sampleRate))).toBe(4); // 2k–6k
      expect(argmax(bandEnergies(tone(10000, sampleRate), sampleRate))).toBe(5); // 6k–16k
    });
  }
});

describe('rmsDb', () => {
  it('reads a full-scale sine as about -3 dBFS', () => {
    const s = Float32Array.from({ length: 2048 }, (_, i) => Math.sin((2 * Math.PI * i) / 64));
    expect(rmsDb(s)).toBeCloseTo(-3.01, 1);
  });

  it('floors digital silence at -120 so it survives JSON', () => {
    expect(rmsDb(new Float32Array(2048))).toBe(-120);
  });
});
