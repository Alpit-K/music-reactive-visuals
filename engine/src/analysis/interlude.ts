import { CONFIG } from '../config';

const db = (x: number) => 20 * Math.log10(x + 1e-9);

/**
 * Ambient interludes (design §5): smooth sound, read as low busyness — how far the bass, mids and highs
 * rise from frame to frame. It ignores kicks and tempo, which ambient music fakes and rumbling techno
 * hides (spike-findings §7). Slow in (30 s window, then a 15 s hold), quicker out (8 s window). The window
 * is read from 10 s in, so a session that opens on ambient music does not wait for it to fill.
 */
export class Interlude {
  private prev: number[] | null = null;
  private second: number | null = null;
  private sum = { rise: 0, rms: 0 };
  private count = 0;
  private seconds: number[] = []; // per playing second; silent seconds are left out
  private held = 0;
  private interlude = false;
  private busyness: number | null = null;

  update(t: number, bands: number[], rmsDb: number): { interlude: boolean; busyness: number | null } {
    const now = bands.slice(1).map(db);
    const rise = this.prev ? now.reduce((a, x, i) => a + Math.max(x - this.prev![i], 0), 0) / now.length : 0;
    this.prev = now;

    const s = Math.floor(t);
    if (this.second !== null && s !== this.second) this.closeSecond();
    this.second = s;
    this.sum.rise += rise;
    this.sum.rms += rmsDb;
    this.count++;
    return { interlude: this.interlude, busyness: this.busyness };
  }

  private closeSecond(): void {
    const { windowS, minS, shortS, enterBelow, holdS, leaveAbove } = CONFIG.interlude;
    if (this.sum.rms / this.count > CONFIG.idle.db) {
      this.seconds.push(this.sum.rise / this.count);
      if (this.seconds.length > windowS) this.seconds.shift();
      if (this.seconds.length >= minS) {
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        this.busyness = mean(this.seconds);
        const recent = mean(this.seconds.slice(-shortS));
        if (this.interlude) {
          if (recent > leaveAbove) {
            this.interlude = false;
            this.held = 0;
          }
        } else {
          this.held = this.busyness < enterBelow && recent < enterBelow ? this.held + 1 : 0;
          if (this.held > holdS) this.interlude = true;
        }
      }
    }
    this.sum = { rise: 0, rms: 0 };
    this.count = 0;
  }
}
