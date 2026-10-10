import { particleScene } from '../particleScene';

// Interludes only, after the Butterchurn preset stormy sea: a choppy sea seen from the shore, horizon high.
export default particleScene({ id: 'interlude-sea' }, {
  count: 40000, shapes: ['sea'], clock: 'seconds', hold: 45, morph: 0.4, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0, swirl: 0, size: 5, bright: 2.2,
  palettes: ['storm'], hueSpeed: 0.5,
});
