import { particleScene } from '../particleScene';

// Interludes only: aurora — three dotted curtains, bright at the lower edge, rays fading upward, folding slowly (2026-10-10).
export default particleScene({ id: 'interlude-aurora' }, {
  count: 90000, shapes: ['aurora'], clock: 'seconds', hold: 45, morph: 0.4, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.05, cloud: 0, swirl: 0, size: 4, bright: 2.0,
  palettes: ['aurora', 'emerald', 'lagoon', 'nebula'], hueSpeed: 0.5,
});
