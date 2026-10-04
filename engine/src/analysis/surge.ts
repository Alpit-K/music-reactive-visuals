import { CONFIG } from '../config';

/**
 * A sudden lift in loudness or in the highs while the kick plays: the rough, powerful sections that
 * the peak model, which hears only the lows, cannot see (spike-findings §6). Per-second means; the
 * last few seconds against the median of the seconds before. It fades by itself once the new level
 * fills the comparison window.
 */
export class Surge {
  private second: number | null = null;
  private sum = { loud: 0, highs: 0 };
  private count = 0;
  private seconds: { s: number; loud: number; highs: number }[] = [];
  private lifted = false;

  update(t: number, rmsDb: number, highsDb: number, sinceKick: number): boolean {
    const s = Math.floor(t);
    if (this.second !== null && s !== this.second) this.closeSecond(this.second);
    this.second = s;
    if (rmsDb > CONFIG.idle.db) {
      this.sum.loud += rmsDb;
      this.sum.highs += highsDb;
      this.count++;
    }
    return this.lifted && sinceKick < CONFIG.surge.kickS;
  }

  private closeSecond(s: number): void {
    const { shortS, longS, loudDb, highsDb } = CONFIG.surge;
    // Silent seconds are left out, so audio starting after silence has nothing to rise above.
    if (this.count > 0) this.seconds.push({ s, loud: this.sum.loud / this.count, highs: this.sum.highs / this.count });
    this.sum = { loud: 0, highs: 0 };
    this.count = 0;
    this.seconds = this.seconds.filter((x) => x.s > s - longS);
    const recent = this.seconds.filter((x) => x.s > s - shortS);
    const before = this.seconds.filter((x) => x.s <= s - shortS);
    if (recent.length < shortS || before.length < (longS - shortS) / 2) {
      this.lifted = false;
      return;
    }
    const rise = (k: 'loud' | 'highs') => {
      const sorted = before.map((x) => x[k]).sort((a, b) => a - b);
      return recent.reduce((a, x) => a + x[k], 0) / recent.length - sorted[sorted.length >> 1];
    };
    this.lifted = rise('loud') >= loudDb || rise('highs') >= highsDb;
  }
}
