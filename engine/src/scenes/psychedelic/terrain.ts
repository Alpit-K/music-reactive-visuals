import { particleScene } from '../particleScene';

// Peak: a terrain of dot columns from the four bands, low in the middle and high at the edges; the kick rolls a wave back (2026-10-09).
export default particleScene({ id: 'psychedelic-terrain' }, {
  count: 60000, shapes: ['terrain'], clock: 'bars', hold: 16, morph: 0.25, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0, cloud: 0, swirl: 0, size: 5, bright: 5.0,
  palettes: ['sunburst', 'electric', 'fire', 'acid'], hueSpeed: 4,
});
