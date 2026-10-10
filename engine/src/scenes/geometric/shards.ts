import { particleScene } from '../particleScene';

// Main: a field of triangles traced in dots, a different set lit on every beat, punching in on the kick (redrawn 2026-10-09).
export default particleScene({ id: 'geometric-shards' }, {
  count: 40000, shapes: ['shards'], clock: 'bars', hold: 16, morph: 0.125, facing: true,
  spin: 0, stepTurn: false, kick: 0.1, breathe: 0.03, cloud: 0, swirl: 0, size: 4, bright: 3.0,
  palettes: ['sunburst', 'ember', 'electric', 'orchid'], hueSpeed: 2,
});
