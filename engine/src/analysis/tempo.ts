import { CONFIG } from '../config';
import { SUB } from './onsets';
import { TimeWindow } from './timeWindow';

export interface Heard {
  bpm: number | null;
  beat: number;         // beats counted since the tempo was found; whole numbers fall on the beat
  confidence: number;   // how clearly the pulse repeats at this tempo, 0..1
  kick: boolean;        // a low-band onset on this hop
  kickPresence: number; // the share of the last 8 beats that had a kick on the beat
}

/**
 * Tempo, beat and kick from the onset front end's hops (design §5 *Second hearing*, 2026-11-16).
 *
 * The first clock took the median gap between kicks, folded into 115–150 BPM. That needs a kick, hears an off-beat
 * figure 3/4 of a beat apart as a tempo, and cannot leave its range. This asks instead how well the whole pulse — kick,
 * snare and hats — repeats at each tempo from 60 to 200 (the autocorrelation of the last 8 s), and counts a tempo's
 * repeats at 2, 3 and 4 beats too, which a true beat has and a 3/4-beat figure lacks.
 */
export class BeatTracker {
  private c = CONFIG.ears;
  private n: number;
  private pulse: Float32Array; // ring: all bands, for the tempo
  private low: Float32Array;   // ring: the sub-bass, for where the beat falls
  private at = 0;
  private hops = 0;
  private means = [0, 0, 0];
  private score: Float32Array; // leaky, per candidate tempo
  private current: number | null = null; // index into the candidates
  private rival = 0;
  private bpm: number | null = null;
  private beat = 0;
  private confidence = 0;
  private lowFlux: TimeWindow;
  private lastKick = -Infinity;
  private rose = false; // the low band rose past the threshold on the last hop: a kick if the level follows
  private lowPeak = -Infinity; // the low band's recent peak level, fading slowly
  private kickBeats: number[] = [];
  private acf: Float32Array;
  private x: Float32Array;

  constructor(private rate: number) {
    const T = this.c.tempo;
    this.n = Math.ceil(T.windowS * rate);
    this.pulse = new Float32Array(this.n);
    this.low = new Float32Array(this.n);
    this.x = new Float32Array(this.n);
    this.score = new Float32Array(Math.round((T.hi - T.lo) / T.stepBpm) + 1);
    this.acf = new Float32Array(Math.min(this.n - 1, Math.ceil((T.harmonics.length * 60 * rate) / T.lo) + 2));
    this.lowFlux = new TimeWindow(this.c.kick.windowS);
  }

  private bpmAt(i: number): number {
    return this.c.tempo.lo + i * this.c.tempo.stepBpm;
  }

  hop(t: number, flux: ArrayLike<number>, level: ArrayLike<number>): Heard {
    const T = this.c.tempo, K = this.c.kick;
    // Each band against its own recent mean, so a loud hat does not outweigh a soft kick.
    let pulse = 0;
    for (let b = 0; b < 3; b++) {
      this.means[b] += (flux[b] - this.means[b]) / (T.normS * this.rate);
      pulse += (T.weights[b] * flux[b]) / (this.means[b] + 0.05);
    }
    this.pulse[this.at] = pulse;
    this.low[this.at] = flux[SUB];
    this.at = (this.at + 1) % this.n;
    this.hops++;

    // The kick: the sub-bass rising well above its last 1.5 s, by a real margin, to near its recent peak.
    this.lowFlux.prune(t);
    const threshold = Math.max(this.lowFlux.mean() + K.k * this.lowFlux.std(), K.minRiseDb);
    this.lowFlux.push(t, flux[SUB]);
    const kick = this.rose && level[SUB] >= this.lowPeak - K.peakDropDb && level[SUB] > K.minLevelDb;
    this.lowPeak = Math.max(level[SUB], this.lowPeak - K.peakFadeDbS / this.rate);
    if (kick) this.lastKick = t;
    this.rose = !kick && flux[SUB] > threshold && t - this.lastKick >= K.refractoryS;

    if (this.bpm !== null) this.beat += this.bpm / 60 / this.rate;
    if (this.hops % Math.round(T.everyS * this.rate) === 0 && this.hops >= this.n / 2) this.estimate();

    if (kick && this.bpm !== null) this.kickBeats.push(this.beat);
    while (this.kickBeats.length && this.kickBeats[0] < this.beat - K.gridBeats - 1) this.kickBeats.shift();
    const onGrid = new Set<number>();
    for (const k of this.kickBeats) if (Math.abs(k - Math.round(k)) <= K.gridTol && Math.round(k) > this.beat - K.gridBeats) onGrid.add(Math.round(k));
    return { bpm: this.bpm, beat: this.beat, confidence: this.confidence, kick, kickPresence: onGrid.size / K.gridBeats };
  }

  private estimate(): void {
    const T = this.c.tempo;
    const n = Math.min(this.hops, this.n);
    // The window in time order, mean taken off.
    let mean = 0;
    for (let i = 0; i < n; i++) {
      this.x[i] = this.pulse[(this.at - n + i + this.n) % this.n];
      mean += this.x[i];
    }
    mean /= n;
    for (let i = 0; i < n; i++) this.x[i] -= mean;
    const lags = Math.min(this.acf.length, n - 1);
    for (let l = 0; l < lags; l++) {
      let s = 0;
      for (let i = l; i < n; i++) s += this.x[i] * this.x[i - l];
      this.acf[l] = s / (n - l);
    }
    const zero = this.acf[0];
    if (zero < 1e-9) return; // silence: hold what we have
    const acfAt = (lag: number) => {
      const i = Math.floor(lag);
      return i + 1 < lags ? this.acf[i] + (this.acf[i + 1] - this.acf[i]) * (lag - i) : 0;
    };
    let peak = 0;
    for (let i = 0; i < this.score.length; i++) {
      const bpm = this.bpmAt(i);
      const period = (60 * this.rate) / bpm;
      let s = 0, w = 0;
      T.harmonics.forEach((h, k) => {
        s += h * acfAt((k + 1) * period);
        w += h;
      });
      const prior = Math.exp(-0.5 * (Math.log2(bpm / T.priorBpm) / T.priorOctaves) ** 2);
      this.score[i] += T.leak * (Math.max(s / w / zero, 0) * prior - this.score[i]);
      if (this.score[i] > this.score[peak]) peak = i;
    }

    const near = (i: number, j: number) => Math.abs(this.bpmAt(i) - this.bpmAt(j)) <= T.nearPct * this.bpmAt(j);
    let switched = false;
    if (this.current === null) {
      if (this.score[peak] >= T.minScore) {
        this.current = peak;
        switched = true;
      }
    } else {
      // Follow the tempo as it drifts; leave it only for a rival that has scored clearly better for a while.
      let local = this.current;
      for (let i = 0; i < this.score.length; i++) if (near(i, this.current) && this.score[i] > this.score[local]) local = i;
      this.current = local;
      this.rival = !near(peak, local) && this.score[peak] > T.switchRatio * this.score[local] ? this.rival + 1 : 0;
      if (this.rival >= T.switchCount) {
        this.current = peak;
        this.rival = 0;
        switched = true;
      }
    }
    if (this.current === null) return;
    // Between two candidates: the top of a parabola through the peak and its neighbours.
    const i = this.current, a = this.score[i - 1] ?? 0, b = this.score[i], c = this.score[i + 1] ?? 0;
    const off = a + c - 2 * b < 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
    this.bpm = this.bpmAt(i) + off * T.stepBpm;
    this.confidence = Math.min(1, b);

    // Where the beat falls: the offset at which a train of beats at this tempo gathers the most sub-bass onsets.
    const period = (60 * this.rate) / this.bpm;
    const span = Math.min(n, Math.ceil(T.phaseS * this.rate));
    const sums: number[] = [];
    for (let phi = 0; phi < Math.ceil(period); phi++) {
      let s = 0;
      for (let k = 0; phi + k * period < span; k++) s += this.low[(this.at - 1 - Math.round(phi + k * period) + 2 * this.n) % this.n];
      sums.push(s);
    }
    let best = 0, total = 0;
    for (let phi = 0; phi < sums.length; phi++) {
      total += sums[phi];
      if (sums[phi] > sums[best]) best = phi;
    }
    if (sums[best] < T.phaseContrast * (total / sums.length)) return; // no kick to speak of: run free
    // Between two hops: the top of a parabola through the best offset and its neighbours (the train wraps round).
    const m = sums.length, l = sums[(best - 1 + m) % m], r = sums[(best + 1) % m];
    const fine = l + r - 2 * sums[best] < 0 ? (0.5 * (l - r)) / (l - 2 * sums[best] + r) : 0;
    const target = (best + fine) / period; // beats since the last beat
    let diff = target - (this.beat - Math.floor(this.beat));
    diff -= Math.round(diff);
    this.beat += (switched ? 1 : T.phaseGain) * diff;
  }
}
