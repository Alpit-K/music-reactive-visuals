// Six bands, as captured in the spike: sub and bass must stay separate, because peak detection is their ratio.
export const BAND_EDGES = [20, 60, 150, 500, 2000, 6000, 16000] as const;

/** Mean linear magnitude per band from an AnalyserNode dB spectrum. Bands are half-open [lo, hi). */
export function bandEnergies(db: Float32Array, sampleRate: number): number[] {
  const binHz = sampleRate / (db.length * 2);
  const out: number[] = [];
  for (let b = 0; b < BAND_EDGES.length - 1; b++) {
    const lo = Math.max(1, Math.ceil(BAND_EDGES[b] / binHz));
    const hi = Math.min(db.length, Math.ceil(BAND_EDGES[b + 1] / binHz));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += 10 ** (db[i] / 20);
    out.push(hi > lo ? sum / (hi - lo) : 0);
  }
  return out;
}

/** dBFS, floored at -120: JSON turns -Infinity into null. */
export function rmsDb(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.max(-120, 10 * Math.log10(sum / samples.length));
}
