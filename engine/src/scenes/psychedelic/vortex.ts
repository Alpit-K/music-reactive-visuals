import { particleScene } from '../particleScene';

// Peak, after the Butterchurn preset Thumbdrum Tokamak: striped arms winding into a far centre, filling the screen.
export default particleScene({ id: 'psychedelic-vortex' }, {
  count: 50000, shapes: ['vortex'], clock: 'bars', hold: 16, morph: 0.25, facing: true,
  spin: 0, stepTurn: false, kick: 0.3, breathe: 0.08, cloud: 0, swirl: 0.02, size: 6, bright: 3.5,
  palettes: ['sunburst', 'ultraviolet', 'emerald', 'orchid'], hueSpeed: 6,
});
