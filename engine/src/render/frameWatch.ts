import { CONFIG } from '../config';

export type WatchAction = 'none' | 'downscale' | 'disable-scene';

export interface SecondStats {
  t: number;
  frames: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
  over20: number;
}

/** Design §7: frame time > 20 ms for 10 s steps the render scale down; gaps count as slow (spike 3). */
export class FrameWatch {
  scale: number;
  lastSecond: SecondStats | null = null;
  private step: number;
  private run = 0;
  private second: number | null = null;
  private deltas: number[] = [];

  /** `scale` carries a step already taken this session across a page reload. */
  constructor(scale: number = CONFIG.frame.scales[0]) {
    this.step = Math.max(0, CONFIG.frame.scales.indexOf(scale as (typeof CONFIG.frame.scales)[number]));
    this.scale = CONFIG.frame.scales[this.step];
  }

  frame(t: number, deltaMs: number): WatchAction {
    const s = Math.floor(t);
    if (this.second !== null && s !== this.second) {
      this.closeSecond(this.second);
      // A gap spanning whole seconds: those seconds drew nothing.
      if (deltaMs >= 1000) this.run += Math.floor(deltaMs / 1000);
    }
    this.second = s;
    this.deltas.push(deltaMs);

    if (this.run < CONFIG.frame.badRunS) return 'none';
    this.run = 0;
    if (this.step < CONFIG.frame.scales.length - 1) {
      this.scale = CONFIG.frame.scales[++this.step];
      return 'downscale';
    }
    return 'disable-scene';
  }

  private closeSecond(t: number): void {
    const d = [...this.deltas].sort((a, b) => a - b);
    this.deltas = [];
    const over = d.filter((x) => x > CONFIG.frame.badMs).length;
    const r = (x: number) => Math.round(x * 10) / 10;
    this.lastSecond = {
      t,
      frames: d.length,
      meanMs: r(d.reduce((a, b) => a + b, 0) / Math.max(d.length, 1)),
      p95Ms: r(d[Math.min(d.length - 1, Math.floor(d.length * 0.95))] ?? 0),
      maxMs: r(d.at(-1) ?? 0),
      over20: over,
    };
    this.run = over > d.length / 2 ? this.run + 1 : 0;
  }
}
