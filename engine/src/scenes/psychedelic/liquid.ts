import { particleScene } from '../particleScene';

// Peak: folding liquid paint as a halftone of dots, so it can morph — chosen over the solid liquid shader by the user, 2026-10-09.
export default particleScene({ id: 'psychedelic-liquid' }, {
  count: 90000, shapes: ['liquid'], clock: 'bars', hold: 16, morph: 0.25, facing: true,
  spin: 0, stepTurn: false, kick: 0.2, breathe: 0.05, cloud: 0, swirl: 0, size: 6, bright: 4.0,
  palettes: ['electric', 'ultraviolet', 'nebula', 'aurora'], hueSpeed: 4,
});
