import butterchurnPresets from 'butterchurn-presets';
import { describe, expect, it } from 'vitest';
import { INTERLUDE_SCENES, interludeRole, WALL_PRESETS } from './interlude';
import { ENABLED_PRESETS } from './psychedelic/presets';
import { loadShaderScenes } from './registry';

describe('interlude pool', () => {
  it('names only scenes that exist, spelled exactly', () => {
    const shaders = new Set(loadShaderScenes().map((s) => s.id));
    const presets = butterchurnPresets.getPresets();
    for (const id of INTERLUDE_SCENES) {
      if (id.startsWith('bc:')) expect(presets).toHaveProperty([id.slice(3)]);
      else expect(shaders).toContain(id);
    }
  });

  it('keeps a preset that is not in rotation out of rotation', () => {
    expect(interludeRole('bc:martin - castle in the air')).toBe('only');
    expect(interludeRole('bc:martin - chain breaker')).toBe('also');
    expect(interludeRole('organic-flow')).toBe('also');
    expect(interludeRole('organic-cells')).toBeUndefined();
  });

  it('loads every enabled preset and every interlude preset on the wall, once', () => {
    expect(WALL_PRESETS).toEqual(expect.arrayContaining([...ENABLED_PRESETS, 'martin - castle in the air']));
    expect(new Set(WALL_PRESETS).size).toBe(WALL_PRESETS.length);
  });
});
