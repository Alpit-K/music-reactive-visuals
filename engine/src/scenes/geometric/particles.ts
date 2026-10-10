import { particleScene } from '../particleScene';

// Crisp swarm for main: a new form every 16 bars, flowing in over the last 2, landing on the bar line.
export default particleScene({ id: 'geometric-particles' }, {
  count: 30000, shapes: ['sphere', 'cube', 'helix', 'donut', 'dna', 'knot', 'saturn', 'twist', 'tunnel', 'octahedron', 'dodecahedron', 'icosahedron', 'tree'],
  clock: 'bars', hold: 16, morph: 0.125,
  spin: 1.5, stepTurn: true, kick: 0.18, breathe: 0.05, cloud: 0, swirl: 0.01, size: 5, bright: 1.2,
  palettes: ['electric', 'lagoon', 'sunburst', 'ultraviolet', 'emerald', 'aurora'],
  hueSpeed: 2,
});
