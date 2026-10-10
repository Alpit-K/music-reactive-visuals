import { particleScene } from '../particleScene';

// Breakdown swarm: breathes with the bass, drifts apart into a loose cloud and re-forms, a new form every 30 s.
export default particleScene({ id: 'organic-particles' }, {
  count: 30000, shapes: ['galaxy', 'flower', 'shell', 'wave', 'butterfly', 'tree', 'brain', 'field', 'column', 'stars'],
  clock: 'seconds', hold: 30, morph: 0.3,
  spin: 1, stepTurn: false, kick: 0, breathe: 0.12, cloud: 0.2, swirl: 0.04, size: 5, bright: 1.9,
  palettes: ['ember', 'orchid', 'aurora', 'sunburst', 'emerald', 'nebula'],
  hueSpeed: 1,
});
