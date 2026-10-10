import { particleScene } from '../particleScene';

// Main: a tunnel of rings in dots, one arriving per beat, turning a step each bar (the 2026-10-01 shader, redrawn 2026-10-09).
export default particleScene({ id: 'geometric-rings' }, {
  count: 35000, shapes: ['rings'], clock: 'bars', hold: 16, morph: 0.125, facing: true,
  spin: 0, stepTurn: false, kick: 0.15, breathe: 0.04, cloud: 0, swirl: 0, size: 4, bright: 1.6,
  palettes: ['electric', 'lagoon', 'sunburst', 'ultraviolet', 'emerald', 'aurora'], hueSpeed: 2,
});
