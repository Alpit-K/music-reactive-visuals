import { particleScene } from '../particleScene';

// Breakdowns: four jellyfish rising, bells pulsing, tentacles taking the pulse late (2026-10-10).
export default particleScene({ id: 'organic-jellyfish' }, {
  count: 80000, shapes: ['jellyfish'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.08, cloud: 0, swirl: 0, size: 4, bright: 1.8,
  palettes: ['deepsea', 'electric', 'nebula', 'ultraviolet'], hueSpeed: 1,
});
