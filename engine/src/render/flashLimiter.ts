import { CONFIG } from '../config';

const C = CONFIG.flash;

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function uv(r: number, g: number, b: number): [number, number] {
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const d = X + 15 * Y + 3 * Z;
  return d > 0 ? [(4 * X) / d, (9 * Y) / d] : [0, 0];
}

/**
 * One tile's flash history. WCAG counts a change of >= 0.10 however many frames it takes, so a
 * tile remembers its brightest or darkest point since its last counted change, and the colour
 * at its last counted red change — never just the previous frame, which a smooth ramp slips past.
 */
interface Tile {
  dir: number; // +1 last counted change was a rise, -1 a fall, 0 none yet
  lo: number; // before the first change: the darkest and brightest seen
  hi: number;
  ext: number; // since the last change: the extreme in its direction
  red: boolean | null; // saturated red at the last counted red change (null before any colour)
  u: number;
  v: number;
  times: number[]; // counted changes in the last second
}

/** The luminance direction a change to l would count as, or 0 if it is no change yet. */
function lumTurn(s: Tile, l: number): number {
  const jump = C.jump - C.roundingMargin;
  if (s.dir === 0) {
    const lo = Math.min(s.lo, l);
    const hi = Math.max(s.hi, l);
    if (l - lo >= jump && lo < C.darkMax) return 1;
    if (hi - l >= jump && l < C.darkMax) return -1;
    return 0;
  }
  if (s.dir === 1) return Math.max(s.ext, l) - l >= jump && l < C.darkMax ? -1 : 0;
  return l - Math.min(s.ext, l) >= jump && Math.min(s.ext, l) < C.darkMax ? 1 : 0;
}

/** Whether moving to this colour counts as a red change; chromaticity is meaningless near black. */
function redTurn(s: Tile, r: number, g: number, b: number): boolean {
  if (s.red === null || lum(r, g, b) < C.minRedLum) return false;
  const red = r / (r + g + b) >= C.redRatio;
  const [u, v] = uv(r, g, b);
  return red !== s.red && Math.hypot(u - s.u, v - s.v) > C.redChroma;
}

function changes(s: Tile, x: ArrayLike<number>, i: number): boolean {
  const [r, g, b] = [x[i], x[i + 1], x[i + 2]];
  return lumTurn(s, lum(r, g, b)) !== 0 || redTurn(s, r, g, b);
}

/** Records the tile moving to this colour; returns whether that counted as a change. */
function commit(s: Tile, x: ArrayLike<number>, i: number, t: number): boolean {
  const [r, g, b] = [x[i], x[i + 1], x[i + 2]];
  const l = lum(r, g, b);
  const turn = lumTurn(s, l);
  const redChange = redTurn(s, r, g, b);
  if (turn !== 0) [s.dir, s.ext] = [turn, l];
  else if (s.dir === 0) [s.lo, s.hi] = [Math.min(s.lo, l), Math.max(s.hi, l)];
  else s.ext = s.dir === 1 ? Math.max(s.ext, l) : Math.min(s.ext, l);
  if (l >= C.minRedLum && (s.red === null || redChange)) {
    s.red = r / (r + g + b) >= C.redRatio;
    [s.u, s.v] = uv(r, g, b);
  }
  if (turn !== 0 || redChange) s.times.push(t);
  return turn !== 0 || redChange;
}

/**
 * Caps flashes at 3 per second per tile on what the wall shows (design §6). A flash is a pair of
 * opposing changes, as in WCAG 2.3.1, each counted however many frames it takes. Stricter than WCAG
 * in two ways: tiles are smaller than its area threshold, and brightness and red share one budget.
 */
export class FlashLimiter {
  damped = false;
  private last: Float32Array | null = null;
  private tiles: Tile[] = [];

  step(t: number, cand: Float32Array): number {
    if (!this.last) {
      this.last = cand.slice();
      this.tiles = Array.from({ length: C.tilesX * C.tilesY }, (_, k) => {
        const l = lum(cand[k * 3], cand[k * 3 + 1], cand[k * 3 + 2]);
        const s: Tile = { dir: 0, lo: l, hi: l, ext: l, red: null, u: 0, v: 0, times: [] };
        commit(s, cand, k * 3, t);
        return s;
      });
      return 1;
    }
    const last = this.last;
    for (const s of this.tiles) while (s.times.length && s.times[0] <= t - C.windowS) s.times.shift();

    // A change is one half of a flash: a tile with 2 × 3 changes this second may not change again.
    const budget = 2 * C.maxFlashes;
    const overBudget = this.tiles.some((s, k) => s.times.length >= budget && changes(s, cand, k * 3));
    let alpha = 1;
    let out = cand;
    if (overBudget) {
      for (const a of C.dampAlphas) {
        alpha = a;
        out = last.map((x, i) => x + a * (cand[i] - x));
        if (!this.tiles.some((s, k) => changes(s, out, k * 3))) break;
      }
    }
    this.tiles.forEach((s, k) => commit(s, out, k * 3, t));
    this.last = out.slice();
    this.damped = alpha < 1;
    return alpha;
  }
}
