// Every tuned number. Kick, BPM and peak values are the spike's starting configuration
// (docs/spike-findings.md "Starting configuration for V1"), tuned on fftSize 2048, smoothing 0.
export const CONFIG = {
  fftSize: 2048,
  kick: { windowS: 2.0, k: 1.5, rel: 0.3, refS: 60, refStepS: 0.5, gate: 1.0, refractoryS: 0.25 },
  bpm: { lo: 115, hi: 150, windowS: 10, minIntervals: 4 },
  clock: { phaseGain: 0.2, beatsPerBar: 4 },
  breakdown: { bars: 8, fallbackS: 15 }, // 2 bars caught transition gaps, fills and soft kicks (spike-findings §6)
  peak: { windowS: 60, entryS: 60, subDominanceDb: 3.16 },
  // Dark: harder and faster, as the user's sets turn later on (design §5, spike-findings §9). Median played tempo over the
  // last 120 kick-playing seconds, once 60 are in; a 60 s window let one 30 s tempo misread flicker it (10-02 replay). Provisional.
  // Dark at 136, or sooner at stepBpm above the set's opening tempo (the median of its first openingS kick-playing
  // seconds): the 2026-11-15 set climbed 126 → 135 and felt harder for its last 30 minutes, yet 136 gave it 3 minutes
  // of dark. Against the tempo logged in seven sets, +7 turns that one dark at 36:49 and leaves the relaxed 10-10 and
  // 10-17 sets main; +6 would turn 10-10 dark for 14 minutes. The same step back down (user, 2026-11-16): dark ends
  // once the tempo is stepBpm under the fastest it held while dark, and starts again stepBpm above the slowest since.
  // Never under floorBpm (a first guess): a slow opener or a slow track after a dark spell would start it in the 120s.
  dark: { windowS: 120, minS: 60, enterBpm: 136, openingS: 600, stepBpm: 7, floorBpm: 130 },
  idle: { db: -60, holdS: 3 },
  // Last 4 s against the 26 s before. In a 20-minute set, loudness +4 dB fired ~6 times and highs +6 dB ~8,
  // mostly at different moments (spike-findings §6). Provisional.
  surge: { shortS: 4, longS: 30, loudDb: 4, highsDb: 6, kickS: 2 },
  // Busyness: mean dB rise per frame over bass..highs. Over 30 s, never below 1.03 in the user's set 4 and
  // under 0.9 for ~90% of an ambient mix (spike-findings §7). Frame-to-frame, so it assumes ~60 fps.
  // minS: the window is read once this many seconds are in — at a session's start it waited 44 s (2026-10-10 set).
  interlude: { windowS: 30, minS: 10, shortS: 8, enterBelow: 0.9, holdS: 15, leaveAbove: 1.3 },
  // The second hearing (analysis/onsets.ts, tempo.ts, 2026-11-16), run beside the kick detector until a live set shows
  // it is better: every sample read on the audio thread, three bands of onsets, tempo over 60–200 BPM. First guesses,
  // set on synthetic audio and one recording (Max Cooper, Waterworks) — not yet on the user's own sets.
  ears: {
    fft: 1024, hop: 256, floorDb: -90,
    bandsHz: [[30, 150], [150, 2500], [2500, 12000]], // low, mid (snare, body), high (hats): the pulse the tempo is read from
    // The kick is heard in the sub-bass alone, from a longer window that can tell 45 Hz from 90: in the low band a
    // rolling bassline's notes passed as kicks (Waterworks: 2,476 kicks in 12 minutes of 1,548 beats, 30% on the beat).
    sub: { fft: 2048, hz: [25, 65] },
    tempo: {
      lo: 60, hi: 200, stepBpm: 0.5, windowS: 8, everyS: 0.5,
      weights: [1, 0.6, 0.3], normS: 4, // how much each band counts toward the pulse, each against its own 4 s mean
      // A true beat repeats at 2, 3 and 4 beats too; a 3/4-beat off-beat figure does not. Counted equally: weighted
      // toward the first, a two-step break read as its 6/16 kick gap (114.7 for 172).
      harmonics: [1, 1, 1, 1],
      priorBpm: 120, priorOctaves: 0.7, // a mild lean toward the middle, to choose between a tempo and its double
      leak: 0.15, minScore: 0.05,
      nearPct: 0.04, switchRatio: 1.15, switchCount: 4, // leave a tempo only for one that scores 15% better for 2 s
      // Where the beat falls is read from the sub-bass alone — with the bassline's 16ths in it the beat wandered ±35 ms
      // (Waterworks) — and only while a beat train gathers phaseContrast times the average: with no kick it runs free.
      phaseS: 4, phaseGain: 0.2, phaseContrast: 1.5,
    },
    // peakDropDb, peakFadeDbS: a kick must bring the low band within 12 dB of its recent peak, a memory that fades
    // 0.1 dB a second, judged one hop (6 ms) after the rise, when the level is in. The rise is measured in dB, so over a
    // near-empty low band — a breakdown — a snare's faint low end rises as far as a kick does (19 dB under it, on the
    // synthetic loop); and the 1.5 s threshold sinks as soon as the kick stops.
    kick: { windowS: 1.5, k: 2, minRiseDb: 3, minLevelDb: -70, peakDropDb: 12, peakFadeDbS: 0.1, refractoryS: 0.12, gridBeats: 8, gridTol: 0.15 },
  },
  normaliseS: 30,
  // The kick's ripple through a swarm (2026-11-12): it rose over 0.12 s and took 0.6 s to reach the edge, which read as
  // late — the engine itself hears a kick ~21 ms after it lands (analysis/latency.test.ts). Stronger too: it was too faint.
  ripple: { riseS: 0.03, edgeS: 0.35, gain: 0.9 },
  // The swarms' dance (analysis/motion.ts, 2026-11-12). Groove eases toward its level while the kick plays — two kicks
  // within 2 beats, so a lone kick in a breakdown does not start it; the drop is the first kick after 4 bars without one.
  // The drop's second kick sets groove to its level at once (a lone kick must not start the dance), and a kick out a whole bar lets it fall over grooveFallS (2026-11-16:
  // both eased over 2 s, and drops and breakdowns read as late).
  // Tension grows from 1 bar after the kick stops to full at 16 bars, more with the highs up (a riser). Without a tempo,
  // beats and bars are counted at 128 BPM. No build before the first kick, in silence or an interlude, or past 32 bars out
  // (2026-11-12 review: idle and interludes spun and brightened as if building).
  motion: {
    level: { main: 0.6, dark: 0.85, peak: 1.0 }, grooveS: 2, grooveFallS: 0.5, playingBeats: 2, burstGapBars: 4, dropFullBars: 16, fallbackBpm: 128,
    tensionStartBars: 1, tensionBars: 16, tensionMaxBars: 32, highsS: 1, tensionReleaseS: 0.5, tensionTurnRate: 0.8,
  },
  // How the swarms dance with those (particleScene.ts, 2026-11-12), in shape units — the screen is about ±2.0 × ±1.13.
  // Travel takes 2 bars across and 4 up and down; the dip lands on each beat; roll swings over a bar.
  groove: { travelX: 0.45, travelY: 0.18, dip: 0.05, roll: 0.15, fillRoll: 0.25, fillGrow: 0.04 },
  build: { tighten: 0.25, brighten: 0.5 },
  // The drop: out in 0.1 s, back over 1.5 s. scale was 2.2 until 2026-11-16 — measured headless, that threw most of the
  // form off the screen, so the picture stayed thin and dim for ~0.5 s after the drop kick and the drop read as late. Now
  // a smaller throw and a flash: flash is how much brighter the dots are at the top of the burst.
  // small: the share of the burst a 4-bar break's drop gets; one after 16 bars out gets it all (Features.dropSize,
  // 2026-11-16 — every drop burst alike, a fill's as hard as a long breakdown's).
  burst: { scale: 0.7, flash: 1.5, small: 0.35, outS: 0.1, backS: 1.5 },
  // Fullness (2026-11-12): a dim backdrop of dots behind object forms, and small copies of the form orbiting it while it
  // grooves, so the screen is not one shape in black. Orbits in shape units, the screen being about ±2.0 × ±1.13.
  fullness: {
    // First look, headless: satellites at 0.3 on a 1.35 × 0.62 orbit crossed the lead sphere; the backdrop at 0.25 was
    // barely visible.
    backdrop: 5000, backdropAlpha: 0.6, satellites: 3, satelliteShare: 0.15, minPerSatellite: 600, satelliteScale: 0.22,
    orbitX: 1.75, orbitY: 0.85, orbitBeats: 32,
    // Troupe: three forms in a line, copies with half the lead's dots; mirror: lead and reflection side by side.
    troupeShare: 0.5, troupeScale: 0.55, troupeGap: 1.3, mirrorScale: 0.6, mirrorGap: 1.0,
  },
  // The life cycle (scenes/lifeCycle.ts, 2026-11-13): a swarm comes apart once the kick has been out outStartBars, gone
  // outBars later — 8 bars out, as the breakdown flag (spike-findings §6: shorter gaps catch fills and blends; the user:
  // "2 bars without kick happen within the same song lot of times"), so a 4-bar break only dims it a little — and
  // builds back over backBars when the kick returns. Past maxOutBars out it is no breakdown: it builds back. A breakdown
  // within repickBars of the last keeps that one's pick (a fill kick in a breakdown). Each pick is never the last one.
  life: {
    outStartBars: 4, outBars: 4, backBars: 1, maxOutBars: 32, repickBars: 16, soft: 0.3,
    // No breakdown leaves nothing (2026-11-16: a build-up after a vanish was a black screen until the drop, set of
    // 2026-11-15). What is left gathers over gatherBars from when the form starts to come apart: dust from its share to every dot,
    // a point to gatherPoint of the dots and gatherRadius times as wide. On the drop the form is whole in dropBackS.
    breakdown: { dust: 0.4, point: 0.25, hold: 0.35 },
    gatherBars: 8, gatherPoint: 0.12, gatherRadius: 4, gatherBright: 2.5, dropBackS: 0.1,
    drop: { copies: 0.45, larger: 0.25, same: 0.3 },
    copies: [2, 3, 4, 6, 9], larger: 1.3,
    // Left when it has come apart: a quarter of the dots as drifting dust, or 4% as one glowing point.
    dust: 0.25, dustAlpha: 0.35, point: 0.04, pointAlpha: 0.5, pointRadius: 0.07,
    // Through nothing: the old swarm is gone by outEnd of the change, the new one starts at inStart.
    nothing: { outEnd: 0.3, inStart: 0.38 },
  },
  // Echo trails (render/compositor.ts, 2026-11-13, after raVe's zooming history): a swarm showing draws one of these per
  // the weights. zoomPerS: the log of how much the echo grows a second (raVe's 4% a frame at 60 fps is 2.35, frantic);
  // halfLifeS: how long it takes to fade by half. floor: taken off each frame, because stored in 8 bits a faint echo
  // dimmed by a few percent rounds back to itself and never clears. First guesses, not yet judged on the curation
  // page. live: on the wall since 2026-11-13 — the user liked it on the curation page and switched it on before the
  // 12–13 Nov changes had a live set, so that set judges both.
  echo: {
    live: true,
    weights: { off: 0.4, trail: 0.2, out: 0.2, in: 0.2 },
    styles: { trail: { zoomPerS: 0, halfLifeS: 0.15 }, out: { zoomPerS: 1.0, halfLifeS: 0.25 }, in: { zoomPerS: -0.5, halfLifeS: 0.3 } },
    floor: 1.5 / 255,
    // Turned off, the wake shrinks to nothing over this many beats: gone in one frame, an out halo read as a jump.
    releaseBeats: 2,
  },
  swellS: 0.6, // time constant of the smoothed bass the swarms swell with (2026-10-09: raw bass made them bounce)
  director: {
    rotateBars: 64,
    // A pick is drawn from this share of the pool, the least recently shown end: strictly the oldest played each pass
    // through a pool in the same order (2026-11-15: main's 15 scenes went round twice alike).
    pickFromOldest: 0.5,
    minStayS: 60, // a character change waits this long after the last change, so a drop is not demoted at once
    // A breakdown changes scene only once its flag has held this long (2026-11-12: none of 71 in five sets did); the
    // drop then morphs back. A shorter one keeps the scene, which bursts on the drop (analysis/motion.ts).
    longBreakdownS: 30,
    afterDropBars: 8, // no rotation this soon after a drop
    crossfadeBeats: { character: 4, breakdown: 8, drop: 4 },
    // A rotation or character change between two swarms picks one of these, never the one it picked last (2026-11-13:
    // "I don't want this repetitive pattern"). Morph is split evenly over MORPH_STYLES. Through nothing takes longer:
    // ~2 bars out, a breath of nothing, ~4 bars in.
    transition: { weights: { morph: 0.6, nothing: 0.3, cut: 0.1 }, nothingBeats: 24 },
    morphBeats: 8, // a change between two swarms flows the points over at least this long (user's pick on the curation page, 2026-11-12; was 16)
    rotateBeats: { breakdown: 8, main: 4, dark: 4, peak: 8, idle: 8 },
    immediateCrossfadeS: 4,
    interlude: { rotateS: 120, crossfadeS: 15, afterDropS: 30 }, // slow on purpose: the user asked for slower than 60 s (2026-10-03)
  },
  frame: { badMs: 20, badRunS: 10, scales: [1, 0.83, 0.67] },
  stream: { silentS: 10, reopenS: 5, retryS: 2, noAudioNoteS: 60 },
  flash: {
    tilesX: 8, tilesY: 6, maxFlashes: 3, windowS: 1,
    // The wall rounds to 8-bit sRGB, ~0.005 from the limiter's float record: count changes 0.01 early.
    jump: 0.1, roundingMargin: 0.01, darkMax: 0.8, redRatio: 0.8, redChroma: 0.2, minRedLum: 0.01,
    dampAlphas: [0.05, 0.0125, 0],
  },
  base: { width: 1920, height: 1080 },
  serverPort: 8765,
} as const;
