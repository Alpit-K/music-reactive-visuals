import { particleScene } from '../particleScene';

// Dark sections (design §5): the peak swarm's filaments and tentacled orb, with its motion (curation 2026-10-10).
export default particleScene({ id: 'dark-psychedelic-particles' }, {
  count: 40000, shapes: ['filaments', 'tentacles'],
  clock: 'bars', hold: 16, morph: 0.25,
  spin: 4, stepTurn: false, kick: 0.45, breathe: 0.1, cloud: 0, swirl: 0.06, size: 4, bright: 1.0,
  palettes: ['electric', 'lagoon', 'sunburst', 'ultraviolet', 'emerald', 'ember', 'orchid', 'aurora', 'deepsea', 'nebula'],
  hueSpeed: 8,
});
