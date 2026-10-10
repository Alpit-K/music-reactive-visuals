import { particleScene } from '../particleScene';

// Main: a Chladni plate in halftone — sand gathering on the still lines, a new mode each bar, flowing to its lines (2026-10-09).
export default particleScene({ id: 'geometric-chladni' }, {
  count: 90000, shapes: ['chladni'], clock: 'bars', hold: 16, morph: 0.125, facing: true,
  spin: 0, stepTurn: false, kick: 0.1, breathe: 0.03, cloud: 0, swirl: 0, size: 5, bright: 2.5,
  palettes: ['electric', 'sunburst', 'emerald', 'ultraviolet'], hueSpeed: 2,
});
