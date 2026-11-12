import { describe, expect, it } from 'vitest';
import { nearestPalette, PALETTES } from './palettes';

const flat = (name: keyof typeof PALETTES) => [...PALETTES[name], PALETTES[name][0]].flat(); // as a showing stores it

describe('nearestPalette', () => {
  it('picks the option closest to the colours showing, never the same palette again', () => {
    expect(nearestPalette(flat('electric'), ['electric', 'ultraviolet', 'acid'])).toBe('ultraviolet');
  });

  it('keeps the same palette when it is the only option', () => {
    expect(nearestPalette(flat('electric'), ['electric'])).toBe('electric');
  });
});
