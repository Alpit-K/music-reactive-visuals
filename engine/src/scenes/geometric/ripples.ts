import { particleScene } from '../particleScene';

// Main: interference in halftone — waves from three wandering sources crossing, a ring sent out on each kick (2026-10-09).
export default particleScene({ id: 'geometric-ripples' }, {
  count: 90000, shapes: ['ripples'], clock: 'bars', hold: 16, morph: 0.125, facing: true,
  spin: 0, stepTurn: false, kick: 0.05, breathe: 0.03, cloud: 0, swirl: 0, size: 5, bright: 3.0,
  palettes: ['electric', 'lagoon', 'ultraviolet', 'aurora'], hueSpeed: 2,
});
