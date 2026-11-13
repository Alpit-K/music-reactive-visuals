import { particleScene } from '../particleScene';

// Main and peaks: hydrogen orbitals — the electron's probability cloud, a new orbital every 16 bars (2026-11-13).
export default particleScene({ id: 'physics-orbitals' }, {
  count: 45000, shapes: ['orbital2p', 'orbital3p', 'orbital3d', 'orbital3dxz', 'orbital4f'], clock: 'bars', hold: 16, morph: 0.25,
  spin: 1.5, stepTurn: false, kick: 0.25, breathe: 0.1, cloud: 0, swirl: 0, size: 5, bright: 3.2,
  palettes: ['electric', 'ultraviolet', 'nebula', 'acid'], hueSpeed: 1,
});
