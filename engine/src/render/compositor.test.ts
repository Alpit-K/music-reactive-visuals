import { describe, expect, it } from 'vitest';
import { SILENT, type Scene } from '../scenes/types';
import { Compositor } from './compositor';

// Enough of WebGL2 for the compositor to build its targets and programs: every call succeeds.
const fakeGl = new Proxy({} as Record<string | symbol, unknown>, {
  get: (_t, k) => (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 0 : () => ({})),
}) as unknown as WebGL2RenderingContext;

function scene(id: string, calls: string[], failInit = false): Scene {
  return {
    id, source: 'test', licence: 'test', enabled: true,
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

describe('Compositor.show', () => {
  it('hands over to a swarm that can morph from the scene showing, disposing the old one at once', () => {
    const calls: string[] = [];
    const c = new Compositor(fakeGl, () => {});
    const from = scene('a', calls);
    const to: Scene = { ...scene('b', calls), morphFrom: (f, time, s) => { calls.push(`b.morphFrom ${f.id}@${time} for ${s}`); return true; } };
    c.show(from, 1, 0, 0);
    c.show(to, 2, 7, 10);
    expect(calls).toEqual(['a.init', 'b.init', 'b.morphFrom a@10 for 7', 'a.dispose']);
    c.render(11, SILENT);
    expect(calls.slice(-1)).toEqual(['b.render@11']); // only the new scene draws
  });

  it('crossfades when the incoming scene cannot morph from the one showing', () => {
    const calls: string[] = [];
    const c = new Compositor(fakeGl, () => {});
    c.show(scene('a', calls), 1, 0, 0);
    c.show({ ...scene('b', calls), morphFrom: () => false }, 2, 7, 10);
    c.render(11, SILENT);
    expect(calls).toEqual(['a.init', 'b.init', 'a.render@11', 'b.render@11']);
  });
});
