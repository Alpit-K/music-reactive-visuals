import { particleScene } from '../particleScene';

// Peak, after the Butterchurn preset Red Liquid Fire: a dome of embers bursting up and out, crimson to violet.
export default particleScene({ id: 'psychedelic-fire' }, {
  count: 40000, shapes: ['bloom'], clock: 'bars', hold: 16, morph: 0.25,
  spin: 1, stepTurn: false, kick: 0.5, breathe: 0.1, cloud: 0, swirl: 0.05, size: 4, bright: 2.0,
  palettes: ['fire', 'ember'], hueSpeed: 4,
});
