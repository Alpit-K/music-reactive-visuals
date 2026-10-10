import { particleScene } from '../particleScene';

// Interludes only: a contour map in halftone — a slowly shifting landscape drawn along its height lines (2026-10-09).
export default particleScene({ id: 'interlude-contour' }, {
  count: 90000, shapes: ['contour'], clock: 'seconds', hold: 45, morph: 0.4, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.05, cloud: 0, swirl: 0, size: 5, bright: 4.0,
  palettes: ['deepsea', 'aurora', 'nebula', 'lagoon'], hueSpeed: 0.5,
});
