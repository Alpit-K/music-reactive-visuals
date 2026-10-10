import { particleScene } from '../particleScene';

// Interludes only: a dome of squiggly cells under contour rings drifting up it (2026-10-10).
export default particleScene({ id: 'interlude-dome' }, {
  count: 90000, shapes: ['dome'], clock: 'seconds', hold: 45, morph: 0.4, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.05, cloud: 0, swirl: 0, size: 5, bright: 3.0,
  palettes: ['orchid', 'nebula', 'ember', 'aurora'], hueSpeed: 0.5,
});
