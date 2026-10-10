import { CONFIG } from '../config';
import type { Features } from '../scenes/types';
import { bandEnergies, rmsDb } from './bands';
import { CharacterModel } from './character';
import { Interlude } from './interlude';
import { BeatClock } from './clock';
import { KickDetector } from './kicks';
import { Surge } from './surge';
import { TimeWindow } from './timeWindow';

const db = (x: number) => 20 * Math.log10(x + 1e-9);

/** One call per animation frame: raw spectrum in, Features out. */
export class Analysis {
  bands: number[] = [0, 0, 0, 0, 0, 0];
  private kicks = new KickDetector();
  private clock = new BeatClock();
  private character = new CharacterModel();
  private surge = new Surge();
  private interlude = new Interlude();
  private norm = [0, 1, 2, 3].map(() => new TimeWindow(CONFIG.normaliseS));
  private lastKick = -Infinity;
  private swell = 0;
  private lastT: number | null = null;

  frame(t: number, freqDb: Float32Array, wave: Float32Array, sampleRate: number): Features {
    const b = bandEnergies(freqDb, sampleRate);
    this.bands = b;
    const rms = rmsDb(wave);
    const kick = this.kicks.push(t, b[0]);
    if (kick) this.lastKick = t;
    const clock = this.clock.update(t, kick);
    const ch = this.character.update(t, kick, b[0], b[1], rms, clock.bpm);
    const il = this.interlude.update(t, b, rms);

    // Visual bands: each against its own trailing range, so loud and quiet masters look alike.
    const raw = [db(b[0]), db(b[1]), db((b[2] + b[3]) / 2), db((b[4] + b[5]) / 2)];
    const [sub, bass, mids, highs] = raw.map((x, i) => {
      const w = this.norm[i];
      w.push(t, x);
      w.prune(t);
      const lo = w.min();
      const range = w.max() - lo;
      return range > 1e-6 ? Math.min(1, Math.max(0, (x - lo) / range)) : 0;
    });
    const dt = this.lastT === null ? 0 : t - this.lastT;
    this.lastT = t;
    this.swell += (bass - this.swell) * (1 - Math.exp(-dt / CONFIG.swellS));

    return {
      sub, bass, swell: this.swell, mids, highs,
      kick,
      sinceKick: t - this.lastKick,
      bpm: clock.bpm,
      beat: clock.beat,
      beatPhase: clock.beatPhase,
      bar: clock.bar,
      barLine: clock.barLine,
      character: ch.character,
      breakdown: ch.breakdown,
      idle: ch.idle,
      surge: this.surge.update(t, rms, raw[3], t - this.lastKick),
      interlude: il.interlude,
      busyness: il.busyness,
      rmsDb: rms,
      subDominanceDb: ch.subDominanceDb,
      tempoBpm: ch.tempoBpm,
    };
  }
}
