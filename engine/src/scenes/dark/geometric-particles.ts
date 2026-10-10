import { particleScene } from '../particleScene';

// Dark sections (design §5): the main swarm's power core on dark palettes (curation 2026-10-10).
export default particleScene({ id: 'dark-geometric-particles' }, {
  count: 30000, shapes: ['core'],
  clock: 'bars', hold: 16, morph: 0.125,
  spin: 1.5, stepTurn: true, kick: 0.18, breathe: 0.05, cloud: 0, swirl: 0.01, size: 5, bright: 1.2,
  palettes: ['deepsea', 'nebula', 'ultraviolet', 'fire'],
  hueSpeed: 2,
});
