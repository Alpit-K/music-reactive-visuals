import { describe, expect, it } from 'vitest';
import { Director, type DirectorInput, type DirectorScene } from './director';
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

/** Up to the drop of a breakdown long enough to change scene: the flag from `from` s, the switch at bar `bar`. */
const longBreakdown = (d: Director, from: number, bar: number, s: Partial<DirectorInput> = {}) => {
  d.update(input({ ...s, time: from, bar, breakdown: true }));
  return d.update(input({ ...s, time: from + CONFIG.director.longBreakdownS, bar: bar + 1, barLine: true, breakdown: true }))!;
};

describe('Director', () => {
  it('starts in the wanted family at once', () => {
    const d = new Director(SCENES, 1);
    const dec = d.update(input())!;
    expect(dec.event).toBe('start');
    expect(fam(dec.sceneId)).toBe('main');
  });

  it('holds the scene through a breakdown: no decision while the flag is up under 30 s', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    for (let t = 10; t < 10 + CONFIG.director.longBreakdownS; t += 1) {
      expect(d.update(input({ time: t, bar: t, barLine: true, breakdown: true }))).toBeNull();
    }
  });

  it('switches to the breakdown pool once the flag has held 30 s, at the next bar line, 8 beats', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    const long = 10 + CONFIG.director.longBreakdownS;
    d.update(input({ time: 10, bar: 1, barLine: true, breakdown: true }));
    expect(d.update(input({ time: long, bar: 16, breakdown: true }))).toBeNull();
    const dec = d.update(input({ time: long + 1, bar: 17, barLine: true, breakdown: true }))!;
    expect(dec.event).toBe('breakdown');
    expect(fam(dec.sceneId)).toBe('breakdown');
    expect(dec.crossfadeBeats).toBe(8);
    expect(dec.crossfadeS).toBeCloseTo((8 * 60) / 128);
  });
  it('logs the drop after a short breakdown as a decision on the same scene and seed', () => {
    const d = new Director(SCENES, 1);
    const start = d.update(input())!;
    d.update(input({ time: 10, bar: 1, barLine: true, breakdown: true }));
    const dec = d.update(input({ time: 20, bar: 6 }))!;
    expect(dec.event).toBe('drop');
    expect(dec.sceneId).toBe(start.sceneId);
    expect(dec.seed).toBe(start.seed);
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

  it('after a long breakdown, the drop morphs back to the scene shown before it over 4 beats, with its seed', () => {
    for (const character of ['main', 'peak'] as const) {
      const d = new Director(SCENES, 1);
      const before = d.update(input({ character }))!;
      expect(longBreakdown(d, 10, 1, { character }).event).toBe('breakdown');
      const back = d.update(input({ time: 60, bar: 9, character }))!;
      expect(back.event).toBe('drop');
      expect(back.sceneId).toBe(before.sceneId);
      expect(back.seed).toBe(before.seed);
      expect(back.crossfadeBeats).toBe(4);
    }
  });
  it('keeps counting the returning scene\'s 64 bars from when it first showed', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    d.update(input({ time: 10, bar: 40, barLine: true, breakdown: true }));
    d.update(input({ time: 30, bar: 48 }));
    expect(d.update(input({ time: 100, bar: 64, barLine: true }))!.event).toBe('rotate');
  });

  it('picks afresh on a drop once the scene before a long breakdown has had its 64 bars', () => {
    const d = new Director(SCENES, 1);
    const before = d.update(input())!;
    longBreakdown(d, 10, 60);
    const drop = d.update(input({ time: 60, bar: 68 }))!;
    expect(drop.event).toBe('drop');
    expect(fam(drop.sceneId)).toBe('main');
    expect(drop.sceneId).not.toBe(before.sceneId);
  });
  it('does not bring back a scene from outside the music\'s pool after a long breakdown', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(SCENES, seed);
      d.update(input({ character: 'peak' }));
      longBreakdown(d, 100, 1, { character: 'peak' });
      expect(fam(d.update(input({ time: 150, bar: 9 }))!.sceneId)).toBe('main');
    }
  });
  it('does not demote a drop to main during its minimum stay', () => {
    const d = new Director(SCENES, 1);
    d.update(input({ character: 'peak' }));
    longBreakdown(d, 100, 1, { character: 'peak' });
    d.update(input({ time: 150, bar: 9, character: 'peak' }));
    expect(d.update(input({ time: 152, bar: 10, barLine: true, character: 'main' }))).toBeNull();
  });

  it('holds the current scene through a 30 s+ breakdown when the breakdown pool is empty — never idle', () => {
    const d = new Director(SCENES.filter((s) => s.pools[0] !== 'breakdown'), 1);
    const start = d.update(input())!;
    expect(longBreakdown(d, 10, 1)).toBeNull();
    expect(d.current).toBe(start.sceneId);
  });

  it('does not rotate during a breakdown, nor within 8 bars of a drop; rotates at the first bar line after', () => {
    const d = new Director(SCENES, 1);
    const start = d.update(input())!;
    const rb = CONFIG.director.rotateBars;
    expect(d.update(input({ time: 100, bar: rb, barLine: true, breakdown: true }))).toBeNull();
    expect(d.update(input({ time: 110, bar: rb + 4 }))!.event).toBe('drop');
    for (let bar = rb + 5; bar < rb + 4 + CONFIG.director.afterDropBars; bar++) {
      expect(d.update(input({ time: 110 + bar, bar, barLine: true }))).toBeNull();
    }
    const rot = d.update(input({ time: 200, bar: rb + 4 + CONFIG.director.afterDropBars, barLine: true }))!;
    expect(rot.event).toBe('rotate');
    expect(rot.sceneId).not.toBe(start.sceneId);
  });

  it('holds a pending character change through a held breakdown, and makes it after the drop', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    const t = CONFIG.director.minStayS + 10;
    expect(d.update(input({ time: t, bar: 30, barLine: true, breakdown: true, character: 'peak' }))).toBeNull();
    expect(d.update(input({ time: t + 5, bar: 32, barLine: true, breakdown: true, character: 'peak' }))).toBeNull();
    expect(d.update(input({ time: t + 8, bar: 33, character: 'peak' }))!.event).toBe('drop');
    expect(d.update(input({ time: t + 10, bar: 34, barLine: true, character: 'peak' }))!.event).toBe('character');
  });

  it('gives a character change its own colours and every other change colours near the last', () => {
    const d = new Director(SCENES, 1);
    expect(d.update(input())!.colour).toBe('near');
    expect(d.update(input({ time: CONFIG.director.minStayS, bar: 1, barLine: true, character: 'peak' }))!.colour).toBe('own');
    expect(d.update(input({ time: 200, bar: 1 + CONFIG.director.rotateBars, barLine: true, character: 'peak' }))!.colour).toBe('near');
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
      const swarmBeats = { morph: CONFIG.director.morphBeats, nothing: CONFIG.director.transition.nothingBeats, cut: 0 }[dec.transition.kind];
      expect(dec.crossfadeBeats).toBe(start.sceneId === 'g1' ? CONFIG.director.crossfadeBeats.character : swarmBeats);
    }
  });

  it('changes swarm to swarm by morph, through nothing or a cut, never the same way twice running', () => {
    const scenes = ['s1', 's2', 's3'].map((id) => ({ id, pools: ['main'] as Pool[], swarm: true }));
    const d = new Director([...scenes, { id: 'idle', pools: ['idle'] as Pool[] }], 7);
    d.update(input());
    const seen = new Set<string>();
    let last = '';
    for (let n = 1; n <= 200; n++) {
      const bar = n * CONFIG.director.rotateBars;
      const dec = d.update(input({ time: bar * 2, bar, barLine: true }))!;
      expect(dec.event).toBe('rotate');
      const way = JSON.stringify(dec.transition);
      expect(way).not.toBe(last);
      last = way;
      seen.add(dec.transition.kind);
      if (dec.transition.kind === 'cut') expect(dec.crossfadeS).toBe(0);
      if (dec.transition.kind === 'nothing') expect(dec.crossfadeBeats).toBe(CONFIG.director.transition.nothingBeats);
    }
    expect([...seen].sort()).toEqual(['cut', 'morph', 'nothing']);
  });

  it('only morphs into and out of the breakdown pool', () => {
    const scenes = [
      { id: 'g1', pools: ['main'] as Pool[], swarm: true }, { id: 'o1', pools: ['breakdown'] as Pool[], swarm: true },
      { id: 'idle', pools: ['idle'] as Pool[] },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(scenes, seed);
      d.update(input());
      const into = longBreakdown(d, 10, 5);
      expect(into.event).toBe('breakdown');
      expect(into.transition.kind).toBe('morph');
      const back = d.update(input({ time: 60, bar: 30 }))!;
      expect(back.event).toBe('drop');
      expect(back.transition.kind).toBe('morph');
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
    d.update(input({ time: 3, bpm: null, breakdown: true }));
    const dec = d.update(input({ time: 3 + CONFIG.director.longBreakdownS, bpm: null, breakdown: true }))!;
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

  it('holds through a stray kick: one kick after 8 bars without any is not a drop that ends the interlude', () => {
    const { d } = entered();
    expect(d.update(input({ time: 40, bar: 20, interlude: true, breakdown: true }))).toBeNull();
    expect(d.update(input({ time: 41, bar: 21, interlude: true }))).toBeNull();
  });

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

  it('does not start within half a minute of a drop: that smooth stretch was the breakdown', () => {
    const d = new Director(IL, 1);
    d.update(input());
    d.update(input({ time: 10, bar: 1, barLine: true, breakdown: true }));
    d.update(input({ time: 30, bar: 9 }));
    const wait = CONFIG.director.interlude.afterDropS;
    expect(d.update(input({ time: 30 + wait - 1, bar: 10, interlude: true }))).toBeNull();
    expect(d.update(input({ time: 30 + wait, bar: 11, interlude: true }))!.event).toBe('interlude');
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

  it('lands a drop after a long breakdown in a dark stretch back in dark', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(DK, seed);
      d.update(input({ character: 'dark' }));
      longBreakdown(d, 10, 1, { character: 'dark' });
      const drop = d.update(input({ time: 60, bar: 9, character: 'dark' }))!;
      expect(drop.event).toBe('drop');
      expect(darkPool).toContain(drop.sceneId);
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
