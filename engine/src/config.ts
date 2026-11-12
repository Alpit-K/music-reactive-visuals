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
  dark: { windowS: 120, minS: 60, enterBpm: 136, leaveBpm: 133 },
  idle: { db: -60, holdS: 3 },
  // Last 4 s against the 26 s before. In a 20-minute set, loudness +4 dB fired ~6 times and highs +6 dB ~8,
  // mostly at different moments (spike-findings §6). Provisional.
  surge: { shortS: 4, longS: 30, loudDb: 4, highsDb: 6, kickS: 2 },
  // Busyness: mean dB rise per frame over bass..highs. Over 30 s, never below 1.03 in the user's set 4 and
  // under 0.9 for ~90% of an ambient mix (spike-findings §7). Frame-to-frame, so it assumes ~60 fps.
  // minS: the window is read once this many seconds are in — at a session's start it waited 44 s (2026-10-10 set).
  interlude: { windowS: 30, minS: 10, shortS: 8, enterBelow: 0.9, holdS: 15, leaveAbove: 1.3 },
  normaliseS: 30,
  // The kick's ripple through a swarm (2026-11-12): it rose over 0.12 s and took 0.6 s to reach the edge, which read as
  // late — the engine itself hears a kick ~21 ms after it lands (analysis/latency.test.ts). Stronger too: it was too faint.
  ripple: { riseS: 0.03, edgeS: 0.35, gain: 0.9 },
  // The swarms' dance (analysis/motion.ts, 2026-11-12). Groove eases toward its level while the kick plays — two kicks
  // within 2 beats, so a lone kick in a breakdown does not start it; the drop is the first kick after 4 bars without one.
  // Tension grows from 1 bar after the kick stops to full at 16 bars, more with the highs up (a riser). Without a tempo,
  // beats and bars are counted at 128 BPM. No build before the first kick, in silence or an interlude, or past 32 bars out
  // (2026-11-12 review: idle and interludes spun and brightened as if building).
  motion: {
    level: { main: 0.6, dark: 0.85, peak: 1.0 }, grooveS: 2, playingBeats: 2, burstGapBars: 4, fallbackBpm: 128,
    tensionStartBars: 1, tensionBars: 16, tensionMaxBars: 32, highsS: 1, tensionReleaseS: 0.5, tensionTurnRate: 0.8,
  },
  // How the swarms dance with those (particleScene.ts, 2026-11-12), in shape units — the screen is about ±2.0 × ±1.13.
  // Travel takes 2 bars across and 4 up and down; the dip lands on each beat; roll swings over a bar.
  groove: { travelX: 0.45, travelY: 0.18, dip: 0.05, roll: 0.15, fillRoll: 0.25, fillGrow: 0.04 },
  build: { tighten: 0.25, brighten: 0.5 },
  burst: { scale: 2.2, outS: 0.1, backS: 1.5 }, // the drop: out in 0.1 s, back over 1.5 s
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
  swellS: 0.6, // time constant of the smoothed bass the swarms swell with (2026-10-09: raw bass made them bounce)
  director: {
    rotateBars: 64,
    minStayS: 60, // a character change waits this long after the last change, so a drop is not demoted at once
    // A breakdown changes scene only once its flag has held this long (2026-11-12: none of 71 in five sets did); the
    // drop then morphs back. A shorter one keeps the scene, which bursts on the drop (analysis/motion.ts).
    longBreakdownS: 30,
    afterDropBars: 8, // no rotation this soon after a drop
    crossfadeBeats: { character: 4, breakdown: 8, drop: 4 },
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
