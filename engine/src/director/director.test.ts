import { describe, expect, it } from 'vitest';
import { Director, type DirectorInput } from './director';
import { CONFIG } from '../config';
import type { Family } from '../scenes/types';

const SCENES: { id: string; family: Family }[] = [
  { id: 'o1', family: 'organic' }, { id: 'o2', family: 'organic' }, { id: 'o3', family: 'organic' },
  { id: 'g1', family: 'geometric' }, { id: 'g2', family: 'geometric' }, { id: 'g3', family: 'geometric' },
  { id: 'p1', family: 'psychedelic' }, { id: 'p2', family: 'psychedelic' },
  { id: 'idle', family: 'idle' },
];
const fam = (id: string | null) => SCENES.find((s) => s.id === id)?.family;
const isMain = (id: string | null) => fam(id) === 'geometric' || fam(id) === 'psychedelic'; // main mixes in presets
const input = (s: Partial<DirectorInput> = {}): DirectorInput => ({
  time: 0, bar: 0, barLine: false, bpm: 128, character: 'main', breakdown: false, idle: false, surge: false, interlude: false, ...s,
});

describe('Director', () => {
  it('starts in the wanted family at once', () => {
    const d = new Director(SCENES, 1);
    const dec = d.update(input())!;
    expect(dec.event).toBe('start');
    expect(isMain(dec.sceneId)).toBe(true);
  });

  it('waits for the next bar line on a breakdown, then crossfades 8 beats', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    expect(d.update(input({ time: 10, breakdown: true }))).toBeNull();
    const dec = d.update(input({ time: 11, bar: 1, barLine: true, breakdown: true }))!;
    expect(dec.event).toBe('breakdown');
    expect(fam(dec.sceneId)).toBe('organic');
    expect(dec.crossfadeBeats).toBe(8);
    expect(dec.crossfadeS).toBeCloseTo((8 * 60) / 128);
  });

  it('returns to the previous family on the drop at once, without waiting for a bar line, as a hard cut', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    d.update(input({ bar: 1, barLine: true, breakdown: true }));
    const dec = d.update(input({ time: 20, bar: 1, barLine: false }))!;
    expect(dec.event).toBe('drop');
    expect(isMain(dec.sceneId)).toBe(true);
    expect(dec.crossfadeBeats).toBe(0);
    expect(dec.crossfadeS).toBe(0);
  });

  it('switches family on character change with 4 beats', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    const dec = d.update(input({ time: CONFIG.director.minStayS, bar: 1, barLine: true, character: 'peak' }))!;
    expect(dec.event).toBe('character');
    expect(fam(dec.sceneId)).toBe('psychedelic');
    expect(dec.crossfadeBeats).toBe(4);
  });

  it('holds a scene through a character change until the minimum stay has passed', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    const stay = CONFIG.director.minStayS;
    expect(d.update(input({ time: stay - 1, bar: 1, barLine: true, character: 'peak' }))).toBeNull();
    expect(d.update(input({ time: stay, bar: 2, barLine: true, character: 'peak' }))!.event).toBe('character');
  });

  it('lands a drop on a preset: the one shown before the breakdown, with its seed, if there was one', () => {
    const d = new Director(SCENES, 1);
    const peak = d.update(input({ character: 'peak' }))!;
    d.update(input({ time: 10, bar: 1, barLine: true, character: 'peak', breakdown: true }));
    const back = d.update(input({ time: 30, bar: 9, character: 'peak' }))!;
    expect(back.event).toBe('drop');
    expect(back.sceneId).toBe(peak.sceneId);
    expect(back.seed).toBe(peak.seed);

    for (let seed = 1; seed <= 20; seed++) {
      const g = new Director(SCENES.filter((s) => s.id !== 'p2'), seed); // geometric before the breakdown
      let first = g.update(input())!;
      while (fam(first.sceneId) !== 'geometric') first = g.update(input({ bar: (first.bar + 64), barLine: true }))!;
      g.update(input({ time: 1000, bar: first.bar + 1, barLine: true, breakdown: true }));
      expect(fam(g.update(input({ time: 1020, bar: first.bar + 9 }))!.sceneId)).toBe('psychedelic');
    }
  });

  it('does not demote a drop to main during its minimum stay', () => {
    const d = new Director(SCENES, 1);
    d.update(input({ character: 'peak' }));
    d.update(input({ time: 100, bar: 1, barLine: true, character: 'peak', breakdown: true }));
    d.update(input({ time: 130, bar: 9, character: 'peak' }));
    expect(d.update(input({ time: 132, bar: 10, barLine: true, character: 'main' }))).toBeNull();
  });

  it('drops to main when there are no presets (Butterchurn broken)', () => {
    const d = new Director(SCENES.filter((s) => s.family !== 'psychedelic'), 1);
    d.update(input());
    d.update(input({ time: 10, bar: 1, barLine: true, breakdown: true }));
    expect(fam(d.update(input({ time: 30, bar: 9 }))!.sceneId)).toBe('geometric');
  });

  it('switches a geometric scene to a preset on a surge at the next bar line, inside the minimum stay', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(SCENES, seed);
      let cur = d.update(input())!;
      while (fam(cur.sceneId) !== 'geometric') cur = d.update(input({ bar: cur.bar + 64, barLine: true }))!;
      const t = cur.time + 5;
      expect(d.update(input({ time: t, bar: cur.bar + 1, surge: true }))).toBeNull();
      const dec = d.update(input({ time: t + 1, bar: cur.bar + 2, barLine: true, surge: true }))!;
      expect(dec.event).toBe('surge');
      expect(fam(dec.sceneId)).toBe('psychedelic');
      expect(dec.crossfadeBeats).toBe(CONFIG.director.crossfadeBeats.surge);
      expect(d.update(input({ time: t + 3, bar: cur.bar + 3, barLine: true, surge: true }))).toBeNull(); // a preset already shows
    }
  });

  it('rotates to a preset while a surge lasts', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(SCENES, seed);
      d.update(input({ surge: true }));
      const dec = d.update(input({ time: 200, bar: 64, barLine: true, surge: true }))!;
      expect(fam(dec.sceneId)).toBe('psychedelic');
    }
  });

  it('enters idle immediately and leaves it immediately, without a beat clock', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    const enter = d.update(input({ time: 5, idle: true }))!;
    expect(enter.event).toBe('silence');
    expect(enter.sceneId).toBe('idle');
    expect(enter.crossfadeS).toBe(4);
    const leave = d.update(input({ time: 9 }))!;
    expect(leave.event).toBe('audio-returns');
    expect(isMain(leave.sceneId)).toBe(true);
  });

  it('cuts on the drop even without a tempo', () => {
    const d = new Director(SCENES, 1);
    d.update(input({ bpm: null }));
    d.update(input({ time: 3, bpm: null, breakdown: true }));
    expect(d.update(input({ time: 30, bpm: null }))!.crossfadeS).toBe(0);
  });

  it('changes immediately with 4 s when there is no tempo (bar lines never come)', () => {
    const d = new Director(SCENES, 1);
    d.update(input({ bpm: null }));
    const dec = d.update(input({ time: 3, bpm: null, breakdown: true }))!;
    expect(fam(dec.sceneId)).toBe('organic');
    expect(dec.crossfadeS).toBe(4);
  });

  it('rotates within the family every 64 bars, never repeating, least recently shown first', () => {
    const d = new Director(SCENES, 1);
    const shown = [d.update(input())!.sceneId];
    for (let bar = 1; bar <= 64 * 3; bar++) {
      const dec = d.update(input({ bar, barLine: true }));
      if (dec) {
        expect(dec.event).toBe('rotate');
        expect(bar % 64).toBe(0);
        expect(dec.sceneId).not.toBe(shown.at(-1));
        shown.push(dec.sceneId);
      }
    }
    const geometric = shown.filter((id) => fam(id) === 'geometric');
    expect(new Set(geometric.slice(0, 3)).size).toBe(3); // all three geometric scenes before any repeat
  });

  it('mixes presets into main at about the configured share, never geometric into peak', () => {
    const d = new Director(SCENES, 3);
    const main = [d.update(input())!.sceneId];
    for (let bar = 1; bar <= 64 * 600; bar++) {
      const dec = d.update(input({ bar, barLine: true }));
      if (dec) main.push(dec.sceneId);
    }
    const share = main.filter((id) => fam(id) === 'psychedelic').length / main.length;
    expect(share).toBeGreaterThan(CONFIG.director.mainPresetShare - 0.07);
    expect(share).toBeLessThan(CONFIG.director.mainPresetShare + 0.07);

    const p = new Director(SCENES, 3);
    p.update(input({ character: 'peak' }));
    for (let bar = 1; bar <= 64 * 50; bar++) {
      const dec = p.update(input({ bar, barLine: true, character: 'peak' }));
      if (dec) expect(fam(dec.sceneId)).toBe('psychedelic');
    }
  });

  it('keeps main geometric when there are no presets (Butterchurn broken)', () => {
    const d = new Director(SCENES.filter((s) => s.family !== 'psychedelic'), 1);
    expect(fam(d.update(input())!.sceneId)).toBe('geometric');
    for (let bar = 1; bar <= 64 * 20; bar++) {
      const dec = d.update(input({ bar, barLine: true }));
      if (dec) expect(fam(dec.sceneId)).toBe('geometric');
    }
  });

  it('keeps a lone scene rather than rotating to itself', () => {
    const d = new Director([{ id: 'g1', family: 'geometric' }, { id: 'idle', family: 'idle' }], 1);
    d.update(input());
    expect(d.update(input({ bar: 64, barLine: true }))).toBeNull();
  });

  it('falls back to idle when a family has no scenes (Butterchurn broken)', () => {
    const d = new Director(SCENES.filter((s) => s.family !== 'psychedelic'), 1);
    d.update(input());
    const dec = d.update(input({ bar: 1, barLine: true, character: 'peak' }))!;
    expect(dec.sceneId).toBe('idle');
  });

  it('replaces a failed scene at once and never picks it again', () => {
    const d = new Director(SCENES, 1);
    const first = d.update(input())!.sceneId;
    const dec = d.disable(first, input({ time: 2 }))!;
    expect(dec.event).toBe('scene-failed');
    expect(dec.sceneId).not.toBe(first);
    for (let bar = 1; bar <= 64 * 6; bar++) {
      const r = d.update(input({ bar, barLine: true }));
      if (r) expect(r.sceneId).not.toBe(first);
    }
  });

  it('is deterministic: same seed and inputs give identical decisions', () => {
    const script = (seed: number) => {
      const d = new Director(SCENES, seed);
      const out = [d.update(input())];
      for (let bar = 1; bar <= 300; bar++) {
        out.push(d.update(input({ bar, barLine: true, character: bar > 100 ? 'peak' : 'main', breakdown: bar % 50 === 0 })));
      }
      return JSON.stringify(out);
    };
    expect(script(7)).toBe(script(7));
    expect(script(7)).not.toBe(script(8));
  });
});

describe('Director in an ambient interlude', () => {
  // o2 and p2 also show in rotation; p3 shows only in interludes.
  const IL = [
    ...SCENES.map((s) => (s.id === 'o2' || s.id === 'p2' ? { ...s, interlude: 'also' as const } : s)),
    { id: 'p3', family: 'psychedelic' as const, interlude: 'only' as const },
  ];
  const POOL = ['o2', 'p2', 'p3'];
  const entered = () => {
    const d = new Director(IL, 1);
    d.update(input());
    return { d, dec: d.update(input({ time: 5, interlude: true }))! };
  };

  it('enters at once, without a bar line, with a 15 s crossfade from the interlude pool', () => {
    const { dec } = entered();
    expect(dec.event).toBe('interlude');
    expect(POOL).toContain(dec.sceneId);
    expect(dec.crossfadeBeats).toBeNull();
    expect(dec.crossfadeS).toBe(CONFIG.director.interlude.crossfadeS);
  });

  it('rotates on a timer, not on bars, never repeating', () => {
    const { d, dec } = entered();
    const rotateS = CONFIG.director.interlude.rotateS;
    expect(d.update(input({ time: 5 + rotateS - 1, bar: 500, barLine: true, interlude: true }))).toBeNull();
    const next = d.update(input({ time: 5 + rotateS, interlude: true }))!;
    expect(next.event).toBe('rotate');
    expect(POOL).toContain(next.sceneId);
    expect(next.sceneId).not.toBe(dec.sceneId);
    expect(next.crossfadeS).toBe(CONFIG.director.interlude.crossfadeS);
  });

  it('ends with a hard cut back to main when the music turns busy', () => {
    const { d } = entered();
    const dec = d.update(input({ time: 30 }))!;
    expect(dec.event).toBe('interlude-ends');
    expect(isMain(dec.sceneId)).toBe(true);
    expect(dec.crossfadeS).toBe(0);
  });

  it('never shows an interlude-only scene outside an interlude', () => {
    const d = new Director(IL, 3);
    const shown = [d.update(input())!.sceneId];
    for (let bar = 1; bar <= 2000; bar++) {
      const dec = d.update(input({ time: bar * 2, bar, barLine: true, character: bar > 1000 ? 'peak' : 'main', breakdown: bar % 100 > 90, surge: bar % 50 > 45 }));
      if (dec) shown.push(dec.sceneId);
    }
    expect(shown).not.toContain('p3');
    expect(shown).toContain('p2');
  });

  it('gives way to silence, and wins over a breakdown and a surge', () => {
    const { d } = entered();
    expect(d.update(input({ time: 10, interlude: true, idle: true }))!.event).toBe('silence');
    expect(POOL).toContain(d.update(input({ time: 15, interlude: true, breakdown: true }))!.sceneId);
    expect(d.update(input({ time: 16, bar: 1, barLine: true, interlude: true, surge: true }))).toBeNull();
  });

  it('is ignored when no scene is in the interlude pool', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    expect(d.update(input({ time: 5, interlude: true }))).toBeNull();
  });
});
