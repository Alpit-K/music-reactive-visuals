import { particleScene } from '../particleScene';

// Breakdowns: a Galton board — balls through pegs, piling into a bell curve over 32 bars (2026-11-13).
export default particleScene({ id: 'physics-galton' }, {
  count: 24000, shapes: ['galton'], clock: 'bars', hold: 64, morph: 0, facing: true,
  spin: 0, stepTurn: false, kick: 0.1, breathe: 0, cloud: 0, swirl: 0, size: 4, bright: 1.7,
  palettes: ['sunburst', 'emerald', 'lagoon', 'orchid'], hueSpeed: 0.5,
});
