import { particleScene } from '../particleScene';

// Dark: two-slit interference, a wave a beat, and dots landing one by one into its bands (2026-11-13).
export default particleScene({ id: 'physics-slits' }, {
  count: 90000, shapes: ['slits'], clock: 'bars', hold: 64, morph: 0, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0, cloud: 0, swirl: 0, size: 5, bright: 1.6,
  palettes: ['electric', 'deepsea', 'ultraviolet', 'steel'], hueSpeed: 0.5,
});
