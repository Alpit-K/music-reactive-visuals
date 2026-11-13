import { particleScene } from '../particleScene';

// Main and breakdowns: squares within squares, order sweeping into disorder and back over 32 bars — after plotter art the
// user shared (2026-11-13), redrawn from their description. No kick ripple: its per-dot push smears thin lines.
export default particleScene({ id: 'geometric-plotter' }, {
  count: 90000, shapes: ['plotter'], clock: 'bars', hold: 64, morph: 0, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0, cloud: 0, swirl: 0, size: 4, bright: 3.5,
  palettes: ['electric', 'aurora', 'sunburst', 'bone'], hueSpeed: 0.5,
});
