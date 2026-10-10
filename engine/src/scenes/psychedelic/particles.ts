import { particleScene } from '../particleScene';

// Peak swarm: dense and fast, bursts apart on every kick, cycles colour; a new form every 16 bars, flowing in over the last 4.
export default particleScene({ id: 'psychedelic-particles' }, {
  count: 40000, shapes: ['supernova', 'sun', 'galaxy', 'dna'],
  clock: 'bars', hold: 16, morph: 0.25,
  spin: 4, stepTurn: false, kick: 0.45, breathe: 0.1, cloud: 0, swirl: 0.06, size: 4, bright: 1.0,
  palettes: ['electric', 'lagoon', 'sunburst', 'ultraviolet', 'emerald', 'ember', 'orchid', 'aurora', 'deepsea', 'nebula'],
  hueSpeed: 8,
});
