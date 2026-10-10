import { particleScene } from '../particleScene';

// Main: a tesseract in dots — edges bright, faces faint — turning through the fourth dimension a step each bar (2026-10-10).
export default particleScene({ id: 'geometric-tesseract' }, {
  count: 40000, shapes: ['tesseract'], clock: 'bars', hold: 16, morph: 0.125,
  spin: 1.5, stepTurn: false, kick: 0.18, breathe: 0.05, cloud: 0, swirl: 0, size: 4, bright: 1.4,
  palettes: ['electric', 'lagoon', 'ultraviolet', 'emerald'], hueSpeed: 2,
});
