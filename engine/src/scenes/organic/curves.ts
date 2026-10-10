import { particleScene } from '../particleScene';

// Breakdowns and interludes: four layers of a rose curve in dots, each turning at its own pace (the 2026-10-01 shader, redrawn 2026-10-09).
export default particleScene({ id: 'organic-curves' }, {
  count: 30000, shapes: ['curves'], clock: 'seconds', hold: 30, morph: 0.3, facing: true,
  spin: 0, stepTurn: false, kick: 0, breathe: 0.12, cloud: 0, swirl: 0.01, size: 4, bright: 1.6,
  palettes: ['ember', 'orchid', 'aurora', 'nebula'], hueSpeed: 1,
});
