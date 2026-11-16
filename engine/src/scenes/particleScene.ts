import { CONFIG } from '../config';
import { rng } from '../director/rng';
import { program } from '../render/gl';
import { nearestPalette, PALETTES, type PaletteName } from './palettes';
import { COMMON, type SceneOpts, setUniforms, shaderSeed, uniformLocations } from './shaderScene';
import { BUILD_STYLES, LifeCycle, REST } from './lifeCycle';
import { MORPH_STYLES, SILENT, type Features, type RenderSize, type Scene } from './types';

// Glowing particle swarms that flow from one 3D shape to the next — the look of particles.casberry.in,
// written fresh (that site states no licence). Every particle's position is a pure function of its index,
// the seed and the clock: no state between frames, so after-set rendering reproduces it exactly.

export interface Swarm {
  count: number;      // particles
  shapes: ShapeName[]; // the forms this scene may use
  clock: 'bars' | 'seconds'; // what a shape change counts in
  hold: number;       // shape lasts this many bars or seconds, morph included
  morph: number;      // 0..1 of `hold` spent flowing into the next shape, ending on the change
  spin: number;       // camera turns per minute
  stepTurn: boolean;  // camera also turns a step on each bar line
  kick: number;       // outward burst on the kick
  breathe: number;    // swell with the bass
  cloud: number;      // drift apart into a loose cloud and back
  swirl: number;      // turbulence
  size: number;       // point size in px at 1080p, one unit from the camera
  bright: number;     // per-point brightness; points add up where they overlap
  palettes: PaletteName[]; // one picked per showing; colour runs along and across the shape, shifting with depth
  hueSpeed: number;   // gradient cycles per minute
  facing?: boolean;   // the form faces the camera, which neither turns nor tilts: for forms that fill the screen
}

/** The shapes, by name. Each maps a particle's randoms to a point within ~1 unit — or, for the forms that fill
 *  the screen (twist, tunnel, supernova, sun, stars), well past it and around the camera. */
export const SHAPES = [
  'sphere', 'cube', 'helix', 'donut', 'dna', 'galaxy', 'flower', 'knot',
  'shell',     // nautilus cut in half: a golden spiral, its chamber walls (septa) and the open body chamber
  'wave',
  // After the user's favourites on particles.casberry.in (2026-10-08), redrawn from screenshots, not their code:
  'saturn',    // rainbow saturn: planet and glittering ring
  'core',      // MK1: ring-shaped power core with turbine blades, fins and a beam
  'butterfly', // but fly: wings that flap
  'tree',      // fractal tree: branching, swaying, blossoming tips
  'tentacles', // the voidmaw: an orb with writhing tentacles and an eye
  'filaments', // plasmatic void: a tangle of glowing loops
  'brain',     // mind: two folded halves
  'field',     // chat gpt: a breathing sphere warped by interference waves
  'column',    // ASCI system: a twisting column of flowing dots
  'twist',     // qwert: a huge twisting form that fills the screen
  'tunnel',    // dunno: a lattice torus seen through its hole
  'supernova', // supernova explosion 2: shockwave shells that sweep past the camera
  'sun',       // the sun: a dense core, looping flares and scattered stars
  'stars',     // a field of sparkles, big flakes among the dust
  // After the Butterchurn presets the user kept (2026-10-09), reinterpreted as swarms when Butterchurn went:
  'silk',      // Airhandler: broad ribbons that furl and fold
  'bloom',     // Red Liquid Fire: a dome of embers bursting up and out
  'grain',     // jelly showoff parade: screen-filling bands of flowing lines
  'wire',      // disconnected: a warped torus drawn only along its mesh lines, soft lights behind
  'vortex',    // Thumbdrum Tokamak: jagged striped arms winding into a far centre
  'spiro',     // True Visionary: rings flowing out of a tunnel, chords strung across them
  'neon',      // _Mig_085: one glowing tube tying and untying itself
  'pearl',     // mother-of-pearl: iridescent feathered flakes lining the screen around a dark void
  'sea',       // stormy sea: a choppy surface seen from the shore, horizon high
  // The last shader scenes, redrawn in dots so every scene can morph into every other (2026-10-09):
  'curves',    // rose curves, petals layered
  'rings',     // a tunnel of rings coming one per beat, turning a step each bar
  'lasers',    // a fan of beams from the centre, sweeping, alternate beams taking the beat
  'shards',    // a field of triangles, a different set lit on every beat
  'cells',     // living cells: membranes within membranes and a nucleus, the cells drifting
  'liquid',    // halftone paint: a grid of dots sized and coloured by a folding liquid field
  // More halftones in the liquid's method — a field read on a grid of dots (2026-10-09):
  'coral',     // Turing coral: labyrinth stripes, faked with warped noise
  'chladni',   // Chladni plate: sand gathering on a vibrating plate's still lines, a new mode each bar
  'ripples',   // interference: waves from drifting sources crossing; the kick sends a ring out
  'contour',   // contour map: a shifting landscape drawn along its height lines
  'sunflower', // sunflower: seeds on the golden angle, swelling in waves from the centre
  'terrain',   // bar terrain: a field of dot columns, the bands low to high across it
  'cellsheet', // cell sheet: dots big mid-cell, fine at the walls
  'plasma',    // plasma tunnel: the liquid's folds wrapped round a tunnel
  // Biological, fractal and golden-ratio forms (2026-10-10):
  'fern',      // Barnsley's fern: each dot hops through 30 shrinking copies of the frond and lands on it
  'gasket',    // Sierpinski's triangle the same way, its three copies turning
  'romanesco', // romanesco: a cone of florets on the golden angle, each a cone of its own
  'pinecone',  // pinecone: scales on the golden angle round an egg, opening and closing
  'mitosis',   // a cell dividing, then a zoom into one daughter, which divides in turn
  'jellyfish', // jellyfish: pulsing bells trailing tentacles, rising
  'blackhole', // black hole: a near edge-on accretion disc, the far side lensed into a halo, jets that fire a knot on each kick
  'volcano',   // erupting volcano: a cone with lava running down it, a fountain the bass drives, ash rising
  'attractor', // Lorenz attractor: forty trails, each worked out afresh every frame from where it started
  'tesseract', // tesseract: a 4D cube's edges and faces, turning in 4D a step each bar
  'rain',      // digital rain without the letters: columns of dots stepping down to the beat
  'octahedron', 'dodecahedron', 'icosahedron', // dotted faces, edges bright
  'aurora',    // aurora: three curtains, bright at the lower edge, rays fading upward, folding slowly
  'radiolarian', // radiolarian: two nested lattice shells with pores, glass spines out through them
  'dome',      // squiggle dome: a hemisphere of worm-like cells under contour rings drifting up it
  'rose',      // rose nebula: petals of gas round a pulsing cluster, a dark dust lane, a halo spreading out
  'ribbon',    // chronos ribbon: dotted rings strung along a bending axis, flowing down it
  // Physics, each drawn from its real equations (2026-11-13: the user asked for visuals like Veritasium's):
  'pendulums', // pendulum wave: 15 pendulums falling in and out of step
  'orbital2p', 'orbital3p', 'orbital3d', 'orbital3dxz', 'orbital4f', // hydrogen orbitals: the electron's probability cloud
  'slits',     // two-slit interference, and dots landing one by one into its bands
  'galton',    // Galton board: balls through pegs piling into a bell curve
  'caustics',  // light through rippled water, crowding into the web on a pool floor
  'horizon',   // black hole: shadow, photon ring, lensed disc, Doppler beaming, infall that never crosses
  'plotter',   // squares within squares, order sweeping into disorder and back (the user's reference, 2026-11-13)
] as const;
export type ShapeName = (typeof SHAPES)[number];
const I = (n: ShapeName) => SHAPES.indexOf(n);

// Forms that fill the screen: no travel when they groove (it would bare an edge), and no satellites or backdrop.
// Measured 2026-11-12 with scripts/swarm-check.mjs — at least 40 of the screen's 8 × 6 tiles lit in every shot —
// plus pearl and sea, which line the whole screen round a dark middle or below a high horizon.
export const FILLS_SCREEN: readonly ShapeName[] = [
  'chladni', 'lasers', 'twist', 'tunnel', 'rain', 'rings', 'ripples', 'shards', 'spiro', 'cells', 'coral', 'contour',
  'grain', 'stars', 'rose', 'supernova', 'sun', 'bloom', 'liquid', 'plasma', 'vortex', 'terrain', 'pearl', 'sea',
  'slits', 'caustics', 'plotter',
];
export const FILLS_GLSL = `bool fills(int s) { return ${FILLS_SCREEN.map((n) => `s == ${SHAPES.indexOf(n)}`).join(' || ')}; }\n`;

// pcg and rnd come first so shapes can draw extra randoms. q is the particle's place on a square lattice, for
// forms drawn in tidy rows of dots; sz scales its point size, for big flakes among fine dust.
const SHAPE_GLSL = `
const float PI = 3.14159265;
float pointCount;                                         // the dot's role's count (lead or satellite), set before each shape()
int vid;                                                  // the dot's index within its role: shapes use it, never gl_VertexID
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(uint k, float seed) { return float(pcg(uint(vid) * 32u + k + uint(seed * 1000.0) * 65536u)) / 4294967296.0; }
// seeded() from COMMON, for a seed of the caller's choosing: a morph draws two swarms with two seeds.
float seededBy(float seed, float k) { return fract(sin(seed * 0.731 + k * 12.9898) * 43758.5453); }
mat2 rot2(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
vec3 sphereDir(vec2 u) { float z = 2.0 * u.x - 1.0; float q = sqrt(max(1.0 - z * z, 0.0)); float b = 2.0 * PI * u.y; return vec3(q * cos(b), z, q * sin(b)); }
vec3 jitter(float x) { return vec3(fract(x * 7.13), fract(x * 13.7), fract(x * 29.3)) - 0.5; }
vec2 screenGrid(vec2 q) { return (q * 2.0 - 1.0) * vec2(2.15, 1.22); } // the lattice stretched just past the screen, for halftones
vec3 chladni(vec2 p, float n, float m) {                  // a square plate's mode (n, m): height, then its gradient
  return vec3(cos(n * p.x) * cos(m * p.y) - cos(m * p.x) * cos(n * p.y),
              -n * sin(n * p.x) * cos(m * p.y) + m * sin(m * p.x) * cos(n * p.y),
              -m * cos(n * p.x) * sin(m * p.y) + n * cos(m * p.x) * sin(n * p.y));
}
vec2 chladniMode(float seed, float k) {                   // mode for bar k: n 1–4, m 1–4 above it, so never flat
  float n = 1.0 + floor(seededBy(seed, 60.0 + mod(k, 101.0)) * 4.0);
  return vec2(n, n + 1.0 + floor(seededBy(seed, 170.0 + mod(k, 101.0)) * 4.0));
}
// Smooth fields for the forms drawn along height lines: three octaves or fewer, not fbm's five, so the lines don't fray.
float contourHeight(vec2 p, float t, float seed) {
  p += vec2(t * 0.02, -t * 0.015);
  return 0.55 * noise(p, seed) + 0.3 * noise(p * 2.03 + 5.1, seed) + 0.15 * noise(p * 4.1 + 9.7, seed);
}
// The dot's k-th hop through an iterated function system, for the fractals drawn by hopping: fixed per dot and
// seed, so each dot keeps its place on the fractal while the maps move.
float hop(float seed, int k) { return float(pcg(pcg(uint(vid) + uint(seed * 1000.0) * 65536u) + uint(k))) / 4294967296.0; }
// Point n of N on the golden angle down a cone of radius 1 and height h, apex up, denser near the apex (u: 0 apex .. 1 rim);
// axis is the way a floret there points, between the cone's normal and straight up.
vec3 goldenCone(float n, float N, float h, out vec3 axis, out float u) {
  u = pow((n + 0.5) / N, 0.6);
  float b = n * 2.39996323;
  axis = normalize(mix(normalize(vec3(h * cos(b), 1.0, h * sin(b))), vec3(0.0, 1.0, 0.0), 0.3));
  return vec3(u * cos(b), h * (1.0 - u), u * sin(b));
}
mat3 frameUp(vec3 Y) { vec3 X = normalize(cross(Y, vec3(0.0, 1.0, 0.0))); return mat3(X, Y, cross(X, Y)); }
// A Platonic solid met by a ray from its centre along unit d: the distance to it, faces at 1; edge is 0 on an edge
// and grows toward a face's middle. kind 0 octahedron, 1 dodecahedron (faces toward an icosahedron's corners),
// 2 icosahedron (faces toward a dodecahedron's). Normals come in ± pairs, so one of each pair is listed.
float solidRay(vec3 d, int kind, out float edge) {
  const float G = 1.618034, H = 0.618034;
  vec3 n[10];
  int k = kind == 0 ? 4 : kind == 1 ? 6 : 10;
  n[0] = vec3(1, 1, 1); n[1] = vec3(1, 1, -1); n[2] = vec3(1, -1, 1); n[3] = vec3(-1, 1, 1);
  if (kind == 1) { n[0] = vec3(0, 1, G); n[1] = vec3(0, 1, -G); n[2] = vec3(1, G, 0); n[3] = vec3(1, -G, 0); n[4] = vec3(G, 0, 1); n[5] = vec3(-G, 0, 1); }
  else { n[4] = vec3(0, H, G); n[5] = vec3(0, H, -G); n[6] = vec3(H, G, 0); n[7] = vec3(H, -G, 0); n[8] = vec3(G, 0, H); n[9] = vec3(-G, 0, H); }
  float m1 = 0.0, m2 = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= k) break;
    float v = abs(dot(d, normalize(n[i])));
    if (v > m1) { m2 = m1; m1 = v; } else if (v > m2) m2 = v;
  }
  edge = m1 - m2;
  return 1.0 / m1;
}
vec3 fibSphere(float i, float n) { float z = 1.0 - (2.0 * i + 1.0) / n, q = sqrt(1.0 - z * z), b = i * 2.39996323; return vec3(q * cos(b), z, q * sin(b)); }
// Distance from unit d to the nearest of n points on a golden-spiral sphere.
float sphereNearest(vec3 d, float n) {
  float f1 = 9.0;
  for (int i = 0; i < 80; i++) {
    if (float(i) >= n) break;
    f1 = min(f1, length(d - fibSphere(float(i), n)));
  }
  return f1;
}
float pineRadius(float v) { return 0.62 * pow(sin(PI * v), 0.75) * (1.0 - 0.35 * v); } // an egg, fat low, pointed at the tip
vec3 neonPath(float u, float t, float seed) {             // a closed curve whose loops drift, so the knot ties and unties
  float f1 = 2.0 + floor(seededBy(seed, 38.0) * 2.0), f2 = 3.0;
  return vec3(sin(f1 * u + t * 0.07) + 0.35 * sin(5.0 * u - t * 0.05),
              sin(f2 * u + 1.3 + t * 0.04),
              cos(f1 * u + t * 0.06) + 0.3 * cos(4.0 * u + t * 0.09)) * vec3(0.95, 0.7, 0.7);
}
vec3 shape(int s, vec3 r, vec2 q, float t, float seed, inout float sz, inout float hu) {
  float a = 2.0 * PI * r.x, b = 2.0 * PI * r.y;
  if (s == 0) return sphereDir(q) * 0.85;
  if (s == 1) {                                           // cube surface
    int f = int(r.z * 6.0); vec2 u = vec2(r.x, r.y) * 2.0 - 1.0; float sg = (f % 2 == 0) ? 0.75 : -0.75;
    return f < 2 ? vec3(sg, u * 0.75) : f < 4 ? vec3(u.x * 0.75, sg, u.y * 0.75) : vec3(u * 0.75, sg);
  }
  if (s == 2) { float y = r.x * 2.2 - 1.1; float ang = r.x * 6.0 * 2.0 * PI; float rr = 0.55 + 0.06 * (r.y - 0.5);
                return vec3(rr * cos(ang), y, rr * sin(ang)); }
  if (s == 3) { float A = 2.0 * PI * q.x, B = 2.0 * PI * q.y; return vec3((0.72 + 0.28 * cos(B)) * cos(A), 0.28 * sin(B), (0.72 + 0.28 * cos(B)) * sin(A)); }
  if (s == 4) {                                           // DNA: two strands and the rungs between
    float y = r.x * 2.4 - 1.2;
    if (r.z < 0.8) { float ang = r.x * 4.0 * 2.0 * PI + (r.z < 0.4 ? 0.0 : PI);
                     return vec3(0.45 * cos(ang), y, 0.45 * sin(ang)) + 0.06 * jitter(r.y); }
    float k = floor(r.x * 28.0) / 28.0; float ang = k * 4.0 * 2.0 * PI; float m = r.y * 2.0 - 1.0;
    return vec3(0.45 * m * cos(ang), k * 2.4 - 1.2, 0.45 * m * sin(ang));
  }
  if (s == 5) {                                           // spiral galaxy: arms around a bright bulge
    if (r.z < 0.15) { float z = 2.0 * r.x - 1.0; float w = sqrt(1.0 - z * z) * 0.18 * r.y; return vec3(w * cos(b), z * 0.1, w * sin(b)); }
    float arms = 2.0 + floor(seededBy(seed, 31.0) * 3.0);
    float rad = pow(r.x, 0.6) * 1.1;
    float ang = floor(r.z * arms) / arms * 2.0 * PI + rad * 3.2 + (fract(r.z * 17.0) - 0.5) * 0.5 * (1.2 - rad);
    return vec3(rad * cos(ang), (r.y - 0.5) * 0.08 * (1.2 - rad), rad * sin(ang));
  }
  if (s == 6) {                                           // flower: cupped petals and a seed head
    float petals = 5.0 + floor(seededBy(seed, 32.0) * 3.0);
    if (r.z < 0.12) { float w = 0.12 * sqrt(r.y); return vec3(w * cos(a), 0.05, w * sin(a)); }
    float rho = abs(cos(petals * 0.5 * a)) * sqrt(r.y) * 0.95;
    return vec3(rho * cos(a), 0.45 * rho * rho - 0.15, rho * sin(a));
  }
  if (s == 7) {                                           // (2,3) torus knot, thickened to a tube
    float rr = 0.5 + 0.22 * cos(3.0 * a);
    vec3 p = vec3(rr * cos(2.0 * a), 0.22 * sin(3.0 * a), rr * sin(2.0 * a)) * 1.3;
    return p + 0.06 * vec3(cos(b), sin(b), cos(b + r.z * 6.0)) * r.z;
  }
  if (s == 8) {                                          // nautilus: r = a·e^(bθ) with b = ln φ / π, so each half turn grows by the golden ratio — near a real
    const float B = 0.15318, TM = 18.8496;                // shell's ×3 a turn; the strict golden spiral (φ a quarter turn) read as a hook. TM: three turns
    float rad, th;
    if (r.z < 0.45) {                                     // the spiral wall, dots even along its length
      th = log(mix(exp(B * 0.0), exp(B * TM), r.x)) / B;
      rad = exp(B * (th - TM));
      sz = 0.5 + 0.6 * rad;
    } else if (r.z < 0.9) {                               // septa every tenth of a turn, curving back, none in the last third-turn: the body chamber
      float k = floor(fract(r.z * 37.0) * 26.0), tk = TM - 2.2 - k * 0.6283;
      float u = r.x;
      th = tk - 0.18 * sin(PI * u);
      rad = mix(exp(B * (tk - 6.2832 - TM)), exp(B * (tk - TM)), u);
      sz = 0.8 + 0.8 * rad;
    } else {                                              // the siphuncle: a thin tube threading the chambers
      th = mix(2.0, TM - 2.2, r.x);
      rad = 0.5 * (exp(B * (th - TM)) + exp(B * (th - 6.2832 - TM)));
      sz = 0.9;
    }
    hu = 0.04 * th + 0.2 * rad;
    return vec3(rad * cos(th + t * 0.05), rad * sin(th + t * 0.05), (r.y - 0.5) * 0.05 * rad) * 1.05;
  }
  if (s == 9) { float x = q.x * 2.0 - 1.0, z = q.y * 2.0 - 1.0;   // rippling sheet
                return vec3(x * 1.1, 0.22 * sin(4.0 * x + t * 1.5) * cos(3.0 * z + t), z * 1.1); }
  if (s == 10) {                                          // saturn
    if (r.z < 0.45) return sphereDir(r.xy) * 0.55;
    float rad = mix(0.8, 1.35, sqrt(r.x));
    vec3 p = vec3(rad * cos(b), 0.02 * (r.z - 0.7), rad * sin(b));
    p.yz = rot2(0.45) * p.yz;
    sz = 0.6 + 1.2 * fract(r.z * 37.0);
    return p;
  }
  if (s == 11) {                                          // power core
    float spin = t * 0.8;
    if (r.z < 0.3) return vec3((0.75 + 0.07 * cos(b)) * cos(a), (0.75 + 0.07 * cos(b)) * sin(a), 0.07 * sin(b));
    if (r.z < 0.6) { float i = floor(r.x * 12.0); float A = (i + 0.35 * r.y) / 12.0 * 2.0 * PI + spin;
                     float rad = mix(0.2, 0.65, fract(r.x * 12.0)); return vec3(rad * cos(A), rad * sin(A), 0.06 * (r.y - 0.5)); }
    if (r.z < 0.8) { float i = floor(r.x * 16.0); float A = i / 16.0 * 2.0 * PI - spin * 0.5;
                     float rad = mix(0.9, 1.15, fract(r.x * 16.0)); return vec3(rad * cos(A), rad * sin(A), (r.y - 0.5) * 0.25); }
    if (r.z < 0.9) { float rad = 0.18 * sqrt(r.x); float A = b + rad * 20.0 - spin * 3.0; sz = 1.3; return vec3(rad * cos(A), rad * sin(A), 0.0); }
    sz = 1.4;                                             // the beam
    return vec3(-0.1 - r.x * 1.6, 0.0, 0.0) + 0.05 * (1.0 - r.x) * jitter(r.y);
  }
  if (s == 12) {                                          // butterfly: Fay's curve, filled, wings flapping
    float th = r.x * 12.0 * PI;
    float rr = exp(sin(th)) - 2.0 * cos(4.0 * th) + pow(abs(sin((2.0 * th - PI) / 24.0)), 5.0);
    float fill = r.z < 0.6 ? 1.0 - 0.04 * r.y : sqrt(r.y); // most on the wing edges, the rest filling them
    vec2 w = vec2(sin(th), cos(th)) * rr * 0.22 * fill;
    float flap = 0.7 * sin(t * 3.0);
    return vec3(w.x * cos(flap), w.y - 0.1, abs(w.x) * sin(flap));
  }
  if (s == 13) {                                          // fractal tree: each particle follows its own path of left/right turns
    uint bits = pcg(uint(vid) * 7u + 101u);
    int lv = int(pow(r.z, 0.7) * 10.0);                   // more particles in the finer branches
    vec3 pos = vec3(0.0, -1.0, 0.0), dir = vec3(0.0, 1.0, 0.0);
    float len = 0.5;
    for (int k = 0; k < 10; k++) {
      if (k == lv) { pos += dir * len * r.y; break; }
      pos += dir * len;
      float ang = (((bits >> uint(k)) & 1u) == 1u ? 1.0 : -1.0) * (0.5 + 0.08 * sin(t * 0.9 + float(k)));
      if (k % 2 == 0) dir.xy = rot2(ang) * dir.xy; else dir.zy = rot2(ang) * dir.zy;
      len *= 0.74;
    }
    if (lv >= 8) sz = 1.6;                                // blossoming tips
    return pos + 0.02 * jitter(r.x);
  }
  if (s == 14) {                                          // orb with tentacles and an eye
    if (r.z < 0.35) return sphereDir(r.xy) * 0.38 * (0.85 + 0.15 * fract(r.z * 53.0));
    if (r.z < 0.4) { float rad = 0.09 * sqrt(r.x); sz = 1.5; return vec3(rad * cos(b), rad * sin(b), 0.4); }
    float i = floor((r.z - 0.4) / 0.6 * 9.0);
    vec3 base = sphereDir(vec2(fract(i * 0.618 + 0.1), fract(i * 0.381 + 0.3)));
    vec3 s1 = normalize(cross(base, vec3(0.3, 1.0, 0.2))), s2 = cross(base, s1);
    float w = r.x * 0.5;
    vec3 p = base * (0.38 + r.x * 1.9) + s1 * w * sin(r.x * 5.0 + t * 2.2 + i) + s2 * w * cos(r.x * 4.0 + t * 1.7 + i * 2.0);
    return p + 0.1 * (1.0 - r.x) * jitter(r.y);
  }
  if (s == 15) {                                          // filaments: 20 looping strands
    float k = floor(r.z * 20.0);
    vec3 f = 1.0 + floor(vec3(fract(k * 0.37), fract(k * 0.71), fract(k * 0.13)) * 3.0);
    vec3 ph = vec3(fract(k * 0.53), fract(k * 0.29), fract(k * 0.91)) * 2.0 * PI;
    vec3 p = vec3(sin(f.x * a + ph.x + t * 0.25), sin(f.y * a + ph.y - t * 0.2), sin(f.z * a + ph.z + t * 0.15));
    return p * 0.85 / (0.55 + 0.45 * length(p)) + 0.015 * jitter(r.y); // rounded, not boxed in
  }
  if (s == 16) {                                          // brain: two folded halves and sparks inside
    float side = r.z < 0.5 ? -1.0 : 1.0;
    vec3 d = sphereDir(r.xy);
    float fold = 0.14 * sin(18.0 * d.y + 11.0 * d.z + side) * sin(15.0 * d.x + 17.0 * d.z);
    vec3 w = d * (1.0 + fold) * vec3(0.34, 0.48, 0.78);
    vec3 p = vec3(side * (0.07 + abs(w.x)), w.y * (1.0 - 0.25 * step(w.y, 0.0)), w.z); // gap between halves, flatter underside
    if (fract(r.z * 41.0) < 0.15) p *= 0.6 + 0.4 * fract(r.z * 97.0);
    return p;
  }
  if (s == 17) {                                          // breathing field
    vec3 d = sphereDir(q);
    float th = acos(clamp(d.y, -1.0, 1.0)), ph = atan(d.z, d.x);
    float rad = 0.75 + 0.22 * sin(5.0 * th + t * 0.8) * sin(4.0 * ph - t * 0.6) + 0.12 * sin(9.0 * th + 3.0 * ph + t * 1.2);
    return d * rad * vec3(1.3, 0.8, 1.3);
  }
  if (s == 18) {                                          // twisting column
    float y = (q.y * 2.0 - 1.0) * 1.6;
    float ang = q.x * 2.0 * PI + y * 1.4 + t * 0.4;
    float rad = 0.35 + 0.22 * sin(y * 3.0 + t) + 0.1 * sin(q.x * 6.0 * PI + y * 5.0 - t * 2.0);
    return vec3(rad * cos(ang), y, rad * sin(ang));
  }
  if (s == 19) {                                          // twist: a torus whose cross-section turns as it goes round
    float A = 2.0 * PI * q.x, B = 2.0 * PI * q.y;
    vec2 cs = rot2(A * 1.5 + t * 0.3) * vec2((0.6 + 0.08 * sin(t * 0.7)) * cos(B), 0.36 * sin(B));
    return vec3((1.15 + cs.x) * cos(A), cs.y + 0.15 * sin(3.0 * A + t), (1.15 + cs.x) * sin(A)) * (1.0 + 0.05 * sin(t * 0.9));
  }
  if (s == 20) {                                          // tunnel: torus facing the camera, wide enough to look through
    float A = 2.0 * PI * q.x, B = 2.0 * PI * q.y;
    float w = 0.95 + 0.07 * sin(6.0 * A + 4.0 * B + t);
    return vec3((1.5 + w * cos(B)) * cos(A), (1.5 + w * cos(B)) * sin(A), w * sin(B));
  }
  if (s == 21) {                                          // supernova: three shells grow out past the camera, then start again
    vec3 d = sphereDir(r.xy);
    if (fract(r.z * 13.0) < 0.02) { float A = t * 1.5 + (r.x < 0.5 ? 0.0 : PI); sz = 1.5; return vec3(0.12 * cos(A), 0.0, 0.12 * sin(A)) + 0.02 * d; }
    float g = fract(t * 0.12 + floor(r.z * 3.0) / 3.0);
    sz = (fract(r.z * 37.0) < 0.12 ? 3.0 : 0.8) * (1.0 - 0.6 * g);
    return d * (0.1 + 4.0 * g) * (1.0 + 0.25 * (fract(r.z * 71.0) - 0.5));
  }
  if (s == 22) {                                          // sun
    if (r.z < 0.55) { vec3 d = sphereDir(r.xy); float rad = 0.45 * pow(fract(r.z * 91.0), 0.33);
                      return d * rad * (1.0 + 0.08 * sin(d.x * 9.0 + t) * sin(d.y * 7.0 - t * 0.8)); }
    if (r.z < 0.7) { float i = floor(fract(r.z * 31.0) * 12.0); vec3 a0 = sphereDir(vec2(fract(i * 0.618), fract(i * 0.31)));
                     vec3 tng = normalize(cross(a0, vec3(0.0, 1.0, 0.1))); float u = r.x * PI;
                     return a0 * (0.45 + 0.35 * sin(u) * (0.8 + 0.2 * sin(t + i))) + tng * 0.25 * cos(u); }
    sz = fract(r.z * 53.0) < 0.1 ? 3.5 : 0.7;
    return sphereDir(r.xy) * (0.7 + 3.0 * r.x * r.x);
  }
  if (s == 24) {                                          // silk: broad ribbons that furl and fold
    float k = floor(r.z * (2.0 + floor(seededBy(seed, 33.0) * 2.0)));
    float u = r.x * 2.0 - 1.0, v = r.y - 0.5, ph = k * 2.1 + seededBy(seed, 34.0) * 6.0;
    vec3 c = vec3(1.5 * u, 0.55 * sin(2.0 * u + t * 0.23 + ph), 0.45 * cos(1.6 * u - t * 0.19 + ph * 1.3));
    float ang = 2.4 * u + t * 0.17 + ph;                   // the ribbon's width turns as it runs, so it furls
    vec3 across = vec3(0.0, cos(ang), sin(ang)), out_ = vec3(0.0, -sin(ang), cos(ang));
    hu = 0.3 * k + 0.2 * u;
    return c + across * v * 0.6 * (1.0 - 0.6 * u * u) + out_ * 0.12 * sin(7.0 * v + 3.0 * u + t * 0.6);
  }
  if (s == 25) {                                          // fire bloom: a dome of flame licking up from below the centre, embers flung off it
    vec3 d = sphereDir(r.xy); d.y = abs(d.y);
    float az = atan(d.z, d.x);
    float lick = 0.25 * sin(7.0 * az + 3.0 * d.y + t * 0.8) * sin(4.0 * d.y - t * 0.6) + 0.1 * sin(13.0 * az - t * 1.3);
    float g = r.z < 0.75 ? 0.0 : fract(t * 0.2 + r.z * 7.0); // three in four on the dome; the rest are embers, out and burning down
    if (g > 0.0) sz = 1.5 * (1.0 - 0.8 * g);
    hu = 0.4 * d.y + 0.6 * g + 0.15 * r.x;
    return d * (0.8 + 0.7 * lick + 0.08 * fract(r.z * 53.0) + 1.1 * g) * vec3(1.3, 0.85, 1.3) - vec3(0.0, 0.5, 0.0);
  }
  if (s == 26) {                                          // grain: 60 lines across the view, pushed about by overlapping waves until they bunch and whorl
    float k = floor(r.z * 60.0), x = (r.x * 2.0 - 1.0) * 2.5, y0 = (k / 60.0 * 2.0 - 1.0) * 1.45;
    float y = y0 + 0.35 * sin(1.1 * x + 1.7 * y0 + t * 0.21) + 0.2 * sin(2.3 * x - 2.9 * y0 - t * 0.17) + 0.12 * sin(4.1 * x + 3.3 * y0 + t * 0.3);
    hu = 0.25 * y0 + 0.12 * x;
    return vec3(x, y, 0.3 + 0.2 * sin(0.9 * x + 1.3 * y + t * 0.2));
  }
  if (s == 27) {                                          // wire lattice
    if (fract(r.z * 31.0) < 0.03) { sz = 6.0; return (vec3(r.x, r.y, fract(r.z * 7.0)) - 0.5) * vec3(7.0, 4.0, 3.0) + vec3(0.0, 0.0, 2.5); } // soft lights far behind
    float A = r.z < 0.5 ? floor(r.x * 20.0) / 20.0 : r.x, B = r.z < 0.5 ? r.y : floor(r.y * 10.0) / 10.0; // on a line of the mesh
    A *= 2.0 * PI; B *= 2.0 * PI;
    float rr = 0.42 * (1.0 + 0.12 * sin(2.0 * A + B + t * 0.5) + 0.06 * sin(3.0 * B - t * 0.4));
    vec3 p = vec3((0.85 + rr * cos(B)) * cos(A), 1.3 * rr * sin(B), (0.85 + rr * cos(B)) * sin(A));
    p.xy = rot2(0.6 * sin(t * 0.13)) * p.xy;
    sz = 0.7;
    return p;
  }
  if (s == 28) {                                          // vortex: arms on a log spiral, near at the edge, far at the centre
    float arms = 5.0 + floor(seededBy(seed, 35.0) * 4.0), k = floor(r.z * arms);
    float rad = 0.04 + 3.2 * r.x;
    float band = 0.8 * (0.6 + 0.4 * sign(sin(rad * 30.0 + k)));   // the band narrows in steps: jagged edges
    float ang = (k + (r.y - 0.5) * band) / arms * 2.0 * PI + 2.2 * log(rad + 0.05) - t * 0.35;
    hu = k / arms + 0.1 * rad;
    return vec3(rad * cos(ang), rad * sin(ang), 2.2 - 0.9 * rad);
  }
  if (s == 29) {                                          // spirograph tunnel: each ring drifts toward the camera, then starts again at the far end
    if (r.z < 0.1) { float rad = 0.24 * (floor(r.x * 6.0) + 0.15 * r.y) / 6.0; sz = 1.3; hu = 0.5 + 0.1 * rad; // the eye: an iris of rings
                     return vec3(rad * cos(b + t * 0.3), rad * sin(b + t * 0.3), 2.0); }
    float k = floor(fract(r.z * 7.0) * 10.0), z = 2.6 - mod(k + t * 0.25, 10.0) * 0.42;
    hu = 0.06 * k;
    if (r.z < 0.55) return vec3(1.15 * cos(a), 1.15 * sin(a), z);
    float n = 9.0 + floor(seededBy(seed, 36.0) * 8.0), i = floor(r.y * n);   // string art: chord from each pin to one ~half-way round
    float a1 = i / n * 2.0 * PI + k * 0.2, a2 = a1 + PI * (0.55 + 0.2 * seededBy(seed, 37.0));
    return vec3(mix(vec2(cos(a1), sin(a1)), vec2(cos(a2), sin(a2)), r.x) * 1.15, z);
  }
  if (s == 30) {                                          // neon tube: a head running round the curve, the tube thinning to its tail
    float back = r.x * 0.7, u = (t * 0.05 - back) * 2.0 * PI;
    vec3 c = neonPath(u, t, seed), tg = normalize(neonPath(u + 0.002, t, seed) - c);
    vec3 n1 = normalize(cross(tg, vec3(0.3, 1.0, 0.2))), n2 = cross(tg, n1);
    sz = 1.0 - 0.8 * back;
    hu = 1.2 * back;
    return c + 0.07 * (1.0 - back) * (cos(b) * n1 + sin(b) * n2);
  }
  if (s == 31) {                                          // pearl fringe: feathers grow in from the screen's edge, most of the way to the centre and back
    float W = 2.1, H = 1.2, e = r.x * 2.0 * (W + H), side = e < W ? 0.0 : e < W + H ? 1.0 : e < 2.0 * W + H ? 2.0 : 3.0;
    vec2 at = side == 0.0 ? vec2(e * 2.0 - W, -H) : side == 1.0 ? vec2(W, (e - W) * 2.0 - H) : side == 2.0 ? vec2(W - (e - W - H) * 2.0, H) : vec2(-W, H - (e - 2.0 * W - H) * 2.0);
    vec2 in_ = side == 0.0 ? vec2(0.0, 1.0) : side == 1.0 ? vec2(-1.0, 0.0) : side == 2.0 ? vec2(0.0, -1.0) : vec2(1.0, 0.0);
    float len = (0.45 + 0.6 * (0.5 + 0.5 * sin(13.0 * e + seededBy(seed, 40.0) * 6.0))) * (0.75 + 0.25 * sin(t * 0.3 + 7.0 * e)) * (1.05 + 0.15 * sin(t * 0.12));
    float d = len * pow(r.y, 0.7);
    vec2 p = at + in_ * d + vec2(in_.y, -in_.x) * 0.05 * sin(30.0 * d + 40.0 * e);   // barbs off each feather
    sz = fract(r.z * 23.0) < 0.1 ? 2.0 : 0.8;
    hu = 2.4 * e / (W + H) + 0.3 * r.y + 0.2 * sin(t * 0.2 + 9.0 * e);
    return vec3(p, 0.2 * sin(5.0 * e + t * 0.25));
  }
  if (s == 32) {                                          // sea: rows bunched near the camera, where they are drawn biggest
    float x = (q.x * 2.0 - 1.0) * 5.0, z = -1.8 + q.y * q.y * 6.5;
    float h = 0.16 * sin(0.9 * x + 1.1 * z - 1.3 * t) + 0.1 * sin(1.7 * x - 1.4 * z + 1.1 * t)
            + 0.05 * sin(3.7 * x + 2.9 * z - 2.1 * t) + 0.025 * sin(7.1 * x - 6.3 * z + 2.9 * t);
    h -= 0.08 * abs(sin(1.3 * x + 0.7 * z - 1.7 * t));     // sharper crests
    hu = 1.5 * h + 0.05 * z;
    vec2 yz = rot2(0.3) * vec2(h - 0.75, z + 2.6);         // looking down a little, about the camera
    return vec3(x, yz.x, yz.y - 2.6);
  }
  if (s == 33) {                                          // curves: four layers of a rose, each turning at its own pace
    float k = 3.0 + floor(seededBy(seed, 41.0) * 4.0), n = floor(r.z * 4.0);
    float rose = mix(0.24, 0.36, seededBy(seed, 42.0)) * cos(k * a + t * (0.05 + 0.02 * n)) + 0.05 * n * sin(t * 0.1 + n);
    float rad = (abs(rose) + 0.04 * n) * 2.2 + 0.006 * (r.y - 0.5);
    hu = 0.08 * n + seededBy(seed, 43.0);
    return vec3(rad * cos(a), rad * sin(a), 0.1 * n - 0.15);
  }
  if (s == 34) {                                          // rings: square, circle or hexagon, by seed
    float k = floor(r.z * 14.0), z = 3.2 - mod(k + u_beat, 14.0) * 0.35;
    float bars = u_beat / 4.0, turn = (seededBy(seed, 44.0) < 0.5 ? 1.0 : -1.0) * (seededBy(seed, 45.0) < 0.5 ? 0.7854 : 0.5236);
    float th = a + turn * (floor(bars) + smoothstep(0.0, 0.25, fract(bars))), form = floor(seededBy(seed, 46.0) * 3.0);
    vec2 d = vec2(cos(a), sin(a));
    float rad = form < 0.5 ? 1.0 / max(abs(d.x), abs(d.y)) : form < 1.5 ? 1.0 : 1.0 / max(abs(d.x) * 0.866 + abs(d.y) * 0.5, abs(d.y));
    rad *= 0.9 * (1.0 + (r.y - 0.5) * 0.08 * exp(-u_kick * 6.0)); // rings thicken on the kick
    hu = k * mix(0.04, 0.12, seededBy(seed, 47.0));
    return vec3(rot2(th - a) * d * rad, z);
  }
  if (s == 35) {                                          // lasers: 8–32 beams, changing count at each bar line
    float beams = 4.0 + 2.0 * floor(seededBy(seed, 48.0) * 3.0) + (2.0 + floor(seededBy(seed, 49.0) * 3.0)) * mod(u_bar, 3.0);
    float i = floor(r.z * 2.0 * beams);
    float sweep = mix(0.2, 0.6, seededBy(seed, 50.0)) * sin(1.5708 * u_beat + seed);    // across and back every four beats
    float ang = i * PI / beams - sweep, d = 0.05 + 2.6 * pow(r.x, 0.8);
    float pulse = exp(-u_kick * 7.0);
    sz = (mod(i + floor(u_beat), 2.0) > 0.5 ? 1.2 * exp(-u_phase * 2.5) + 0.8 : 0.6) * smoothstep(2.9, 0.4, d); // alternate beams take the beat
    hu = 0.1 * i + 0.12 * u_bar;
    return vec3(vec2(sin(ang), cos(ang)) * d + vec2(cos(ang), -sin(ang)) * (r.y - 0.5) * 0.012 * (1.0 + 2.0 * pulse), 0.0);
  }
  if (s == 36) {                                          // shards: triangles on a skewed lattice; dots trace each one's edges
    float cell = 2.26 / mix(3.0, 7.0, seededBy(seed, 51.0)), n = ceil(4.8 / cell);
    vec2 c = floor(vec2(r.z, fract(r.z * 37.0)) * n) - floor(n * 0.5);
    float up = step(0.5, fract(r.z * 91.0)), e = floor(r.y * 3.0);
    vec2 v0 = up > 0.5 ? c : c + vec2(1.0, 0.0), v1 = up > 0.5 ? c + vec2(1.0, 0.0) : c + vec2(1.0, 1.0), v2 = c + vec2(0.0, 1.0);
    vec2 sk = e < 1.0 ? mix(v0, v1, r.x) : e < 2.0 ? mix(v1, v2, r.x) : mix(v2, v0, r.x);
    sk = mix(sk, (v0 + v1 + v2) / 3.0, 0.08);             // a hair inside, so neighbours' edges don't merge
    vec2 id = c * 2.0 + vec2(up, 0.0);
    float lit = step(mix(0.45, 0.7, seededBy(seed, 52.0)), hash(id + floor(u_beat), seed));
    float pulse = exp(-u_kick * 5.0);
    float y = sk.y / 1.1547;
    vec2 p = vec2(sk.x - y * 0.57735, y) * cell * (1.0 - 0.06 * pulse);   // back off the lattice; punches in on the kick
    sz = lit > 0.5 ? 1.0 + 0.4 * pulse : 0.3;
    hu = 0.15 * hash(id + 3.0, seed);
    return vec3(rot2(seed + 0.04 * u_beat * (seededBy(seed, 53.0) < 0.5 ? 1.0 : -1.0)) * p, 0.0);
  }
  if (s == 37) {                                          // cells: each dot finds its cell's wall along its own direction — the nearest bisector with a neighbour
    float cell = 2.26 / mix(2.5, 5.0, seededBy(seed, 54.0)), n = ceil(4.6 / cell), sp = mix(0.08, 0.25, seededBy(seed, 55.0));
    vec2 ci = floor(vec2(r.z, fract(r.z * 37.0)) * n) - floor(n * 0.5);
    vec2 c0 = ci + 0.5 + 0.4 * sin(t * sp + 6.2832 * vec2(hash(ci, seed), hash(ci + 17.0, seed)));
    vec2 dir = vec2(cos(a), sin(a));
    float wall = 2.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      if (x == 0 && y == 0) continue;
      vec2 cj = ci + vec2(x, y), d = cj + 0.5 + 0.4 * sin(t * sp + 6.2832 * vec2(hash(cj, seed), hash(cj + 17.0, seed))) - c0;
      float along = dot(d, dir);
      if (along > 0.0) wall = min(wall, dot(d, d) / (2.0 * along));
    }
    float layer = floor(r.y * 4.0);                        // outer wall, two inner membranes, a speckled nucleus
    float rad = layer < 1.0 ? 0.94 : layer < 2.0 ? 0.72 : layer < 3.0 ? 0.5 : 0.3 * sqrt(fract(r.y * 4.0));
    rad *= wall * (1.0 + 0.03 * sin(9.0 * a + t * 0.7 + hash(ci, seed) * 6.0));
    sz = layer < 1.0 ? 1.0 : layer < 3.0 ? 0.7 : 0.9;
    hu = 0.2 * layer + 0.3 * hash(ci, seed);
    return vec3((c0 + dir * rad) * cell, 0.0);
  }
  if (s == 38) {                                          // liquid: the peak liquid's folds, sampled on a grid; dots swell on the ridges, shrink in the valleys
    vec2 g = screenGrid(q);
    vec2 p = g * 1.1;
    float tt = t * 0.25 + 0.12 * (floor(u_beat) + smoothstep(0.0, 0.35, fract(u_beat))) + seededBy(seed, 56.0) * 50.0;
    // The folds widen with the smoothed bass, not hit by hit: on u_bass every bass note reshuffled the whole pattern,
    // and the flash limiter damped plasma 75% and liquid 53% of their screen time live (2026-10-10).
    float w = 4.5 * (1.0 + 0.25 * u_swell);
    vec2 f1 = vec2(fbm(p + tt, seed), fbm(p + vec2(5.2, 1.3) - tt, seed));
    vec2 f2 = vec2(fbm(p + w * f1 + vec2(1.7, 9.2) + 0.6 * tt, seed), fbm(p + w * f1 + vec2(8.3, 2.8) - 0.6 * tt, seed));
    float h = fbm(p + w * f2, seed);
    sz = 0.5 + 1.5 * smoothstep(0.3, 0.75, h);
    hu = 2.0 * h + 0.6 * length(f2);
    return vec3(g + (f2 - 0.5) * 0.12, -0.3 * h);
  }
  if (s == 39) {                                          // coral: noise of one scale, cut at its middle — Turing's even-width meanders, which branch and dead-end
    vec2 g = screenGrid(q), p = g * mix(12.0, 16.0, seededBy(seed, 58.0)) + seededBy(seed, 57.0) * 40.0;
    vec2 w = 1.5 * vec2(noise(g * 0.6 + t * 0.02, seed), noise(g * 0.6 + vec2(5.3, 2.1) - t * 0.02, seed));
    float v = 0.5 * noise(rot2(0.7) * p + w, seed) + 0.5 * noise(rot2(2.1) * p * 1.17 + w + 3.7, seed);   // two turned copies hide the noise's grid
    float stripe = smoothstep(0.47, 0.53, v);
    sz = 0.15 + 1.5 * stripe;
    hu = 0.35 * stripe + 0.8 * w.x;
    return vec3(g, -0.1 * stripe);
  }
  if (s == 40) {                                          // chladni: each dot slides toward the nearest still line; the mode turns over early in each bar
    vec2 g = screenGrid(q), p = g / 1.22 * PI;
    float bars = u_beat / 4.0, k = floor(bars), e = smoothstep(0.0, 0.3, fract(bars));
    vec2 m0 = chladniMode(seed, k - 1.0), m1 = chladniMode(seed, k);
    vec3 f = mix(chladni(p, m0.x, m0.y), chladni(p, m1.x, m1.y), e);
    float slope = max(length(f.yz), 1e-3), dist = abs(f.x) / slope;   // to the line, in plate units
    float move = min(dist, 0.35) * 0.85;
    vec2 to = -sign(f.x) * f.yz / slope;
    sz = 0.3 + 1.3 * exp(-(dist - move) * 8.0);
    hu = 0.07 * mix(m0.x + m0.y, m1.x + m1.y, e) + 0.1 * g.x;
    return vec3(g + to * move * 1.22 / PI, 0.0);
  }
  if (s == 41) {                                          // ripples: thin crests round three wandering sources, one every two beats; where they cross, the dots add up
    vec2 g = screenGrid(q);
    float k = mix(16.0, 24.0, seededBy(seed, 62.0)), h = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 c = vec2(1.4 * sin(t * 0.07 + fi * 2.1 + seed), 0.8 * cos(t * 0.05 + fi * 1.7 + seed * 1.3));
      h += pow(0.5 + 0.5 * sin(k * length(g - c) - u_beat * PI), 8.0);
    }
    float ring = exp(-pow((length(g) - u_kick * 2.5) * 6.0, 2.0)) * exp(-u_kick * 1.5);
    sz = 0.15 + 0.8 * min(h + 1.5 * ring, 2.2);
    hu = 0.3 * h + 0.4 * ring + 0.1 * length(g);
    return vec3(g, -0.05 * h);
  }
  if (s == 42) {                                          // contour: dots pulled onto the nearest height line, every fifth line heavier
    vec2 g = screenGrid(q), p = g * 0.9 + seededBy(seed, 63.0) * 30.0;
    float h = contourHeight(p, t, seed);
    vec2 grad = vec2(contourHeight(p + vec2(0.01, 0.0), t, seed) - h, contourHeight(p + vec2(0.0, 0.01), t, seed) - h) / 0.01 * 0.9;
    float lv = h * 18.0, near = floor(lv + 0.5), slope = max(length(grad) * 18.0, 1e-3);
    float dist = (near - lv) / slope;                     // signed, in screen units
    float pull = clamp(dist, -0.025, 0.025);
    float line = exp(-pow((dist - pull) / 0.012, 2.0));
    sz = 0.15 + (mod(near, 5.0) < 0.5 ? 1.8 : 1.1) * line;
    hu = 1.5 * h;
    return vec3(g + grad / (slope / 18.0) * pull, 0.0);
  }
  if (s == 43) {                                          // sunflower: one head, Vogel's spiral; seeds swell outward and in slow waves from the centre
    float i = float(vid);
    float ang = float(uint(vid) * 2654435769u) / 4294967296.0 * 2.0 * PI + t * 0.02; // golden angle, in exact integer turns
    float rad = 1.15 * sqrt((i + 0.5) / pointCount);
    vec2 p = rad * vec2(cos(ang), sin(ang));
    float wave = 0.5 + 0.5 * sin(rad * 14.0 - t * 0.9 + 1.5 * fbm(p * 2.0 + t * 0.05, seed));
    sz = (0.45 + 0.9 * rad) * (0.6 + 0.5 * wave);
    // Seed i's outer neighbours are i ± 34 and i ± 55, so arms of every 34th seed lie side by side, and neighbouring
    // arms differ by 21 — odd — so colouring the arms by parity stripes the spirals in two colours.
    hu = 0.3 * mod(mod(i, 34.0), 2.0) + 0.25 * wave + 0.3 * rad;
    return vec3(p, -0.05 * wave);
  }
  if (s == 44) {                                          // terrain: 16 × 10 bars, each 3 × 3 dots thick, on a floor seen from above; dots above a bar's height drop to the floor as dust
    float id = float(vid), cid = mod(id, 160.0), k = mod(floor(id / 160.0), 9.0), lvl = floor(id / 1440.0);
    vec2 cell = vec2(mod(cid, 16.0), floor(cid / 16.0));
    float z = cell.y / 9.0, D = 1.5 + 4.0 * z;              // 0 front row .. 1 back row; D its distance along the floor
    float x = (cell.x / 15.0 * 2.0 - 1.0) * (1.9 + 0.64 * (D - 1.5));   // rows widen with distance, so the field fills the screen
    // Low bands in the middle, high ones at both edges: a stand-in for a spectrum, which the features do not carry.
    float u = abs(cell.x / 15.0 * 2.0 - 1.0) * 3.0;
    float band = u < 1.0 ? mix(u_sub, u_bass, u) : u < 2.0 ? mix(u_bass, u_mids, u - 1.0) : mix(u_mids, u_highs, u - 2.0);
    float hgt = (0.05 + 0.45 * band) * (0.4 + 0.8 * noise(cell * 0.3 + vec2(0.0, t * 0.6), seed))
              + 0.25 * exp(-pow((z * 3.0 - u_kick * 4.0) * 2.0, 2.0));   // the kick rolls a wave from the front row back
    float y = lvl * 0.02;
    vec2 at = vec2(x, D) + (vec2(mod(k, 3.0), floor(k / 3.0)) - 1.0) * 0.016 * (1.0 + D);   // the bar's 3 × 3 cross-section
    if (y > hgt) { y = 0.0; at += (r.xy - 0.5) * vec2(0.4, 0.4); sz = 0.25; }
    else sz = y + 0.02 > hgt ? 1.6 : 0.9;                // each bar's top layer is its cap
    hu = 2.0 * min(y, hgt) + 0.1 * z;
    vec2 yz = rot2(0.6) * vec2(y - 2.0, at.y);              // floor 2 below the eye, looking down on it
    return vec3(at.x, yz.x, yz.y - 2.6);
  }
  if (s == 45) {                                          // cell sheet: F2 − F1 is 0 on a wall and largest mid-cell
    vec2 g = screenGrid(q), p = g * mix(2.2, 3.6, seededBy(seed, 64.0)), ip = floor(p), id = ip;
    float f1 = 9.0, f2 = 9.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 c = ip + vec2(x, y), o = c + 0.5 + 0.4 * sin(t * 0.15 + 6.2832 * vec2(hash(c, seed), hash(c + 17.0, seed)));
      float d = length(p - o);
      if (d < f1) { f2 = f1; f1 = d; id = c; } else if (d < f2) f2 = d;
    }
    float e = f2 - f1;
    sz = 0.15 + 1.6 * smoothstep(0.0, 0.5, e);
    hu = 0.4 * hash(id, seed) + 0.3 * e;
    return vec3(g, 0.0);
  }
  if (s == 46) {                                          // plasma: the liquid read in tunnel space — round it and into it — mirrored so there is no seam
    vec2 g = screenGrid(q);
    float rad = length(g), ang = atan(g.y, g.x);
    vec2 p = vec2(abs(mod(ang + t * 0.05, 2.0 * PI) - PI) * 1.2, 0.8 / max(rad, 0.05) + t * 0.6);
    float tt = t * 0.2 + 0.1 * (floor(u_beat) + smoothstep(0.0, 0.35, fract(u_beat))) + seededBy(seed, 65.0) * 50.0;
    float w = 3.5 * (1.0 + 0.25 * u_swell);   // smoothed bass, as the liquid's
    vec2 f1 = vec2(fbm(p + tt, seed), fbm(p + vec2(5.2, 1.3) - tt, seed));
    vec2 f2 = vec2(fbm(p + w * f1 + vec2(1.7, 9.2) + 0.6 * tt, seed), fbm(p + w * f1 + vec2(8.3, 2.8) - 0.6 * tt, seed));
    float h = fbm(p + w * f2, seed);
    sz = (0.5 + 1.5 * smoothstep(0.3, 0.75, h)) * smoothstep(0.05, 0.45, rad);   // the far centre fades to nothing
    hu = 2.0 * h + 0.6 * length(f2);
    return vec3(g + (f2 - 0.5) * 0.1, -0.3 * h);
  }
  if (s == 47) {                                          // fern: Barnsley's four maps, picked 1 : 85 : 7 : 7; the frond bends and its leaflets flutter
    vec2 p = vec2(0.0);
    float side = 0.0, bend = 0.04 * sin(t * 0.35 + seed) + 0.015 * sin(t * 0.9), flut = 1.0 + 0.06 * sin(t * 0.7 + seed);
    for (int k = 0; k < 30; k++) {
      float u = hop(seed, k);
      if (u < 0.01) p = vec2(0.0, 0.16 * p.y);
      else if (u < 0.86) p = rot2(bend) * vec2(0.85 * p.x + 0.04 * p.y, -0.04 * p.x + 0.85 * p.y) + vec2(0.0, 1.6);
      else if (u < 0.93) { p = flut * vec2(0.2 * p.x - 0.26 * p.y, 0.23 * p.x + 0.22 * p.y) + vec2(0.0, 1.6); side = 0.0; }
      else { p = flut * vec2(-0.15 * p.x + 0.28 * p.y, 0.26 * p.x + 0.24 * p.y) + vec2(0.0, 0.44); side = 1.0; }
    }
    sz = 0.8 + 0.4 * fract(r.z * 31.0);
    hu = 0.05 * p.y + 0.25 * side;                        // the last leaflet map taken says which side of its stalk a dot is on
    return vec3((p.x - 0.25) * 0.21, (p.y - 5.0) * 0.21, 0.0);
  }
  if (s == 48) {                                          // gasket: three half-size copies about the corners, each turning a little
    vec2 p = vec2(0.0);
    float last = 0.0, prev = 0.0;
    for (int k = 0; k < 30; k++) {
      float i = floor(hop(seed, k) * 3.0), ang = i * 2.0944 + 1.5708;
      vec2 v = 1.35 * vec2(cos(ang), sin(ang));
      p = v + 0.5 * rot2(0.3 * sin(t * 0.12 + i * 2.1 + seed)) * (p - v);
      prev = last; last = i;
    }
    sz = 0.8 + 0.4 * fract(r.z * 31.0);
    hu = 0.25 * last + 0.1 * prev;                        // the last two hops name the third and ninth it is in
    return vec3(p.x, p.y - 0.34, 0.0);
  }
  if (s == 49) {                                          // romanesco: three levels of the same cone — 55 florets of 21 florets of dots, all on the golden angle
    float per = floor(pointCount / 55.0), per2 = floor(per / 21.0), id = float(vid);
    float n = min(floor(id / per), 54.0), m = min(floor(mod(id, per) / per2), 20.0), j = mod(mod(id, per), per2);
    float h = 1.6, u1, u2, u3;
    vec3 ax1, ax2, ax3;
    vec3 at = goldenCone(n, 55.0, h, ax1, u1), sub = goldenCone(m, 21.0, h, ax2, u2), pt = goldenCone(j, per2, h, ax3, u3);
    float sc1 = (0.06 + 0.15 * u1) * (1.0 + 0.1 * sin(t * 0.6 - u1 * 8.0)), sc2 = 0.1 + 0.2 * u2; // growth swells down the head in waves
    sz = 0.6 + 0.6 * u3;
    hu = 0.3 * mod(mod(n, 13.0), 2.0) + 0.3 * u1 + 0.15 * u2;  // florets every 13th apart lie along one spiral: alternate spirals in two colours
    vec3 p = at + frameUp(ax1) * (sc1 * (sub + frameUp(ax2) * (sc2 * pt)));
    return (p - vec3(0.0, 0.85, 0.0)) * 0.8;
  }
  if (s == 50) {                                          // pinecone: 144 diamond scales on the golden angle round an egg, lifting open and shutting
    float per = floor(pointCount / 144.0), id = float(vid);
    float n = min(floor(id / per), 143.0), v = (n + 0.5) / 144.0;
    float ang = n * 2.39996323, R = pineRadius(v), slope = (pineRadius(v + 0.01) - pineRadius(v - 0.01)) / 0.04;
    vec3 N = normalize(vec3(cos(ang), -slope, sin(ang))), T1 = vec3(-sin(ang), 0.0, cos(ang)), T2 = cross(N, T1);
    float sc = 0.05 + 0.2 * R;
    float a1 = r.x * 2.0 - 1.0, b1 = (r.y * 2.0 - 1.0) * (1.0 - abs(a1));
    if (r.z < 0.35) b1 = sign(b1) * (1.0 - abs(a1));      // a third of the dots trace the scale's edge
    float open = 0.25 + 0.2 * sin(t * 0.12 + seed);
    vec3 p = vec3(R * cos(ang), 2.0 * v - 1.0, R * sin(ang)) + sc * (T1 * a1 + T2 * b1 * 0.8)
           + N * sc * (open * (1.0 - b1) + 0.25 * (1.0 - abs(a1) - abs(b1)));   // lower tip lifts; a raised boss mid-scale
    sz = r.z < 0.35 ? 1.2 : 0.8;
    hu = 0.3 * mod(mod(n, 8.0), 2.0) + 0.3 * v + 0.1 * b1;
    p.xy = rot2(0.35) * p.xy;
    return p;
  }
  if (s == 51) {                                          // mitosis: one division per 18 s, its axis a right angle on from the last; then a zoom into one daughter, who becomes the next cell
    float c = t / 18.0 + seededBy(seed, 66.0), k = floor(c), g = fract(c);
    float phi = seededBy(seed, 67.0) * 6.2832 + k * 1.5708;
    vec2 A = vec2(cos(phi), sin(phi)), P = vec2(-A.y, A.x);
    float sd = rnd(9u + uint(mod(k, 20.0)), seed) < 0.5 ? -1.0 : 1.0;          // the daughter this dot goes to
    float was = rnd(9u + uint(mod(k + 19.0, 20.0)), seed) < 0.5 ? -1.0 : 1.0;  // and last time: dots of the daughter left behind fade back in
    float condense = smoothstep(0.25, 0.42, g), separate = smoothstep(0.48, 0.66, g);
    float spindle = smoothstep(0.28, 0.42, g) * (1.0 - smoothstep(0.66, 0.78, g));
    float cleave = smoothstep(0.58, 0.84, g), reform = smoothstep(0.68, 0.84, g), zoom = smoothstep(0.86, 1.0, g);
    float d = 0.74, rd = 0.707;                           // daughters of half the area
    vec2 cb = sd * d * cleave * A;
    float rr = mix(1.0, rd, cleave);
    float vis = (was < 0.0 ? smoothstep(0.0, 0.12, g) : 1.0) * (sd < 0.0 ? 1.0 - zoom : 1.0);
    vec2 p;
    float ci = floor(fract(r.z * 91.0) * 8.0), sa = fract(r.z * 37.0) * 2.0 - 1.0;
    vec2 cen = P * ((ci / 7.0 - 0.5) * 0.8 * mix(1.0, 0.6, separate)) + A * sd * mix(0.015, 0.55, separate); // centromere
    if (r.z < 0.35) {                                     // membrane, wobbling
      float th = 2.0 * PI * r.x;
      vec2 e = vec2(cos(th), sin(th));
      p = cb + rr * e * (1.0 + 0.03 * sin(5.0 * th + t * 0.6) + 0.02 * sin(9.0 * th - t));
      vis *= mix(1.0, smoothstep(-0.03, 0.03, length(p + cb) - rr), smoothstep(0.0, 0.05, cleave)); // hidden inside the other daughter
      sz = 1.1; hu = 0.05 * sin(th);
    } else if (r.z < 0.75) {                              // chromatin: speckle in the nucleus, then chromosomes, then two nuclei
      vec2 L = 0.33 * sqrt(r.x) * vec2(cos(2.0 * PI * r.y), sin(2.0 * PI * r.y));
      L += 0.03 * vec2(noise(L * 9.0 + t * 0.2, seed), noise(L * 9.0 + 4.0 - t * 0.2, seed));
      vec2 arm = rot2(0.5 * (fract(ci * 0.37) - 0.5)) * P;  // each chromosome lies a little askew
      vec2 chrom = cen + arm * 0.08 * sa + A * sd * (0.03 * sa * sa - 0.09 * separate * sa * sa); // an X; arms trail once pulled
      p = mix(mix(L, chrom, condense), cb + rr * L, reform);
      sz = 0.8; hu = 0.45 + 0.04 * ci;
    } else if (r.z < 0.85) {                              // nuclear envelope: fades as the chromosomes form, re-forms round each daughter's
      float th = 2.0 * PI * r.x;
      vec2 e = 0.36 * vec2(cos(th), sin(th));
      p = mix(e * (1.0 + 0.3 * condense), cb + rr * e, reform);
      vis *= 1.0 - condense * (1.0 - reform);
      sz = 0.9; hu = 0.3;
    } else {                                              // cytoplasm specks, drawn into spindle fibres from the poles to the centromeres
      vec2 L = 0.9 * sqrt(r.x) * vec2(cos(2.0 * PI * r.y), sin(2.0 * PI * r.y)) + 0.04 * vec2(sin(t * 0.3 + 6.2832 * fract(r.z * 17.0)), cos(t * 0.25 + 6.2832 * fract(r.z * 29.0))); // each speck its own phase, or rings show
      p = mix(cb + rr * L, mix(A * sd * 0.65, cen, fract(r.x * 13.0)), spindle);
      sz = 0.55; hu = 0.7;
    }
    sz *= vis;
    return vec3((p - zoom * d * A) / mix(1.0, rd, zoom) * 0.78, 0.0);
  }
  if (s == 52) {                                          // jellyfish: four bells pulsing, each trailing tentacles that take the pulse late, rising
    float i = mod(float(vid), 4.0), sj = 0.4 + 0.2 * seededBy(seed, 70.0 + i);
    float per = 2.6 + seededBy(seed, 74.0 + i), w = fract(t / per + seededBy(seed, 78.0 + i));
    float y0 = mod(i * 1.1 + seededBy(seed, 82.0 + i) + 0.05 * t + 0.015 * sin(2.0 * PI * (t / per + seededBy(seed, 78.0 + i))), 4.4) - 2.0;
    vec3 c = vec3((i / 3.0 - 0.5) * 3.0 + 0.4 * (seededBy(seed, 86.0 + i) - 0.5), y0, (seededBy(seed, 90.0 + i) - 0.5) * 0.8);
    float con = smoothstep(0.0, 0.2, w) * (1.0 - smoothstep(0.25, 1.0, w));   // quick squeeze, slow relax
    float fm = 1.5;
    vec3 l;
    if (r.z < 0.6) {                                      // bell and rim; bright radial canals
      float rim = r.z < 0.1 ? 1.0 : 0.0;
      float ph = rim > 0.5 ? fm : acos(1.0 - r.x * (1.0 - cos(fm))), b = 2.0 * PI * r.y;
      float flare = 1.0 + 0.15 * pow(ph / fm, 4.0) * (1.0 - con);
      l = vec3(sin(ph) * cos(b) * flare * (1.0 - 0.25 * con), cos(ph) * (0.8 + 0.25 * con) - 0.2, sin(ph) * sin(b) * flare * (1.0 - 0.25 * con));
      sz = rim > 0.5 ? 1.4 : 0.5 + 0.8 * pow(abs(cos(4.0 * b)), 12.0);
      hu = 0.25 * ph + 0.1 * i;
    } else if (r.z < 0.72) {                              // four frilled oral arms
      float a = floor(r.x * 4.0) * 1.5708, s1 = r.y;
      float rad = 0.12 * (1.0 + 0.7 * sin(s1 * 22.0 + t)) * (0.4 + fract(r.x * 4.0));
      l = vec3(rad * cos(a + s1 * 4.0 + t * 0.4), -0.15 - s1 * 1.0, rad * sin(a + s1 * 4.0 + t * 0.4));
      sz = 0.7; hu = 0.35 + 0.2 * s1;
    } else {                                              // sixteen tentacles from the rim; the squeeze runs down them late
      float k = floor(r.x * 16.0), b = k / 16.0 * 2.0 * PI, s1 = r.y;
      float lag = fract(w - s1 * 0.35), cl = smoothstep(0.0, 0.2, lag) * (1.0 - smoothstep(0.25, 1.0, lag));
      vec3 top = vec3(sin(fm) * cos(b), cos(fm) * 0.8 - 0.2, sin(fm) * sin(b));
      l = top * vec3(1.0 - 0.3 * cl - 0.2 * s1, 1.0, 1.0 - 0.3 * cl - 0.2 * s1) + vec3(0.0, -s1 * 2.4, 0.0)
        + 0.25 * s1 * vec3(sin(6.0 * s1 - t * 1.3 + k), 0.0, cos(5.0 * s1 - t * 1.1 + 2.0 * k));
      sz = 1.1 * (1.0 - 0.5 * s1); hu = 0.55 + 0.3 * s1;
    }
    l.xy = rot2(0.2 * sin(t * 0.1 + i * 1.7)) * l.xy;
    l.yz = rot2(-0.35) * l.yz;                            // seen a little from above, so the rim is an ellipse
    sz *= smoothstep(-2.0, -1.4, y0) * smoothstep(2.4, 1.8, y0);   // in and out of view unseen where the rise wraps round
    return c + l * sj;
  }
  if (s == 53) {                                          // black hole: disc and jets tilted toward the camera; the halo and photon ring face it
    float tilt = 0.22 + 0.08 * sin(t * 0.1 + seed), flare = exp(-u_kick * 4.0);
    vec3 p;
    if (r.z < 0.55) {                                     // disc: each ring at its own orbital speed, an inflowing spiral of brightness over it
      float rad = 0.42 + 2.0 * pow(r.x, 2.2), th = 2.0 * PI * r.y + t * 1.2 * pow(rad / 0.42, -1.5);
      p = vec3(rad * cos(th), 0.015 * rad * (fract(r.z * 37.0) - 0.5), rad * sin(th));
      float arms = pow(0.5 + 0.5 * sin(2.0 * th - 6.0 * log(rad) + t * 0.5), 2.0);
      sz = (0.5 + 0.7 * arms) * (1.0 - 0.4 * cos(th)) * (1.0 + 0.6 * flare * smoothstep(1.2, 0.42, rad)); // the side coming at us is brighter
      hu = 0.35 * log(rad / 0.42) + 0.1 * arms;
    } else if (r.z < 0.85) {                              // jets along the axis, twisting wider as they go; a bright knot leaves on each kick
      float sgn = r.z < 0.7 ? 1.0 : -1.0, s1 = fract(r.x + t * 0.5), w = (0.02 + 0.1 * s1) * sqrt(r.y);
      float a2 = s1 * 20.0 - t * 3.0 + 2.0 * PI * fract(r.z * 53.0);
      p = vec3(w * cos(a2), sgn * (0.3 + 2.6 * s1), w * sin(a2));
      float knot = exp(-pow((s1 * 2.6 - u_kick * 1.5) * 4.0, 2.0));
      sz = (0.5 + 1.8 * knot) * (1.0 - 0.7 * s1);
      hu = 0.6 + 0.3 * s1;
    }
    if (r.z < 0.85) {
      p.yz = rot2(tilt) * p.yz;
      if (p.z > 0.0 && length(p.xy) < 0.34) sz = 0.0;     // behind the hole: swallowed
      return p;
    }
    if (r.z < 0.95) {                                     // the far disc seen over and under the hole, flowing round it
      float rad = 0.38 + 0.25 * pow(r.x, 1.5), th = 2.0 * PI * r.y + t * 0.6 * pow(rad / 0.38, -1.5);
      sz = 0.5 + 0.5 * (1.0 - r.x); hu = 0.3 * r.x;
      return vec3(rad * cos(th), rad * sin(th) * 0.92, 0.05);
    }
    if (r.z < 0.97) { sz = 1.2; hu = 0.0; return vec3(0.33 * cos(2.0 * PI * r.x), 0.33 * sin(2.0 * PI * r.x), 0.04); } // photon ring
    sz = fract(r.z * 71.0) < 0.1 ? 2.5 : 0.6; hu = r.y;    // stars far behind
    return vec3((r.x - 0.5) * 9.0, (r.y - 0.5) * 5.0, 3.0);
  }
  if (s == 54) {                                          // volcano: concave cone, crater 0.18 wide at the top; the crater is the origin
    float R = 1.6, cr = 0.18, heat = exp(-u_kick * 3.0);
    vec3 p;
    if (r.z < 0.45) {                                     // the mountain, gullied, glowing toward the top
      float rho = cr + (R - cr) * sqrt(r.x), ph = 2.0 * PI * r.y, f = 1.0 - (rho - cr) / (R - cr);
      p = vec3(rho * cos(ph), pow(f, 1.8) - 1.0 + 0.04 * f * sin(ph * 11.0 + 3.0 * noise(vec2(ph * 2.0, rho * 3.0), seed)), rho * sin(ph));
      sz = 0.9 + 0.6 * smoothstep(0.7, 1.0, f) * (1.0 + 0.8 * heat);
      hu = 0.6 - 0.5 * f;
    } else if (r.z < 0.55) {                              // seven lava rivers, running down and fading out at the foot
      float k = floor(r.x * 7.0), s1 = fract(r.y + t * 0.06 + k * 0.37);
      float rho = cr + s1 * (R - cr) * 0.85, f = 1.0 - (rho - cr) / (R - cr);
      float ph = k / 7.0 * 2.0 * PI + seededBy(seed, 94.0) * 6.0 + 0.12 * sin(rho * 7.0 + k * 1.3) + (fract(r.z * 41.0) - 0.5) * 0.05 / rho;
      p = vec3(rho * cos(ph), pow(f, 1.8) - 0.99, rho * sin(ph));
      sz = 1.3 * smoothstep(1.0, 0.75, s1) * smoothstep(0.0, 0.05, s1);
      hu = 0.05 + 0.2 * s1;
    } else if (r.z < 0.85) {                              // fountain: each bomb on its own flight, higher as the bass swells; all flare on the kick
      float T = 2.6, age = fract(fract(r.z * 7.0) + t / T) * T;
      float hs = 0.12 + 0.4 * r.x, vy = (0.5 + 1.1 * pow(rnd(9u, seed), 0.7)) * (1.0 + 0.3 * u_swell); // a wide spread, apart from the launch time, or the tops meet in sheets
      p = vec3(hs * cos(2.0 * PI * r.y) * age, vy * age - 0.9 * age * age, hs * sin(2.0 * PI * r.y) * age);
      sz = (0.7 + 0.9 * heat) * (1.0 - smoothstep(0.7, 1.0, age / T));
      hu = 0.1 + 0.25 * age / T;
    } else {                                              // ash billowing up and out, fading
      float T = 9.0, age = fract(fract(r.z * 7.0) + t / T) * T;
      vec2 dr = vec2(noise(vec2(r.x * 5.0, age * 0.3), seed), noise(vec2(r.y * 5.0 + 3.0, age * 0.3), seed)) - 0.5;
      p = vec3(dr.x * (0.2 + 0.5 * age), 0.3 * age, dr.y * (0.2 + 0.5 * age)) + 0.15 * jitter(r.x);
      sz = 1.4 * smoothstep(0.0, 1.0, age) * (1.0 - age / T);
      hu = 0.7 + 0.1 * r.y;
    }
    return p * 0.6 - vec3(0.0, 0.25, 0.0);
  }
  if (s == 55) {                                          // attractor: trail k is the orbit from its own start, 600 dots a quarter step apart behind the head
    float id = float(vid), k = floor(id / 600.0), j = mod(id, 600.0);
    float life = 14.0, c = t / life + k / 40.0, age = fract(c) * life;
    vec3 p = vec3(hash(vec2(k, floor(c)), seed), hash(vec2(k + 50.0, floor(c)), seed), hash(vec2(k + 99.0, floor(c)), seed)) * vec3(30.0, 30.0, 30.0) - vec3(15.0, 15.0, -10.0);
    float st = age * 25.0 - j * 0.25;                     // the step this dot sits at
    if (st < 0.0) { sz = 0.0; return vec3(0.0); }
    vec3 nx = p;
    for (int n = 0; n < 400; n++) {                       // Lorenz, Euler steps of 0.008
      p = nx;
      nx = p + 0.008 * vec3(10.0 * (p.y - p.x), p.x * (28.0 - p.z) - p.y, p.x * p.y - 2.6667 * p.z);
      if (float(n) >= floor(st)) break;
    }
    p = mix(p, nx, fract(st));
    sz = (1.0 - j / 600.0) * smoothstep(0.0, 2.0, age) * smoothstep(life, life - 2.0, age);  // fade in from the start's settling, out before the restart
    hu = k / 40.0 * 0.6 + 0.3 * j / 600.0;
    return vec3(p.x, p.z - 24.0, p.y) / 30.0;
  }
  if (s == 56) {                                          // tesseract: 70% of dots on the 32 edges, the rest faint on the 24 faces; projected from 4D by perspective
    vec4 P;
    if (r.z < 0.7) {
      int e = int(r.z / 0.7 * 32.0), d = e % 4, m = e / 4, bi = 0;
      for (int i = 0; i < 4; i++) {
        if (i == d) P[i] = r.x * 2.0 - 1.0;
        else { P[i] = ((m >> bi) & 1) == 1 ? 1.0 : -1.0; bi++; }
      }
      sz = 1.0;
    } else {
      int f = int((r.z - 0.7) / 0.3 * 24.0), pr = f % 6, m = f / 6, bi = 0;
      ivec2 dd = pr == 0 ? ivec2(0, 1) : pr == 1 ? ivec2(0, 2) : pr == 2 ? ivec2(0, 3) : pr == 3 ? ivec2(1, 2) : pr == 4 ? ivec2(1, 3) : ivec2(2, 3);
      for (int i = 0; i < 4; i++) {
        if (i == dd.x) P[i] = r.x * 2.0 - 1.0;
        else if (i == dd.y) P[i] = r.y * 2.0 - 1.0;
        else { P[i] = ((m >> bi) & 1) == 1 ? 1.0 : -1.0; bi++; }
      }
      sz = 0.35;
    }
    float bars = u_beat / 4.0, step4 = floor(bars) + smoothstep(0.0, 0.3, fract(bars));
    P.xw = rot2(0.3927 * step4 + t * 0.1) * P.xw;          // an eighth of a turn through the fourth dimension each bar
    P.yz = rot2(t * 0.13) * P.yz;
    P.zw = rot2(t * 0.07 + seed) * P.zw;
    hu = 0.15 * (P.w + 1.0);
    return P.xyz * (1.6 / (3.2 - P.w)) * 0.75;
  }
  if (s == 57) {                                          // rain: 1000 columns of 60 cells through a box; heads step down a cell at a time, cells flicker
    float id = float(vid), col = floor(id / 60.0), j = mod(id, 60.0);
    float cx = mod(col, 40.0), cz = floor(col / 40.0);
    float h1 = hash(vec2(col, 1.0), seed), h2 = hash(vec2(col, 2.0), seed);
    vec2 xz = vec2((cx + h2) / 40.0 * 6.0 - 3.0, cz / 25.0 * 3.5 - 1.0);
    float cell = 0.03, fall = u_beat * (2.0 + 4.0 * h1) + h2 * 400.0;  // cells fallen: tempo-locked, each column its own speed
    float head = 40.0 - mod(floor(fall), 110.0);            // cell index of the head, sweeping down through the view then round again
    float ci = head + j;
    float flick = hash(vec2(col * 61.0 + ci, floor(u_beat * 2.0)), seed);
    sz = j < 0.5 ? 2.0 : exp(-j / 20.0) * (0.5 + 0.8 * flick);
    hu = j < 0.5 ? 0.6 : 0.2 * j / 60.0 + 0.2 * flick;
    return vec3(xz.x, ci * cell, xz.y);
  }
  if (s == 61) {                                          // aurora: curtain k on a lattice of dots, its lower edge a slow wave; rays are noise along it
    float k = floor(r.z * 3.0), u = q.x * 2.0 - 1.0, v = q.y;
    float bottom = -0.65 + 0.3 * sin(1.7 * u + t * 0.07 + k * 2.1) + 0.12 * sin(4.3 * u - t * 0.11 + k);
    float H = 0.9 + 0.4 * sin(2.3 * u + t * 0.05 + k * 1.3);
    float ray = noise(vec2(u * 10.0 + k * 7.0, t * 0.15), seed);
    vec3 p = vec3(u * 2.6, bottom + v * H, 0.4 * k - 0.3 + 0.35 * sin(3.1 * u + t * 0.09 + k * 2.7)); // folds in depth
    sz = (0.3 + 1.4 * exp(-v * 3.0)) * (0.6 + 0.6 * ray);
    hu = 0.4 * v + 0.12 * k;
    return p;
  }
  if (s == 62) {                                          // radiolarian: outer shell 65%, inner shell 15%, twenty spines; each shell solid but for round pores, their rims bright
    vec3 d = sphereDir(r.xy);
    if (r.z < 0.8) {
      float outer = r.z < 0.65 ? 1.0 : 0.0, n = outer > 0.5 ? 48.0 : 20.0, pore = outer > 0.5 ? 0.17 : 0.24;
      float f = sphereNearest(d, n);
      float rim = smoothstep(pore, pore + 0.015, f) * (1.0 - smoothstep(pore + 0.02, pore + 0.06, f));
      sz = f < pore ? 0.0 : (outer > 0.5 ? 0.35 : 0.25) + 1.1 * rim;
      hu = 0.3 * (1.0 - outer) + 0.4 * rim;
      return d * (outer > 0.5 ? 0.85 : 0.5) * (1.0 + 0.03 * rim);   // rims stand a little proud
    }
    vec3 sp = fibSphere(floor(fract(r.z * 37.0) * 20.0), 20.0);
    float along = r.x;
    sz = 1.1 * (1.0 - 0.7 * along); hu = 0.6 + 0.2 * along;
    return sp * (0.45 + 0.95 * along) + 0.012 * (1.0 - along) * jitter(r.y); // spines taper outward
  }
  if (s == 63) {                                          // dome: equal-area lattice over a hemisphere; squiggles are coral's stripes, read in azimuth and height
    float az = (q.x - 0.5) * PI * 1.2, el = asin(q.y);   // the front of the dome only: the seam stays out of sight
    vec3 d = vec3(cos(el) * sin(az), sin(el), -cos(el) * cos(az));
    vec2 p = vec2(az * 3.0, el * 4.0) * 3.0 + seededBy(seed, 95.0) * 40.0;
    vec2 w = vec2(noise(p * 0.15 + t * 0.03, seed), noise(p * 0.15 + 7.0 - t * 0.03, seed));
    float v = 0.5 * noise(rot2(0.7) * p + w * 2.0, seed) + 0.5 * noise(rot2(2.1) * p * 1.17 + w * 2.0 + 3.7, seed);
    float squig = 1.0 - smoothstep(0.0, 0.05, abs(v - 0.5));  // the stripe's edge, so each cell is outlined in dots
    float ring = exp(-pow(fract(el * 6.0 - t * 0.04) - 0.5, 2.0) * 900.0);   // contour rings drifting up
    sz = 0.15 + 0.9 * squig + 1.0 * ring;
    hu = 0.3 * squig + 0.5 * el + 0.2 * ring;
    return d * 1.25 - vec3(0.0, 0.7, 0.0);
  }
  if (s == 64) {                                          // rose nebula: tilted disc of petals, a dust lane through it, a cluster pulsing at the core
    vec3 p;
    if (r.z < 0.55) {
      float th = 2.0 * PI * r.x, petals = 2.5 + floor(seededBy(seed, 96.0) * 2.0) * 0.5;
      float rad = 1.0 * pow(abs(cos(petals * th + t * 0.02)), 0.5) * sqrt(r.y) + 0.15 * fbm(vec2(th * 2.0, r.y * 4.0) + t * 0.03, seed);
      float y = 0.12 * (fract(r.z * 37.0) - 0.5) * (1.2 - rad);
      p = vec3(rad * cos(th), y, rad * sin(th));
      sz = (0.5 + 0.8 * (1.0 - rad)) * smoothstep(0.004, 0.02, abs(y));   // the dust lane: dark along the midplane
      hu = 0.3 * rad + 0.1 * sin(th * petals);
    } else if (r.z < 0.65) {
      p = sphereDir(r.xy) * 0.1 * pow(fract(r.z * 53.0), 0.5);
      sz = 1.5 * (1.0 + 0.4 * sin(t * 1.2)); hu = 0.0;
    } else if (r.z < 0.8) {                               // halo: each shell spreads and fades, then starts again
      float g = fract(t * 0.04 + fract(r.z * 17.0));
      p = sphereDir(r.xy) * (0.6 + 1.2 * g) * vec3(1.0, 0.45, 1.0);
      sz = 0.6 * (1.0 - g); hu = 0.6;
    } else {
      p = sphereDir(r.xy) * (1.5 + 2.0 * fract(r.z * 71.0));
      sz = fract(r.z * 29.0) < 0.08 ? 2.5 : 0.5; hu = r.y;
    }
    p.xy = rot2(0.25) * p.xy;
    return p;
  }
  if (s == 65) {                                          // ribbon: 50 rings along a bending axis, swelling in a wave and drifting down it
    float k = floor(r.z * 50.0), sp = fract(k / 50.0 + t * 0.015);
    vec3 c = vec3(0.7 * sin(2.2 * sp + t * 0.1), 0.45 * sin(3.1 * sp - t * 0.07), sp * 4.0 - 2.0);
    vec3 c2 = vec3(0.7 * sin(2.2 * (sp + 0.01) + t * 0.1), 0.45 * sin(3.1 * (sp + 0.01) - t * 0.07), (sp + 0.01) * 4.0 - 2.0);
    vec3 T = normalize(c2 - c), N = normalize(cross(T, vec3(0.0, 1.0, 0.0))), Bn = cross(T, N);
    float rad = 0.25 + 0.55 * (0.5 + 0.5 * sin(sp * 7.0 - t * 0.4));
    float a2 = floor(r.x * 90.0) / 90.0 * 2.0 * PI + k * 0.2;   // 90 even dots round each ring
    sz = 0.8 * smoothstep(0.0, 0.1, sp) * smoothstep(1.0, 0.85, sp);   // in at the far end, out before the camera
    hu = 0.6 * sp + 0.1 * rad;
    return c + rad * (cos(a2) * N + sin(a2) * Bn);
  }
  if (s == ${I('pendulums')}) {
    // Pendulum wave: 15 pendulums, each length set by a real pendulum's law (length ∝ period²) so that in 32 bars they
    // swing 20, 21 … 34 times — in step at each run's start, then a snake, braids, halves, and in step again. The bobs
    // swing toward us; the frame leans back so the swing reads as up and down. A trail shows where each bob just was.
    float N = 15.0, n = floor(r.x * N), K = 20.0;
    float x = (n / (N - 1.0)) * 2.9 - 1.45, L = 1.5 * pow(K / (K + n), 2.0), top = 1.0;
    float A = 0.42 + 0.12 * u_swell;
    vec3 p;
    hu = n / N;
    if (r.z < 0.05) { p = vec3(r.y * 3.1 - 1.55, top, 0.0); sz = 0.5; hu = 0.0; }        // the bar they hang from
    else {
      float lag = r.z > 0.78 ? (r.z - 0.78) / 0.22 : 0.0;                                   // trail: up to a beat behind
      float th = A * cos(2.0 * PI * (K + n) * (u_beat - lag) / 128.0);
      vec3 bob = vec3(x, top - L * cos(th), L * sin(th));
      if (r.z < 0.3) { p = mix(vec3(x, top, 0.0), bob, r.y); sz = 0.3; }                    // the string
      else if (r.z < 0.78) { p = bob + sphereDir(vec2(r.y, fract(r.z * 37.0))) * 0.06 * pow(fract(r.z * 91.0), 0.33); sz = 1.0; }
      else { p = bob + 0.012 * jitter(r.y); sz = 0.9 * (1.0 - lag); }
    }
    p.yz = rot2(0.75) * p.yz;
    p.y -= 0.2;
    p.xz = rot2(0.3 * sin(t * 0.05)) * p.xz;
    return p;
  }
  if (s >= ${I('orbital2p')} && s <= ${I('orbital4f')}) {
    // Hydrogen orbitals 2p, 3p, 3d z², 3d xz, 4f z³: each dot sits where the electron is likely to be found, |ψ|² — by
    // rejection, a try at a radius drawn evenly kept with chance ψ²r² over its peak. The lobes' signs, as textbooks
    // colour them, set the colour; the cloud shimmers.
    int k = s - ${I('orbital2p')};
    float R = k == 0 ? 12.0 : k == 1 ? 25.0 : k == 4 ? 34.0 : 22.0;
    float W = k == 0 ? 4.9 : k == 1 ? 263.0 : k == 2 ? 5530.0 : k == 3 ? 346.0 : 6.05e6;
    vec3 p = vec3(0.0);
    float psi = 0.0;
    sz = 0.0;
    for (int i = 0; i < 32; i++) {
      float rr = R * hop(seed, 40 + i * 4);
      vec3 x = sphereDir(vec2(hop(seed, 41 + i * 4), hop(seed, 42 + i * 4))) * rr;
      float c = x.y / max(rr, 1e-4);
      float v = k == 0 ? rr * exp(-rr / 2.0) * c : k == 1 ? rr * (6.0 - rr) * exp(-rr / 3.0) * c
              : k == 2 ? rr * rr * exp(-rr / 3.0) * (3.0 * c * c - 1.0) : k == 3 ? exp(-rr / 3.0) * x.x * x.z
              : rr * rr * rr * exp(-rr / 4.0) * (5.0 * c * c * c - 3.0 * c);
      if (hop(seed, 43 + i * 4) * W < v * v * rr * rr) { p = x / R * 2.1; psi = v; sz = 1.0; break; }
    }
    hu = (psi > 0.0 ? 0.1 : 0.6) + 0.15 * length(p);
    sz *= 0.75 + 0.25 * sin(t * 2.0 + r.x * 40.0);
    return p;
  }
  if (s == ${I('slits')}) {
    // Two-slit interference: a wave from the left meets a wall with two slits; a circular wave spreads from each, and
    // where they meet they add or cancel in bands — the dark rays are where they cancel. At the right single dots land
    // on a screen one by one, each where the two waves make it likely, and build up the same bands over 16 bars.
    float wall = -0.95, sep = 0.32, wl = 0.16, w = 2.0 * PI * u_beat;                    // one wave a beat
    float kw = 2.0 * PI / wl, G = floor(pointCount * 0.74), Wd = floor(pointCount * 0.05), id = float(vid);
    vec2 s1 = vec2(wall, sep / 2.0), s2 = vec2(wall, -sep / 2.0);
    if (id < G) {
      float cols = floor(sqrt(G * 1.8)), rows = floor(G / cols);
      vec2 c = vec2(mod(id, cols), floor(id / cols));
      vec2 p = (vec2(c.x / (cols - 1.0), c.y / (rows - 1.0)) * 2.0 - 1.0) * vec2(2.15, 1.22);
      float h = p.x < wall ? cos(kw * p.x - w)
              : (cos(kw * length(p - s1) - w) / sqrt(1.0 + 4.0 * length(p - s1)) + cos(kw * length(p - s2) - w) / sqrt(1.0 + 4.0 * length(p - s2))) * 1.1;
      sz = c.y >= rows || p.x > 1.72 ? 0.0 : 0.15 + 1.3 * max(h, 0.0);
      hu = 0.45 + 0.25 * h;
      return vec3(p, 0.0);
    }
    if (id < G + Wd) {                                                                    // the wall, open at the slits
      float y = r.y * 2.44 - 1.22;
      sz = min(abs(y - s1.y), abs(y - s2.y)) < 0.03 ? 0.0 : 0.6;
      hu = 0.9;
      return vec3(wall + 0.012 * (r.x - 0.5), y, 0.0);
    }
    float y = 0.0, L = 1.9 - wall;
    sz = 0.0;
    for (int i = 0; i < 16; i++) {
      float yy = hop(seed, 70 + i * 2) * 2.3 - 1.15;
      float r1 = length(vec2(L, yy - s1.y)), r2 = length(vec2(L, yy - s2.y));
      float I0 = 1.0 / r1 + 1.0 / r2 + 2.0 * cos(kw * (r1 - r2)) / sqrt(r1 * r2);
      if (hop(seed, 71 + i * 2) * 1.45 < I0) { y = yy; sz = 1.0; break; }
    }
    float landed = fract(u_beat / 64.0) - hop(seed, 99);                                  // its moment in this 16 bars
    sz *= landed < 0.0 ? 0.0 : 0.8 + 3.0 * exp(-landed * 128.0);                        // a flash as it lands
    hu = 0.1;
    return vec3(1.9 + 0.1 * (hop(seed, 98) - 0.5), y, 0.0);
  }
  if (s == ${I('galton')}) {
    // Galton board: balls fall through 12 rows of pegs, going left or right at each like a coin toss, and pile up in 13
    // bins as a bell curve — the binomial distribution. Over 32 bars they pour from the hopper for 22, the bins empty
    // from bar 27, and the hopper fills again. A ball's height in its bin follows its turn, so the curve grows evenly.
    float dx = 0.13, dy = 0.085, top = 0.8, binTop = top - 12.0 * dy - 0.04, bottom = -1.05;
    float c = mod(u_beat, 128.0);
    if (r.z < 0.08) {                                                                     // pegs
      float m = floor(r.x * 78.0), j = floor((sqrt(8.0 * m + 1.0) - 1.0) / 2.0), i = m - j * (j + 1.0) / 2.0;
      sz = 0.9; hu = 0.85;
      return vec3((i - j / 2.0) * dx, top - j * dy, 0.0) + 0.012 * vec3(sphereDir(r.yz).xy, 0.0);
    }
    if (r.z < 0.16) {                                                                     // bin walls and floor
      sz = 0.45; hu = 0.85;
      if (r.z < 0.145) return vec3((floor(r.x * 14.0) - 6.5) * dx, mix(binTop, bottom, r.y), 0.0);
      return vec3((r.x - 0.5) * 13.0 * dx, bottom, 0.0);
    }
    float tau = hop(seed, 60), launch = tau * 88.0, since = c - launch;
    float rights[13];
    rights[0] = 0.0;
    for (int i = 0; i < 12; i++) rights[i + 1] = rights[i] + step(0.5, hop(seed, 61 + i));
    float b = rights[12];
    vec3 p;
    sz = 0.9; hu = 0.5;
    if (since < 0.0) {                                                                    // waiting in the hopper
      float left = clamp((tau - c / 88.0) / max(1.0 - c / 88.0, 1e-3), 0.0, 1.0);
      p = vec3((hop(seed, 80) - 0.5) * (0.06 + 0.5 * left), top + 0.08 + 0.4 * left, 0.0);
      sz *= smoothstep(0.0, 2.0, c);
    } else if (since < 12.0 * 0.35) {                                                     // falling through the pegs
      float jf = since / 0.35, j = floor(jf), f = fract(jf);
      int ji = int(j);
      float x0 = (rights[ji] - j / 2.0) * dx, x1 = (rights[ji + 1] - (j + 1.0) / 2.0) * dx;
      p = vec3(mix(x0, x1, f), top - j * dy - dy * f * f + 0.03 * sin(PI * f) + 0.02, 0.0);
    } else {                                                                              // in its bin
      float comb = 1.0;
      for (int i = 0; i < 12; i++) { if (float(i) >= b) break; comb *= (12.0 - float(i)) / (float(i) + 1.0); }
      float rest = bottom + 0.015 + 0.8 * tau * comb / 924.0;
      float y = max(rest, binTop - 2.0 * (since - 4.2) * (since - 4.2) * 0.05);
      if (c > 108.0) y -= 0.02 * (c - 108.0) * (c - 108.0);
      sz *= step(-1.3, y);
      p = vec3((b - 6.0) * dx + (hop(seed, 81) - 0.5) * dx * 0.75, y, 0.0);
      hu = b / 12.0;
    }
    return p;
  }
  if (s == ${I('caustics')}) {
    // Light on a pool floor: each dot is a ray of light coming down through the rippled surface, bent by its slope —
    // Snell's law, for small slopes a shift along the gradient. Where rays bend together they crowd into the bright web
    // of a pool's floor: the caustics are where the dots bunch, not drawn on.
    // Gentle, fine waves from five directions: each bends light just enough to focus a little before the floor
    // (amplitude × wavenumber² × depth near 1), so the rays cross into a web rather than folding into sheets.
    // Each ray starts at a random spot in its lattice cell, so the lattice's rows don't read as lines.
    vec2 g = screenGrid(q) * 1.1 + (r.xy - 0.5) * vec2(4.73, 2.68) / sqrt(pointCount);
    vec2 grad = vec2(0.0);
    for (int i = 0; i < 5; i++) {
      float fi = float(i), ang = seededBy(seed, 200.0 + fi) * 2.0 * PI, kk = 14.0 + 8.0 * seededBy(seed, 210.0 + fi);
      vec2 K = kk * vec2(cos(ang), sin(ang));
      grad += 0.0008 * (1.0 + 0.3 * u_swell) * K * cos(dot(K, g) - (0.5 + 0.2 * fi) * t + seededBy(seed, 220.0 + fi) * 6.28);
    }
    sz = 0.7;
    hu = 0.35 + 6.0 * length(grad);
    return vec3(g + 4.5 * grad, 0.0);
  }
  if (s == ${I('horizon')}) {
    // A black hole as general relativity draws it: the shadow, edged by the photon ring where light circles the hole; a
    // thin disc turning by Kepler's law (the inner edge fastest), its far side lifted over the shadow and a sliver
    // under it by lensing (the point-lens equation), the side coming toward us brighter and bluer (Doppler beaming),
    // the inner edge dimmed and reddened by gravity; matter falling in slows, reddens and fades at the horizon without
    // ever being seen to cross; stars behind crowd round the Einstein ring.
    float rs = 0.16, bc = 2.598 * rs, HZ = 1.2;                          // the hole sits HZ behind the form's centre
    if (r.z < 0.05) {                                                                     // photon ring
      float a = 2.0 * PI * r.x, b = bc * (1.02 + 0.02 * r.y);
      sz = 1.3 * (0.8 + 0.2 * sin(t * 3.0 + r.x * 60.0)); hu = 0.2;
      return vec3(b * cos(a), b * sin(a), HZ);
    }
    vec3 P;
    float bright = 1.0;
    if (r.z < 0.13) {                                                                     // stars behind
      P = vec3(mod((r.x * 2.0 - 1.0) * 5.0 + 0.03 * t + 5.0, 10.0) - 5.0, (r.y * 2.0 - 1.0) * 3.0, 4.0);
      sz = fract(r.z * 997.0) < 0.1 ? 1.6 : 0.5; hu = 0.6;
    } else if (r.z < 0.25) {                                                              // matter falling in
      float st = floor(r.x * 6.0), fall = fract(t / 45.0 + st / 6.0 + 0.03 * r.y);
      float rr = rs * 1.03 + (1.5 - rs) * exp(-fall * 6.0);                               // nears the horizon, never crosses
      float ang = st * 1.05 + 4.0 * (1.0 - exp(-fall * 6.0));
      P = vec3(rr * cos(ang), 0.04 * (r.y - 0.5), rr * sin(ang));
      bright = 1.0 - rs / rr;
      sz = 1.0; hu = 0.02 + 0.1 * bright;
    } else {                                                                              // the disc
      float rr = mix(3.0 * rs, 1.5, pow(r.x, 1.6));
      float ang = 2.0 * PI * r.y + 0.9 * pow(rr / (3.0 * rs), -1.5) * t;
      P = vec3(rr * cos(ang), 0.015 * (fract(r.z * 41.0) - 0.5), rr * sin(ang));
      float toward = -cos(ang) * sqrt(rs / (2.0 * rr)) * 1.3;                           // speed toward us, over c
      bright = pow(1.0 / (1.0 - toward), 3.0) * sqrt(1.0 - rs / rr) * 0.6;
      sz = 0.9; hu = 0.12 + 0.25 * toward + 0.25 * (1.0 - rr / 1.5);
    }
    P.yz = rot2(0.12) * P.yz;                                                             // the disc seen nearly edge-on
    if (P.z > 0.0) {
      float D = P.z + 2.6 + HZ, RE2 = 2.0 * rs * P.z * (2.6 + HZ) / D;               // Einstein radius², in the hole's plane
      vec2 sp = P.xy * (2.6 + HZ) / D;
      float b = max(length(sp), 1e-4);
      bool second = fract(r.z * 53.0) > 0.85;
      float bp = (b + sqrt(b * b + 4.0 * RE2)) / 2.0;
      bright *= 1.5;                                                                      // lensing magnifies
      if (second) { bp = bc * (1.04 + 0.12 * (sqrt(b * b + 4.0 * RE2) - b) / (2.0 * sqrt(RE2))); bright *= 0.5; }
      P = vec3(sp / b * bp * (second ? -1.0 : 1.0), 0.0);
    }
    P.z += HZ;
    sz *= bright;
    return P;
  }
  if (s == ${I('plotter')}) {
    // Squares within squares on a grid, after 1960s–70s plotter art: order on the left, disorder on the right, and the
    // edge between them sweeping across and back over 32 bars — each square turned, shifted, grown and its corners
    // pulled by its own amounts, scaled by how disordered its cell is. A build scrambles them all.
    float cols = 7.0, rows = 4.0, rings = 6.0;
    float sq = floor(r.z * cols * rows * rings), cell = floor(sq / rings), ring = mod(sq, rings);
    vec2 cc = vec2(mod(cell, cols), floor(cell / cols));
    vec2 centre = (vec2((cc.x + 0.5) / cols, (cc.y + 0.5) / rows) * 2.0 - 1.0) * vec2(1.9, 1.05);
    float front = mix(-2.6, 2.6, abs(fract(u_beat / 128.0) * 2.0 - 1.0));
    float d = clamp((centre.x - front) / 1.8 + 0.5, 0.0, 1.0);
    d = max(d * d, u_tension);
    float k = sq * 17.0, e = floor(r.x * 4.0), f = fract(r.x * 4.0);
    float hs = 0.2 * (ring + 1.0) / rings * (1.0 + d * (seededBy(seed, k + 3.0) - 0.5) * 1.2);
    vec2 c0 = vec2(e == 0.0 || e == 3.0 ? -1.0 : 1.0, e < 1.5 ? -1.0 : 1.0) * hs;
    vec2 c1 = vec2(e == 2.0 || e == 3.0 ? -1.0 : 1.0, e == 0.0 || e == 3.0 ? -1.0 : 1.0) * hs;
    c0 += d * (vec2(seededBy(seed, k + 4.0 + e), seededBy(seed, k + 8.0 + e)) - 0.5) * 0.35;
    float e1 = mod(e + 1.0, 4.0);
    c1 += d * (vec2(seededBy(seed, k + 4.0 + e1), seededBy(seed, k + 8.0 + e1)) - 0.5) * 0.35;
    vec2 p = rot2(d * (seededBy(seed, k) - 0.5) * 1.6) * mix(c0, c1, f);
    p += centre + d * (vec2(seededBy(seed, k + 1.0), seededBy(seed, k + 2.0)) - 0.5) * 0.45;
    sz = 0.5;
    hu = 0.1 + 0.6 * d;
    return vec3(p, 0.0);
  }
  if (s >= 58 && s <= 60) {                               // octahedron, dodecahedron, icosahedron: dots sent out from the centre to the surface
    float edge;
    vec3 d = sphereDir(r.xy);                             // random, not the lattice: its rows bunch at the poles
    float rad = solidRay(d, s - 58, edge);
    sz = edge < 0.015 ? 2.2 : 0.55;
    hu = 0.3 * edge * 10.0;
    return d * rad * (s == 58 ? 0.5 : 0.68);
  }
  sz = fract(r.z * 29.0) < 0.06 ? 3.0 : 0.6 + 0.6 * r.z; // stars
  return sphereDir(r.xy) * (0.3 + 2.2 * sqrt(r.z)) + 0.05 * vec3(sin(t * 0.5 + r.x * 20.0), cos(t * 0.4 + r.y * 20.0), 0.0);
}
`;

// A swarm's settings as uniforms rather than constants, so one program can draw two swarms: the one showing
// and, during a morph, the one it flows out of.
const VERT = `
${SHAPE_GLSL}
${FILLS_GLSL}struct Swarm {
  float count, hold, morph, spin, kick, breathe, cloud, swirl, size, bright, hueSpeed, seed;
  float backdrop, perSat, nsat;                           // dots in the backdrop and in each copy, and how many copies: layout()
  float arrange, path;                                    // index into ARRANGEMENTS and PATHS, picked per showing: choices()
  float life, lifeStyle, rest, gather, copies, grow;      // the life cycle (lifeCycle.ts): how much is built, how, what is left and how far it has gathered, copies
  bool clockBars, stepTurn, facing;
  int nshapes;
  int shapes[${SHAPES.length}];
  vec3 pal[5];
};
uniform Swarm u_to, u_from;
uniform float u_mix;                                      // progress of a morph out of u_from; 1 = none
uniform int u_morphStyle;                                 // index into MORPH_STYLES, or ${MORPH_STYLES.length}: through nothing
out vec3 v_col;
out float v_alpha;
struct Point { vec3 p; vec3 col; float alpha; float size; float fill; float bg; }; // fill: a form that fills the screen; bg: a backdrop dot
vec3 rot(vec3 p, float yaw, float pitch) {
  p.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * p.xz;
  p.yz = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch)) * p.yz;
  return p;
}
int shapeAt(Swarm S, float step) {                        // consecutive steps never repeat a shape
  int n = S.nshapes;
  int jump = 1 + int(seededBy(S.seed, 3.0) * float(n - 1));
  return S.shapes[(int(seededBy(S.seed, 2.0) * float(n)) + int(step) * jump) % n];
}
vec3 palette(Swarm S, float g) { int i = int(g * 4.0); return mix(S.pal[i], S.pal[i + 1], fract(g * 4.0)); }
float fillAt(Swarm S, float step) { return fills(shapeAt(S, step)) ? 1.0 : 0.0; }
float total(Swarm S) { return S.backdrop + S.count + S.nsat * S.perSat; }
// The groove's path for this showing (PATHS), a dip landing on each beat: sway, figure of eight, circle, or a step.
vec2 travel(float path, float beat) {
  float B = 2.0 * PI * beat, tx = ${CONFIG.groove.travelX.toFixed(4)}, ty = ${CONFIG.groove.travelY.toFixed(4)};
  float dip = ${CONFIG.groove.dip.toFixed(4)} * (0.5 + 0.5 * cos(B));
  if (path < 0.5) return vec2(tx * sin(B / 8.0), ty * sin(B / 16.0 + 1.3) - dip);
  if (path < 1.5) return vec2(tx * sin(B / 8.0), 1.3 * ty * sin(B / 4.0) - dip);
  if (path < 2.5) return vec2(0.8 * tx * cos(B / 8.0), 1.8 * ty * sin(B / 8.0) - dip);
  return vec2(0.7 * tx * sin(B / 8.0), -2.5 * dip);
}
// Where a dot rests once its form has come apart (lifeCycle.ts REST), keyed on the dot's own index, not its role, so a
// form that comes back as copies takes its dots from where they lie.
vec3 dustAt(float id) {
  uint u = uint(id) * 3u + 1013u;
  vec3 r = vec3(float(pcg(u)), float(pcg(u + 1u)), float(pcg(u + 2u))) / 4294967296.0;
  return vec3((r.x * 2.0 - 1.0) * 2.1, (r.y * 2.0 - 1.0) * 1.2, (r.z * 2.0 - 1.0) * 0.6)
       + 0.15 * vec3(sin(u_time * 0.13 + r.y * 30.0), cos(u_time * 0.11 + r.x * 30.0), 0.0);
}
vec3 pointAt(float id, float gather) {
  uint u = uint(id) * 3u + 2029u;
  vec2 r = vec2(float(pcg(u)), float(pcg(u + 1u))) / 4294967296.0;
  return sphereDir(r) * ${CONFIG.life.pointRadius.toFixed(3)} * (1.0 + ${(CONFIG.life.gatherRadius - 1).toFixed(3)} * gather) * (1.0 + 0.5 * u_swell) * pow(float(pcg(u + 2u)) / 4294967296.0, 0.33);
}
// One particle of one swarm, turned to face the camera but not yet projected. Its index says its role (layout()):
// the backdrop first, then the lead form, then each satellite — so a morph pairs backdrop with backdrop.
Point swarm(Swarm S) {
  float sd = S.seed;
  float id = float(gl_VertexID);
  float c = (S.clockBars ? u_beat / 4.0 : u_time) / S.hold;
  float step = floor(max(c, 0.0));
  float local = fract(max(c, 0.0));
  Point o;
  if (id >= total(S)) { o.p = vec3(0.0); o.col = vec3(0.0); o.alpha = 0.0; o.size = 0.0; o.fill = 0.0; o.bg = 0.0; return o; }
  if (id < S.backdrop) {
    // Backdrop (2026-11-12): dim dots drifting slowly in a wide layer behind the form, so the black is never empty.
    // Not for a form that fills the screen. It ignores the groove and the drop: it is the room, not a dancer.
    vid = int(id);
    vec3 r = vec3(rnd(0u, sd), rnd(1u, sd), rnd(2u, sd));
    o.p = vec3((r.x * 2.0 - 1.0) * 3.3, (r.y * 2.0 - 1.0) * 1.9, 0.8 + 1.4 * r.z)
        + 0.12 * vec3(sin(u_time * 0.07 + r.y * 20.0), cos(u_time * 0.05 + r.x * 20.0), 0.0);
    o.col = palette(S, fract(0.5 * r.x + 0.3 * r.y + u_time * S.hueSpeed / 120.0));
    o.fill = mix(fillAt(S, step), fillAt(S, step + 1.0), S.nshapes < 2 ? 0.0 : smoothstep(1.0 - S.morph, 1.0, local));
    o.alpha = ${CONFIG.fullness.backdropAlpha.toFixed(3)} * S.bright * (1.0 - o.fill);
    o.size = S.size;
    o.bg = 1.0;
    return o;
  }
  float lead = id - S.backdrop, k = -1.0, roleCount = S.count;
  if (S.copies > 0.5) {
    // Copies over the screen (lifeCycle.ts): every dot but the backdrop's, shared evenly among them.
    float per = floor((total(S) - S.backdrop) / S.copies);
    k = floor(lead / per);
    if (k >= S.copies) { o.p = vec3(0.0); o.col = vec3(0.0); o.alpha = 0.0; o.size = 0.0; o.fill = 0.0; o.bg = 0.0; return o; }
    lead -= k * per;
    roleCount = per;
  } else if (lead >= S.count) { k = floor((lead - S.count) / S.perSat); lead = mod(lead - S.count, S.perSat); roleCount = S.perSat; }
  vid = int(lead);
  vec3 r = vec3(rnd(0u, sd), rnd(1u, sd), rnd(2u, sd));
  float side = floor(sqrt(roleCount));
  vec2 q = min((vec2(mod(lead, side), floor(lead / side)) + 0.5) / side, 1.0);
  float delay = rnd(3u, sd) * 0.5;                        // particles leave one by one, so the cloud flows
  // A scene of one form never flows into itself: the arc below would swing every point aside each hold.
  float m = S.nshapes < 2 ? 0.0 : smoothstep(0.0, 1.0, clamp((local - (1.0 - S.morph) - delay * S.morph) / (0.5 * S.morph), 0.0, 1.0));
  float sa = 1.0, ha = 0.5 * r.x;                         // size and colour place; a shape may set either
  pointCount = roleCount;
  vec3 a = shape(shapeAt(S, step), r, q, u_time, sd, sa, ha);
  float sb = sa, hb = ha;
  vec3 b = S.nshapes < 2 ? a : shape(shapeAt(S, step + 1.0), r, q, u_time, sd, sb, hb);
  vec3 dir = normalize(vec3(rnd(4u, sd), rnd(5u, sd), rnd(6u, sd)) - 0.5);
  vec3 p = mix(a, b, m) + sin(PI * m) * 0.35 * cross(normalize(b - a + 1e-4), dir); // arc, not a straight slide
  p += S.swirl * vec3(sin(p.y * 3.1 + u_time * 0.7), sin(p.z * 2.7 + u_time * 0.9), sin(p.x * 2.9 + u_time * 0.6));
  p += S.cloud * (0.5 - 0.5 * cos(u_time * 0.21)) * dir * rnd(7u, sd);
  // Life (lifeCycle.ts): each dot has its own moment to appear, set by the build style — along the form's line (r.x
  // runs along most forms), outward from the centre, at random out of dust, or bottom first, falling from above.
  // lp: 0 not yet there .. 1 in place. Coming apart is the same, reversed.
  float st = S.lifeStyle;
  float order = st < 0.5 ? r.x : st < 1.5 ? clamp(length(p) / 1.3, 0.0, 1.0) : st < 2.5 ? rnd(12u, sd) : clamp((p.y + 1.3) / 2.6, 0.0, 1.0);
  float lp = clamp((S.life - order * (1.0 - ${CONFIG.life.soft.toFixed(3)})) / ${CONFIG.life.soft.toFixed(3)}, 0.0, 1.0);
  float le = lp * lp * (3.0 - 2.0 * lp);
  if (st > 0.5 && st < 1.5) p *= le;
  if (st > 2.5) p.y += 2.5 * (1.0 - le) * (1.0 - le);
  vec3 sp = p;                                            // shape space, for colour that sticks to the form
  // The kick sends a ripple out from the centre rather than the whole form jumping at once; the bass swells it
  // slowly (u_swell is smoothed), not hit by hit. CONFIG.ripple: a quick rise and travel, so it lands on the kick.
  float w = u_kick - ${CONFIG.ripple.edgeS.toFixed(3)} * length(sp);
  float ripple = w > 0.0 ? smoothstep(0.0, ${CONFIG.ripple.riseS.toFixed(3)}, w) * exp(-w * 2.5) : 0.0;
  p *= 1.0 + ${CONFIG.ripple.gain.toFixed(3)} * S.kick * ripple * (0.4 + rnd(4u, sd)) + S.breathe * u_swell;
  float bars = u_beat / 4.0;
  float yaw = u_time * S.spin * 2.0 * PI / 60.0 + seededBy(sd, 4.0) * 6.2832 + u_tensionTurn // a build turns it faster
            + (S.stepTurn ? 0.5236 * (floor(bars) + smoothstep(0.0, 0.25, fract(bars))) : 0.0);
  o.p = S.facing ? p : rot(p, yaw + (S.copies > 1.5 ? k * 1.1 : 0.0), 0.35 + 0.25 * sin(u_time * 0.05 + seededBy(sd, 5.0) * 6.0));
  o.size = S.size * mix(sa, sb, m);
  float depth = smoothstep(1.6, 3.6, o.p.z + 2.6);        // 0 near, 1 far
  float g = fract(mix(ha, hb, m) + 0.3 * sp.y + 0.25 * length(sp.xz) + 0.2 * depth + u_time * S.hueSpeed / 60.0);
  o.col = palette(S, g);
  o.alpha = S.bright * (1.0 + 0.3 * ripple * S.kick);
  o.fill = mix(fillAt(S, step), S.nshapes < 2 ? fillAt(S, step) : fillAt(S, step + 1.0), m);
  o.bg = 0.0;
  // Copies of the form, arranged per showing (ARRANGEMENTS, 2026-11-12), never beside a form that fills the screen;
  // the groove moves each along this showing's path.
  float f = o.fill, A = S.arrange, lag = 0.0, mirrorSide = 1.0; // mirrorSide: -1 the lead's side of a mirror, 1 the copy's
  if (S.copies > 0.5) {
    // Copies on a grid over the screen, each a beat behind the one before and turned its own way; one alone is larger.
    float N = S.copies, cols = N < 1.5 ? 1.0 : N < 2.5 ? 2.0 : N < 3.5 ? 3.0 : N < 4.5 ? 2.0 : 3.0, rows = ceil(N / cols);
    vec2 cell = vec2(mod(k, cols), floor(k / cols));
    vec2 at = vec2(((cell.x + 0.5) / cols * 2.0 - 1.0) * 1.7, -((cell.y + 0.5) / rows * 2.0 - 1.0) * 0.9);
    float sc = N < 1.5 ? S.grow : 0.75 * min(1.7 / cols, 0.9 / rows);
    o.p = o.p * mix(sc, 1.0, f) + vec3(at * (1.0 - f), 0.0);
    lag = N < 1.5 ? 0.0 : k;
  } else if (A < 0.5) {
    if (k >= 0.0) {
      // Orbit: small copies circling the lead, bobbing a third of a bar apart, shown only while the swarm grooves.
      float orbit = 2.0 * PI * (k / S.nsat + u_beat / ${CONFIG.fullness.orbitBeats.toFixed(1)});
      o.p = o.p * ${CONFIG.fullness.satelliteScale.toFixed(3)} + vec3(${CONFIG.fullness.orbitX.toFixed(3)} * cos(orbit), ${CONFIG.fullness.orbitY.toFixed(3)} * sin(orbit) + 0.08 * u_groove * sin(2.0 * PI * (u_beat / 4.0 + k / 3.0)), 0.0);
      o.size *= 0.8;
      o.alpha *= smoothstep(0.2, 0.6, u_groove);
    }
  } else if (A < 1.5) {
    // Troupe: three forms in a line, each copy a beat behind the one before, like a dance line.
    float slot = k < 0.0 ? 0.0 : (k < 0.5 ? -1.0 : 1.0);
    lag = k + 1.0;
    o.p = o.p * mix(${CONFIG.fullness.troupeScale.toFixed(3)}, 1.0, f) + vec3(slot * ${CONFIG.fullness.troupeGap.toFixed(3)} * (1.0 - f), 0.0, 0.0);
  } else {
    // Mirror: the lead on the left and its reflection on the right, the copy dancing as the lead's mirror image.
    mirrorSide = k < 0.0 ? -1.0 : 1.0;
    o.p.x = mix(mirrorSide * (${CONFIG.fullness.mirrorGap.toFixed(3)} - o.p.x * ${CONFIG.fullness.mirrorScale.toFixed(3)}), o.p.x, f);
    o.p.yz *= mix(${CONFIG.fullness.mirrorScale.toFixed(3)}, 1.0, f);
  }
  if (k >= 0.0 && S.copies < 0.5) o.alpha *= 1.0 - f;
  vec2 tr = travel(S.path, u_beat - lag) * (S.copies > 1.5 ? 0.4 : A < 0.5 || S.copies > 0.5 ? 1.0 : 0.5);
  if (A > 1.5 && mirrorSide > 0.0 && S.copies < 0.5) tr.x = -tr.x; // the reflection dances mirror-wise
  o.p.xy += (1.0 - f) * u_groove * tr;
  // Life, after the arrangement: fade and shrink by lp, a bright edge where a line is drawing itself; dots gathering from
  // dust fly in from it, and the dots left when the form has come apart (REST) rest as dust or one glowing point.
  o.alpha *= st < 0.5 ? smoothstep(0.0, 0.5, lp) * (1.0 + 1.5 * sin(PI * lp)) : st < 1.5 ? smoothstep(0.0, 0.4, lp)
           : st < 2.5 ? smoothstep(0.0, 0.6, lp) : smoothstep(0.0, 0.25, lp);
  float pick = float(pcg(uint(gl_VertexID) * 5u + 77u)) / 4294967296.0;
  // What is left gathers through a build (S.gather): the dust thickens to every dot, the point takes more and swells.
  bool point = S.rest > 1.5, rest = (S.rest > 0.5 && !point && pick < mix(${CONFIG.life.dust.toFixed(3)}, 1.0, S.gather)) || (point && pick < mix(${CONFIG.life.point.toFixed(3)}, ${CONFIG.life.gatherPoint.toFixed(3)}, S.gather));
  if ((st > 1.5 && st < 2.5) || rest) o.p = mix(rest && point ? pointAt(id, S.gather) : dustAt(id), o.p, le);
  o.size *= mix(0.4, 1.0, rest ? max(lp, S.gather) : lp);
  if (rest) o.alpha = max(o.alpha, (point ? ${CONFIG.life.pointAlpha.toFixed(3)} : ${CONFIG.life.dustAlpha.toFixed(3)}) * S.bright * mix(1.0, ${CONFIG.life.gatherBright.toFixed(3)}, S.gather) * (1.0 - le));
  return o;
}
void main() {
  Point o = swarm(u_to);
  float mid = ${((CONFIG.life.nothing.outEnd + CONFIG.life.nothing.inStart) / 2).toFixed(3)};
  if (u_mix < 1.0 && u_morphStyle == ${MORPH_STYLES.length}) {
    // Through nothing: each swarm's life, set from the change's progress, takes the old one apart and builds the new;
    // a dot is the old swarm's until neither shows. Backdrop dots drift across from one to the other.
    Point a = swarm(u_from);
    if (a.bg > 0.5 && o.bg > 0.5) o = Point(mix(a.p, o.p, u_mix), mix(a.col, o.col, u_mix), mix(a.alpha, o.alpha, u_mix), o.size, 0.0, 1.0);
    else if (u_mix < mid) { o = a; o.alpha *= 1.0 - a.bg * u_mix / mid; }
    else o.alpha *= 1.0 - o.bg * (1.0 - (u_mix - mid) / (1.0 - mid));
  } else if (u_mix < 1.0) {                               // morph: each particle flows from the old swarm to the new
    Point a = swarm(u_from);
    float id = float(gl_VertexID);
    float m = smoothstep(0.0, 1.0, clamp((u_mix - rnd(8u, u_to.seed) * 0.5) / 0.5, 0.0, 1.0));
    if (id < total(u_from) && id < total(u_to)) {
      vec3 dir = normalize(vec3(rnd(4u, u_to.seed), rnd(5u, u_to.seed), rnd(6u, u_to.seed)) - 0.5);
      vec3 p = mix(a.p, o.p, m) + sin(PI * m) * 0.35 * cross(normalize(o.p - a.p + 1e-4), dir);
      if (u_morphStyle == 1) {
        // Pour: dots leave in order across the old form, along one seeded direction, and stream round one shared bend.
        float ang = seededBy(u_to.seed, 90.0) * 2.0 * PI;
        vec3 D = vec3(cos(ang), sin(ang), 0.0);
        float order = clamp(dot(a.p, D) * 0.35 + 0.5, 0.0, 1.0);
        m = smoothstep(0.0, 1.0, clamp((u_mix - order * 0.55) / 0.45, 0.0, 1.0));
        vec3 bend = 0.25 * (a.p + o.p) + 0.9 * vec3(-D.y, D.x, 0.0);
        p = (1.0 - m) * (1.0 - m) * a.p + 2.0 * m * (1.0 - m) * bend + m * m * o.p;
        p.xy = rot2(0.6 * sin(PI * m)) * p.xy;
      } else if (u_morphStyle == 2) {
        // Dissolve and condense: the old form melts into a soft drifting cloud, which gathers into the new one.
        vec3 cloud = sphereDir(vec2(rnd(9u, u_to.seed), rnd(10u, u_to.seed))) * 1.3 * pow(rnd(11u, u_to.seed), 0.33)
                   + 0.1 * vec3(sin(u_time * 0.7 + id * 0.01), cos(u_time * 0.6 + id * 0.013), 0.0);
        float jit = rnd(8u, u_to.seed) * 0.15;
        float out1 = smoothstep(0.0, 1.0, clamp((u_mix - jit) / 0.4, 0.0, 1.0));
        float in1 = smoothstep(0.0, 1.0, clamp((u_mix - 0.5 - jit) / 0.35, 0.0, 1.0));
        p = mix(mix(a.p, cloud, out1), o.p, in1);
        m = u_mix;
      } else if (u_morphStyle == 3) {
        // Grow from inside: the old form collapses to its centre, outer dots first, as the new grows out, inner first.
        float ra = clamp(length(a.p) / 1.2, 0.0, 1.0), ro = clamp(length(o.p) / 1.2, 0.0, 1.0);
        float shrink = smoothstep(0.0, 1.0, clamp((u_mix - (1.0 - ra) * 0.3) / 0.3, 0.0, 1.0));
        float grow = smoothstep(0.0, 1.0, clamp((u_mix - 0.4 - ro * 0.3) / 0.3, 0.0, 1.0));
        p = a.p * (1.0 - shrink) + o.p * grow;
        m = grow;
        a.alpha *= mix(1.0, 0.2, shrink * (1.0 - grow)); // dots bunched at the centre would add up to a white flash
        o.alpha *= mix(1.0, 0.2, shrink * (1.0 - grow));
      }
      o = Point(p, mix(a.col, o.col, m), mix(a.alpha, o.alpha, m), mix(a.size, o.size, m), mix(a.fill, o.fill, m), mix(a.bg, o.bg, m));
    } else if (id < total(u_from)) {                       // the old swarm had more points: these fade out
      a.alpha *= 1.0 - m;
      o = a;
    } else {
      o.alpha *= m;                                       // the new one has more: these fade in
    }
  }
  // Roll, build and drop move the whole picture, after any morph, so both swarms of a morph move as one; each form's
  // travel along its path is set in swarm(), as its copies each take their own.
  // Groove (design §6): an object form travels in slow beat-locked arcs, dipping on each beat and rolling; a form
  // that fills the screen only rolls a little and dips by scale, grown slightly so no edge shows.
  float g = u_groove, f = o.fill, B = 2.0 * PI * u_beat;
  vec2 still = o.p.xy;                                    // the backdrop keeps its place
  float roll = ${CONFIG.groove.roll.toFixed(4)} * sin(B / 4.0) * g * mix(1.0, ${CONFIG.groove.fillRoll.toFixed(4)}, f);
  o.p.xy = rot2(roll) * o.p.xy * (1.0 + f * g * (${CONFIG.groove.fillGrow.toFixed(4)} + ${CONFIG.groove.dip.toFixed(4)} * 0.3 * (0.5 + 0.5 * cos(B))));
  // A build tightens an object form and brightens any; the drop blows the picture out and lets it fall back.
  o.p.xy *= 1.0 - ${CONFIG.build.tighten.toFixed(4)} * u_tension * (1.0 - f);
  o.alpha *= 1.0 + ${CONFIG.build.brighten.toFixed(4)} * u_tension * (1.0 - o.bg);
  float burst = u_drop < ${CONFIG.burst.outS.toFixed(4)} ? smoothstep(0.0, ${CONFIG.burst.outS.toFixed(4)}, u_drop) : exp(-(u_drop - ${CONFIG.burst.outS.toFixed(4)}) * 3.0 / ${CONFIG.burst.backS.toFixed(4)});
  burst *= mix(${CONFIG.burst.small.toFixed(4)}, 1.0, u_dropSize);
  o.p.xy *= 1.0 + ${CONFIG.burst.scale.toFixed(4)} * burst;
  o.alpha *= 1.0 + ${CONFIG.burst.flash.toFixed(4)} * burst;
  o.p.xy = mix(o.p.xy, still, o.bg);
  float z = o.p.z + 2.6;                                  // camera 2.6 units back
  if (z < 0.15) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; v_alpha = 0.0; return; } // behind the camera
  float aspect = u_res.x / u_res.y;
  gl_Position = vec4(o.p.x * 2.3 / aspect, o.p.y * 2.3, 0.0, z);
  gl_PointSize = min(o.size * u_res.y / 1080.0 * 2.6 / z, 48.0);
  v_col = o.col;
  // Far side fades into haze; points about to pass the camera fade out rather than fill the screen.
  v_alpha = o.alpha * smoothstep(6.5, 1.8, z) * smoothstep(0.15, 0.7, z);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform float u_gain;
in vec3 v_col;
in float v_alpha;
out vec4 outColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float glow = (exp(-d * d * 18.0) + 0.3 * exp(-d * d * 4.0)) * max(1.0 - d, 0.0); // bright core, soft halo
  outColor = vec4(v_col * glow * v_alpha * u_gain, 1.0);
}`;

// Picked per showing, so one swarm looks different each time (2026-11-12, the user's ask: "a bit more random"). How
// its copies stand; which path its dance takes; how it morphs in — all four styles were liked on the curation page.
export const ARRANGEMENTS = ['orbit', 'troupe', 'mirror'] as const;
export type Arrangement = (typeof ARRANGEMENTS)[number];
export const PATHS = ['sway', 'figure of eight', 'circle', 'step'] as const;

/** A showing's picks, from its seed alone, so a set replays as it played. How it morphs in is the director's pick
 *  (Transition); how it builds itself and comes apart is its own (BUILD_STYLES). */
export function choices(seed: number) {
  const r = rng(Math.floor(seed * 1000) ^ 0x5eed);
  return { arrangement: ARRANGEMENTS[Math.floor(r() * ARRANGEMENTS.length)], path: Math.floor(r() * PATHS.length), build: Math.floor(r() * BUILD_STYLES.length) };
}

interface Showing { sw: Swarm; seed: number; pal: number[]; arrangement: Arrangement; path: number; build: number; fills: boolean; lc: LifeCycle }

/** A swarm's dots by role, in index order: backdrop, lead form, then each copy (CONFIG.fullness). A mirror copy has
 *  every dot of the lead, or it would not be a reflection. A swarm whose forms all fill the screen draws neither. */
export function layout(count: number, arrangement: Arrangement, fills: boolean) {
  if (fills) return { backdrop: 0, lead: count, satellites: 0, perSatellite: 0, total: count };
  const { backdrop, satellites: orbiting, satelliteShare, troupeShare, minPerSatellite } = CONFIG.fullness;
  const [satellites, perSatellite] =
    arrangement === 'orbit' ? [orbiting, Math.max(minPerSatellite, Math.round(count * satelliteShare))]
    : arrangement === 'troupe' ? [2, Math.max(minPerSatellite, Math.round(count * troupeShare))]
    : [1, count];
  return { backdrop, lead: count, satellites, perSatellite, total: backdrop + count + satellites * perSatellite };
}
const layoutOf = (s: Showing) => layout(s.sw.count, s.arrangement, s.fills);

// Swarms set up and not yet disposed, so an incoming swarm can take over the points of the one showing.
const live = new WeakMap<Scene, Showing>();

// One program for every swarm, built on first use and kept for the context's life: every swarm's source is the
// same, and building it took ~42 ms — a dropped frame or three on each scene change (2026-10-10). Its uniforms are
// shared too, so each swarm sets its own on every frame rather than trusting what the last one left.
interface Shared { prog: WebGLProgram; vao: WebGLVertexArrayObject; loc: ReturnType<typeof uniformLocations>; mix: WebGLUniformLocation | null; style: WebGLUniformLocation | null; at: Map<string, WebGLUniformLocation | null> }
const shared = new WeakMap<WebGL2RenderingContext, Shared>();

function sharedProgram(g: WebGL2RenderingContext): Shared {
  let s = shared.get(g);
  if (!s) {
    const prog = program(g, COMMON + VERT, FRAG);
    s = { prog, vao: g.createVertexArray(), loc: uniformLocations(g, prog), mix: g.getUniformLocation(prog, 'u_mix'), style: g.getUniformLocation(prog, 'u_morphStyle'), at: new Map() };
    shared.set(g, s);
  }
  return s;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function setSwarm(g: WebGL2RenderingContext, sh: Shared, name: 'u_to' | 'u_from', s: Showing, life: number, rest: number) {
  const at = (k: string) => {
    const key = `${name}.${k}`;
    if (!sh.at.has(key)) sh.at.set(key, g.getUniformLocation(sh.prog, key));
    return sh.at.get(key)!;
  };
  const { sw } = s;
  const { backdrop, perSatellite, satellites } = layoutOf(s);
  const floats = { backdrop, perSat: perSatellite, nsat: satellites, arrange: ARRANGEMENTS.indexOf(s.arrangement), path: s.path, count: sw.count, hold: sw.hold, morph: sw.morph, spin: sw.spin, kick: sw.kick, breathe: sw.breathe, cloud: sw.cloud, swirl: sw.swirl, size: sw.size, bright: sw.bright, hueSpeed: sw.hueSpeed, seed: s.seed,
    life, lifeStyle: s.lc.style, rest, gather: s.lc.gather, copies: s.lc.copies, grow: CONFIG.life.larger };
  for (const [k, v] of Object.entries(floats)) g.uniform1f(at(k), v);
  g.uniform1i(at('clockBars'), sw.clock === 'bars' ? 1 : 0);
  g.uniform1i(at('stepTurn'), sw.stepTurn ? 1 : 0);
  g.uniform1i(at('facing'), sw.facing ? 1 : 0);
  g.uniform1i(at('nshapes'), sw.shapes.length);
  const ids = sw.shapes.map((n) => SHAPES.indexOf(n));
  g.uniform1iv(at('shapes[0]'), [...ids, ...Array(SHAPES.length - ids.length).fill(0)]);
  g.uniform3fv(at('pal[0]'), s.pal);
}

export function particleScene(meta: { id: string; enabled?: boolean }, sw: Swarm, opts: SceneOpts = {}): Scene {
  let gl: WebGL2RenderingContext | null = null;
  let sh: Shared | null = null;
  let morph: { start: number; seconds: number; count: number; from: Showing; nothing: boolean; style: number } | null = null;

  const scene: Scene = {
    id: meta.id,
    source: 'original, after particles.casberry.in',
    licence: 'project',
    enabled: meta.enabled ?? true,
    forms: sw.shapes.length > 1 ? () => sw.shapes.map((n) => particleScene({ id: `${meta.id} › ${n}`, enabled: scene.enabled }, { ...sw, shapes: [n] }, opts)) : undefined,
    init(g, s) {
      gl = g;
      sh = sharedProgram(g);
      morph = null;
      const seed = shaderSeed(s);
      // Palette for this showing, closed into a loop so the drifting colour has no seam: stops a b c d a.
      const stops = PALETTES[sw.palettes[seed % sw.palettes.length | 0]];
      const picks = choices(seed);
      const fills = sw.shapes.every((n) => FILLS_SCREEN.includes(n));
      const lc = new LifeCycle(seed, picks.build, !sw.shapes.some((n) => FILLS_SCREEN.includes(n)), !fills);
      live.set(scene, { sw, seed, pal: [...stops, stops[0]].flat(), ...picks, fills, lc });
    },
    morphFrom(from, time, seconds, colour, transition) {
      const old = live.get(from);
      const showing = live.get(scene);
      if (!old || !sh || !showing) return false;
      if (colour === 'near') {
        const stops = PALETTES[nearestPalette(old.pal, sw.palettes)];
        showing.pal = [...stops, stops[0]].flat();
      }
      morph = { start: time, seconds, count: Math.max(layoutOf(old).total, layoutOf(showing).total), from: old,
                nothing: transition.kind === 'nothing', style: transition.kind === 'morph' ? transition.style : 0 };
      return true;
    },
    render(time: number, f: Features, size: RenderSize) {
      const showing = live.get(scene);
      if (!gl || !sh || !showing) return;
      gl.useProgram(sh.prog);
      gl.bindVertexArray(sh.vao);
      setUniforms(gl, sh.loc, showing.seed, time, f, size, opts);
      showing.lc.update(time, opts.deaf ? SILENT : f);
      const t = morph ? Math.min(1, Math.max(0, (time - morph.start) / morph.seconds)) : 1;
      // Through nothing: the old swarm comes apart by outEnd, its leftovers too; the new one builds from inStart.
      const N = CONFIG.life.nothing;
      setSwarm(gl, sh, 'u_to', showing, showing.lc.life * (morph?.nothing ? smooth(N.inStart, 1, t) : 1), showing.lc.rest);
      if (morph) setSwarm(gl, sh, 'u_from', morph.from, morph.from.lc.life * (morph.nothing ? 1 - smooth(0, N.outEnd, t) : 1), morph.nothing ? REST.none : morph.from.lc.rest);
      gl.uniform1f(sh.mix, t);
      gl.uniform1i(sh.style, morph?.nothing ? MORPH_STYLES.length : (morph?.style ?? 0));
      const count = morph ? morph.count : layoutOf(showing).total;
      if (t >= 1) morph = null;
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE); // additive: overlapping points glow
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
    },
    describe() {
      const s = live.get(scene);
      if (!s) return '';
      const { lc } = s;
      return `${s.arrangement}, ${PATHS[s.path]}, builds: ${BUILD_STYLES[s.build]}   life ${lc.life.toFixed(2)}`
        + `${lc.breakdown ? `  last breakdown: ${lc.breakdown}` : ''}${lc.copies === 1 ? '  larger' : lc.copies > 1 ? `  ${lc.copies} copies` : ''}`;
    },
    dispose() {
      live.delete(scene);   // the shared program stays for the next swarm
      sh = null;
    },
  };
  return scene;
}
