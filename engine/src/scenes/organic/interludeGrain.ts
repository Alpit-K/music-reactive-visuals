import { particleScene } from '../particleScene';

// Interludes only, after the Butterchurn preset jelly showoff parade: bands of flowing lines across the whole screen.
export default particleScene({ id: 'interlude-grain' }, {
  count: 50000, shapes: ['grain'], clock: 'seconds', hold: 45, morph: 0.4, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0, swirl: 0.02, size: 5, bright: 2.2,
  palettes: ['acid', 'lagoon'], hueSpeed: 0.5,
});
