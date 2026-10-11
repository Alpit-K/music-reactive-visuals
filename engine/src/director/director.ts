import { CONFIG } from '../config';
import type { Character, Motion, Pool } from '../scenes/types';
import { rng } from './rng';

export type DirectorEvent = 'start' | 'character' | 'breakdown' | 'drop' | 'rotate' | 'silence' | 'audio-returns' | 'scene-failed' | 'interlude' | 'interlude-ends' | 'bridge';

export interface DirectorScene {
  id: string;
  pools: readonly Pool[]; // the moments it shows at (scenes/pools.ts)
  swarm?: boolean; // a particle swarm: a change between two of them morphs rather than crossfades
  motion?: Motion; // still or moving (scenes/pools.ts): rotations keep to it, and a change of it is bridged
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
  private beforeBreakdown: { id: string; seed: number; bar: number } | null = null;
  private lastDrop = -Infinity;
  private lastShown = new Map<string, number>(); // show order, so equal timestamps cannot tie
  private shown = 0;
  private round = new Map<Pool, number>(); // show count each pool's round began at: a scene shown since has had its turn
  private bridge: { to: Motion; event: DirectorEvent } | null = null; // a bridge showing, on its way to a scene that moves `to`
  private disabled = new Set<string>();
  private rand: () => number;

  constructor(private scenes: DirectorScene[], seed: number) {
    this.rand = rng(seed);
  }

  update(i: DirectorInput): Decision | null {
    const want = this.wanted(i);
    if (this.current === null) return this.show(want, 'start', i, null);

    if (want !== this.active) {
      this.bridge = null;
      const event = this.eventFor(this.active!, want);
      if (event === 'drop') return this.drop(want, i);
      if (event === 'interlude') return this.showFor(want, event, i, CONFIG.director.interlude.crossfadeS);
      if (event === 'interlude-ends') return this.show(want, event, i, 0); // a hard cut, like the drop
      if (event === 'character' && i.time - this.sceneTime < CONFIG.director.minStayS) return null;
      const immediate = event === 'silence' || event === 'audio-returns' || i.bpm === null;
      if (immediate) return this.show(want, event, i, null);
      if (i.barLine) return this.show(want, event, i, CONFIG.director.crossfadeBeats[event as 'character' | 'breakdown'], want, undefined, event === 'character' ? this.keepMotion() : undefined);
      return null;
    }

    // No beat to count bars by: an interlude rotates on a timer.
    if (want === 'interlude') {
      if (i.time - this.sceneTime < CONFIG.director.interlude.rotateS || this.candidates(want).length === 0) return null;
      return this.showFor(want, 'rotate', i, CONFIG.director.interlude.crossfadeS);
    }

    if (this.bridge) {
      if (!i.barLine || i.bar - this.sceneBar < CONFIG.director.bridgeBars) return null;
      const { to, event } = this.bridge;
      this.bridge = null;
      return this.show(want, event, i, CONFIG.director.rotateBeats[want], want, undefined, { want: to, bridge: false });
    }

    if (i.barLine && i.bar - this.sceneBar >= CONFIG.director.rotateBars) {
      if (this.candidates(want).length === 0) return null;
      return this.show(want, 'rotate', i, CONFIG.director.rotateBeats[want], want, undefined, this.keepMotion());
    }
    return null;
  }

  disable(sceneId: string, i: DirectorInput): Decision | null {
    this.disabled.add(sceneId);
    if (sceneId !== this.current) return null;
    this.bridge = null;
    this.current = null; // so the failed scene is not "current" when excluded from candidates
    return this.show(this.wanted(i), 'scene-failed', i, null);
  }

  private wanted(i: DirectorInput): Pool {
    // Just after a drop, a smooth 30 s window is the breakdown, not an interlude (2026-10-10).
    const afterDrop = i.time - this.lastDrop < CONFIG.director.interlude.afterDropS;
    if (!i.idle && i.interlude && !afterDrop && this.pool('interlude').length > 0) return 'interlude';
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

  private motionOf(id: string | null) {
    return this.scenes.find((s) => s.id === id)?.motion;
  }

  // The director's own changes — a rotation, or a character change while the kick plays — keep to the motion of the
  // scene showing. Changes the music makes (breakdown, drop, interlude, silence) are left to the music (design §6).
  private keepMotion() {
    const m = this.motionOf(this.current);
    return m && { want: m, bridge: true };
  }

  // Every scene still has its turn once a round, least recently shown first; within a round the scenes that move as
  // wanted go first. A new round starts from the scene that has waited longest, whatever its motion — so a pool
  // shows its still run and its moving run once each a round, rather than one run twice over.
  private keepTo(f: Pool, options: DirectorScene[], want: Motion) {
    const start = this.round.get(f) ?? 1;
    const due = options.filter((s) => (this.lastShown.get(s.id) ?? 0) < start);
    if (due.length === 0) {
      this.round.set(f, this.shown + 1);
      return options;
    }
    const same = due.filter((s) => s.motion === want);
    return same.length > 0 ? same : due;
  }

  private oldest<T extends { id: string }>(options: T[]): T {
    const oldest = Math.min(...options.map((s) => this.lastShown.get(s.id) ?? -Infinity));
    const tied = options.filter((s) => (this.lastShown.get(s.id) ?? -Infinity) === oldest);
    return tied[Math.floor(this.rand() * tied.length)];
  }

  // The drop cuts back to the music's own pool — main, dark or peak. Landing every drop on peak put
  // psychedelic scenes all through a relaxed set (2026-10-10). It brings back the scene shown before the
  // breakdown, still counting its 64 bars from when it first showed, unless those bars are already up.
  private drop(f: Pool, i: DirectorInput): Decision | null {
    const prev = this.beforeBreakdown;
    this.beforeBreakdown = null;
    this.lastDrop = i.time;
    const keep = prev && this.pool(f).some((s) => s.id === prev.id) && i.bar - prev.bar < CONFIG.director.rotateBars ? prev : undefined;
    const dec = this.show(f, 'drop', i, CONFIG.director.crossfadeBeats.drop, f, keep);
    if (dec && keep) this.sceneBar = keep.bar;
    return dec;
  }

  private showFor(f: Pool, event: DirectorEvent, i: DirectorInput, seconds: number): Decision | null {
    const dec = this.show(f, event, i, null);
    if (dec) dec.crossfadeS = seconds;
    return dec;
  }

  // `motion`: keep to this motion where the pool allows; with `bridge`, a change of motion first shows a moving
  // interlude scene for `director.bridgeBars`, and the pick is made afresh when it ends.
  private show(f: Pool, event: DirectorEvent, i: DirectorInput, beats: number | null, from: Pool = f, keep?: { id: string; seed: number }, motion?: { want: Motion; bridge: boolean }): Decision | null {
    if (this.pool(from).length === 0) from = f;
    let options = this.candidates(from);
    if (options.length === 0) options = this.pool(from); // a pool of one: keep showing it after a pool change
    if (options.length === 0) return null;
    if (motion) options = this.keepTo(from, options, motion.want);
    let pick: { id: string };
    let seed: number;
    if (keep) {
      pick = keep;
      seed = keep.seed;
    } else {
      pick = this.oldest(options);
      const to = this.motionOf(pick.id);
      const bridges = this.scenes.filter((s) => s.pools.includes('interlude') && s.motion === 'moving' && !this.disabled.has(s.id) && s.id !== this.current);
      if (motion?.bridge && to && to !== motion.want && bridges.length > 0) {
        this.bridge = { to, event };
        event = 'bridge';
        pick = this.oldest(bridges);
      }
      seed = Math.floor(this.rand() * 2 ** 32);
    }

    const isSwarm = (id: string | null) => this.scenes.some((s) => s.id === id && s.swarm);
    if (beats !== null && beats > 0 && isSwarm(this.current) && isSwarm(pick.id)) beats = Math.max(beats, CONFIG.director.morphBeats);
    if (f === 'breakdown' && this.active !== 'breakdown' && this.current !== null) this.beforeBreakdown = { id: this.current, seed: this.seed, bar: this.sceneBar };
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
