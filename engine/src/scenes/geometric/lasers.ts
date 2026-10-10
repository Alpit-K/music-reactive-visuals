import { particleScene } from '../particleScene';

// Main: a fan of dotted beams from the centre, sweeping, alternate beams taking the beat (the 2026-10-01 shader, redrawn
// 2026-10-09 with the centre origin only — beams from an edge left half the projector dark).
export default particleScene({ id: 'geometric-lasers' }, {
  count: 40000, shapes: ['lasers'], clock: 'bars', hold: 16, morph: 0.125, facing: true,
  spin: 0, stepTurn: false, kick: 0.1, breathe: 0.03, cloud: 0, swirl: 0, size: 4, bright: 3.2,
  palettes: ['electric', 'ultraviolet', 'sunburst', 'emerald'], hueSpeed: 2,
});
