// What an AnalyserNode with smoothingTimeConstant 0 returns from getFloatFrequencyData (Web Audio spec,
// "FFT windowing and smoothing over time"): Blackman window, FFT scaled by 1/N, magnitude in dB.
// Lets a recording be analysed without a browser. No imports, so plain Node can load it too.

const cache = new Map<number, { win: Float64Array; cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();

function tables(n: number) {
  let t = cache.get(n);
  if (!t) {
    const win = new Float64Array(n);
    for (let i = 0; i < n; i++) win[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / n);
      sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    const bits = Math.log2(n);
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    t = { win, cos, sin, rev };
    cache.set(n, t);
  }
  return t;
}

/** `wave` is the last fftSize mono samples; `out` gets fftSize / 2 bins in dB. */
export function analyserSpectrum(wave: Float32Array, out: Float32Array): void {
  const n = wave.length;
  const { win, cos, sin, rev } = tables(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[rev[i]] = wave[i] * win[i];
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const wr = cos[k * step];
        const wi = sin[k * step];
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  for (let k = 0; k < n / 2; k++) out[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / n);
}
