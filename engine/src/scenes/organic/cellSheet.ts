import { particleScene } from '../particleScene';

// Breakdowns: a skin of drifting cells in halftone — dots big mid-cell, fine at the walls (2026-10-09).
export default particleScene({ id: 'organic-cellsheet', enabled: false }, {
  count: 90000, shapes: ['cellsheet'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.08, cloud: 0, swirl: 0, size: 6, bright: 3.5,
  palettes: ['deepsea', 'aurora', 'lagoon', 'nebula'], hueSpeed: 1,
});
