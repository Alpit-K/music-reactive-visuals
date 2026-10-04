import { describe, expect, it } from 'vitest';
import { pickBlackHole } from './capture';

const dev = (label: string, kind: MediaDeviceKind = 'audioinput') => ({ kind, label, deviceId: `id-${label}` });

describe('pickBlackHole', () => {
  it('picks the BlackHole input by label', () => {
    expect(pickBlackHole([dev('MacBook Air Microphone'), dev('BlackHole 2ch')])).toBe('id-BlackHole 2ch');
  });

  it('ignores a BlackHole output', () => {
    expect(() => pickBlackHole([dev('MacBook Air Microphone'), dev('BlackHole 2ch', 'audiooutput')])).toThrow(/No BlackHole input/);
  });

  it('refuses to guess when labels are hidden (permission not granted)', () => {
    expect(() => pickBlackHole([dev(''), dev('')])).toThrow(/labels are empty/);
  });
});
