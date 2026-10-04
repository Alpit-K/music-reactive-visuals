import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadShaderScenes } from './registry';

const here = dirname(fileURLToPath(import.meta.url));
const sceneFiles = Object.keys(import.meta.glob(['./organic/*.ts', './geometric/*.ts', './idle/*.ts', './psychedelic/*.ts']));

describe('scene registry', () => {
  it('discovers scenes with unique ids, a family, a source and a licence', () => {
    const scenes = loadShaderScenes();
    expect(scenes.length).toBeGreaterThanOrEqual(3);
    expect(new Set(scenes.map((s) => s.id)).size).toBe(scenes.length);
    for (const s of scenes) {
      expect(['organic', 'geometric', 'idle']).toContain(s.family);
      expect(s.source).not.toBe('');
      expect(s.licence).not.toBe('');
    }
  });

  it('has an idle drift scene', () => {
    expect(loadShaderScenes().some((s) => s.family === 'idle')).toBe(true);
  });

  // Design invariant: scenes are deterministic — time from the session clock, randomness from the seed.
  it.each(sceneFiles)('%s uses no Date.now or Math.random', (file) => {
    const src = readFileSync(join(here, file), 'utf8');
    expect(src).not.toMatch(/Date\.now|Math\.random/);
  });
});
