import { particleScene } from '../particleScene';

// Main, after the Butterchurn preset True Visionary: rings flowing out of a tunnel, chords strung across them, an eye at the end.
export default particleScene({ id: 'geometric-spiro' }, {
  count: 45000, shapes: ['spiro'], clock: 'bars', hold: 16, morph: 0.125, facing: true,
  spin: 0, stepTurn: false, kick: 0.18, breathe: 0.05, cloud: 0, swirl: 0, size: 4, bright: 2.6,
  palettes: ['steel'], hueSpeed: 1,
});
