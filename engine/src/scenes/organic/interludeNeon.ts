import { particleScene } from '../particleScene';

// Interludes only, after the Butterchurn preset _Mig_085: one glowing tube tying and untying itself, its colour sliding along it.
export default particleScene({ id: 'interlude-neon' }, {
  count: 24000, shapes: ['neon'], clock: 'seconds', hold: 45, morph: 0.4,
  spin: 0.4, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0, swirl: 0.02, size: 4, bright: 1.4,
  palettes: ['electric', 'lagoon', 'ultraviolet', 'orchid'], hueSpeed: 0.5,
});
