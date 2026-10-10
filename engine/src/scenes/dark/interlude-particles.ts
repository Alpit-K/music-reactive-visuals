import { particleScene } from '../particleScene';

// Dark sections (design §5): the interlude swarm's rose nebula, as slow and sparse as in interludes (curation 2026-10-10).
export default particleScene({ id: 'dark-interlude-particles' }, {
  count: 14000, shapes: ['rose'],
  clock: 'seconds', hold: 45, morph: 0.4,
  spin: 0.5, stepTurn: false, kick: 0, breathe: 0.06, cloud: 0.2, swirl: 0.03, size: 5, bright: 1.8,
  palettes: ['deepsea', 'nebula', 'aurora', 'ultraviolet', 'lagoon'],
  hueSpeed: 0.5,
});
