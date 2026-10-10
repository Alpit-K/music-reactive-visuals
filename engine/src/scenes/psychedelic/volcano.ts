import { particleScene } from '../particleScene';

// Peak: an erupting volcano — lava running down the cone, a fountain the bass drives higher, bombs flaring on the kick, ash rising (2026-10-10).
export default particleScene({ id: 'psychedelic-volcano' }, {
  count: 80000, shapes: ['volcano'], clock: 'bars', hold: 16, morph: 0.25,
  spin: 1, stepTurn: false, kick: 0.3, breathe: 0.08, cloud: 0, swirl: 0, size: 4, bright: 1.6,
  palettes: ['fire', 'ember', 'sunburst'], hueSpeed: 4,
});
