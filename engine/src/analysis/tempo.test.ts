import { describe, expect, it } from 'vitest';
import { OnsetFrontEnd } from './onsets';
import { drums } from './synthetic';
import { BeatTracker, type Heard } from './tempo';

const SR = 44100;
const FOUR = { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] };

/** Runs audio through the front end and tracker in audio-thread sized blocks; one row per hop. */
function hear(audio: Float32Array): (Heard & { t: number })[] {
  const front = new OnsetFrontEnd(SR);
  const tracker = new BeatTracker(front.rate);
  const out: (Heard & { t: number })[] = [];
  for (let i = 0; i + 128 <= audio.length; i += 128) front.push(audio.subarray(i, i + 128), (t) => out.push({ t, ...tracker.hop(t, front.flux, front.level) }));
  return out;
}
const at = (rows: (Heard & { t: number })[], t: number) => rows.find((r) => r.t >= t)!;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

describe('BeatTracker', () => {
  it.each([100, 118, 128, 140, 150])('reads a four-on-the-floor loop at %i BPM within 1 BPM after 15 s', (bpm) => {
    const rows = hear(drums(30, bpm, FOUR).audio);
    expect(Math.abs(at(rows, 15).bpm! - bpm)).toBeLessThan(1);
    expect(Math.abs(at(rows, 29).bpm! - bpm)).toBeLessThan(1);
  });

  it.each([75, 90, 165, 174])('reads %i BPM as itself or its octave', (bpm) => {
    const got = at(hear(drums(30, bpm, FOUR).audio), 25).bpm!;
    expect(Math.min(Math.abs(got - bpm), Math.abs(got - bpm * 2), Math.abs(got - bpm / 2))).toBeLessThan(1.5);
  });

  it('reads a two-step break (kick on 1 and the and of 3, snare on 2 and 4) at 172 as 172 or 86', () => {
    const got = at(hear(drums(30, 172, { kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }).audio), 25).bpm!;
    expect(Math.min(Math.abs(got - 172), Math.abs(got - 86))).toBeLessThan(1.5);
  });

  it('is not pulled to 3/4 of a beat by an off-beat bass note after each kick', () => {
    // The first clock's known misread (spike-findings §7): ~20% of onsets in the user's sets sit 3/4 of a beat apart.
    const rows = hear(drums(40, 128, { ...FOUR, bass: [3, 7, 11, 15] }).audio);
    for (const t of [15, 25, 39]) expect(Math.abs(at(rows, t).bpm! - 128)).toBeLessThan(1);
  });

  it('follows a change of tempo within 15 s', () => {
    const rows = hear(drums(60, (t) => (t < 30 ? 128 : 100), FOUR).audio);
    expect(Math.abs(at(rows, 29).bpm! - 128)).toBeLessThan(1);
    expect(Math.abs(at(rows, 45).bpm! - 100)).toBeLessThan(1);
  });

  it('puts its beats within 25 ms of the true beats', () => {
    const { audio, beats } = drums(40, 128, FOUR);
    const rows = hear(audio);
    const errs: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].t < 20 || Math.floor(rows[i].beat) === Math.floor(rows[i - 1].beat)) continue;
      const tBeat = rows[i].t - ((rows[i].beat - Math.floor(rows[i].beat)) * 60) / rows[i].bpm!;
      errs.push(Math.min(...beats.map((b) => Math.abs(b - tBeat))));
    }
    expect(errs.length).toBeGreaterThan(35);
    expect(median(errs)).toBeLessThan(0.025);
  });

  it('hears nearly every kick within 20 ms, and none in a breakdown that keeps its hats and snare', () => {
    const { audio, kicks } = drums(70, 128, FOUR, { kickOut: [30, 60] });
    const rows = hear(audio);
    const heard = rows.filter((r) => r.kick).map((r) => r.t);
    const real = kicks.filter((k) => k > 5);
    const delays = real.map((k) => heard.find((h) => h >= k && h < k + 0.1)).filter((h): h is number => h !== undefined).map((h, i) => h - real[i]);
    expect(delays.length / real.length).toBeGreaterThan(0.95);
    expect(median(delays)).toBeLessThan(0.02);
    expect(heard.filter((h) => h > 30.3 && h < 59.9).length).toBe(0);
    expect(at(rows, 29).kickPresence).toBeGreaterThan(0.8);
    expect(at(rows, 36).kickPresence).toBe(0);
    expect(Math.abs(at(rows, 59).bpm! - 128)).toBeLessThan(1); // the tempo holds on hats and snare alone
  });
});
