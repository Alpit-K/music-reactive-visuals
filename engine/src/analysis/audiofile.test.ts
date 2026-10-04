import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyserSpectrum } from '../audio/analyserSpectrum';
import { CONFIG } from '../config';
import { Analysis } from './analysis';

// Runs a recording through the analysis as the wall would hear it and writes a features log in the
// wall's format, for the replay check and the spike's scoring script:
// AUDIO=<file> OUT=<features.jsonl> npx vitest run src/analysis/audiofile.test.ts
const audio = process.env.AUDIO;
const out = process.env.OUT;
const SR = 44100;
const HOP = SR / 60; // one analyser read per 60 Hz frame

describe.runIf(audio && out)('features log from an audio file', () => {
  it('writes one row per frame', async () => {
    const n = CONFIG.fftSize;
    const ring = new Float32Array(n);
    const wave = new Float32Array(n);
    const freq = new Float32Array(n / 2);
    const a = new Analysis();
    const rows: string[] = [];
    let filled = 0;
    let nextRead = n;
    let leftover = Buffer.alloc(0);
    // Stereo decode, averaged here: an AnalyserNode down-mixes stereo to mono as (L + R) / 2.
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', audio!, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-']);
    for await (const chunk of ff.stdout) {
      const buf = Buffer.concat([leftover, chunk as Buffer]);
      const frames = Math.floor(buf.length / 8);
      leftover = buf.subarray(frames * 8);
      for (let i = 0; i < frames; i++) {
        ring[filled % n] = (buf.readFloatLE(i * 8) + buf.readFloatLE(i * 8 + 4)) / 2;
        filled++;
        if (filled >= nextRead) {
          nextRead += HOP;
          for (let j = 0; j < n; j++) wave[j] = ring[(filled + j) % n];
          analyserSpectrum(wave, freq);
          const t = filled / SR;
          const f = a.frame(t, freq, wave, SR);
          rows.push(JSON.stringify({ t: +t.toFixed(4), rms: +f.rmsDb.toFixed(1), bands: a.bands.map((b) => Number(b.toPrecision(4))) }));
        }
      }
    }
    writeFileSync(out!, rows.join('\n') + '\n');
    console.log(`${rows.length} frames, ${(filled / SR / 60).toFixed(1)} min`);
    expect(rows.length).toBeGreaterThan(0);
  }, 30 * 60_000);
});
