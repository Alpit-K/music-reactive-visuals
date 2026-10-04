import { describe, expect, it } from 'vitest';
import { loadCarry, saveCarry } from './carry';

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('carry across a reload', () => {
  it('starts fresh: full scale, nothing disabled', () => {
    expect(loadCarry(store())).toEqual({ scale: 1, disabled: [] });
  });

  it('keeps the render scale and disabled scenes', () => {
    const s = store();
    saveCarry(s, { scale: 0.83, disabled: ['geometric-rings'] });
    expect(loadCarry(s)).toEqual({ scale: 0.83, disabled: ['geometric-rings'] });
  });
});
