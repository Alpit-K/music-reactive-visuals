import { analyserSpectrum } from '../audio/analyserSpectrum';
import { CONFIG } from '../config';

/**
 * Onsets from raw audio (2026-11-16), for the beat tracker (analysis/tempo.ts). The first analysis read six band levels
 * once per drawn frame — every 17 ms, over a 46 ms window — and heard a beat only as a kick in the sub-bass. This reads
 * every sample, 172 times a second, and reports how much each band rose since the last hop: low, mid (snare, body) and high (hats)
 * for the pulse, and the sub-bass for the kick. No imports beyond the FFT and the config, so it runs on the audio thread
 * (audio/onsets.worklet.ts) and in Node alike.
 */
/** Index of the sub-bass in `flux` and `level`, after the three pulse bands. */
export const SUB = CONFIG.ears.bandsHz.length;

export class OnsetFrontEnd {
  private ring: Float32Array;
  private filled = 0;
  private spectra: { n: number; wave: Float32Array; db: Float32Array; prev: Float32Array; bins: [number, number][]; first: number }[];
  /** Per band — low, mid, high, then the sub-bass (SUB). Reused on every hop: copy it to keep it. */
  readonly flux = new Float32Array(CONFIG.ears.bandsHz.length + 1);
  readonly level = new Float32Array(CONFIG.ears.bandsHz.length + 1);

  constructor(private sampleRate: number) {
    const { fft, bandsHz, sub, floorDb } = CONFIG.ears;
    this.ring = new Float32Array(Math.max(fft, sub.fft));
    const spectrum = (n: number, bands: readonly (readonly number[])[], first: number) => ({
      n, first, wave: new Float32Array(n), db: new Float32Array(n / 2), prev: new Float32Array(n / 2).fill(floorDb),
      bins: bands.map(([lo, hi]) => [Math.max(1, Math.round((lo * n) / sampleRate)), Math.min(n / 2, Math.round((hi * n) / sampleRate))] as [number, number]),
    });
    this.spectra = [spectrum(fft, bandsHz, 0), spectrum(sub.fft, [sub.hz], SUB)];
  }

  /** Hops a second. */
  get rate(): number {
    return this.sampleRate / CONFIG.ears.hop;
  }

  /** Feed mono samples; `onHop(t)` runs once per hop with `flux` and `level` set, `t` the time of the newest sample. */
  push(samples: Float32Array, onHop: (t: number) => void): void {
    const { hop, floorDb } = CONFIG.ears;
    const size = this.ring.length;
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.filled % size] = samples[i];
      this.filled++;
      if (this.filled % hop !== 0) continue;
      for (const s of this.spectra) {
        for (let j = 0; j < s.n; j++) s.wave[j] = this.ring[(this.filled - s.n + j + size) % size];
        analyserSpectrum(s.wave, s.db);
        s.bins.forEach(([lo, hi], b) => {
          let rise = 0, sum = 0;
          for (let k = lo; k < hi; k++) {
            const d = Math.max(s.db[k], floorDb); // -Infinity in digital silence
            rise += Math.max(d - s.prev[k], 0);
            sum += d;
            s.prev[k] = d;
          }
          this.flux[s.first + b] = rise / (hi - lo);
          this.level[s.first + b] = sum / (hi - lo);
        });
      }
      onHop(this.filled / this.sampleRate);
    }
  }
}
