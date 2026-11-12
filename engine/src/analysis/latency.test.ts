import { describe, expect, it } from 'vitest';
import { analyserSpectrum } from '../audio/analyserSpectrum';
import { CONFIG } from '../config';
import { Analysis } from './analysis';
import { rng } from './synthetic';

// How late the engine hears a kick, and how far its beat clock sits from the true beat (2026-11-12: the user said
// the visuals feel late). Synthetic 128 BPM kicks fed through the analysis exactly as audiofile.test.ts feeds a
// recording: an analyser read every 60 Hz frame over the last fftSize samples. Prints the numbers — run with
// --silent=false. It cannot see what lies outside the engine: BlackHole's buffer, the browser's paint, the projector.
const SR = 44100;
const HOP = SR / 60;
const BPM = 128;
const BEAT = 60 / BPM;
const SECONDS = 180;

function kicks(): Float32Array {
  const rand = rng(7);
  const out = new Float32Array(SECONDS * SR);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const since = t % BEAT;
    out[i] = 0.03 * (rand() * 2 - 1) + (since < 0.25 ? 0.8 * Math.sin(2 * Math.PI * 50 * since) * Math.exp(-since / 0.08) : 0);
  }
  return out;
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

describe('latency', () => {
  it('hears nearly every kick, and reports detection delay and beat-clock error', () => {
    const audio = kicks();
    const n = CONFIG.fftSize;
    const wave = new Float32Array(n);
    const freq = new Float32Array(n / 2);
    const a = new Analysis();
    const delays: number[] = [];
    const phaseErr: number[] = [];
    let nextOnset = 10 * BEAT; // skip the first 10 beats: the detector's threshold is still settling
    for (let end = n; end <= audio.length; end += HOP) {
      const e = Math.floor(end);
      wave.set(audio.subarray(e - n, e));
      analyserSpectrum(wave, freq);
      const t = e / SR;
      const f = a.frame(t, freq, wave, SR);
      // Clock error: the clock's phase at the frame nearest each true beat, as a signed fraction of a beat.
      if (f.bpm !== null && t > 10) {
        const k = Math.round(t / BEAT);
        if (Math.abs(t - k * BEAT) <= 0.5 / 60) {
          let ph = f.beatPhase;
          if (ph > 0.5) ph -= 1;
          phaseErr.push(ph * BEAT * 1000);
        }
      }
      while (t - nextOnset > BEAT / 2) nextOnset += BEAT; // a missed kick: move on
      if (f.kick && t >= nextOnset - 0.05) {
        delays.push((t - nextOnset) * 1000);
        nextOnset += BEAT;
      }
    }
    const expected = Math.floor((SECONDS - 10 * BEAT) / BEAT);
    console.log(`kicks heard ${delays.length}/${expected}`);
    console.log(`detection delay ms: median ${pct(delays, 0.5).toFixed(1)}, p95 ${pct(delays, 0.95).toFixed(1)}`);
    console.log(`beat-clock error ms (+ = clock ahead of the beat): median ${pct(phaseErr, 0.5).toFixed(1)}, p5 ${pct(phaseErr, 0.05).toFixed(1)}, p95 ${pct(phaseErr, 0.95).toFixed(1)}`);
    expect(delays.length).toBeGreaterThanOrEqual(0.95 * expected);
  }, 120_000);
});
