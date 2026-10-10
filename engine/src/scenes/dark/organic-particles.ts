import { particleScene } from '../particleScene';

// Dark sections (design §5): the breakdown swarm's breathing field, with its motion (curation 2026-10-10).
export default particleScene({ id: 'dark-organic-particles' }, {
  count: 30000, shapes: ['field'],
  clock: 'seconds', hold: 30, morph: 0.3,
  spin: 1, stepTurn: false, kick: 0, breathe: 0.12, cloud: 0.2, swirl: 0.04, size: 5, bright: 1.9,
  palettes: ['ember', 'orchid', 'aurora', 'sunburst', 'emerald', 'nebula'],
  hueSpeed: 1,
});
