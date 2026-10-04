import { describe, expect, it } from 'vitest';
import { CharacterModel } from './character';

const SUB_FOR = (db: number) => 10 ** (db / 20); // with bass = 1, sub/bass in dB = db

/**
 * Drive the model with one value per second (60 frames each). `db[i]` is the sub-over-bass for
 * second i; `playing[i]` puts one kick at the start of that second. Returns the character per second.
 */
function perSecond(db: number[], playing: boolean[]): string[] {
  const m = new CharacterModel();
  const out: string[] = [];
  // A second is classified when it closes, i.e. on the next second's first frame: drive one extra
  // second and read each frame's result one second late, so out[s] is the verdict on second s.
  for (let s = 0; s <= db.length; s++) {
    const i = Math.min(s, db.length - 1);
    let c = 'main';
    for (let f = 0; f < 60; f++) {
      c = m.update(s + f / 60, playing[i] && f === 0, SUB_FOR(db[i]), 1, -20, 128).character;
      if (f === 0 && s > 0) out.push(c);
    }
  }
  return out;
}

describe('CharacterModel — peak', () => {
  it('ignores a 30 s sweep, needs 60 s of evidence, and leaves as soon as the window mean drops', () => {
    const db = [...Array(10).fill(0), ...Array(30).fill(5), ...Array(10).fill(0), ...Array(100).fill(5), ...Array(30).fill(-10)];
    const out = perSecond(db, db.map(() => true));
    // The sweep lifts the 60 s mean above 3.16 dB for ~20 s only: too short for the 60 s hold.
    // The real section crosses at second 54 and holds 60 playing seconds: peak from 113.
    expect(out.slice(0, 113).every((c) => c === 'main')).toBe(true);
    expect(out[113]).toBe('peak');
    expect(out[150]).toBe('peak');
    expect(out.slice(160).every((c) => c === 'main')).toBe(true); // mean falls below ~8 s into the drop
  });

  it('counts only kick-playing seconds towards the entry hold', () => {
    const db = Array(100).fill(5);
    const playing = [...Array(30).fill(true), ...Array(40).fill(false), ...Array(30).fill(true)];
    const out = perSecond(db, playing);
    expect(out.slice(0, 99).every((c) => c === 'main')).toBe(true);
    expect(out[99]).toBe('peak');
  });
});

describe('CharacterModel — breakdown, drop, idle', () => {
  function drive(seconds: number, kickEvery: (t: number) => boolean, rms: (t: number) => number = () => -20) {
    const m = new CharacterModel();
    const states: { t: number; breakdown: boolean; idle: boolean }[] = [];
    const beat = 60 / 128;
    let nextKick = 0;
    for (let i = 0; i < seconds * 60; i++) {
      const t = i / 60;
      let kick = false;
      if (t >= nextKick) {
        kick = kickEvery(t);
        nextKick += beat;
      }
      const r = m.update(t, kick, 1, 1, rms(t), 128);
      states.push({ t, breakdown: r.breakdown, idle: r.idle });
    }
    return states;
  }

  it('enters a breakdown after 8 bars without kicks and leaves on the first kick back', () => {
    const states = drive(50, (t) => t < 20 || t >= 40);
    // Last kick before the gap is at beat 42 (19.69 s); 8 bars at 128 BPM is 15 s → breakdown from 34.69 s.
    const at = (t: number) => states[Math.round(t * 60)];
    expect(at(34.4).breakdown).toBe(false);
    expect(at(35.0).breakdown).toBe(true);
    expect(at(40.4).breakdown).toBe(false); // first kick back on the beat grid: 40.31 s
  });

  it('ignores a kick gap shorter than 8 bars, such as a transition or a fill', () => {
    const states = drive(40, (t) => t < 20 || t >= 30);
    expect(states.some((s) => s.breakdown)).toBe(false);
  });

  it('is not a breakdown before the first kick of the session', () => {
    const states = drive(10, () => false);
    expect(states.some((s) => s.breakdown)).toBe(false);
  });

  it('goes idle after 3 s of near-silence and leaves as soon as audio returns', () => {
    const states = drive(12, () => false, (t) => (t >= 2 && t < 8 ? -100 : -20));
    const at = (t: number) => states[Math.round(t * 60)];
    expect(at(4.5).idle).toBe(false);
    expect(at(5.5).idle).toBe(true);
    expect(at(8.05).idle).toBe(false);
  });
});
