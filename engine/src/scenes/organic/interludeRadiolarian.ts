import { particleScene } from '../particleScene';

// Interludes only: a radiolarian — two nested glass lattice shells full of pores, spines out through them, turning slowly (2026-10-10).
export default particleScene({ id: 'interlude-radiolarian' }, {
  count: 120000, shapes: ['radiolarian'], clock: 'seconds', hold: 45, morph: 0.4,
  spin: 0.5, stepTurn: false, kick: 0, breathe: 0.05, cloud: 0, swirl: 0, size: 3, bright: 2.2,
  palettes: ['deepsea', 'pearl', 'aurora', 'lagoon'], hueSpeed: 0.5,
});
