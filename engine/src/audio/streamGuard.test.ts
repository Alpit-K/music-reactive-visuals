import { describe, expect, it } from 'vitest';
import { showNoAudioNote, streamAction, type GuardState } from './streamGuard';

const state = (s: Partial<GuardState> = {}): GuardState => ({ sessionStartS: 0, lastAudioS: null, lastReopenS: null, ...s });

describe('streamAction', () => {
  it('waits while audio is fresh', () => {
    expect(streamAction(100, state({ lastAudioS: 95 }))).toBe('none');
  });

  it('reopens after 10 s of silence (stream opened at the old rate, or a toggle)', () => {
    expect(streamAction(111, state({ lastAudioS: 100 }))).toBe('reopen');
  });

  it('reopens after 10 s with no audio ever heard', () => {
    expect(streamAction(11, state())).toBe('reopen');
  });

  it('keeps reopening every 5 s while silence lasts, so no single attempt can be spent', () => {
    expect(streamAction(113, state({ lastAudioS: 100, lastReopenS: 111 }))).toBe('none');
    expect(streamAction(116, state({ lastAudioS: 100, lastReopenS: 111 }))).toBe('reopen');
    expect(streamAction(5000, state({ lastAudioS: 100, lastReopenS: 4995 }))).toBe('reopen');
  });
});

describe('showNoAudioNote', () => {
  it('shows only in the first 60 s and only while nothing has been heard', () => {
    expect(showNoAudioNote(30, state())).toBe(true);
    expect(showNoAudioNote(61, state())).toBe(false);
    expect(showNoAudioNote(30, state({ lastAudioS: 20 }))).toBe(false);
  });
});
