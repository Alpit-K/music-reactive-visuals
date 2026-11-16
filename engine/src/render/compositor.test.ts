import { describe, expect, it } from 'vitest';
import { SILENT, type Scene } from '../scenes/types';
import { CONFIG } from '../config';
import { Compositor, echoStep } from './compositor';

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
    const to: Scene = { ...scene('b', calls), morphFrom: (f, time, s, colour) => { calls.push(`b.morphFrom ${f.id}@${time} for ${s}, colours ${colour}`); return true; } };
    c.show(from, 1, 0, 0);
    c.show(to, 2, 7, 10, 'own');
    expect(calls).toEqual(['a.init', 'b.init', 'b.morphFrom a@10 for 7, colours own', 'a.dispose']);
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

describe('echoStep', () => {
  it('fades by half over the half-life and zooms by the configured rate, whatever the frame rate', () => {
    for (const echo of ['trail', 'out', 'in'] as const) {
      const s = CONFIG.echo.styles[echo];
      const whole = echoStep(echo, s.halfLifeS);
      expect(whole.keep).toBeCloseTo(0.5);
      expect(whole.zoom).toBeCloseTo(Math.exp(s.zoomPerS * s.halfLifeS));
      const frame = echoStep(echo, s.halfLifeS / 30); // thirty frames make the same as one long one
      expect(frame.keep ** 30).toBeCloseTo(whole.keep);
      expect(frame.zoom ** 30).toBeCloseTo(whole.zoom);
    }
  });
});

describe('Compositor.setEcho', () => {
  it('lets an echo go over releaseBeats, not at once, and takes it back if turned on meanwhile', () => {
    const c = new Compositor(fakeGl, () => {});
    const at128 = { ...SILENT, bpm: 128 };
    const releaseS = (CONFIG.echo.releaseBeats * 60) / 128;
    let t = 0;
    const run = (seconds: number) => { for (const end = t + seconds; t < end - 1e-9; ) c.render((t += 1 / 60), at128); };
    c.setEcho('out');
    run(1);
    c.setEcho('off');
    run(releaseS * 0.9);
    expect(c.drawnEcho).toBe('out'); // still shrinking
    c.setEcho('trail');
    run(releaseS * 2);
    expect(c.drawnEcho).toBe('trail'); // back on, no release pending
    c.setEcho('off');
    run(releaseS * 1.1);
    expect(c.drawnEcho).toBe('off');
  });

  it('shrinks the wake to nothing as it is let go', () => {
    expect(echoStep('out', 1 / 60, 0.5).keep).toBeCloseTo(echoStep('out', 1 / 30).keep); // half the length: fades twice as fast
    expect(echoStep('out', 1 / 60, 0).keep).toBe(0);
  });

  it('renders with an echo on and after it goes off again', () => {
    const calls: string[] = [];
    const c = new Compositor(fakeGl, () => {});
    c.show(scene('a', calls), 1, 0, 0);
    c.setEcho('out');
    c.render(1, SILENT);
    c.render(1.016, SILENT);
    c.setEcho('off');
    c.render(1.033, SILENT);
    expect(calls).toEqual(['a.init', 'a.render@1', 'a.render@1.016', 'a.render@1.033']);
  });
});
