import { CONFIG } from '../config';
import { rng } from '../director/rng';
import type { Features } from './types';

// The life cycle of one showing of a swarm (design §6, 2026-11-13): the user wants forms that build themselves from
// nothing and go back to nothing, not forms that arrive complete — and not the same pattern every time. So each
// moment draws from a menu, never repeating its last pick: how a breakdown takes the form apart, and what the drop
// brings back. Fed the analysis each frame, so it replays exactly after a set.

/** How a form builds itself, and comes apart: the same, reversed. Picked per showing (choices()). */
export const BUILD_STYLES = ['draw along its line', 'grow from the centre', 'gather from dust', 'fall into place'] as const;
export const BREAKDOWNS = ['dust', 'point', 'hold'] as const;
export const DROPS = ['copies', 'larger', 'same'] as const;
export type Breakdown = (typeof BREAKDOWNS)[number];
export type Drop = (typeof DROPS)[number];
/** What is left once a form has come apart: drifting dust or one glowing point (nothing: through-nothing changes only). */
export const REST = { none: 0, dust: 1, point: 2 } as const;

/** A weighted pick that is never `last`, unless nothing else is allowed. */
export function pickExcept<T extends string>(weights: Partial<Record<T, number>>, last: string | null, r: number): T {
  const allowed = (Object.keys(weights) as T[]).filter((k) => (weights[k] ?? 0) > 0);
  const keys = allowed.length > 1 ? allowed.filter((k) => k !== last) : allowed;
  const total = keys.reduce((s, k) => s + weights[k]!, 0);
  let x = r * total;
  for (const k of keys) {
    x -= weights[k]!;
    if (x < 0) return k;
  }
  return keys[keys.length - 1];
}

// The last pick at each moment, across showings, so the next breakdown or drop is never the same as the last.
export const lastPick: { breakdown: Breakdown | null; drop: Drop | null } = { breakdown: null, drop: null };

export class LifeCycle {
  life = 1;          // 0 nothing .. 1 the whole form
  style: number;     // index into BUILD_STYLES for the coming apart or building now under way
  rest: number = REST.none;
  gather = 0;        // 0..1: how far what is left has gathered through a build — more dust, a larger point (2026-11-16)
  copies = 0;        // 0: the showing's own arrangement; n: the dots shared among n forms over the screen (1: one, larger)
  breakdown: Breakdown | null = null;
  private breaking = false;
  private from = 1;  // life when the current change began
  private t0 = -Infinity;
  private backS = 0; // how long the build back under way takes
  private brokeAt = -Infinity;
  private rand: () => number;

  /** `canCopy`: no form of the swarm fills the screen, so copies have room. `canGrow`: one at least does not. */
  constructor(seed: number, private ownStyle: number, private canCopy: boolean, private canGrow: boolean) {
    this.style = ownStyle;
    this.rand = rng(Math.floor(seed * 1000) ^ 0x11fe);
  }

  update(t: number, f: Features): void {
    const L = CONFIG.life;
    const bar = 240 / (f.bpm ?? CONFIG.motion.fallbackBpm);
    // No breakdown before the first kick, in silence or in an interlude; past maxOutBars it is not one any more.
    const calm = f.idle || f.interlude || !Number.isFinite(f.sinceKick);
    const out = !calm && f.sinceKick >= L.outStartBars * bar && f.sinceKick < L.maxOutBars * bar;

    if (out && !this.breaking) {
      this.breaking = true;
      if (this.breakdown === null || t - this.brokeAt > L.repickBars * bar) {
        this.breakdown = pickExcept(L.breakdown, lastPick.breakdown, this.rand());
        lastPick.breakdown = this.breakdown;
        this.style = this.breakdown === 'dust' ? 2 : this.breakdown === 'point' ? 1 : this.ownStyle;
        this.rest = this.breakdown === 'dust' ? REST.dust : this.breakdown === 'point' ? REST.point : REST.none;
        this.gather = 0;
      }
      this.brokeAt = t;
      this.from = this.life;
      this.t0 = t;
    } else if (!out && this.breaking) {
      this.breaking = false;
      // The drop, onto a form fully come apart: it may come back changed. Only then — a change while any of it
      // shows would make dots jump.
      const drop = f.sinceDrop < 0.5;
      if (this.life < 0.02 && drop) this.dropped();
      // On the drop the form is whole within the burst's own rise, so the burst has a form to throw (2026-11-16: over a
      // bar, the burst was spent on a near-empty screen and the drop read as late).
      this.backS = drop ? L.dropBackS : L.backBars * bar;
      this.from = this.life;
      this.t0 = t;
    }
    // As the form comes apart, what is left gathers through the build, so a long build-up is never a bare screen.
    const gone = L.outStartBars * bar;
    const g = this.breaking ? Math.min(1, Math.max(0, (f.sinceKick - gone) / (L.gatherBars * bar))) : 0;
    this.gather = this.breaking ? g * g * (3 - 2 * g) : this.gather;

    const k = Math.min(1, Math.max(0, (t - this.t0) / (this.breaking ? L.outBars * bar : this.backS)));
    if (this.breaking) this.life = this.breakdown === 'hold' ? this.from + (1 - this.from) * k : this.from * (1 - k);
    else this.life = this.from + (1 - this.from) * k;
  }

  private dropped(): void {
    const L = CONFIG.life;
    const w = { ...L.drop, copies: this.canCopy ? L.drop.copies : 0, larger: this.canGrow ? L.drop.larger : 0 };
    const d = pickExcept(w, lastPick.drop, this.rand());
    lastPick.drop = d;
    if (d === 'copies') {
      const options = L.copies.filter((n) => n !== this.copies);
      this.copies = options[Math.floor(this.rand() * options.length)];
    } else if (d === 'larger') this.copies = 1;
  }
}
