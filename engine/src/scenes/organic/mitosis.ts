import { particleScene } from '../particleScene';

// Breakdowns: a cell dividing — chromosomes line up and pull apart, the membrane pinches — then a zoom into one daughter, who divides in turn (2026-10-10).
export default particleScene({ id: 'organic-mitosis' }, {
  count: 60000, shapes: ['mitosis'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0, swirl: 0, size: 4, bright: 2.2,
  palettes: ['deepsea', 'nebula', 'aurora', 'lagoon'], hueSpeed: 1,
});
