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

  it('lands the drop in the music\'s own pool at once, without waiting for a bar line, as a hard cut', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    d.update(input({ bar: 1, barLine: true, breakdown: true }));
    const dec = d.update(input({ time: 20, bar: 1, barLine: false }))!;
    expect(dec.event).toBe('drop');
    expect(fam(dec.sceneId)).toBe('main');
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

  it('lands a drop on the scene shown before the breakdown, with its seed, if there was one', () => {
    for (const character of ['main', 'peak'] as const) {
      const d = new Director(SCENES, 1);
      const before = d.update(input({ character }))!;
      d.update(input({ time: 10, bar: 1, barLine: true, character, breakdown: true }));
      const back = d.update(input({ time: 30, bar: 9, character }))!;
      expect(back.event).toBe('drop');
      expect(back.sceneId).toBe(before.sceneId);
      expect(back.seed).toBe(before.seed);
    }
  });

  it('keeps counting the returning scene\'s 64 bars from when it first showed', () => {
    const d = new Director(SCENES, 1);
    d.update(input());
    d.update(input({ time: 10, bar: 40, barLine: true, breakdown: true }));
    d.update(input({ time: 30, bar: 48 }));
    expect(d.update(input({ time: 100, bar: 64, barLine: true }))!.event).toBe('rotate');
  });

  it('picks afresh on a drop once the scene before the breakdown has had its 64 bars', () => {
    const d = new Director(SCENES, 1);
    const before = d.update(input())!;
    d.update(input({ time: 10, bar: 60, barLine: true, breakdown: true }));
    const drop = d.update(input({ time: 30, bar: 68 }))!;
    expect(drop.event).toBe('drop');
    expect(fam(drop.sceneId)).toBe('main');
    expect(drop.sceneId).not.toBe(before.sceneId);
  });

  it('does not bring back a scene from outside the music\'s pool', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(SCENES, seed);
      d.update(input({ character: 'peak' }));
      d.update(input({ time: 100, bar: 1, barLine: true, character: 'peak', breakdown: true }));
      expect(fam(d.update(input({ time: 120, bar: 9 }))!.sceneId)).toBe('main');
    }
  });

  it('does not demote a drop to main during its minimum stay', () => {
    const d = new Director(SCENES, 1);
    d.update(input({ character: 'peak' }));
    d.update(input({ time: 100, bar: 1, barLine: true, character: 'peak', breakdown: true }));
    d.update(input({ time: 130, bar: 9, character: 'peak' }));
    expect(d.update(input({ time: 132, bar: 10, barLine: true, character: 'main' }))).toBeNull();
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

  it('lands a drop in a dark stretch back in dark', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(DK, seed);
      d.update(input({ character: 'dark' }));
      d.update(input({ time: 10, bar: 1, barLine: true, character: 'dark', breakdown: true }));
      const drop = d.update(input({ time: 30, bar: 9, character: 'dark' }))!;
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

describe('Director keeping to a motion', () => {
  // Main: three moving, two still. Peak: moving. Interlude: b1 moves (the bridge), q1 is still.
  const MV: DirectorScene[] = [
    { id: 'm1', pools: ['main'], motion: 'moving' }, { id: 'm2', pools: ['main'], motion: 'moving' }, { id: 'm3', pools: ['main'], motion: 'moving' },
    { id: 's1', pools: ['main'], motion: 'still' }, { id: 's2', pools: ['main'], motion: 'still' },
    { id: 'p1', pools: ['peak'], motion: 'moving' }, { id: 'p2', pools: ['peak'], motion: 'moving' },
    { id: 'o1', pools: ['breakdown'], motion: 'still' },
    { id: 'b1', pools: ['interlude'], motion: 'moving' }, { id: 'q1', pools: ['interlude'], motion: 'still' },
    { id: 'idle', pools: ['idle'] },
  ];
  const motion = (id: string) => MV.find((s) => s.id === id)?.motion;
  const rotations = (seed: number, bars: number) => {
    const d = new Director(MV, seed);
    const out = [d.update(input())!];
    for (let bar = 1; bar <= bars; bar++) {
      const dec = d.update(input({ time: bar * 2, bar, barLine: true }));
      if (dec) out.push({ ...dec });
    }
    return out;
  };

  it('never changes between still and moving except through a bridge, which a moving interlude scene fills', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const out = rotations(seed, 64 * 30);
      for (let k = 1; k < out.length; k++) {
        const [a, b] = [out[k - 1], out[k]];
        if (b.event === 'bridge') expect(b.sceneId).toBe('b1');
        else if (a.event !== 'bridge') expect(motion(b.sceneId), `${a.sceneId} → ${b.sceneId}`).toBe(motion(a.sceneId));
      }
      expect(out.some((d) => d.event === 'bridge')).toBe(true);
    }
  });

  it('holds the bridge for its bars, then lands on the other motion at a bar line with the event that called it', () => {
    const out = rotations(1, 64 * 30);
    const k = out.findIndex((d) => d.event === 'bridge');
    const [before, bridge, after] = out.slice(k - 1, k + 2);
    expect(after.bar - bridge.bar).toBe(CONFIG.director.bridgeBars);
    expect(after.event).toBe('rotate');
    expect(motion(after.sceneId)).not.toBe(motion(before.sceneId));
    expect(MV.find((s) => s.id === after.sceneId)!.pools).toEqual(['main']);
  });

  it('shows every scene of the pool once a round, one motion run each', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const main = rotations(seed, 64 * 30).filter((d) => d.event !== 'bridge').map((d) => d.sceneId);
      expect(new Set(main.slice(0, 5)).size).toBe(5);
      expect(new Set(main.slice(5, 10)).size).toBe(5);
      let run = 1;
      for (let k = 1; k < main.length; k++) {
        run = motion(main[k]) === motion(main[k - 1]) ? run + 1 : 1;
        expect(run, main.join(' ')).toBeLessThanOrEqual(3); // no still run twice over at a round's turn
      }
    }
  });

  it('lands a character change from a moving scene on a moving one: no black hole → romanesco', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(MV, seed);
      d.update(input({ character: 'peak' }));
      const dec = d.update(input({ time: 100, bar: 1, barLine: true }))!;
      expect(dec.event).toBe('character');
      expect(motion(dec.sceneId)).toBe('moving');
    }
  });

  it('bridges a character change when the new pool has nothing of the same motion', () => {
    const d = new Director(MV.map((s) => (s.pools.includes('main') ? { ...s, motion: 'still' as const } : s)), 1);
    d.update(input());
    const dec = d.update(input({ time: 100, bar: 1, barLine: true, character: 'peak' }))!;
    expect(dec.event).toBe('bridge');
    const after = d.update(input({ time: 120, bar: 1 + CONFIG.director.bridgeBars, barLine: true, character: 'peak' }))!;
    expect(after.event).toBe('character');
    expect(MV.find((s) => s.id === after.sceneId)!.pools).toEqual(['peak']);
  });

  it('leaves the music\'s own changes alone: a drop from a still breakdown is never bridged', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = new Director(MV, seed);
      d.update(input());
      d.update(input({ time: 10, bar: 60, barLine: true, breakdown: true }));
      const drop = d.update(input({ time: 30, bar: 68 }))!;
      expect(drop.event).toBe('drop');
      expect(MV.find((s) => s.id === drop.sceneId)!.pools).toContain('main');
    }
  });

  it('drops a bridge when the pool changes under it', () => {
    const out = rotations(1, 64 * 30);
    const k = out.findIndex((d) => d.event === 'bridge');
    const d = new Director(MV, 1);
    d.update(input());
    for (let bar = 1; bar <= out[k].bar; bar++) d.update(input({ time: bar * 2, bar, barLine: true }));
    const brk = d.update(input({ time: 1e4, bar: out[k].bar + 1, barLine: true, breakdown: true }))!;
    expect(brk.event).toBe('breakdown');
    const drop = d.update(input({ time: 1e4 + 30, bar: out[k].bar + 9 }))!;
    expect(drop.event).toBe('drop');
    expect(d.update(input({ time: 1e4 + 40, bar: out[k].bar + 9 + CONFIG.director.bridgeBars, barLine: true }))).toBeNull();
  });

  it('changes straight across when there is no moving interlude scene to bridge with', () => {
    const out = (() => {
      const d = new Director(MV.filter((s) => s.id !== 'b1'), 1);
      const o = [d.update(input())!];
      for (let bar = 1; bar <= 64 * 30; bar++) { const dec = d.update(input({ bar, barLine: true })); if (dec) o.push(dec); }
      return o;
    })();
    expect(out.some((d) => d.event === 'bridge')).toBe(false);
    expect(new Set(out.map((d) => motion(d.sceneId))).size).toBe(2);
  });
});
