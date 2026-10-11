import { describe, expect, it } from 'vitest';
import { MOTION, motionOf, POOLS, poolsOf } from './pools';
import { loadShaderScenes } from './registry';

describe('pools', () => {
  const enabled = loadShaderScenes().filter((s) => s.enabled).map((s) => s.id);

  it('names only enabled scenes, spelled exactly', () => {
    for (const ids of Object.values(POOLS)) for (const id of ids) expect(enabled).toContain(id);
  });

  it('puts every enabled scene in at least one pool', () => {
    for (const id of enabled) expect(poolsOf(id), id).not.toEqual([]);
  });

  it('has an idle scene', () => {
    expect(POOLS.idle.length).toBeGreaterThan(0);
  });

  it('rates every enabled scene but idle as still or moving, once', () => {
    for (const id of enabled) {
      if (poolsOf(id).includes('idle')) expect(motionOf(id), id).toBeUndefined();
      else expect([...MOTION.still, ...MOTION.moving].filter((m) => m === id), id).toHaveLength(1);
    }
    for (const id of [...MOTION.still, ...MOTION.moving]) expect(enabled).toContain(id);
  });

  it('has a moving interlude scene to bridge with', () => {
    expect(POOLS.interlude.some((id) => motionOf(id) === 'moving')).toBe(true);
  });

  it('lists every pool a scene is in, in pool order', () => {
    expect(poolsOf('organic-curves')).toEqual(['breakdown', 'interlude']);
    expect(poolsOf('interlude-particles')).toEqual(['interlude']);
    expect(poolsOf('no-such-scene')).toEqual([]);
  });
});
