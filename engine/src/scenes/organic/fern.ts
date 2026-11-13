import { particleScene } from '../particleScene';

// Off since 2026-11-13 (curation page), both forms. Was main and breakdowns: two fractals drawn by hopping — Barnsley's fern and Sierpinski's triangle, flowing into each other (2026-10-10).
export default particleScene({ id: 'organic-fern', enabled: false }, {
  count: 100000, shapes: ['fern', 'gasket'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.08, cloud: 0, swirl: 0, size: 3, bright: 2.5,
  palettes: ['emerald', 'lagoon', 'aurora', 'orchid'], hueSpeed: 1,
});
