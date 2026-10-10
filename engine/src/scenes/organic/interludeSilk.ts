import { particleScene } from '../particleScene';

// Interludes only, after the Butterchurn preset Aderrasi + Geiss - Airhandler: broad ribbons that furl and fold, in sand and bronze.
export default particleScene({ id: 'interlude-silk' }, {
  count: 40000, shapes: ['silk'], clock: 'seconds', hold: 45, morph: 0.4,
  spin: 0.4, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0, swirl: 0.04, size: 4, bright: 1.6,
  palettes: ['sand'], hueSpeed: 0.5,
});
