import { FLOW_FRAG } from '../organic/flow';
import { shaderScene } from '../shaderScene';

export default shaderScene({ id: 'idle-drift', family: 'idle' }, FLOW_FRAG, { timeScale: 0.3, gain: 0.35, deaf: true });
