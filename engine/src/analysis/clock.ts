import { CONFIG } from '../config';

export interface ClockState {
  bpm: number | null;
  beat: number;
  bar: number;
  beatPhase: number;
  barLine: boolean;
}

/**
 * V1 beat clock from detected kicks (design §5). Known limitation: bars are counted from
 * wherever it locked on, not from the true downbeat — V3 replaces this with Ableton Link.
 */
export class BeatClock {
  private kicks: number[] = [];
  private bpm: number | null = null;
  private beat = 0;
  private lastT: number | null = null;
  private lastBar = 0;
  private locked = false;

  update(t: number, kick: boolean): ClockState {
    if (this.lastT !== null && this.bpm !== null) this.beat += ((t - this.lastT) * this.bpm) / 60;
    this.lastT = t;

    if (kick) {
      this.kicks.push(t);
      this.kicks = this.kicks.filter((k) => k > t - CONFIG.bpm.windowS);
      const bpm = tempo(this.kicks);
      if (bpm !== null) this.bpm = bpm;
      if (this.bpm !== null) {
        if (!this.locked) {
          this.beat = Math.round(this.beat);
          this.locked = true;
        } else {
          this.beat += CONFIG.clock.phaseGain * (Math.round(this.beat) - this.beat);
        }
      }
    }

    const bar = Math.floor(this.beat / CONFIG.clock.beatsPerBar);
    const barLine = bar > this.lastBar;
    if (barLine) this.lastBar = bar;
    return { bpm: this.bpm, beat: this.beat, bar, beatPhase: this.beat - Math.floor(this.beat), barLine };
  }
}

/** Median kick interval, each folded by octaves into the 115–150 BPM range first (spike bpm_track). */
export function tempo(kicks: number[]): number | null {
  const { lo, hi, minIntervals } = CONFIG.bpm;
  const centre = 60 / Math.sqrt(lo * hi);
  const iv: number[] = [];
  for (let i = 1; i < kicks.length; i++) {
    const d = kicks[i] - kicks[i - 1];
    const folded = d / 2 ** Math.round(Math.log2(d / centre));
    if (folded >= 60 / hi && folded <= 60 / lo) iv.push(folded);
  }
  if (iv.length < minIntervals) return null;
  iv.sort((a, b) => a - b);
  const med = iv[Math.floor(iv.length / 2)];
  // The median alone is quantised to whole frames (128 BPM reads 128.6 at 60 fps): average the intervals near it.
  const near = iv.filter((x) => Math.abs(x - med) <= 0.05 * med);
  return 60 / (near.reduce((a, b) => a + b, 0) / near.length);
}
