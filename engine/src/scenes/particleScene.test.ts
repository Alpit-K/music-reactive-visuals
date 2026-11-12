import { describe, expect, it } from 'vitest';
import { ARRANGEMENTS, choices, FILLS_GLSL, FILLS_SCREEN, layout, MORPH_STYLES, PATHS, SHAPES } from './particleScene';
import { loadShaderScenes } from './registry';

describe('swarm forms for curation', () => {
  const byId = new Map(loadShaderScenes().map((s) => [s.id, s]));

  it('gives one scene per form for a swarm of several forms', () => {
    const forms = byId.get('geometric-particles')!.forms!();
    expect(forms.length).toBeGreaterThan(1); // the count follows curation
    expect(forms[0].id).toBe('geometric-particles › sphere');
    expect(forms.every((f) => f.id.startsWith('geometric-particles › '))).toBe(true);
    expect(forms.every((f) => f.forms === undefined)).toBe(true);
  });

  it('has none for a scene of one form', () => {
    expect(byId.get('geometric-rings')!.forms).toBeUndefined();
  });
});

describe('forms that fill the screen', () => {
  it('names only real shapes, and the shader fills() lists exactly their indices', () => {
    expect(FILLS_SCREEN.every((n) => SHAPES.includes(n))).toBe(true);
    const listed = [...FILLS_GLSL.matchAll(/s == (\d+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    expect(listed).toEqual(FILLS_SCREEN.map((n) => SHAPES.indexOf(n)).sort((a, b) => a - b));
  });
});

describe('a swarm\u2019s dots by role: backdrop, lead form, copies', () => {
  it('orbit: a 30 000-dot swarm gets a 5 000-dot backdrop and three copies of 4 500', () => {
    expect(layout(30000, 'orbit', false)).toEqual({ backdrop: 5000, lead: 30000, satellites: 3, perSatellite: 4500, total: 48500 });
  });

  it('keeps at least 600 dots in each orbiting copy of a sparse swarm, so it still reads', () => {
    expect(layout(4000, 'orbit', false).perSatellite).toBeGreaterThanOrEqual(600);
  });

  it('troupe: two side copies of half the lead\u2019s dots', () => {
    expect(layout(30000, 'troupe', false)).toMatchObject({ satellites: 2, perSatellite: 15000, total: 5000 + 30000 + 30000 });
  });

  it('mirror: one copy with every dot of the lead, so it is a true reflection', () => {
    expect(layout(30000, 'mirror', false)).toMatchObject({ satellites: 1, perSatellite: 30000, total: 65000 });
  });

  it('draws no backdrop or copies for a swarm whose forms all fill the screen', () => {
    expect(layout(90000, 'mirror', true)).toEqual({ backdrop: 0, lead: 90000, satellites: 0, perSatellite: 0, total: 90000 });
  });
});

describe('choices per showing', () => {
  it('are fixed by the seed, so a set replays as it played', () => {
    expect(choices(123.5)).toEqual(choices(123.5));
  });

  it('reach every arrangement, dance path and morph style across seeds', () => {
    const seen = { arrangement: new Set(), path: new Set(), morph: new Set() };
    for (let s = 0; s < 1000; s++) {
      const c = choices(s + 0.5);
      seen.arrangement.add(c.arrangement);
      seen.path.add(c.path);
      seen.morph.add(c.morph);
    }
    expect(seen.arrangement.size).toBe(ARRANGEMENTS.length);
    expect(seen.path.size).toBe(PATHS.length);
    expect(seen.morph.size).toBe(MORPH_STYLES.length);
  });
});
