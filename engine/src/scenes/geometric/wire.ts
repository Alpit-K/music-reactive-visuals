import { particleScene } from '../particleScene';

// Main, after the Butterchurn preset disconnected: a warped torus drawn only along its mesh lines, soft lights behind.
export default particleScene({ id: 'geometric-wire' }, {
  count: 30000, shapes: ['wire'], clock: 'bars', hold: 16, morph: 0.125,
  spin: 1.5, stepTurn: true, kick: 0.18, breathe: 0.05, cloud: 0, swirl: 0.01, size: 4, bright: 1.6,
  palettes: ['bone'], hueSpeed: 1,
});
