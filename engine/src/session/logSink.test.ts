import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogSink } from './logSink';

afterEach(() => vi.unstubAllGlobals());

describe('LogSink', () => {
  it('posts batched JSON lines to the session log', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    const s = new LogSink('20261001-200000', 'scene-log');
    s.push({ a: 1 });
    s.push({ a: 2 });
    await s.flush();
    expect(fetch).toHaveBeenCalledWith('/log?session=20261001-200000&name=scene-log', { method: 'POST', body: '{"a":1}\n{"a":2}\n' });
    expect(s.rows).toBe(2);
  });

  it('keeps unsent rows when the server is down, and sends them later in order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const s = new LogSink('x', 'frames');
    s.push({ a: 1 });
    await s.flush();
    expect(s.lastError).toMatch(/down/);
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    s.push({ a: 2 });
    await s.flush();
    expect(fetch.mock.calls[0][1].body).toBe('{"a":1}\n{"a":2}\n');
    expect(s.lastError).toBe('');
  });
});
