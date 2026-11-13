import { particleScene } from '../particleScene';

// Main: a pendulum wave — 15 pendulums falling in and out of step over 32 bars (2026-11-13).
export default particleScene({ id: 'physics-pendulums' }, {
  count: 40000, shapes: ['pendulums'], clock: 'bars', hold: 64, morph: 0, facing: true,
  spin: 0, stepTurn: false, kick: 0.15, breathe: 0, cloud: 0, swirl: 0, size: 4, bright: 1.8,
  palettes: ['electric', 'aurora', 'sunburst', 'orchid'], hueSpeed: 1,
});
