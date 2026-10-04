import { CONFIG } from '../config';
import { TimeWindow } from './timeWindow';

/**
 * Kick onsets: sub-band flux above an adaptive threshold, gated on the sub level (design §5).
 * Streaming port of detect_kicks in phase-0-spike:spike/analyse.py.
 *
 * The flux threshold adapts over 2 s, so in a breakdown it sinks with the bass and leftover low
 * end would still trigger it; the gate drops onsets whose sub level is below its 60 s median.
 * The sub band alone, because a rolling bassline in 60–150 Hz hid real kicks.
 */
export class KickDetector {
  private flux: TimeWindow;
  private level: TimeWindow;
  private ref: TimeWindow;
  private prev: number | null = null;
  private refValue = 0;
  private refAt = -Infinity;
  private last = -Infinity;

  constructor(private cfg = CONFIG.kick) {
    this.flux = new TimeWindow(cfg.windowS);
    this.level = new TimeWindow(cfg.windowS);
    this.ref = new TimeWindow(cfg.refS);
  }

  push(t: number, sub: number): boolean {
    const flux = Math.max(sub - (this.prev ?? sub), 0);
    this.prev = sub;

    // Threshold from the frames before this one, as in the spike.
    this.flux.prune(t);
    this.level.prune(t);
    const threshold = Math.max(this.flux.mean() + this.cfg.k * this.flux.std(), this.cfg.rel * this.level.mean());
    this.flux.push(t, flux);
    this.level.push(t, sub);

    this.ref.push(t, sub);
    this.ref.prune(t);
    if (t - this.refAt >= this.cfg.refStepS) {
      this.refValue = this.ref.median();
      this.refAt = t;
    }

    if (flux > threshold && sub >= this.cfg.gate * this.refValue && t - this.last >= this.cfg.refractoryS) {
      this.last = t;
      return true;
    }
    return false;
  }
}
