import { describe, expect, it } from 'vitest';
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
