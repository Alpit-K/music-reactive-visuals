export type Character = 'main' | 'peak' | 'dark';
/** A moment of the set with its own scenes (design §6): `scenes/pools.ts` lists which. */
export type Pool = 'main' | 'dark' | 'peak' | 'breakdown' | 'interlude' | 'idle';
/** How a scene moves on screen (`scenes/pools.ts`): the director keeps to it and bridges a change (design §6). */
export type Motion = 'still' | 'moving';

export interface Features {
  sub: number; bass: number; mids: number; highs: number; // 0..1, each against its own trailing 30 s range (visuals only)
  swell: number;          // bass smoothed over ~0.6 s: for slow, flowing motion rather than a jump on every hit
  kick: boolean;          // onset on this frame
  sinceKick: number;      // seconds since the last kick (Infinity before the first)
  bpm: number | null;
  beat: number;           // continuous beat count
  beatPhase: number;      // 0..1
  bar: number;
  barLine: boolean;
  character: Character;
  breakdown: boolean;
  idle: boolean;
  surge: boolean;         // a sudden lift in loudness while the kick plays
  interlude: boolean;     // smooth sound for half a minute: an ambient interlude
  busyness: number | null; // 30 s busyness, for the overlay (null for the first 30 s)
  rmsDb: number;
  subDominanceDb: number | null; // for the overlay
  tempoBpm: number | null; // 120 s median of played tempo while the kick plays, for the overlay
}

export interface RenderSize { width: number; height: number }

export interface Scene {
  id: string;
  source: string;   // "original" or where it came from
  licence: string;
  enabled: boolean;
  init(gl: WebGL2RenderingContext, seed: number): void;
  render(time: number, features: Features, size: RenderSize): void;
  dispose(): void;
  /** Swarms only: take over the points of `from`, still showing, and flow them into this scene over `seconds`.
   *  False if `from` is not a swarm, and the caller crossfades instead. */
  morphFrom?(from: Scene, time: number, seconds: number): boolean;
  /** Curation only: one scene per form of a swarm of several forms, so each form can be judged alone. */
  forms?(): Scene[];
}

/** Features of silence: what scenes see before audio opens. */
export const SILENT: Features = {
  sub: 0, bass: 0, mids: 0, highs: 0, swell: 0, kick: false, sinceKick: Infinity, bpm: null, beat: 0, beatPhase: 0,
  bar: 0, barLine: false, character: 'main', breakdown: false, idle: true, surge: false, interlude: false, busyness: null, rmsDb: -120, subDominanceDb: null, tempoBpm: null,
};
