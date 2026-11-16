export type Character = 'main' | 'peak' | 'dark';
/** A moment of the set with its own scenes (design §6): `scenes/pools.ts` lists which. */
export type Pool = 'main' | 'dark' | 'peak' | 'breakdown' | 'interlude' | 'idle';

export interface Features {
  sub: number; bass: number; mids: number; highs: number; // 0..1, each against its own trailing 30 s range (visuals only)
  swell: number;          // bass smoothed over ~0.6 s: for slow, flowing motion rather than a jump on every hit
  groove: number;         // 0..1: how much the swarms dance — eases up while the kick plays, to the character's level (analysis/motion.ts)
  tension: number;        // 0..1: a build while the kick is out — grows with time out and the highs
  tensionTurn: number;    // radians turned by tension so far; only grows, so a form never spins back at the drop
  sinceDrop: number;      // seconds since the first kick after 4 bars without one (Infinity before one)
  dropSize: number;       // 0..1: how big that drop was, by how long the kick had been out (4 bars .. 16)
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

/** How one swarm gives way to the next (design §6, 2026-11-13): its dots flow across in one of MORPH_STYLES, or it
 *  goes through nothing — the old one comes apart and the new one builds itself — or it cuts on the bar line. */
export const MORPH_STYLES = ['own arcs', 'pour as one stream', 'dissolve and condense', 'grow from inside'] as const;
export type Transition = { kind: 'morph'; style: number } | { kind: 'nothing' } | { kind: 'cut' };

/** The echo under a swarm showing (design §6, 2026-11-13, an idea from raVe): each frame keeps the brighter of the new
 *  picture and the last one dimmed — trail where it was, out zoomed outward, in zoomed inward — so motion leaves a fading
 *  wake. Drawn by the compositor, never by a scene. */
export const ECHO_STYLES = ['off', 'trail', 'out', 'in'] as const;
export type Echo = (typeof ECHO_STYLES)[number];

export interface Scene {
  id: string;
  source: string;   // "original" or where it came from
  licence: string;
  enabled: boolean;
  init(gl: WebGL2RenderingContext, seed: number): void;
  render(time: number, features: Features, size: RenderSize): void;
  dispose(): void;
  /** Swarms only: take over the points of `from`, still showing, and flow them into this scene over `seconds`.
   *  `colour` near: take the palette closest to the one showing; own: keep this showing's. False if `from` is not a
   *  swarm, and the caller crossfades instead. */
  morphFrom?(from: Scene, time: number, seconds: number, colour: 'near' | 'own', transition: Transition): boolean;
  /** Curation only: one scene per form of a swarm of several forms, so each form can be judged alone. */
  forms?(): Scene[];
  /** Curation only: this showing's picks and where its life cycle stands, for the HUD. */
  describe?(): string;
}

/** Features of silence: what scenes see before audio opens. */
export const SILENT: Features = {
  sub: 0, bass: 0, mids: 0, highs: 0, swell: 0, groove: 0, tension: 0, tensionTurn: 0, sinceDrop: Infinity, dropSize: 0, kick: false, sinceKick: Infinity, bpm: null, beat: 0, beatPhase: 0,
  bar: 0, barLine: false, character: 'main', breakdown: false, idle: true, surge: false, interlude: false, busyness: null, rmsDb: -120, subDominanceDb: null, tempoBpm: null,
};
