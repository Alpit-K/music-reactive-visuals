import { particleScene } from '../particleScene';

// Main: digital rain without the letters — columns of dots through a box, stepping down a cell at a time to the beat (2026-10-10).
export default particleScene({ id: 'geometric-rain' }, {
  count: 60000, shapes: ['rain'], clock: 'bars', hold: 16, morph: 0.125, facing: true,
  spin: 0, stepTurn: false, kick: 0.1, breathe: 0, cloud: 0, swirl: 0, size: 5, bright: 5.0,
  palettes: ['acid', 'emerald', 'lagoon'], hueSpeed: 1,
});
