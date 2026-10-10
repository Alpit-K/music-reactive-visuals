// Vivid four-stop colour loops shared by scenes; a scene picks one per showing from its seed.
// Every stop is a saturated hue — at least one channel near zero — so where glowing points add up they
// stay coloured longer before clipping to white. No stop is saturated red (R/(R+G+B) ≥ 0.8): the flash
// limiter counts red changes as flashes. The muted ones after the blank line (sand, bone, steel, storm) break the
// first rule on purpose, for scenes after the Butterchurn presets that were muted; those scenes draw dim.
export type Rgb = [number, number, number];
export type Palette = [Rgb, Rgb, Rgb, Rgb];

export const PALETTES = {
  electric: [[0.0, 0.9, 1.0], [0.15, 0.3, 1.0], [0.6, 0.1, 1.0], [1.0, 0.1, 0.8]],
  lagoon: [[0.5, 1.0, 0.1], [0.0, 1.0, 0.7], [0.0, 0.6, 1.0], [0.3, 0.2, 1.0]],
  sunburst: [[1.0, 0.1, 0.55], [1.0, 0.5, 0.0], [1.0, 0.85, 0.1], [0.0, 0.85, 1.0]],
  ultraviolet: [[0.45, 0.0, 1.0], [1.0, 0.2, 0.7], [0.0, 0.9, 1.0], [0.2, 0.1, 0.9]],
  emerald: [[0.0, 1.0, 0.45], [0.0, 0.8, 1.0], [0.55, 0.2, 1.0], [0.6, 1.0, 0.0]],
  ember: [[1.0, 0.55, 0.0], [1.0, 0.25, 0.35], [0.8, 0.1, 0.9], [1.0, 0.8, 0.0]],
  orchid: [[0.9, 0.2, 1.0], [1.0, 0.45, 0.6], [1.0, 0.75, 0.2], [0.3, 0.5, 1.0]],
  aurora: [[0.0, 1.0, 0.6], [0.2, 0.7, 1.0], [0.7, 0.2, 1.0], [1.0, 0.3, 0.7]],
  deepsea: [[0.0, 0.35, 1.0], [0.0, 0.85, 0.85], [0.4, 0.1, 1.0], [0.0, 0.6, 0.5]],
  nebula: [[0.35, 0.1, 1.0], [0.9, 0.1, 0.8], [0.1, 0.5, 1.0], [0.0, 0.9, 0.8]],
  fire: [[1.0, 0.1, 0.35], [0.9, 0.0, 0.6], [0.55, 0.1, 1.0], [1.0, 0.3, 0.15]],
  acid: [[0.4, 1.0, 0.1], [0.0, 0.9, 0.7], [1.0, 0.45, 0.1], [0.9, 1.0, 0.0]],
  pearl: [[1.0, 0.55, 0.8], [0.4, 1.0, 0.75], [0.4, 0.7, 1.0], [0.8, 0.55, 1.0]],

  sand: [[0.95, 0.7, 0.35], [0.8, 0.5, 0.25], [1.0, 0.85, 0.6], [0.6, 0.4, 0.3]],
  bone: [[0.9, 0.88, 0.8], [0.75, 0.78, 0.8], [1.0, 0.95, 0.85], [0.8, 0.8, 0.75]],
  steel: [[0.5, 0.55, 0.6], [0.3, 0.7, 0.75], [0.6, 0.5, 0.75], [0.7, 0.72, 0.75]],
  storm: [[0.35, 0.6, 0.65], [0.6, 0.75, 0.75], [0.25, 0.45, 0.55], [0.75, 0.85, 0.85]],
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;
