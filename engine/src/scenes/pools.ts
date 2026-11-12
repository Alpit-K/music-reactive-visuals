import type { Pool } from './types';

// Which scenes show at which moment of the set (design §6), as the user curated them on the curation page,
// 2026-10-10. One list, so the whole assignment reads on one screen; each scene's look stays in its own file.
// A scene may sit in several pools; one in none is disabled in its file. Key order is pool order for poolsOf.
export const POOLS: Record<Pool, readonly string[]> = {
  main: [
    'geometric-attractor', 'geometric-chladni', 'geometric-lasers', 'geometric-particles', 'geometric-shards',
    'geometric-tesseract', 'geometric-wire', 'interlude-contour', 'organic-mitosis', 'organic-romanesco', 'psychedelic-terrain',
    // Biological, fractal and golden-angle scenes from the breakdown pool, which shows only after a 30 s breakdown
    // since 2026-11-12: the user wants relaxed stretches to go organic.
    'organic-cells', 'organic-coral', 'organic-fern', 'organic-particles', 'organic-pinecone', 'organic-sunflower',
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
  // Only a breakdown whose flag holds 30 s draws from here (design §6); a shorter one keeps its scene.
  breakdown: [
    'organic-cells', 'organic-coral', 'organic-curves', 'organic-fern', 'organic-jellyfish', 'organic-particles',
    'organic-pinecone', 'organic-sunflower',
  ],
  // Ambient interludes: first picked by the user against an ambient mix, 2026-10-03.
  interlude: [
    'organic-curves', 'interlude-particles', 'interlude-silk', 'interlude-grain', 'interlude-neon', 'interlude-pearl',
    'interlude-sea', 'organic-coral', 'interlude-aurora', 'interlude-dome', 'geometric-rain', 'organic-jellyfish',
  ],
  idle: ['idle-particles'],
};

export function poolsOf(id: string): Pool[] {
  return (Object.keys(POOLS) as Pool[]).filter((p) => POOLS[p].includes(id));
}
