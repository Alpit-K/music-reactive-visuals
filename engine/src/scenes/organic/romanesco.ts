import { particleScene } from '../particleScene';

// Breakdowns: a romanesco head — florets on the golden angle, each a smaller head of its own (2026-10-10).
export default particleScene({ id: 'organic-romanesco' }, {
  count: 120000, shapes: ['romanesco'], clock: 'seconds', hold: 30, morph: 0.3,
  spin: 1, stepTurn: false, kick: 0, breathe: 0.1, cloud: 0, swirl: 0, size: 3, bright: 1.8,
  palettes: ['lagoon', 'emerald', 'acid', 'aurora'], hueSpeed: 1,
});
