import { particleScene } from '../particleScene';

// Interludes only, after the Butterchurn preset mother-of-pearl: iridescent feathered flakes lining the screen around a dark void.
export default particleScene({ id: 'interlude-pearl' }, {
  count: 40000, shapes: ['pearl'], clock: 'seconds', hold: 45, morph: 0.4, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0, swirl: 0.02, size: 5, bright: 2.6,
  palettes: ['pearl'], hueSpeed: 0.5,
});
