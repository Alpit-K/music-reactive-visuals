import { particleScene } from '../particleScene';

// Breakdowns and interludes: Turing-pattern coral in halftone — labyrinth stripes crawling slowly (2026-10-09).
export default particleScene({ id: 'organic-coral' }, {
  count: 90000, shapes: ['coral'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.08, cloud: 0, swirl: 0, size: 6, bright: 3.5,
  palettes: ['ember', 'emerald', 'lagoon', 'orchid'], hueSpeed: 1,
});
