import type { Pool } from './types';

// Which scenes show at which moment of the set (design §6), as the user curated them on the curation page,
// 2026-10-10, and again 2026-11-13. One list, so the whole assignment reads on one screen; each scene's look stays in
// its own file. A scene may sit in several pools; one in none is disabled in its file. Key order is pool order for poolsOf.
// The physics- scenes and plotter (2026-11-13) were placed for the user to move on the curation page.
// So were six more in main (2026-11-16, unseen by the user): ripples, radiolarian, jellyfish, pinecone, romanesco and
// sunflower — 15 scenes went round twice in a relaxed hour, and the user asked for biological forms in relaxed music.
export const POOLS: Record<Pool, readonly string[]> = {
  main: [
    'geometric-attractor', 'geometric-chladni', 'geometric-lasers', 'geometric-particles', 'geometric-plotter',
    'geometric-ripples', 'geometric-shards', 'geometric-tesseract', 'interlude-contour', 'interlude-grain',
    'interlude-radiolarian', 'organic-cells', 'organic-jellyfish', 'organic-particles', 'organic-pinecone',
    'organic-romanesco', 'organic-sunflower', 'physics-orbitals', 'physics-pendulums', 'psychedelic-particles',
    'psychedelic-terrain',
  ],
  // Harder, faster stretches (design §5). The dark- swarms carry forms from the other swarms, with their motion.
  dark: [
    'geometric-rain', 'geometric-ripples', 'geometric-rings', 'geometric-shards', 'geometric-spiro', 'geometric-wire',
    'interlude-grain', 'interlude-particles', 'interlude-pearl', 'interlude-radiolarian', 'organic-mitosis',
    'organic-sunflower', 'physics-caustics', 'physics-horizon', 'physics-slits', 'psychedelic-blackhole', 'psychedelic-liquid',
    'psychedelic-plasma', 'psychedelic-vortex',
    'dark-geometric-particles', 'dark-interlude-particles', 'dark-organic-particles', 'dark-psychedelic-particles',
  ],
  peak: [
    'geometric-particles', 'geometric-wire', 'interlude-particles', 'interlude-sea', 'organic-mitosis', 'organic-sunflower',
    'physics-horizon', 'physics-orbitals', 'psychedelic-blackhole', 'psychedelic-fire', 'psychedelic-liquid',
    'psychedelic-plasma', 'psychedelic-vortex',
  ],
  // Only a breakdown whose flag holds 30 s draws from here (design §6); a shorter one keeps its scene.
  breakdown: [
    'geometric-plotter', 'geometric-rings', 'interlude-neon', 'organic-cells', 'organic-curves', 'organic-jellyfish',
    'organic-particles', 'organic-pinecone', 'physics-galton',
  ],
  // Ambient interludes: first picked by the user against an ambient mix, 2026-10-03.
  interlude: [
    'geometric-rain', 'geometric-rings', 'interlude-aurora', 'interlude-dome', 'interlude-neon', 'interlude-particles',
    'interlude-pearl', 'interlude-sea', 'interlude-silk', 'organic-curves', 'organic-jellyfish', 'organic-pinecone',
    'organic-romanesco', 'physics-caustics',
  ],
  idle: ['idle-particles'],
};

export function poolsOf(id: string): Pool[] {
  return (Object.keys(POOLS) as Pool[]).filter((p) => POOLS[p].includes(id));
}
