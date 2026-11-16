import { CONFIG } from '../config';
import type { Character } from '../scenes/types';

const EPS = 1e-9;
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/**
 * Peak / dark / main, breakdown and idle (design §5). Streaming port of sub_dominance and classify in
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
  private secBpm: number | null = null;
  private tempoValues: number[] = [];
  private tempo: number | null = null;
  private openingValues: number[] = [];
  private enterBpm: number = CONFIG.dark.enterBpm;
  private turn: number | null = null; // the fastest tempo held while dark; once dark has ended, the slowest since
  private dark = false;
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
    if (bpm !== null) this.secBpm = bpm;

    const gapS = bpm ? (CONFIG.breakdown.bars * 4 * 60) / bpm : CONFIG.breakdown.fallbackS;
    const breakdown = this.lastKick !== null && t - this.lastKick >= gapS;

    if (rmsDb < CONFIG.idle.db) this.quietSince ??= t;
    else this.quietSince = null;
    const idle = this.quietSince !== null && t - this.quietSince >= CONFIG.idle.holdS;

    return { character: this.character, breakdown, idle, subDominanceDb: this.subDominance, tempoBpm: this.tempo };
  }

  // A step up in tempo starts dark and the same step down ends it, each measured from where the tempo last turned.
  private stepDark(tempo: number): void {
    const D = CONFIG.dark;
    if (this.dark) {
      this.turn = Math.max(this.turn!, tempo);
      if (tempo > this.turn - D.stepBpm) return;
      this.dark = false;
      this.turn = tempo;
    } else {
      if (this.turn !== null) this.turn = Math.min(this.turn, tempo);
      const enter = this.turn === null ? this.enterBpm : Math.max(D.floorBpm, this.turn + D.stepBpm);
      if (tempo < enter) return;
      this.dark = true;
      this.turn = tempo;
    }
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
    // Dark (design §5): median played tempo of the last kick-playing seconds, held through breakdowns and tempo-less stretches.
    if (playing && this.secBpm !== null) {
      this.tempoValues.push(this.secBpm);
      if (this.tempoValues.length > CONFIG.dark.windowS) this.tempoValues.shift();
      if (this.tempoValues.length >= CONFIG.dark.minS) this.tempo = median(this.tempoValues);
      // Faster than the set began counts as dark too, once its opening tempo is known — never later than at enterBpm.
      const D = CONFIG.dark;
      if (this.openingValues.length < D.openingS) {
        this.openingValues.push(this.secBpm);
        if (this.openingValues.length === D.openingS) this.enterBpm = Math.min(D.enterBpm, Math.max(D.floorBpm, median(this.openingValues) + D.stepBpm));
      }
    }
    if (this.tempo !== null) this.stepDark(this.tempo);
    const peak = above && this.run >= CONFIG.peak.entryS;
    this.character = peak ? 'peak' : this.dark ? 'dark' : 'main';
    this.secBpm = null;
    this.secSum = 0;
    this.secCount = 0;
    this.secKick = false;
  }
}
