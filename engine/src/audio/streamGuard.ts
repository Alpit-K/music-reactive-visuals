import { CONFIG } from '../config';

// An open BlackHole stream can go silent with no error: opened at a rate rekordbox then changes
// (spike-findings §1), or across a PC MASTER OUT toggle at the same rate (§5). While silent, the
// stream is reopened in place every few seconds. Reopening is invisible on the wall, so a paused
// rekordbox or a B2B handover costs nothing, and recovery never depends on a one-off attempt.

export interface GuardState {
  sessionStartS: number;
  lastAudioS: number | null;
  lastReopenS: number | null;
}

export function streamAction(nowS: number, s: GuardState): 'none' | 'reopen' {
  const since = s.lastAudioS ?? s.sessionStartS;
  if (nowS - since <= CONFIG.stream.silentS) return 'none';
  return s.lastReopenS === null || nowS - s.lastReopenS >= CONFIG.stream.reopenS ? 'reopen' : 'none';
}

export function showNoAudioNote(nowS: number, s: GuardState): boolean {
  return s.lastAudioS === null && nowS - s.sessionStartS <= CONFIG.stream.noAudioNoteS;
}
