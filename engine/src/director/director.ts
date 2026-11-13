import { CONFIG } from '../config';
import { pickExcept } from '../scenes/lifeCycle';
import { MORPH_STYLES, type Character, type Pool, type Transition } from '../scenes/types';
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
  colour: 'near' | 'own'; // near: the new scene takes the palette closest to the one showing; own: its own (a character change)
  transition: Transition;  // swarm to swarm; a crossfade between other scenes ignores it
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
  private breakdownSince: number | null = null; // when the breakdown flag went up, while it is up
  private lastDrop = -Infinity;
  private dropBar = -Infinity;
  private lastShown = new Map<string, number>(); // show order, so equal timestamps cannot tie
  private shown = 0;
  private disabled = new Set<string>();
  private rand: () => number;
  private transitionRand: () => number; // its own stream, so picking a transition leaves the scene picks as they were
  private lastTransition: string | null = null;

  constructor(private scenes: DirectorScene[], seed: number) {
    this.rand = rng(seed);
    this.transitionRand = rng(seed ^ 0x7a17);
  }

  update(i: DirectorInput): Decision | null {
    if (i.breakdown) this.breakdownSince ??= i.time;
    // A drop ends a breakdown of the music's own pools; the flag falling in an interlude or silence is a stray kick.
    const dropped = !i.breakdown && this.breakdownSince !== null && this.active !== 'interlude' && this.active !== 'idle';
    if (!i.breakdown) this.breakdownSince = null;
    if (dropped) {
      this.lastDrop = i.time;
      this.dropBar = i.bar;
    }
    const want = this.wanted(i);
    if (this.current === null) return this.show(want, 'start', i, null);

    // A breakdown under longBreakdownS keeps the scene: the swarm calms with the groove and bursts on the drop
    // (2026-11-12 — 71 breakdowns in five sets each changed scene and cut back seconds later). The drop is still logged.
    if (dropped && this.active !== 'breakdown') return this.mark('drop', i);

    if (want !== this.active) {
      const event = this.eventFor(this.active!, want);
      if (event === 'drop') return this.drop(want, i);
      if (event === 'interlude') return this.showFor(want, event, i, CONFIG.director.interlude.crossfadeS);
      if (event === 'interlude-ends') return this.show(want, event, i, 0); // a hard cut, like the drop
      // A character change waits out a breakdown too: the scene holds until the drop (2026-11-12).
      if (event === 'character' && (i.breakdown || i.time - this.sceneTime < CONFIG.director.minStayS)) return null;
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

    // No rotation in a breakdown, nor just after its drop: a change seconds after the burst would undo it.
    if (i.breakdown || i.bar - this.dropBar < CONFIG.director.afterDropBars) return null;
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
    // Just after a drop, a smooth 30 s window is the breakdown, not an interlude (2026-10-10).
    const afterDrop = i.time - this.lastDrop < CONFIG.director.interlude.afterDropS;
    if (!i.idle && i.interlude && !afterDrop && this.pool('interlude').length > 0) return 'interlude';
    const long = this.breakdownSince !== null && i.time - this.breakdownSince >= CONFIG.director.longBreakdownS && this.pool('breakdown').length > 0;
    let p: Pool = i.idle ? 'idle' : long ? 'breakdown' : i.character === 'peak' ? 'peak' : i.character === 'dark' ? 'dark' : 'main';
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

  // A decision that changes nothing on screen, for the log: the drop after a breakdown that kept its scene.
  private mark(event: DirectorEvent, i: DirectorInput): Decision {
    return { time: i.time, bar: i.bar, event, sceneId: this.current!, seed: this.seed, level: i.character, crossfadeBeats: 0, crossfadeS: 0, colour: 'near', transition: { kind: 'morph', style: 0 } };
  }

  // A rotation or character change between two swarms draws from the whole menu (CONFIG.director.transition); the
  // breakdown pool and the drop only morph. Never the pick before.
  private transition(menu: boolean): Transition {
    const W = CONFIG.director.transition.weights;
    const weights: Record<string, number> = {};
    MORPH_STYLES.forEach((_, s) => (weights[`morph ${s}`] = W.morph / MORPH_STYLES.length));
    if (menu) Object.assign(weights, { nothing: W.nothing, cut: W.cut });
    const k = pickExcept(weights, this.lastTransition, this.transitionRand());
    this.lastTransition = k;
    return k === 'nothing' ? { kind: 'nothing' } : k === 'cut' ? { kind: 'cut' } : { kind: 'morph', style: Number(k.split(' ')[1]) };
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
      pick = this.oldest(options);
      seed = Math.floor(this.rand() * 2 ** 32);
    }

    const isSwarm = (id: string | null) => this.scenes.some((s) => s.id === id && s.swarm);
    let transition: Transition = { kind: 'morph', style: 0 };
    if (beats !== null && beats > 0 && isSwarm(this.current) && isSwarm(pick.id)) {
      transition = this.transition(event === 'rotate' || event === 'character');
      beats = transition.kind === 'nothing' ? CONFIG.director.transition.nothingBeats : transition.kind === 'cut' ? 0 : Math.max(beats, CONFIG.director.morphBeats);
    }
    if (f === 'breakdown' && this.active !== 'breakdown' && this.current !== null) this.beforeBreakdown = { id: this.current, seed: this.seed, bar: this.sceneBar };
    this.current = pick.id;
    this.active = f;
    this.seed = seed;
    this.sceneBar = i.bar;
    this.sceneTime = i.time;
    this.lastShown.set(pick.id, ++this.shown);
    const crossfadeS = beats === 0 ? 0 : beats !== null && i.bpm ? (beats * 60) / i.bpm : CONFIG.director.immediateCrossfadeS;
    return { time: i.time, bar: i.bar, event, sceneId: pick.id, seed, level: i.character, crossfadeBeats: beats !== null && i.bpm ? beats : null, crossfadeS, colour: event === 'character' ? 'own' : 'near', transition };
  }
}
