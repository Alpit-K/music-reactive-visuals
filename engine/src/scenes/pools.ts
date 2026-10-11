import type { Motion, Pool } from './types';

// Which scenes show at which moment of the set (design §6), as the user curated them on the curation page,
// 2026-10-10. One list, so the whole assignment reads on one screen; each scene's look stays in its own file.
// A scene may sit in several pools; one in none is disabled in its file. Key order is pool order for poolsOf.
export const POOLS: Record<Pool, readonly string[]> = {
  main: [
    'geometric-attractor', 'geometric-chladni', 'geometric-lasers', 'geometric-particles', 'geometric-shards',
    'geometric-tesseract', 'geometric-wire', 'interlude-contour', 'organic-mitosis', 'organic-romanesco', 'psychedelic-terrain',
  ],
  // Harder, faster stretches (design §5). The dark- swarms carry forms from the other swarms, with their motion.
  dark: [
    'geometric-ripples', 'geometric-spiro', 'interlude-radiolarian', 'geometric-rings', 'geometric-shards', 'geometric-wire',
    'organic-mitosis', 'psychedelic-blackhole', 'psychedelic-terrain', 'dark-geometric-particles', 'dark-interlude-particles',
    'dark-organic-particles', 'dark-psychedelic-particles',
  ],
  // Blackhole is for the hardest stretches only: dark, not peak (2026-10-10).
  peak: [
    'psychedelic-fire', 'psychedelic-liquid', 'psychedelic-particles', 'psychedelic-plasma',
    'psychedelic-volcano', 'psychedelic-vortex', 'organic-romanesco',
  ],
  breakdown: [
    'organic-cells', 'organic-coral', 'organic-curves', 'organic-fern', 'organic-jellyfish', 'organic-particles',
    'organic-pinecone', 'organic-sunflower',
  ],
  // Ambient interludes: first picked by the user against an ambient mix, 2026-10-03.
  interlude: [
    'organic-curves', 'interlude-particles', 'interlude-silk', 'interlude-grain', 'interlude-neon', 'interlude-pearl',
    'interlude-sea', 'organic-coral', 'interlude-aurora', 'interlude-dome', 'geometric-rain',
  ],
  idle: ['idle-particles'],
};

// How each scene moves, rated from its file and confirmed by the user, 2026-10-10. A moving scene to a still one
// jarred live (black hole → romanesco), so the director keeps to one and bridges a change (design §6).
// Still: the form holds its place — drift, swell, a slow turn — and ignores the kick. Moving: the camera turns and
// steps each bar, the form changes on the beat, or it rushes and bursts on the kick. Idle is not rated.
export const MOTION: Record<Motion, readonly string[]> = {
  still: [
    'interlude-contour', 'organic-mitosis', 'organic-romanesco', 'interlude-radiolarian', 'dark-interlude-particles',
    'dark-organic-particles', 'organic-cells', 'organic-coral', 'organic-curves', 'organic-fern', 'organic-jellyfish',
    'organic-particles', 'organic-pinecone', 'organic-sunflower', 'interlude-particles', 'interlude-aurora',
    'interlude-dome', 'interlude-pearl', 'interlude-grain', 'interlude-silk',
  ],
  // The moving interlude scenes — sea, neon, rain — are the bridges.
  moving: [
    'geometric-attractor', 'geometric-chladni', 'geometric-lasers', 'geometric-particles', 'geometric-shards',
    'geometric-tesseract', 'geometric-wire', 'geometric-ripples', 'geometric-spiro', 'geometric-rings', 'geometric-rain',
    'dark-geometric-particles', 'interlude-sea', 'interlude-neon', 'psychedelic-terrain', 'psychedelic-blackhole',
    'psychedelic-fire', 'psychedelic-liquid', 'psychedelic-particles', 'psychedelic-plasma', 'psychedelic-volcano',
    'psychedelic-vortex', 'dark-psychedelic-particles',
  ],
};

export function poolsOf(id: string): Pool[] {
  return (Object.keys(POOLS) as Pool[]).filter((p) => POOLS[p].includes(id));
}

export function motionOf(id: string): Motion | undefined {
  return (Object.keys(MOTION) as Motion[]).find((m) => MOTION[m].includes(id));
}
