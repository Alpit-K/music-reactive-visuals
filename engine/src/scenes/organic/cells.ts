import { particleScene } from '../particleScene';

// Breakdowns: drifting cells in dots — wall, two inner membranes and a nucleus each (the 2026-10-01 shader, redrawn 2026-10-09).
export default particleScene({ id: 'organic-cells' }, {
  count: 45000, shapes: ['cells'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.08, cloud: 0, swirl: 0.01, size: 5, bright: 3.5,
  palettes: ['deepsea', 'aurora', 'lagoon', 'nebula'], hueSpeed: 1,
});
