import { particleScene } from '../particleScene';

// Breakdowns: a sunflower head in halftone — seeds on the golden angle, swelling in slow waves from the centre (2026-10-09).
export default particleScene({ id: 'organic-sunflower' }, {
  count: 4000, shapes: ['sunflower'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.1, cloud: 0, swirl: 0, size: 16, bright: 3.0,
  palettes: ['sunburst', 'ember', 'aurora', 'orchid'], hueSpeed: 1,
});
