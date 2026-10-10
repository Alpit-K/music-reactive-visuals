import { particleScene } from '../particleScene';

// Silence: a slow swarm that ignores the audio — dim, but bright enough to read on the projector.
export default particleScene({ id: 'idle-particles' }, {
  count: 16000, shapes: ['saturn', 'sun', 'donut', 'galaxy', 'wave'],
  clock: 'seconds', hold: 40, morph: 0.4,
  spin: 0.6, stepTurn: false, kick: 0, breathe: 0, cloud: 0.25, swirl: 0.03, size: 5, bright: 1.5,
  palettes: ['deepsea', 'nebula', 'ultraviolet', 'aurora'],
  hueSpeed: 0.5,
}, { deaf: true });
