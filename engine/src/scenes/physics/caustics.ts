import { particleScene } from '../particleScene';

// Interludes: light through rippled water, crowding into the bright web on a pool floor (2026-11-13).
export default particleScene({ id: 'physics-caustics' }, {
  count: 120000, shapes: ['caustics'], clock: 'seconds', hold: 600, morph: 0, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0, cloud: 0, swirl: 0, size: 4, bright: 3.5,
  palettes: ['lagoon', 'deepsea', 'aurora'], hueSpeed: 0.5,
});
