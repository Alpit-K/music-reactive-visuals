import { CONFIG } from '../config';
import type { Character } from '../scenes/types';

/**
 * What the swarms dance with (design §6 *Groove*, 2026-11-12): how much to groove, the tension of a build while the
 * kick is out, and the drop that releases it. Fed by the analysis each frame, so it replays exactly after a set.
 */
export class MotionFeatures {
  private groove = 0;
  private tension = 0;
  private tensionTurn = 0;
  private highs = 0;
  private interval = Infinity; // the gap before the latest kick: one kick alone is not the kick playing
  private prevSinceKick = Infinity;
  private lastPlaying = -Infinity; // the latest kick of the kick playing — a lone fill kick is not one
  private seenKick = false;
  private dropT: number | null = null;
  private lastT: number | null = null;

  /** `calm`: silence or an ambient interlude — no build there, however long the kick has been out. */
  update(t: number, kick: boolean, sinceKick: number, bpm: number | null, character: Character, highs: number, calm: boolean) {
    const c = CONFIG.motion;
    const dt = this.lastT === null ? 0 : t - this.lastT;
    this.lastT = t;
    const beat = 60 / (bpm ?? c.fallbackBpm);
    const bar = 4 * beat;

    // The drop: the gap counts from the kick last playing, so a lone fill kick in a breakdown cannot take the real
    // drop's burst (it gets one of its own; two bursts are at least 2 bars apart).
    if (kick) {
      this.seenKick = true;
      this.interval = this.prevSinceKick + dt;
      const sinceBurst = this.dropT === null ? Infinity : t - this.dropT;
      if (t - this.lastPlaying >= c.burstGapBars * bar && sinceBurst >= 2 * bar) this.dropT = t;
      if (this.interval < c.playingBeats * beat) this.lastPlaying = t;
    }
    this.prevSinceKick = sinceKick;

    const playing = sinceKick < c.playingBeats * beat && this.interval < c.playingBeats * beat;
    const target = playing ? c.level[character] : 0;
    this.groove += (target - this.groove) * (1 - Math.exp(-dt / c.grooveS));

    this.highs += (highs - this.highs) * (1 - Math.exp(-dt / c.highsS));
    // A build is the kick out between 1 and 32 bars, after the set has started and outside silence and interludes.
    const out = sinceKick - c.tensionStartBars * bar;
    if (this.seenKick && !calm && out > 0 && sinceKick < c.tensionMaxBars * bar) this.tension = Math.min(1, out / (c.tensionBars * bar)) * (0.6 + 0.4 * this.highs);
    else this.tension = Math.max(0, this.tension - dt / c.tensionReleaseS);
    this.tensionTurn += dt * this.tension * c.tensionTurnRate;

    return { groove: this.groove, tension: this.tension, tensionTurn: this.tensionTurn, sinceDrop: this.dropT === null ? Infinity : t - this.dropT };
  }
}
