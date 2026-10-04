import { describe, expect, it } from 'vitest';
import { FlashLimiter } from './flashLimiter';

const TILES = 48;
const frame = (rgb: [number, number, number], only?: number) => {
  const f = new Float32Array(TILES * 3);
  for (let i = 0; i < TILES; i++) {
    const c = only === undefined || only === i ? rgb : [0, 0, 0];
    f.set(c, i * 3);
  }
  return f;
};
const lum = (f: Float32Array, i: number) => 0.2126 * f[i * 3] + 0.7152 * f[i * 3 + 1] + 0.0722 * f[i * 3 + 2];

// The wall's output targets are 8-bit sRGB, so what it shows is rounded (compositor MIX_FRAG).
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const wall8 = (lin: number) => toLin(Math.round(Math.min(1, Math.max(0, toSrgb(lin))) * 255) / 255);

/** Run frames at 60 fps; returns the output tiles per frame (applying alpha like the compositor). */
function play(frames: Float32Array[], round = false): Float32Array[] {
  const lim = new FlashLimiter();
  let last = frames[0].slice();
  return frames.map((cand, n) => {
    const a = lim.step(n / 60, cand);
    last = last.map((x, i) => x + a * (cand[i] - x));
    if (round) last = last.map(wall8);
    return last.slice();
  });
}

/**
 * Max WCAG flashes in any 1 s window on one tile of the output. A flash is a pair of opposing
 * luminance changes of >= 0.10 (darker side < 0.80), each counted however many frames it takes.
 */
function maxFlashesPerSecond(out: Float32Array[], tile: number): number {
  const times: number[] = [];
  let dir = 0;
  let lo = lum(out[0], tile), hi = lo, ext = lo;
  for (let n = 1; n < out.length; n++) {
    const x = lum(out[n], tile);
    if (dir === 0) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
      if (x - lo >= 0.1 && lo < 0.8) [dir, ext] = [1, x];
      else if (hi - x >= 0.1 && x < 0.8) [dir, ext] = [-1, x];
      else continue;
      times.push(n / 60);
    } else if (dir === 1) {
      ext = Math.max(ext, x);
      if (ext - x >= 0.1 && x < 0.8) [dir, ext] = [-1, x], times.push(n / 60);
    } else {
      ext = Math.min(ext, x);
      if (x - ext >= 0.1 && ext < 0.8) [dir, ext] = [1, x], times.push(n / 60);
    }
  }
  let best = 0;
  for (const t of times) best = Math.max(best, times.filter((u) => u >= t && u < t + 1).length);
  return best / 2;
}

const grey = (v: number): [number, number, number] => [v, v, v];

describe('FlashLimiter', () => {
  it('passes steady and slowly changing content untouched', () => {
    const lim = new FlashLimiter();
    for (let n = 0; n < 120; n++) expect(lim.step(n / 60, frame([n / 240, n / 240, n / 240]))).toBe(1);
  });

  it('caps alternating black/white frames at 3 flashes per second', () => {
    const frames = Array.from({ length: 240 }, (_, n) => frame(n % 2 ? [1, 1, 1] : [0, 0, 0]));
    expect(maxFlashesPerSecond(play(frames), 0)).toBeLessThanOrEqual(3);
  });

  it('caps a strobe confined to a single tile', () => {
    const frames = Array.from({ length: 240 }, (_, n) => frame(n % 4 < 2 ? [1, 1, 1] : [0, 0, 0], 17));
    expect(maxFlashesPerSecond(play(frames), 17)).toBeLessThanOrEqual(3);
  });

  it('caps a smooth 4.27 Hz brightness swing (hi-hats at 128 BPM), which no single frame reveals', () => {
    const frames = Array.from({ length: 240 }, (_, n) => frame(grey(0.3 + 0.2 * Math.sin(2 * Math.PI * 4.27 * (n / 60)))));
    expect(maxFlashesPerSecond(play(frames), 0)).toBeLessThanOrEqual(3);
  });

  it('stays within budget when the wall rounds each frame to 8-bit sRGB', () => {
    const frames = Array.from({ length: 240 }, (_, n) => frame(grey(0.3 + 0.2 * Math.sin(2 * Math.PI * 4.27 * (n / 60)))));
    expect(maxFlashesPerSecond(play(frames, true), 0)).toBeLessThanOrEqual(3);
  });

  it('caps a 5 Hz triangle ramp spread over six frames', () => {
    const frames = Array.from({ length: 240 }, (_, n) => frame(grey(0.5 * (1 - Math.abs(((n % 12) / 6) - 1)))));
    expect(maxFlashesPerSecond(play(frames), 0)).toBeLessThanOrEqual(3);
  });

  it('lets a kick pulse at 128 BPM through untouched (R1: visuals pulse with the beat)', () => {
    const beat = 60 / 128;
    const lim = new FlashLimiter();
    const alphas = Array.from({ length: 600 }, (_, n) => {
      const t = n / 60;
      return lim.step(t, frame(grey(0.05 + 0.6 * Math.exp(-(t % beat) / 0.06))));
    });
    expect(alphas.every((a) => a === 1)).toBe(true);
  });

  it('damps an equal-luminance red/blue strobe (red flashes)', () => {
    // Blue chosen to match red's luminance, so only the red rule can catch it.
    const red: [number, number, number] = [0.5, 0, 0];
    const blue: [number, number, number] = [0, 0, (0.2126 * 0.5) / 0.0722];
    const lim = new FlashLimiter();
    const alphas = Array.from({ length: 120 }, (_, n) => lim.step(n / 60, frame(n % 6 < 3 ? red : blue)));
    expect(alphas.filter((a) => a < 1).length).toBeGreaterThan(0);
  });

  it('releases damping once the content stops flashing', () => {
    const frames = [
      ...Array.from({ length: 60 }, (_, n) => frame(n % 2 ? [1, 1, 1] : [0, 0, 0])),
      ...Array.from({ length: 180 }, () => frame([0.3, 0.3, 0.3])),
    ];
    const lim = new FlashLimiter();
    const alphas = frames.map((f, n) => lim.step(n / 60, f));
    expect(alphas.at(-1)).toBe(1);
  });
});
