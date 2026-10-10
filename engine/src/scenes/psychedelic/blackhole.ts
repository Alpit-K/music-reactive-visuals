import { particleScene } from '../particleScene';

// Peak: a black hole — an accretion disc near edge-on, its far side lensed into a halo, quasar jets firing a knot on each kick (2026-10-10).
export default particleScene({ id: 'psychedelic-blackhole' }, {
  count: 80000, shapes: ['blackhole'], clock: 'bars', hold: 16, morph: 0.25, facing: true,
  spin: 0, stepTurn: false, kick: 0.2, breathe: 0.08, cloud: 0, swirl: 0, size: 4, bright: 1.6,
  palettes: ['ember', 'sunburst', 'fire', 'orchid'], hueSpeed: 4,
});
