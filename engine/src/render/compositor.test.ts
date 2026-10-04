import { describe, expect, it } from 'vitest';
import type { Scene } from '../scenes/types';
import { Compositor } from './compositor';

// Enough of WebGL2 for the compositor to build its targets and programs: every call succeeds.
const fakeGl = new Proxy({} as Record<string | symbol, unknown>, {
  get: (_t, k) => (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 0 : () => ({})),
}) as unknown as WebGL2RenderingContext;

function scene(id: string, calls: string[], failInit = false): Scene {
  return {
    id, family: 'geometric', source: 'test', licence: 'test', enabled: true,
    init: () => { calls.push(`${id}.init`); if (failInit) throw new Error('compile failed'); },
    render: (time) => { calls.push(`${id}.render@${time}`); },
    dispose: () => { calls.push(`${id}.dispose`); },
  };
}

describe('Compositor.warmUp', () => {
  it('runs each scene through init, one render and dispose, at times the session clock never reaches', () => {
    const calls: string[] = [];
    new Compositor(fakeGl, () => {}).warmUp([scene('a', calls), scene('b', calls)]);
    expect(calls).toEqual(['a.init', 'a.render@-1', 'a.dispose', 'b.init', 'b.render@-2', 'b.dispose']);
  });

  it('reports a scene that fails and warms the rest', () => {
    const calls: string[] = [];
    const errors: string[] = [];
    new Compositor(fakeGl, (id) => errors.push(id)).warmUp([scene('bad', calls, true), scene('ok', calls)]);
    expect(errors).toEqual(['bad']);
    expect(calls).toEqual(['bad.init', 'ok.init', 'ok.render@-2', 'ok.dispose']);
  });
});
