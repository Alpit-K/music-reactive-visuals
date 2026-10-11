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
  swellS: 0.6, // time constant of the smoothed bass the swarms swell with (2026-10-09: raw bass made them bounce)
  director: {
    rotateBars: 64,
    minStayS: 60, // a character change waits this long after the last change, so a drop is not demoted at once
    crossfadeBeats: { character: 4, breakdown: 8, drop: 0 }, // drop: a hard cut on the kick (2026-10-02)
    morphBeats: 16, // a change between two swarms flows the points over at least this long (2026-10-09)
    bridgeBars: 8, // a still ↔ moving change shows a moving interlude scene this long in between (user's pick on the curation page, 2026-10-10)
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
