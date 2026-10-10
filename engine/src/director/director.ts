import { CONFIG } from '../config';
import type { Character, Pool } from '../scenes/types';
import { rng } from './rng';

export type DirectorEvent = 'start' | 'character' | 'breakdown' | 'drop' | 'rotate' | 'silence' | 'audio-returns' | 'scene-failed' | 'interlude' | 'interlude-ends';

export interface DirectorScene {
  id: string;
  pools: readonly Pool[]; // the moments it shows at (scenes/pools.ts)
  swarm?: boolean; // a particle swarm: a change between two of them morphs rather than crossfades
}

export interface Decision {
  time: number;
  bar: number;
  event: DirectorEvent;
  sceneId: string;
  seed: number;
  level: Character;
  crossfadeBeats: number | null;
  crossfadeS: number;
}

export interface DirectorInput {
  time: number;
  bar: number;
  barLine: boolean;
  bpm: number | null;
  character: Character;
  breakdown: boolean;
  idle: boolean;
  interlude: boolean;
}

/** Chooses which scene is shown and when (design §6). Pure: same seed and inputs → same decisions. */
export class Director {
  current: string | null = null;
  private active: Pool | null = null;
  private seed = 0;
  private sceneBar = 0;
  private sceneTime = 0;
  private beforeBreakdown: { id: string; seed: number } | null = null;
  private lastShown = new Map<string, number>(); // show order, so equal timestamps cannot tie
  private shown = 0;
  private disabled = new Set<string>();
  private rand: () => number;

  constructor(private scenes: DirectorScene[], seed: number) {
    this.rand = rng(seed);
  }

  update(i: DirectorInput): Decision | null {
    const want = this.wanted(i);
    if (this.current === null) return this.show(want, 'start', i, null);

    if (want !== this.active) {
      const event = this.eventFor(this.active!, want);
      if (event === 'drop') return this.drop(want, i);
      if (event === 'interlude') return this.showFor(want, event, i, CONFIG.director.interlude.crossfadeS);
      if (event === 'interlude-ends') return this.show(want, event, i, 0); // a hard cut, like the drop
      if (event === 'character' && i.time - this.sceneTime < CONFIG.director.minStayS) return null;
      const immediate = event === 'silence' || event === 'audio-returns' || i.bpm === null;
      if (immediate) return this.show(want, event, i, null);
      if (i.barLine) return this.show(want, event, i, CONFIG.director.crossfadeBeats[event as 'character' | 'breakdown']);
      return null;
    }

    // No beat to count bars by: an interlude rotates on a timer.
    if (want === 'interlude') {
      if (i.time - this.sceneTime < CONFIG.director.interlude.rotateS || this.candidates(want).length === 0) return null;
      return this.showFor(want, 'rotate', i, CONFIG.director.interlude.crossfadeS);
    }

    if (i.barLine && i.bar - this.sceneBar >= CONFIG.director.rotateBars) {
      if (this.candidates(want).length === 0) return null;
      return this.show(want, 'rotate', i, CONFIG.director.rotateBeats[want]);
    }
    return null;
  }

  disable(sceneId: string, i: DirectorInput): Decision | null {
    this.disabled.add(sceneId);
    if (sceneId !== this.current) return null;
    this.current = null; // so the failed scene is not "current" when excluded from candidates
    return this.show(this.wanted(i), 'scene-failed', i, null);
  }

  private wanted(i: DirectorInput): Pool {
    if (!i.idle && i.interlude && this.pool('interlude').length > 0) return 'interlude';
    let p: Pool = i.idle ? 'idle' : i.breakdown ? 'breakdown' : i.character === 'peak' ? 'peak' : i.character === 'dark' ? 'dark' : 'main';
    if (p === 'dark' && this.pool('dark').length === 0) p = 'main'; // dark is main, harder: without its own scenes it shows main's
    return this.pool(p).length > 0 ? p : 'idle';
  }

  private eventFor(from: Pool, to: Pool): DirectorEvent {
    if (to === 'idle') return 'silence';
    if (from === 'idle') return 'audio-returns';
    if (to === 'interlude') return 'interlude';
    if (from === 'interlude') return 'interlude-ends';
    if (to === 'breakdown') return 'breakdown';
    if (from === 'breakdown') return 'drop';
    return 'character';
  }

  private pool(p: Pool) {
    return this.scenes.filter((s) => s.pools.includes(p) && !this.disabled.has(s.id));
  }

  private candidates(f: Pool) {
    return this.pool(f).filter((s) => s.id !== this.current);
  }

  // The drop is the moment people notice: it lands on a peak scene whatever the character, returning to
  // the one shown before the breakdown if there was one. Without peak scenes it is an ordinary pick.
  private drop(f: Pool, i: DirectorInput): Decision | null {
    const beats = CONFIG.director.crossfadeBeats.drop;
    const prev = this.beforeBreakdown;
    const keep = prev && this.pool('peak').some((s) => s.id === prev.id) ? prev : undefined;
    return this.show(f, 'drop', i, beats, 'peak', keep);
  }

  private showFor(f: Pool, event: DirectorEvent, i: DirectorInput, seconds: number): Decision | null {
    const dec = this.show(f, event, i, null);
    if (dec) dec.crossfadeS = seconds;
    return dec;
  }

  private show(f: Pool, event: DirectorEvent, i: DirectorInput, beats: number | null, from: Pool = f, keep?: { id: string; seed: number }): Decision | null {
    if (this.pool(from).length === 0) from = f;
    let options = this.candidates(from);
    if (options.length === 0) options = this.pool(from); // a pool of one: keep showing it after a pool change
    if (options.length === 0) return null;
    let pick: { id: string };
    let seed: number;
    if (keep) {
      pick = keep;
      seed = keep.seed;
    } else {
      const oldest = Math.min(...options.map((s) => this.lastShown.get(s.id) ?? -Infinity));
      const tied = options.filter((s) => (this.lastShown.get(s.id) ?? -Infinity) === oldest);
      pick = tied[Math.floor(this.rand() * tied.length)];
      seed = Math.floor(this.rand() * 2 ** 32);
    }

    const isSwarm = (id: string | null) => this.scenes.some((s) => s.id === id && s.swarm);
    if (beats !== null && beats > 0 && isSwarm(this.current) && isSwarm(pick.id)) beats = Math.max(beats, CONFIG.director.morphBeats);
    if (event === 'breakdown' && this.current !== null) this.beforeBreakdown = { id: this.current, seed: this.seed };
    this.current = pick.id;
    this.active = f;
    this.seed = seed;
    this.sceneBar = i.bar;
    this.sceneTime = i.time;
    this.lastShown.set(pick.id, ++this.shown);
    const crossfadeS = beats === 0 ? 0 : beats !== null && i.bpm ? (beats * 60) / i.bpm : CONFIG.director.immediateCrossfadeS;
    return { time: i.time, bar: i.bar, event, sceneId: pick.id, seed, level: i.character, crossfadeBeats: beats !== null && i.bpm ? beats : null, crossfadeS };
  }
}
