import { CONFIG } from '../config';
import type { Character } from '../scenes/types';

const EPS = 1e-9;

/**
 * Peak / main, breakdown and idle (design §5). Streaming port of sub_dominance and classify in
 * phase-0-spike:spike/analyse.py: sub-dominance is measured only while the kick plays, held through
 * breakdowns, and peak needs 60 kick-playing seconds above threshold — slow in, fast out.
 */
export class CharacterModel {
  private second: number | null = null;
  private secSum = 0;
  private secCount = 0;
  private secKick = false;
  private playingValues: number[] = [];
  private subDominance: number | null = null;
  private run = 0;
  private character: Character = 'main';
  private lastKick: number | null = null;
  private quietSince: number | null = null;

  update(t: number, kick: boolean, sub: number, bass: number, rmsDb: number, bpm: number | null) {
    const s = Math.floor(t);
    if (this.second !== null && s !== this.second) this.closeSecond();
    this.second = s;
    this.secSum += 20 * Math.log10((sub + EPS) / (bass + EPS));
    this.secCount++;
    if (kick) {
      this.secKick = true;
      this.lastKick = t;
    }

    const gapS = bpm ? (CONFIG.breakdown.bars * 4 * 60) / bpm : CONFIG.breakdown.fallbackS;
    const breakdown = this.lastKick !== null && t - this.lastKick >= gapS;

    if (rmsDb < CONFIG.idle.db) this.quietSince ??= t;
    else this.quietSince = null;
    const idle = this.quietSince !== null && t - this.quietSince >= CONFIG.idle.holdS;

    return { character: this.character, breakdown, idle, subDominanceDb: this.subDominance };
  }

  private closeSecond(): void {
    const value = this.secSum / Math.max(this.secCount, 1);
    const playing = this.secKick;
    if (playing) {
      this.playingValues.push(value);
      if (this.playingValues.length > CONFIG.peak.windowS) this.playingValues.shift();
      this.subDominance = this.playingValues.reduce((a, b) => a + b, 0) / this.playingValues.length;
    }
    const above = this.subDominance !== null && this.subDominance >= CONFIG.peak.subDominanceDb;
    if (!above) this.run = 0;
    else if (playing) this.run++;
    this.character = above && this.run >= CONFIG.peak.entryS ? 'peak' : 'main';
    this.secSum = 0;
    this.secCount = 0;
    this.secKick = false;
  }
}
