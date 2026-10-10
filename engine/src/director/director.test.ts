import { describe, expect, it } from 'vitest';
import { Director, type DirectorInput } from './director';
import { CONFIG } from '../config';
import type { Pool } from '../scenes/types';

const SCENES: { id: string; pools: Pool[] }[] = [
  { id: 'o1', pools: ['breakdown'] }, { id: 'o2', pools: ['breakdown'] }, { id: 'o3', pools: ['breakdown'] },
  { id: 'g1', pools: ['main'] }, { id: 'g2', pools: ['main'] }, { id: 'g3', pools: ['main'] },
  { id: 'p1', pools: ['peak'] }, { id: 'p2', pools: ['peak'] },
  { id: 'idle', pools: ['idle'] },
];
const fam = (id: string | null) => SCENES.find((s) => s.id === id)?.pools[0];
const input = (s: Partial<DirectorInput> = {}): DirectorInput => ({
  time: 0, bar: 0, barLine: false, bpm: 128, character: 'main', breakdown: false, idle: false, interlude: false, ...s,
});

describe('Director', () => {
  it('starts in the wanted family at once', () => {
    const d = new Director(SCENES, 1);
    const dec = d.update(input())!;
    expect(dec.event).toBe('start');
    expect(fam(dec.sceneId)).toBe('main');
  });

  it('waits for the next bar line on a breakdown, then crossfades 8 beats', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    expect(d.update(input({ time: 10, breakdown: true }))).toBeNull();
    const dec = d.update(input({ time: 11, bar: 1, barLine: true, breakdown: true }))!;
    expect(dec.event).toBe('breakdown');
    expect(fam(dec.sceneId)).toBe('breakdown');
    expect(dec.crossfadeBeats).toBe(8);
    expect(dec.crossfadeS).toBeCloseTo((8 * 60) / 128);
  });

  it('lands the drop on a peak scene at once, without waiting for a bar line, as a hard cut', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    d.update(input({ bar: 1, barLine: true, breakdown: true }));
    const dec = d.update(input({ time: 20, bar: 1, barLine: false }))!;
    expect(dec.event).toBe('drop');
    expect(fam(dec.sceneId)).toBe('peak');
    expect(dec.crossfadeBeats).toBe(0);
    expect(dec.crossfadeS).toBe(0);
  });

  it('switches family on character change with 4 beats', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    const dec = d.update(input({ time: CONFIG.director.minStayS, bar: 1, barLine: true, character: 'peak' }))!;
    expect(dec.event).toBe('character');
    expect(fam(dec.sceneId)).toBe('peak');
    expect(dec.crossfadeBeats).toBe(4);
  });

  it('holds a scene through a character change until the minimum stay has passed', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    const stay = CONFIG.director.minStayS;
    expect(d.update(input({ time: stay - 1, bar: 1, barLine: true, character: 'peak' }))).toBeNull();
    expect(d.update(input({ time: stay, bar: 2, barLine: true, character: 'peak' }))!.event).toBe('character');
  });

  it('lands a drop on the peak scene shown before the breakdown, with its seed, if there was one', () => {
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
      while (fam(first.sceneId) !== 'main') first = g.update(input({ bar: (first.bar + 64), barLine: true }))!;
      g.update(input({ time: 1000, bar: first.bar + 1, barLine: true, breakdown: true }));
      expect(fam(g.update(input({ time: 1020, bar: first.bar + 9 }))!.sceneId)).toBe('peak');
    }
  });

  it('does not demote a drop to main during its minimum stay', () => {
    const d = new Director(SCENES, 1);
    d.update(input({ character: 'peak' }));
    d.update(input({ time: 100, bar: 1, barLine: true, character: 'peak', breakdown: true }));
    d.update(input({ time: 130, bar: 9, character: 'peak' }));
    expect(d.update(input({ time: 132, bar: 10, barLine: true, character: 'main' }))).toBeNull();
  });

  it('drops to main when there are no peak scenes', () => {
    const d = new Director(SCENES.filter((s) => !s.pools.includes('peak')), 1);
    d.update(input());
    d.update(input({ time: 10, bar: 1, barLine: true, breakdown: true }));
    expect(fam(d.update(input({ time: 30, bar: 9 }))!.sceneId)).toBe('main');
  });

  it('morphs between two swarms over at least the morph length; other changes keep their crossfade', () => {
    const scenes = [
      { id: 'gs', pools: ['main'] as Pool[], swarm: true }, { id: 'g1', pools: ['main'] as Pool[] },
      { id: 'ps', pools: ['peak'] as Pool[], swarm: true }, { id: 'idle', pools: ['idle'] as Pool[] },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(scenes, seed);
      const start = d.update(input())!;
      const dec = d.update(input({ time: CONFIG.director.minStayS, bar: 1, barLine: true, character: 'peak' }))!;
      expect(dec.sceneId).toBe('ps');
      expect(dec.crossfadeBeats).toBe(start.sceneId === 'g1' ? CONFIG.director.crossfadeBeats.character : CONFIG.director.morphBeats);
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
    expect(fam(leave.sceneId)).toBe('main');
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
    expect(fam(dec.sceneId)).toBe('breakdown');
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
    const geometric = shown.filter((id) => fam(id) === 'main');
    expect(new Set(geometric.slice(0, 3)).size).toBe(3); // all three geometric scenes before any repeat
  });

  it('keeps main geometric and peak psychedelic', () => {
    const d = new Director(SCENES, 3);
    expect(fam(d.update(input())!.sceneId)).toBe('main');
    for (let bar = 1; bar <= 64 * 50; bar++) {
      const dec = d.update(input({ bar, barLine: true }));
      if (dec) expect(fam(dec.sceneId)).toBe('main');
    }
    const p = new Director(SCENES, 3);
    p.update(input({ character: 'peak' }));
    for (let bar = 1; bar <= 64 * 50; bar++) {
      const dec = p.update(input({ bar, barLine: true, character: 'peak' }));
      if (dec) expect(fam(dec.sceneId)).toBe('peak');
    }
  });

  it('keeps a lone scene rather than rotating to itself', () => {
    const d = new Director([{ id: 'g1', pools: ['main'] }, { id: 'idle', pools: ['idle'] }], 1);
    d.update(input());
    expect(d.update(input({ bar: 64, barLine: true }))).toBeNull();
  });

  it('falls back to idle when a family has no scenes', () => {
    const d = new Director(SCENES.filter((s) => !s.pools.includes('peak')), 1);
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
    ...SCENES.map((s) => (s.id === 'o2' || s.id === 'p2' ? { ...s, pools: [...s.pools, 'interlude' as const] } : s)),
    { id: 'p3', pools: ['interlude' as Pool] },
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
    expect(fam(dec.sceneId)).toBe('main');
    expect(dec.crossfadeS).toBe(0);
  });

  it('never shows an interlude-only scene outside an interlude', () => {
    const d = new Director(IL, 3);
    const shown = [d.update(input())!.sceneId];
    for (let bar = 1; bar <= 2000; bar++) {
      const dec = d.update(input({ time: bar * 2, bar, barLine: true, character: bar > 1000 ? 'peak' : 'main', breakdown: bar % 100 > 90 }));
      if (dec) shown.push(dec.sceneId);
    }
    expect(shown).not.toContain('p3');
    expect(shown).toContain('p2');
  });

  it('gives way to silence, and wins over a breakdown', () => {
    const { d } = entered();
    expect(d.update(input({ time: 10, interlude: true, idle: true }))!.event).toBe('silence');
    expect(POOL).toContain(d.update(input({ time: 15, interlude: true, breakdown: true }))!.sceneId);
  });

  it('is ignored when no scene is in the interlude pool', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    expect(d.update(input({ time: 5, interlude: true }))).toBeNull();
  });
});

describe('Director in dark sections', () => {
  // d1/d2 show only in dark; g3 shows in main and dark.
  const DK = [
    ...SCENES.map((s) => (s.id === 'g3' ? { ...s, pools: ['main', 'dark'] as Pool[] } : s)),
    { id: 'd1', pools: ['dark'] as Pool[] }, { id: 'd2', pools: ['dark'] as Pool[] },
  ];
  const darkPool = ['g3', 'd1', 'd2'];

  it('draws from the dark pool, at the next bar line after the minimum stay', () => {
    const d = new Director(DK, 1);
    d.update(input());
    const stay = CONFIG.director.minStayS;
    expect(d.update(input({ time: stay - 1, bar: 1, barLine: true, character: 'dark' }))).toBeNull();
    expect(d.update(input({ time: stay, bar: 1, barLine: false, character: 'dark' }))).toBeNull();
    const dec = d.update(input({ time: stay + 1, bar: 2, barLine: true, character: 'dark' }))!;
    expect(dec.event).toBe('character');
    expect(darkPool).toContain(dec.sceneId);
  });

  it('rotates within dark and never shows a dark-only scene in main', () => {
    const d = new Director(DK, 2);
    const shown: string[] = [d.update(input({ character: 'dark' }))!.sceneId];
    for (let bar = 1; bar <= 64 * 6; bar++) {
      const dec = d.update(input({ bar, barLine: true, character: 'dark' }));
      if (dec) shown.push(dec.sceneId);
    }
    expect(shown.every((id) => darkPool.includes(id))).toBe(true);
    const m = new Director(DK, 2);
    const main: string[] = [m.update(input())!.sceneId];
    for (let bar = 1; bar <= 64 * 6; bar++) {
      const dec = m.update(input({ bar, barLine: true }));
      if (dec) main.push(dec.sceneId);
    }
    expect(main).not.toContain('d1');
    expect(main).not.toContain('d2');
  });

  it('does not re-pick a scene shared by main and dark when main turns dark', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const d = new Director(DK, seed);
      const start = d.update(input())!;
      const dec = d.update(input({ time: 100, bar: 1, barLine: true, character: 'dark' }))!;
      expect(dec.sceneId).not.toBe(start.sceneId);
    }
  });

  // As in main today: the drop's peak scene holds, and dark resumes underneath at the next rotation (64 bars).
  it('lands a drop in a dark stretch on peak, then rotates back into dark', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(DK, seed);
      d.update(input({ character: 'dark' }));
      d.update(input({ time: 10, bar: 1, barLine: true, character: 'dark', breakdown: true }));
      const drop = d.update(input({ time: 30, bar: 9, character: 'dark' }))!;
      expect(drop.event).toBe('drop');
      expect(fam(drop.sceneId)).toBe('peak');
      expect(d.update(input({ time: 30 + CONFIG.director.minStayS, bar: 40, barLine: true, character: 'dark' }))).toBeNull();
      const back = d.update(input({ time: 200, bar: 9 + CONFIG.director.rotateBars, barLine: true, character: 'dark' }))!;
      expect(back.event).toBe('rotate');
      expect(darkPool).toContain(back.sceneId);
    }
  });

  it('shows main when the dark pool is empty or all of it has failed', () => {
    const d = new Director(SCENES, 1);
    expect(fam(d.update(input({ character: 'dark' }))!.sceneId)).toBe('main');
    const f = new Director(DK, 1);
    for (const id of darkPool) f.disable(id, input({ character: 'dark' }));
    const dec = f.update(input({ time: 1, character: 'dark' }))!;
    expect(fam(dec.sceneId)).toBe('main');
  });
});
