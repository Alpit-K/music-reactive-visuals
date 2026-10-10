import { particleScene } from '../particleScene';

// Peak: the dot liquid's folds wrapped round a tunnel, pouring toward the camera (2026-10-09).
export default particleScene({ id: 'psychedelic-plasma' }, {
  count: 90000, shapes: ['plasma'], clock: 'bars', hold: 16, morph: 0.25, facing: true,
  spin: 0, stepTurn: false, kick: 0.2, breathe: 0.05, cloud: 0, swirl: 0, size: 6, bright: 4.0,
  palettes: ['electric', 'ultraviolet', 'nebula', 'fire'], hueSpeed: 4,
});
