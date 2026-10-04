import type { Scene } from './types';

// Each scene file is the single source of truth for its metadata (design §6): no manifest.
const modules = import.meta.glob<{ default: Scene }>(['./organic/*.ts', './geometric/*.ts', './idle/*.ts'], { eager: true });

export function loadShaderScenes(): Scene[] {
  return Object.values(modules).map((m) => m.default);
}
