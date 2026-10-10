import { particleScene } from '../particleScene';

// The interlude swarm: sparse, very slow, mostly black.
export default particleScene({ id: 'interlude-particles' }, {
  count: 14000, shapes: ['donut', 'galaxy', 'flower', 'wave', 'butterfly', 'saturn', 'field', 'stars', 'rose', 'ribbon'],
  clock: 'seconds', hold: 45, morph: 0.4,
  spin: 0.5, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0.2, swirl: 0.03, size: 5, bright: 1.8,
  palettes: ['deepsea', 'nebula', 'aurora', 'ultraviolet', 'lagoon'],
  hueSpeed: 0.5,
});
