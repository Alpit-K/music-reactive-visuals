export type Family = 'organic' | 'geometric' | 'psychedelic' | 'idle';
export type Character = 'main' | 'peak';

export interface Features {
  sub: number; bass: number; mids: number; highs: number; // 0..1, each against its own trailing 30 s range (visuals only)
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
}

export interface RenderSize { width: number; height: number }

export interface Scene {
  id: string;
  family: Family;
  source: string;   // "original" or where it came from
  licence: string;
  enabled: boolean;
  init(gl: WebGL2RenderingContext, seed: number): void;
  render(time: number, features: Features, size: RenderSize): void;
  dispose(): void;
}

/** Features of silence: what scenes see before audio opens. */
export const SILENT: Features = {
  sub: 0, bass: 0, mids: 0, highs: 0, kick: false, sinceKick: Infinity, bpm: null, beat: 0, beatPhase: 0,
  bar: 0, barLine: false, character: 'main', breakdown: false, idle: true, surge: false, interlude: false, busyness: null, rmsDb: -120, subDominanceDb: null,
};
