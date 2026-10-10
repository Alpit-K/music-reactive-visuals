import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Analysis } from './analysis';
import { BAND_EDGES } from './bands';

const path = process.env.REPLAY;
const SR = 44100;

function spectrumFor(bands: number[]): Float32Array {
  const db = new Float32Array(1024).fill(-200);
  const binHz = SR / 2048;
  for (let b = 0; b < 6; b++) {
    const lo = Math.max(1, Math.ceil(BAND_EDGES[b] / binHz));
    const hi = Math.min(1024, Math.ceil(BAND_EDGES[b + 1] / binHz));
    for (let i = lo; i < hi; i++) db[i] = 20 * Math.log10(bands[b] + 1e-12);
  }
  return db;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

describe.runIf(path)('replay of a spike capture log', () => {
  it('prints peak, dark and interlude spans, breakdowns and tempo', () => {
    const rows = readFileSync(path!, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const t0 = rows[0].t;
    const a = new Analysis();
    const wave = new Float32Array(2048);
    let peakStart: number | null = null;
    let darkStart: number | null = null;
    let inBreakdown = false;
    let interludeStart: number | null = null;
    const interludes: string[] = [];
    const peaks: string[] = [];
    const darks: string[] = [];
    const breakdowns: string[] = [];
    const bpms: number[] = [];
    for (const r of rows) {
      const t = r.t - t0;
      wave.fill(10 ** (r.rms / 20)); // constant wave at the logged RMS
      const f = a.frame(t, spectrumFor(r.bands), wave, SR);
      if (f.character === 'peak' && peakStart === null) peakStart = t;
      if (f.character !== 'peak' && peakStart !== null) {
        peaks.push(`${mmss(peakStart)}–${mmss(t)}`);
        peakStart = null;
      }
      if (f.character === 'dark' && darkStart === null) darkStart = t;
      if (f.character !== 'dark' && darkStart !== null) {
        darks.push(`${mmss(darkStart)}–${mmss(t)}`);
        darkStart = null;
      }
      if (f.interlude && interludeStart === null) interludeStart = t;
      if (!f.interlude && interludeStart !== null) {
        interludes.push(`${mmss(interludeStart)}–${mmss(t)}`);
        interludeStart = null;
      }
      if (f.breakdown && !inBreakdown) breakdowns.push(mmss(t));
      inBreakdown = f.breakdown;
      if (f.bpm && Math.floor(t) % 10 === 0) bpms.push(f.bpm);
    }
    if (peakStart !== null) peaks.push(`${mmss(peakStart)}–end`);
    if (darkStart !== null) darks.push(`${mmss(darkStart)}–end`);
    if (interludeStart !== null) interludes.push(`${mmss(interludeStart)}–end`);
    console.log('peak:', peaks.join(', '));
    console.log('dark:', darks.join(', ') || 'none');
    console.log('breakdowns:', breakdowns.join(', '));
    console.log('interludes:', interludes.join(', ') || 'none');
    console.log('bpm range:', Math.min(...bpms).toFixed(1), '–', Math.max(...bpms).toFixed(1));
    expect(peaks.length).toBeGreaterThan(0);
  }, 10 * 60_000); // a 150-minute log takes longer than the 5 s default
});
