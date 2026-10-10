import { particleScene } from '../particleScene';

// Main: the Lorenz attractor as forty glowing trails, each fading in, running and fading out on its own 14 s life (2026-10-10).
export default particleScene({ id: 'geometric-attractor' }, {
  count: 24000, shapes: ['attractor'], clock: 'bars', hold: 16, morph: 0.125,
  spin: 1.5, stepTurn: true, kick: 0.18, breathe: 0.05, cloud: 0, swirl: 0, size: 5, bright: 2.8,
  palettes: ['electric', 'lagoon', 'ultraviolet', 'aurora'], hueSpeed: 2,
});
