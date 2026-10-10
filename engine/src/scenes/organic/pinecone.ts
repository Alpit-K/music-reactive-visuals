import { particleScene } from '../particleScene';

// Breakdowns: a pinecone — diamond scales on the golden angle, lifting open and shutting (2026-10-10).
export default particleScene({ id: 'organic-pinecone' }, {
  count: 60000, shapes: ['pinecone'], clock: 'seconds', hold: 30, morph: 0.3,
  spin: 1, stepTurn: false, kick: 0, breathe: 0.1, cloud: 0, swirl: 0, size: 4, bright: 1.8,
  palettes: ['ember', 'sunburst', 'orchid', 'fire'], hueSpeed: 1,
});
