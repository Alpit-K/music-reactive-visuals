import { particleScene } from '../particleScene';

// Dark and peaks: a black hole by general relativity — shadow, photon ring, lensed disc, infall that never crosses (2026-11-13).
export default particleScene({ id: 'physics-horizon' }, {
  count: 90000, shapes: ['horizon'], clock: 'bars', hold: 64, morph: 0, facing: true,
  spin: 0, stepTurn: false, kick: 0.1, breathe: 0.05, cloud: 0, swirl: 0, size: 4, bright: 1.6,
  palettes: ['ember', 'sunburst', 'fire'], hueSpeed: 0.5,
});
