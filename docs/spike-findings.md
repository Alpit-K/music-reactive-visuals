# Phase 0 spike findings

*Run on branch `phase-0-spike`, 2026-10-01 onwards. Tests the hypotheses in `design.md` §11.*

## Verdict

**Go to V1** (2026-10-01). The design was reopened twice during the spike and both changes are made: §7 launcher routing (spike 1) and §5 character model (spike 2). The §5 model is provisional until a second labelled set early in V1 (design §11).

- **Spike 1 — pass on both §11 hypotheses, but design §7 must change before V1.** The copy is clean master and Spotify is not silenced. Launcher step 2 assumes PC MASTER OUT follows the Mac default output live — it does not — and a BlackHole sample-rate mismatch changes the speed of master itself.
- **Spike 2 — fails as specified; design §5 revised.** A single energy score cannot separate deep / driving / peak (peak 0% correct). Only peak is visible in the audio — as sub-dominance — so the model became peak / main plus breakdown events. On the tuning set, held out block by block, it scores main 94% (deep) and 90% (driving), peak 79%. **Provisional:** one set, and a second labelled set early in V1 must confirm it (design §11).
- **Spike 3 — pass at full scale.** Shader plus Butterchurn copy at 1080p alongside rekordbox on the projector: last 10 minutes of a 31-minute soak, median p95 17.5 ms, 0 bad seconds, thermal pressure Nominal throughout. Two V1 inputs: Butterchurn stalls ~100 ms on a preset's first-ever load, and the page stopped drawing for 12–36 s three times when it lost the screen.
- **Spike 4 — pass.** rekordbox is a Link peer without Ableton Live installed, and deck tempo reaches a listener live. V3 inputs: dj-vj must never write tempo; downbeat alignment of Link phase is still untested.

## 1. Audio routing

**rekordbox + FLX4 (2026-10-01).** rekordbox 7.2.16.0342, macOS 27.0, capture page in Comet 153.0.8010.191 (Chromium-based — the user's browser, not Chrome). PC MASTER OUT behaviour may change between rekordbox releases: after an update, re-check that the copy reaches BlackHole (Output on BlackHole, PC MASTER OUT on, meter moves with deck A — reopen rekordbox if not) and that cue does not leak (deck B cued with its fader down: headphones play B, meter stays at −120 dBFS). All level checks used Spotify tracks; **local files were not tested** (design §10 row 0 names both).

| Check | Result |
|---|---|
| Baseline (Step 2) | Audio = DDJ-FLX4; speakers play deck A, headphones play cued deck B. rekordbox listed and **allowed** under Privacy & Security → Microphone throughout |
| Master Output line with PC MASTER OUT on | `DDJ-FLX4 : MASTER + BlackHole 2ch` — it names the actual target device, not a generic "computer audio device" |
| Which device the copy goes to | **The macOS default output at the moment rekordbox launches or PC MASTER OUT is switched on.** No separate picker: the Master Output dropdown only offers `… + BlackHole 2ch` and a PHONES variant |
| Follows Sound → Output live? | **No.** Switching Output to MacBook Air Speakers mid-track changed nothing — meter kept moving, laptop silent |
| Restart behaviour | Toggle **cleared itself once** on the first restart (unexplained; Microphone was already allowed). Survived the two later restarts. After one restart it bound to MacBook Air Speakers and the copy played **audibly out of the laptop**; after the next, with Output on BlackHole, it bound to BlackHole |
| Cue leak (§11 row 1) | **Pass.** Deck B cued with fader down: headphones play B, meter stays at −120 dBFS. Fader up: meter rises |
| Master knob | **Pre-knob.** FLX4 MASTER LEVEL at half: meter peak unchanged |
| Spotify (§11 row 2) | **Pass.** Every meter reading in this session came from Spotify streams |
| Workflow unchanged (Step 7) | Speakers/headphones behave as baseline with the copy on and the page running; closing the tab does not interrupt music |
| Noise floor | −120 dBFS (true digital silence), unchanged from the tone test |

**rekordbox reclocks BlackHole — two consequences:**

- rekordbox runs at 44.1 kHz (its Sample Rate preference) and switches BlackHole from 48 kHz to 44.1 kHz when it starts sending. A capture stream opened at 48 kHz **went silent with no error** and only recovered on page reload (reopened at `sampleRate 44100`). Reproduced deliberately: setting BlackHole back to 48 kHz in Audio MIDI Setup killed the meter until reload. Design §7's "BlackHole stream ends → retry" does not cover this — the stream does not end, it just delivers silence, which the engine would read as idle.
- **The copy device drives master timing.** With BlackHole at 48 kHz, master and headphones both played audibly fast (a 136 BPM track sounded ~142–143 BPM by ear; a pure 48/44.1 clock error predicts 148, so the ratio is unconfirmed) while the deck BPM readout stayed at 136. Setting BlackHole back to 44.1 kHz restored normal speed at once, no rekordbox restart. **Any BlackHole/rekordbox rate mismatch breaks the DJ-workflow invariant.**

**Other observations:**

- rekordbox maintains its own `rekordbox Aggregate Device` (current default output + DDJ-FLX4), rebuilt when the target changes. Core Audio reports it **not running** while the copy works, so rekordbox appears to open the two devices separately rather than through the aggregate. Our invariant (never route master through an aggregate *we* create) is not affected.
- Leaving PC MASTER OUT on with Output on the laptop speakers plays a second copy of the mix through the laptop at every rekordbox launch — so it was switched off after the spike.

**Design questions for closing the spike** — decided 2026-10-01, see design §7: manual PC MASTER OUT toggle each session after the launcher switches output; no switch-off reminder; BlackHole pinned to 44.1 kHz in setup, checked in pre-flight, and the engine reopens a silent stream.

1. Launcher step 2 cannot just switch the default output — the copy only re-targets at rekordbox launch or toggle. Options: launcher sets Output to BlackHole *before* rekordbox opens (and launches it), or the user toggles PC MASTER OUT after the launcher starts.
2. One-time setup step 2 ("enable PC MASTER OUT") is unsafe as a permanent setting, given the laptop-speaker copy above.
3. Pin BlackHole to rekordbox's rate (44.1 kHz) in one-time setup and check it in launcher pre-flight; decide whether the engine should also detect a stalled stream (e.g. `devicechange` or reopen on a rate mismatch).

**Capture page against BlackHole, test tones only (2026-10-01, before rekordbox):**

- BlackHole 2ch needed a Core Audio restart (`sudo killall coreaudiod`) after install before it appeared as a device.
- Chrome track settings: `echoCancellation`, `noiseSuppression`, `autoGainControl` all `false`; 48 kHz, 2 channels. `getSettings()` carries no device label — the BlackHole match is by label in `pickBlackHole`.
- **Noise floor: −120 dBFS**, all bands at the display minimum — BlackHole silence is true digital silence.
- 100 Hz and 4 kHz tones at −21.1 dBFS RMS land in the 60-150 and 2k-6k bands respectively, ≥29 dB clear of the next band; centroid 113 Hz and 4007 Hz.
- Logging: 60 rows/s, max frame interval 21 ms. A 10 s dev-server outage shows `SAVE FAILING`, then the buffered rows flush with no gap in the log.
- **Gotcha:** when the Vite dev server comes back, its client reloads the page, which silently ends logging. Never restart the dev server during a recorded run.

## 2. Energy detection

**Run (2026-10-01).** `capture-20261001074825`: 29:00 of a planned 30 minutes — the dev server ran as a background task with a 30-minute limit and was stopped mid-run; the restart reloaded the page and ended logging. 104,400 frames, median 57.5 fps, **0 gaps > 100 ms**. Mixed live in my usual style: progressive and hypnotic techno at ~125–133 BPM, long blends, filter rides and EQ bass swaps. The opening track (Pulse XVIII, Peverelist) is not a local file, so the set was at least partly streamed.

| Heard (labels, to the minute) | |
|---|---|
| 0:00–14:00 | driving (the first 3 minutes are the set's opening, labelled after the fact) |
| 14:00–19:00 | deep |
| 19:00–25:00 | peak, including a breakdown ~22:00–23:30 and a riser into the drop |
| 25:00–26:45 | deep (closing; mostly a 46 s breakdown) |
| 26:45–29:00 | peak (closing) |

What the labels mean, agreed while reviewing the data: **deep** = sparse and spacious, **driving** = continuous kick with bright tops, **peak** = weight — heavy low end, tension and release. Three characters, not three points on one scale.

### The original score failed

The four-feature score (loudness, kick density, high-band ratio, centroid; equal-weighted z-scores, 15 s smoothing): deep 83%, driving 72%, **peak 0%** — peak scored lowest of the set. Brightness and centroid are *lowest* in my peak tracks (dark, sub-heavy), so they pulled the score the wrong way; loudness differs by only ~2 dB between levels; and kick density was ~2.1/s everywhere, breakdowns included.

### Kick detection and BPM — fixed

| Problem | Cause | Fix (in `analyse.py`, design §5) |
|---|---|---|
| Kicks "detected" in breakdowns (1.97/s vs 2.15/s elsewhere) | The flux threshold adapts over 2 s, so it sinks with the bass and leftover low end beats it | Keep an onset only if the sub level ≥ its 60 s median. Result stable for a gate of 0.85–1.2× |
| Real kicks missed in bass-heavy tracks once a long reference was added | A rolling bassline in 60–150 Hz raises the reference | Detect on the **sub band (20–60 Hz) alone**: 19:30–22:00 now 2.19 kicks/s, BPM 132.5 on 100% of seconds |
| BPM panel at 78–90 for long stretches | Not the octave fold as first assumed: missed kicks make gaps alternate one and two beats, the median lands on 1.5 beats, which no fold brings into 115–150 | Fold **each interval** into range before the median; drop intervals that will not fold |

The synthetic test fixture's kick decayed to near zero between beats (peak ~20× median), which made the gate untestable. In the real log a kick's sub body is sustained — peaks only ~2–4× the minute's median, and breakdowns drop the sub 5–20× below it — so the fixture now holds the pulse for the whole beat.

**Breakdowns** (kick gaps ≥ 4 s): 2:50, 3:57, 5:41, 9:34, 10:30, 11:03, 15:28, 16:44, 18:43, 22:11–23:20, 25:14, 26:12, 26:23, 27:19, 27:56, 28:04. They line up with stretches where the 20–150 Hz level falls ≥ 10 dB below its preceding minute — **not confirmed by ear**.

### What separates the levels

Medians while the kick plays, 30 s around label changes excluded:

| Feature | deep | driving | peak |
|---|---|---|---|
| loudness (dBFS) | −22.0 | −23.1 | −20.3 |
| bass share of spectrum (dB) | 8.2 | 7.6 | 8.7 |
| brightness, 2–16 kHz share (dB) | −27.7 | −27.2 | −36.9 |
| **sub (20–60) over bass (60–150), dB** | −0.8 | −1.8 | **+4.9** (peak's p10 2.1 > deep's p90 1.7) |
| time without kick | 29% | 13% | 22% |

- **Peak is separable by sub-dominance.** Bass *share* is not — the difference is which part of the low end dominates.
- **Deep and driving are not separable.** The 29% vs 13% kick-absence gap comes from a few long breakdowns; averaged over 1–3 minutes, kick continuity is 0.82 vs 0.83, and every window tried (30–180 s) scored deep vs driving at or below chance held out. Nothing else measured separates them.
- Peak has breakdowns too (7.3 per 10 min, vs 8.9 deep, 4.3 driving), so "the kick drops out" cannot mark deep against peak.

### Filter sweeps fake peak

The opener read as peak at 1:21–2:21. With the filter partly closed (1:15–1:45) sub − bass was +6–7 dB; with it open (2:00–2:15) the same track read −3 dB. The low-pass cutoff sat low enough to cut into 60–150 Hz (150–500 Hz 8 dB down at 0:30) while leaving the sub, so the sub looked dominant. **Hypothesis** — cheapest disproving test: play the track with EQ flat and the filter centred for 60 s while capturing; it should read about −3 dB. No static spectral ratio separated the filtered opener from the dark peak tracks (e.g. 500 Hz–6 kHz vs sub: −34 dB opener, −36 to −38 dB peak, wide overlap), and I ride the filter regularly — hence the entry hold.

### Result

Held out: each labelled block scored by a threshold fitted without it; 30 s around label changes and breakdown seconds (where the breakdown event chooses the visuals) not scored. Deep and driving should read main.

| Model | deep → main | driving → main | peak | Changes (heard: 3) |
|---|---|---|---|---|
| Peak = sub-dominance over 60 kick-playing s | 94% | 68% | 79% | 8 |
| **+ 60 s entry hold (adopted)** | **94%** | **90%** | **79%** | **4** |
| + 90 s entry hold | 94% | 94% | 79% | 2 |

Fitted on the whole set (threshold 3.16 dB) peak shows at 21:09–26:32 (heard 19:00–25:00), plus a 1-second blip at 2:20. The closing peak (26:45–29:00) is never detected. 60 s was chosen over 90 s because it equals the window — picked before these numbers; 90 s scores better only in hindsight.

**Caveats.** One set. Six features were examined before sub-dominance was chosen, and the entry hold was added after seeing the opener — holding blocks out guards against fitting thresholds to the scored data but not against choosing features by looking at it. Hence the second labelled set (design §11).

**V1 port replay (2026-10-01).** The capture log replayed through the TypeScript `Analysis` (`engine/src/analysis/replay.test.ts`, run with `REPLAY=<log>`) gives peak at **21:11–26:33**, plus a 1-second blip at 2:21 — within 2 s of the spike at both ends. All **16 of 16** spike breakdowns appear, each 2–4 s later. The cause is the V1 gap rule: 2 bars, about 3.75 s at 128 BPM, timed from the last kick, against the spike's fixed 4 s. Five more breakdowns appear at 0:14, 15:59, 22:22, 22:41 and 23:24; the last three fall inside the peak's own breakdown at 22:00–23:30. Sampled every 10 s, tempo ranges **117.3–143.0 BPM**. That is within the 115–150 fold range, but wider than the 125–133 the set plays at, so the clock sometimes locks to a wrong tempo for a while. Watch for it in the second labelled set.

**Gotcha:** a background dev server must be started with a timeout longer than the run (2 h max), or it is stopped mid-recording and the restart ends logging.

## 3. Thermal headroom

**Run (2026-10-01, 14:10–15:03).** Perf page in Comet, fullscreen on the **projector at 1080p, 60 Hz**; rekordbox 7.2.16 Automix playing a Spotify playlist through the FLX4 with PC MASTER OUT → BlackHole; MacBook on mains, lid open. Room temperature not recorded — an autumn afternoon is a best case; a warm summer room runs hotter. The soak started **~3 minutes** after the third short run, not the planned 10, so it began warm — harder than planned, and it still passed.

| Run | Logged | Mean fps | p95, median of seconds |
|---|---|---|---|
| `mode=shader` | 269 s | 60.2 | 17.4 ms |
| `mode=butterchurn` | 290 s | 60.1 | 17.5 ms |
| `mode=both` | 480 s | 60.3 | 17.5 ms |

**Soak — `mode=both`, scale 1, 31 minutes** (`perf-both-1-20261001133142.jsonl`):

| Block (min) | Mean fps | p95 median | p95 max | Bad s |
|---|---|---|---|---|
| 0–5 | 60.3 | 17.6 | 17.7 | 0 |
| 5–10 | 60.3 | 17.4 | 17.7 | 0 |
| 10–15 | 60.3 | 17.6 | 18.5 | 0 |
| 15–20 | 60.4 | 18.1 | 18.6 | 0 |
| 20–25 | 60.4 | 17.4 | 18.6 | 0 |
| 25–30 | 60.4 | 17.7 | 18.7 | 0 |

`powermetrics` (thermal + gpu_power, 10 s samples, 14:31–15:03): **thermal pressure Nominal in all 190 samples.** GPU active frequency 338 → 387 → 509 MHz over the first 30 s, then ~440–520 MHz to the end (last three 517, 511, 435) — of a 1470 MHz top state, with no fall-off late in the run. GPU busy 87% of the time (median), 0.9 W median, 1.2 W max. The output wording matched the plan's greps (`Current pressure level:`, `GPU HW active frequency:`).

**Verdict: pass at scale 1.** Last 10 minutes: median p95 17.5 ms, longest bad run 0 s, pressure never above Nominal. The 83% and 67% runs were not needed. The governor held the GPU at about a third of its top clock, so there is headroom for heavier original scenes — how much is not measured.

**Butterchurn stalls on a preset's first-ever load.** Each preset change costs one frame of 50–118 ms (median 100 ms) — a visible hitch — but only the first time that preset has been shown on this machine. Presets load in a fixed order, so later runs repeat earlier ones: in the soak, **15 changes to presets already shown in an earlier run: 0 stalls; 47 changes to new presets: 37 stalls** (> 40 ms). **Hypothesis:** Chromium compiles each preset's shaders on first use and caches the result on disk. A browser update may clear that cache. Cheapest test: run `mode=butterchurn` twice in a row; the second run should show no stalls.

**Multi-second freezes when the page loses the screen.** Three times the page drew **no frames at all** for 12–36 s — 226–263 s of the shader run, 265–283 s of the Butterchurn run, 13–25 s of the soak. The first two came at the end of a run (when Esc exited fullscreen) and the page drew again for a few seconds before the tab closed; the soak one came shortly after Start, while the user was moving between the laptop screen and the projector. The user typed several times on the laptop later in the soak with no further freeze, so plain app-switching is not enough to cause it. **Hypothesis:** Chromium stops drawing a window that macOS reports as hidden or covered. Thermal is ruled out (Nominal, GPU clock normal throughout). For V1 this matters more than the frame budget: a frozen frame on the wall breaks R5. Cheapest test: in fullscreen on the projector, Cmd-Tab to rekordbox on the laptop for 30 s, then three-finger swipe between Spaces, and look for gaps in the log.

**Report blind spot.** `perf_report.py` counts rows, and a page that draws nothing writes no rows — so these freezes do not show as bad seconds, and the reported length undercounts the run. Its `frames == 0` branch can never fire. V1's frame-time watchdog must look at gaps in the frame clock, not only at slow frames.

**Observed, not measured: picture lag.** During the soak the music-reactive layer visibly trailed the music on the projector. Possible sources, all unverified: projector processing, MilkDrop presets' deliberate smoothing of bass/mid/treble, and audio buffering from rekordbox through BlackHole. Not a thermal finding; carried to design §11.

## 4. Ableton Link

**Run (2026-10-01).** rekordbox 7.2.16 in Performance mode, FLX4, macOS 27.0. Probe: `uv run spike/link_probe.py` (aalink 0.2.3), printing session state once a second. Ableton Live is **not installed** — the third-party claim that rekordbox's Link needs Live does not hold here. **Where the buttons are:** global **LINK** in the top bar, right of the mode icons (Performance layout); per-deck **LINK** in each deck header, next to KEY SYNC. No Preferences step was needed. Test track was a Spotify stream.

| Check | Result |
|---|---|
| Probe alone | `peers=0 tempo=120.00`, beat +2/s |
| rekordbox joins (global LINK on) | Probe shows `peers=1`; drops back to 0 when LINK is turned off |
| Deck LINK pressed, track at 124 BPM | **Deck tempo jumps to 120 at once — with no probe running.** A Link-enabled deck takes the session tempo, and rekordbox's own session starts at 120. Fader back to 124 sets the session to 124 |
| Probe joins **after** rekordbox (run 2) | Within 1 s: `peers=1 tempo=124.00`, beat count re-aligned to rekordbox's timeline. The probe adopts rekordbox's session; the session (and so the linked deck) stays at 124 |
| Deck tempo fader 124 → 126 → 124 | Probe follows in real time (124.07 … 125.93 → 126.01 for 12 s, then back down to 124.00) |
| Probe joins **before** rekordbox (run 1) | Probe stayed at 120 throughout; rekordbox's deck also landed on 120. **Inconclusive** — 120 is both the probe's tempo and rekordbox's own default, so this run cannot say which side won |

**Verdict: pass.** rekordbox is a Link peer on this setup, and the deck tempo reaches an outside listener live.

**Implications for V3** (not yet design decisions):

- **dj-vj must only ever read Link.** Every peer can change the shared tempo; aalink exposes a writable `tempo`. A dj-vj that sets tempo, or joins with a different tempo and wins the session, would retime the track playing — breaking the DJ-workflow invariant.
- **Pressing deck LINK mid-track jumps the deck to the session tempo.** Enabling LINK is a step in the DJ's own workflow with an audible cost, so V3's setup must say when to press it (before the first track plays, or with tempo reset afterwards).
- **Untested:** whether rekordbox's Link phase 0 falls on the track's beat-grid downbeat — the whole reason V3 uses Link (design §5, "Known limitation"). Run 2 only shows the probe aligning to rekordbox's timeline. Cheapest test: probe prints on each phase wrap; compare against rekordbox's bar counter on a track with a correct beat grid.
- **Untested:** whether a running dj-vj session at 120 wins over rekordbox when rekordbox joins second at a different tempo. Cheapest test: start the probe with `Link(100)`, then turn rekordbox LINK on with a deck at 124.

## 5. Early V1 checks

**Run (2026-10-01, 20:51–21:09)** with the launcher (`VJ.app`), Chrome 152 on the projector, rekordbox Automix through the FLX4, PC MASTER OUT → BlackHole at 44.1 kHz. Session log `logs/20261001-205113/`. Every check below ran except the preset warm-up (Step 3), which is still open.

| Check | Result | Deciding number |
|---|---|---|
| Launcher end to end (Step 1) | **Pass after a fix.** From Finder the app could not find `uv` (it lives in the Python framework's `bin`, which only `~/.zprofile` adds), so the server never started and the session ended silently after launching Chrome. Fixed in `e128b3b`: the app runs `vj.sh` as a login shell and stops with a dialog if the server does not start. Chrome then opened fullscreen on the projector with no prompt or first-run page. Master and cue on the FLX4 were not explicitly checked | Chrome window at `X = -105` landed on the projector |
| No-projector pre-flight | Pass — "No projector connected." dialog, exit 1, output unchanged | 1 screen |
| Relaunch after Cmd-Q | Pass | relaunched within 1 s (21:00:41) |
| **Same-rate PC MASTER OUT toggle** (design §11) | **Fail — hypothesis disproved.** Toggling off and on within ~2 s while BlackHole was already at 44.1 kHz left the open stream silent; `rms` sat at −120 until the page's silence reload, which recovered it. Reproduced twice | reloads at page clock 79.8 s and 110.5 s, ~10 s after each toggle |
| Crash restore (design §11) | Pass. `kill -9` of the wall's renderer: "Aw, Snap!" until the watchdog's stale-page relaunch; `kill -9` of Chrome: relaunch at once. No "Restore pages?" bubble either time | renderer 28 s (21:01:20 → 21:01:48); Chrome 1 s |
| Hidden-window freeze, with the flags (Step 2) | **Partial pass.** rekordbox use, Cmd-Tab and Spaces swipes for **~45 s** (not the planned 2 min): no gaps. Earlier in the session the page stalled once for 10.4 s (page clock 107–118 s, ~20:53), which the frame watch counted as slow seconds and stepped the render scale to 0.83; what the user was doing then was not recorded, so its cause is unknown | 0 gaps in 45 s; one unexplained 10.4 s frame |
| Preset warm-up (Step 3) | **Open.** Only one preset appeared in 393 s. Its first second held the run's only frame over 40 ms, during the Step 2 activity but when no other swipe caused one — **hypothesis:** warm-up (`loadPreset(…, 0)`) does not cover a live switch with the 4 s blend. Needs ≥3 preset entries with the laptop untouched; the two-hour soak provides them | 150.9 ms at Mandala Chasers' first second |
| Picture lag (Step 4) | Not noticeable at normal speed. The slow-motion count (1 frame at 240 fps ≈ 4 ms) is not credible — the analysis window alone is 2048 samples (46 ms) — so no number is recorded. A better reference is a visible speaker cone, not the soundtrack | — |

**Consequence of the toggle failure.** The page reloads once per silence and not again until it has heard audio, so a toggle made while that reload is spent (for example, a set that starts paused for over 10 s, then PC MASTER OUT is toggled) leaves the wall on idle drift for the rest of the night. Planned fix: while silent, reopen the BlackHole input every few seconds instead of relying on one reload.

**Fix tested 2026-10-01 (no rekordbox, no projector).** The engine now reopens the BlackHole stream in place every 5 s while silent, instead of reloading the page once. Test: headless Chrome on the real BlackHole input, the Mac output set to BlackHole, a synthetic 100 Hz tone from `afplay`. Switching BlackHole to 48 kHz silenced the open stream (`rms` −24 → −120 at page clock 21.7 s, as in §1); the first reopen came at 31.7 s and `rms` was back at 31.9 s. Switching back to 44.1 kHz silenced it again and the reopen at 82.0 s recovered it at 82.2 s. A 35 s pause of the tone gave a reopen every 5 s and sound returned on resume. No frame gaps, worst p95 16.8 ms, so reopening does not show on the wall. **The same-rate toggle itself is untested** — it needs rekordbox (design §11).

**Ordinary fullscreen instead of kiosk (2026-10-01, laptop screen, measured over the DevTools protocol).** `--start-fullscreen` alone left the page 178 px short of the screen: Chrome on Mac keeps the toolbar in fullscreen by default, and `--use-fake-ui-for-media-stream` raises a 56 px "unsupported command-line flag" warning bar, both hidden by kiosk. With `browser.show_fullscreen_toolbar: false` and a `media_stream_mic` grant for the page in the profile's `Preferences`, and the flag dropped, the page filled the window exactly as kiosk did and capture opened with no prompt — tested on a copy of the launcher's real profile. A window killed with `kill -9` relaunched fullscreen. Not checked: placement on the projector, and whether `--hide-crash-restore-bubble` hides the bubble (a bubble does not change the page size).

**On rekordbox and the projector (2026-10-02, session `logs/20261002-194307/`).** One track playing throughout, PC MASTER OUT toggled off and on twice, ~40 s apart. **Same-rate toggle: pass** — each silence recovered on the first reopen: last sound → reopen 10 s later (`stream.silentS`) → sound back 3.0 s and 2.9 s after it (page clock 36.9 → 39.9 s, 76.0 → 78.9 s), so ~13 s from toggle to a reacting wall. The wall shows the old scene for ~11 s of that before idle drift, so it looks like ~5 s. Ordinary fullscreen filled the projector with no bar (user's eye); Cmd-Q relaunched in under 1 s; quit restored the output; no frame gaps, worst p95 17.7 ms, scale 1. **Crash-restore bubble: pass** (session `logs/20261002-194536/`) — Cmd-Q is a clean quit, which never offers a restore, so the test was `kill -9` of the browser process: relaunched in 1 s (19:47:03 → 19:47:04), fullscreen, no bubble, sound on the new page from its first second.

An earlier run the same evening (`logs/20261002-193920/`) sat silent for ~100 s with reopens every 5 s; sound came back between two reopens, not after one, so the stream recovered without the guard — **hypothesis:** the deck was stopped or PC MASTER OUT left off. Not reproduced in the controlled rerun.

**Not a fault:** the wall hides the pointer (`cursor: none`); click the projector picture blind to give Chrome focus for `d` and `q`.

## 6. Live sets and director feedback (2026-10-02)

**Set 1** (`logs/20261002-185506/`, ~20.5 min live, unlabelled — the peak-model check still needs a set with written times): 85% geometric, 9% organic, 2% presets (one 26 s peak). Felt repetitive; the seed changed only colour. Fixed in `4e256ae` (presets in 33% of main picks, scene shapes from the seed).

**Set 2** (`logs/20261002-202459/`, launcher, after `4e256ae`): "looking better but changing too often". The 64-bar rotation never fired; every change came from breakdown/drop flips, and each drop picked a **new** scene.

| Moment | What the engine did | What the user wanted |
|---|---|---|
| Max Cooper "Ascent", 78.94 BPM, long tense ambient build (~20:28–20:32) | 18 changes in 3.5 min: breakdown ↔ drop every 2–26 s, character peak, so every drop picked a new preset | **One scene for the whole build** |
| Max Cooper "Swapped", 130 BPM, thumping bass, mid-track build then a big drop (~20:35–20:36) | Build: breakdown → organic cells (20:35:42). Drop: preset (20:36:12), then **1.9 s later character → main → lasers**, which held | **Something strong and powerful when the bass comes back** |

**Hypotheses (unconfirmed — the launcher does not log features):**
- 79 BPM folds to 158, outside the tracker's 115–150 range, so its intervals are rejected and the previous track's tempo stays; with a soft or intermittent kick, every ~4 s miss calls a breakdown.
- At the Swapped drop, the first kick-playing seconds after the build pulled the 60 s sub-dominance mean under 3.16 dB, and "fast out" demoted peak to main at once. Cheapest test: replay the track through the dev page with `?features=1` and read `subDominanceDb` around the drop.

**Built the same evening (design §5, §6):** breakdown needs 8 bars without a kick (15 s without a tempo); a drop lands on a preset — the one shown before the breakdown, with its seed, if there was one; a character change waits until the scene has shown 60 s. Proposals 2 (return to the pre-breakdown scene) and 4 (strong scene on the drop) merged into the drop rule. Replaying set 1's features through both rule sets: 29 → 18 scene changes, changes under 10 s apart 9 → 1, breakdown/drop pairs 10 → 3, median time on one scene 32 → 73 s. Set 2 has no features log, so the Ascent and Swapped cases are **untested** until the next live set.

**Set 3** (`logs/20261002-204512/`, after the calmer director): calm but dull. On Max Cooper "Void" (123 BPM, loud rough sections) the wall showed only rings, then hexgrid after the 64-bar rotation — no breakdown, no peak, both main picks geometric. The director had no notion of loudness or roughness. Built: main's preset share 33% → 55%; hexgrid off; two bolder geometric scenes (glitch, shards); a **surge** event (design §5) — a 4 dB lift in RMS or a 6 dB lift in the highs over the trailing median. Replayed on set 1: loudness alone gives 7 separate moments in 20 minutes, adding the highs 11 (8 dB: 10; 10 dB: 10). Thresholds provisional; and the launcher now records `features.jsonl` every session, so every set is tuning data.

**Set 4** (`logs/20261002-205947/`, 58 min, dark driving minimal techno, after `c1dfd15`; the user's live notes are in `notes.csv` there): "it all worked alright". 51 changes, median 84 s on screen; presets 86% of the time (share, drops, peaks and surges all lead to presets), geometric 9%, shards barely shown. 4 surges, each lifting geometric to a preset. Two notes of "same visual for a while" — a drop returns to the pre-breakdown preset, so one preset held 5 min across two breakdowns. 4 of 11 breakdowns lasted ≤ 3.2 s (one flash of organic between two showings of the same preset). No frame gaps, render scale 1 for the hour, last-10-min p95 17.6 ms — a good sign for the two-hour soak. Every preset entry still hitches ~50 ms. **"Slight stutter at end"** (21:57): preset *TonyMilkdrop - Leonardo Da Vinci's Balloon* — the flash limiter held up to 48 frames a second and frames ran at 33 ms; rings had the most limiter-held seconds of any scene (32). **User's verdict:** long holds felt right for this music; the drop should hit harder → the drop is now a hard cut. Dimming that preset and softening rings' kick pulse were offered and **declined** — not worth doing.

**V1 definition of done (design §2, one-hour set) — passed on set 4:**

| Criterion | Result | Evidence |
|---|---|---|
| Nobody touched the laptop after the icon, except rekordbox | Pass | User; the only other input was typing notes on the laptop, never the wall |
| Breakdowns clearly calmer than peaks | Pass | User |
| Nothing crashed or showed the desktop | Pass | No `chrome exited` for the session in `logs/launcher.log`; no frame gaps in 3498 s |
| No thermal stutter | Pass | Render scale 1 throughout; last-10-min median p95 17.6 ms |
| At least three scenes per family | Pass | Organic 3, geometric 4 (rings, lasers, glitch, shards), presets 46 |
| Master and cue unaffected | Pass | User |
| Quit restored the audio output | Pass | "output restored to MacBook Air Speakers", the pre-launch device |

**Still open:** tracks outside 115–150 BPM (slow or half-time) — widen the range or behave sensibly with no tempo.

**Preset warm-up (Step 3) fails:** in set 2, 12 of 17 preset entries had a 50–116 ms frame in their first second, with the laptop untouched — warm-up does not cover a live switch. Fewer preset switches make it rarer, not gone. Set 4 confirms it: ~50 ms at nearly every one of 32 preset entries. **Hypothesis:** Butterchurn rebuilds the preset's WebGL programs (and its equation functions) on every `loadPreset`, so the startup warm-up only warms Chrome's shader cache (first load 100+ ms, later ~50 ms). Cheapest test: time `viz.loadPreset` and the first `viz.render` after it, per preset, in headless Chrome, split into JS and GPU time. Agreed 2026-10-02: measure, report the cause and the fix size, then fix — a small fix (cache, or switch in a hidden slot) goes ahead; patching Butterchurn is discussed first.

**Hitch measured and fixed 2026-10-02 (headless Chrome, which uses the real M4 GPU through ANGLE Metal; no rekordbox, no projector).** A scratch page drove the real compositor and scenes through 32 switches per run. Its GL calls were timed, and a CPU profile was taken. **A run only matches the wall once its shaders are compiled cold.** macOS keeps compiled Metal shaders in `$(getconf DARWIN_USER_CACHE_DIR)/com.google.Chrome.helper/com.apple.metal`, which a fresh Chrome profile does not clear. So after a first run, every later run is warm and shows almost no hitch. Each run therefore added a random never-true `discard` to every fragment shader. With that, the old warm-up gave 33–117 ms at 9 of 12 first showings — the same spread as set 4. Why the live wall behaves as if its cache were cold after many sessions is **unknown**. Three costs:

| Cost | Cold measurement | Cause |
|---|---|---|
| First frame after a preset switch | median 30–33 ms with the old warm-up, 15 ms when warmed with the blend, 43 ms without warm-up | The GPU builds a pipeline for a program and its blend state at the first draw. The old warm-up loaded with blend 0, and blend 0 with 3 renders was no better. A live switch blends for 4 s, so the blended variant was built mid-set |
| First preset of the night | 76 ms in one GL call | The program in `butterchurn.ts` that copies Butterchurn's canvas onto the wall compiles on a preset scene's first `init`, which the old warm-up never called |
| First showing of a shader scene | 18–37 ms in `init`, 33–50 ms frames (set 4: preset→shader switches 33–67 ms) | Each shader scene compiles its program on `init`, and nothing warmed them |
| Every preset load, warm or cold | 5–8 ms median; ~20 ms for *cubetrace* and *alien fish pond* | Butterchurn's JS. It allocates a fresh 1M-entry `megabuf` array for the preset and for each wave and shape (`initializeEquations`, ~3 ms on average), then rebuilds and relinks both preset shaders (~3 ms of waiting on the link). A steady frame takes ~8 ms |

**Fix:** `Compositor.warmUp` runs every scene through what a live switch does — `init`, one frame, `dispose`. That means the 4 s blend for presets and their upload program. Shader scenes are warmed before idle drift shows, and presets when Butterchurn is created. Butterchurn's own `warmUp` is gone. Two cold runs on the real code: 21 of 24 preset switches at 17 ms and the rest 33 ms; 7 of 8 shader switches at 17 ms. The one exception is the session's first switch, at 50 and 67 ms (cause unknown). Startup warm-up takes ~5.5 s cold (the old one took 4.7 s).

**Not fixed — needs a Butterchurn patch, so it is the user's call:** the per-load JS above, which can still drop one frame (33 ms) when rekordbox loads the CPU. Repeat showings in set 4 hitched 33 ms, which fits. The patch would reuse compiled programs per preset and reuse the `megabufs`. Butterchurn also never deletes its replaced programs, so it leaks 2 per switch, ~100 an hour. **Live check:** the next set's `frames.jsonl` at preset entries, expected ≤ 33 ms.

## 7. Recordings analysed offline (2026-10-03)

**Tool:** `AUDIO=<file> OUT=<features.jsonl> npx vitest run src/analysis/audiofile.test.ts` runs a recording through the real `Analysis` and writes the wall's features log, ~30 s for 90 minutes. `src/audio/analyserSpectrum.ts` stands in for the AnalyserNode (Blackman window, FFT scaled by 1/N, smoothing 0). Checked against headless Chrome's own AnalyserNode on the same samples: within 0.005 dB on every bin up to 16 kHz, and the stereo down-mix matched to 3e-8. No rekordbox in the path, so absolute level differs from a live set; the character model reads ratios.

**Max Cooper, RA Live Waterworks 2025 (89 min, labelled by the user before analysis, on a 15-minute grid) — the peak-model check fails against these labels.** Held out (60 s window): deep 74%, driving 52%, peak 51% (pass is main ≥ 80%, peak ≥ 60%). With the live 3.16 dB threshold only ~15% of the 31 labelled peak minutes read peak, and 17:16–19:40 is a 2.4-minute peak inside driving. Median sub-vs-bass: driving −1.3 dB, peak −1.0 dB — no separation; the fitted threshold is −2.6 dB. **Not yet a verdict on design §5:** the labels are coarse, the mix is not the user's style, and false kicks (below) may skew sub-dominance, which is only measured while kicks play. Logs: `logs/20261003-waterworks-file/`.

**Out of Body ambient mix (150 min, all ambient by ear) — the kick detector fires on ambient music.** The engine read main 88% of the time, breakdown 9%, idle 0%, and had a BPM in every minute (115–135; octave folding turns any gaps into a plausible tempo). By ear 0:00–3:00 has barely any kicks (engine: 106/min) and 105:00–107:00 a kick every 4 s (engine: 157/min). False and real kicks both rise ~5 dB in the sub band within 0.1 s, so the relative onset test cannot tell them apart. Two causes:

| Passage | Sub band against the whole spectrum | Cause |
|---|---|---|
| 105–110 min (high "sparkles") | −24 dB (techno: −6 to −8 dB) | Ripples in a nearly empty sub band — nothing sets a floor |
| 0–3 min (long synths) | −4 dB | Swells in a full sub band; not separated by level |

Kick-interval regularity does not separate them either (105–107 is as regular as techno). **Consequence for interludes:** a "< 115 BPM" rule cannot fire, because the clock folds every tempo into 115–150; an interlude has to show as kicks absent, which needs the detector fixed first. Logs: `logs/20261003-ambient-file/` (`summary.txt` is the per-minute engine state).

**Follow-up, same day — what detects an interlude.** Scored on four logs: the user's sets 2 and 4 (hypnotic dark techno, a kick throughout by the user's account), Waterworks and the ambient mix. By ear, Waterworks 41–44 is DnB with broken drums.

| Measure | Ambient | User's set 4 | Verdict |
|---|---|---|---|
| Fade 150 ms after each "kick" | −5.5 dB | (Waterworks −4.4 dB) | Fails: false kicks fade as fast |
| Kick gaps of exactly 1 or 2 beats, per minute | ≤ 16% in 90% of minutes | under 20% of the time over 30 s for 53% of the set | Fails on the user's style |
| 2-bar beat coverage ≥ 7/8 | 0.9% of seconds | 21% of seconds | Fails |
| Pulse clarity (8 s autocorrelation of the onset envelope, 75–150 BPM), 30 s mean < 0.22 | 73% | 21% | Fails: rumbling techno smears the kick |
| **Busyness** (mean dB rise per frame, bass..highs), 30 s mean < 1.0 | 91% | 0% (min 1.03) | **Works** — used |

Kick-based measures fail because only 41–46% of detected onsets in the user's sets are one beat apart; ~20% are 3/4 of a beat apart (an off-beat element). The same onsets made **75–150 BPM read 7–20% of seconds under 100 BPM** on the user's sets (0% at 115–150), so the range stayed 115–150. Exit rule picked by simulation: the last 8 s above 1.3 left an ambient interlude 11 times in 150 min against 9 for a 30 s mean above 1.1, but ends ~7 s sooner after the beat returns. A 15 s hold removed 6–15 s blips at Waterworks 38:21, 40:12, 66:49 and 72:40.

**Wider tempo needs a better kick detector first (tested 2026-10-03).** A comb estimator — each candidate 75–150 BPM scored by the kick gaps that are 1–4 whole beats of it — read set 4 under 100 BPM 9.7% of the time (plain 75–150: 7%; 115–150: 0%). The wrong readings cluster in set 4's opening (minutes 0–2) and heavy rumble (44–47). There the detector finds ~100 onsets a minute at 138 BPM, and only 9–20% of gaps are one beat. Listening to 60–150 Hz or 20–150 Hz instead of 20–60 Hz does not help (minute 47: 13% and 17%). **Hypothesis:** six bands at 60 Hz, each frame a 46 ms window, cannot separate a kick from its own rumble. Cheapest test: record one set's master to a local file and run a time-domain transient detector on it.

**Engine replay (TypeScript, final config):** no interludes in sets 2, 3 and 4; Waterworks 58:06–58:40 and 60:31–61:29 (its kick-less gaps; the second ends 17 s after the kick returns at 61:12); the ambient mix 89% interlude with 8 exits back to main, the longest 122:05–126:07 — not yet checked by ear. *Castle in the air* was held 0% by the flash limiter on 3 min of the ambient mix in headless Chrome (chain breaker 1.6%).

## 8. House-party set — V1 acceptance (2026-10-03)

**Session `logs/20261003-191503/`**, 3 h 31 min (19:15–22:46), launched from `VJ.app`. Two DJs played back to back at a house party, mixed genres, unlabelled. Verdict: the visuals largely worked well. The run also served as the two-hour soak.

**V1 definition of done (design §2) — passed:**

| Criterion | Result | Evidence |
|---|---|---|
| Nobody touched the laptop after the icon, except rekordbox | Pass | User |
| Breakdowns clearly calmer than peaks | Pass | User; 43 breakdown events |
| Nothing crashed or showed the desktop | Pass | One `chrome started`, no `chrome exited` in `logs/launcher.log`; no frame gaps in 12,683 s |
| No thermal stutter | Pass | Render scale 1 for all 3.5 h; last-10-min median p95 17.7 ms (whole set 18.1 ms) |
| At least three scenes per family | Pass | 55 scenes shown, 47 of them presets |
| Master and cue unaffected | Pass | User |
| Quit restored the audio output | Pass | "output restored to MacBook Air Speakers", the pre-launch device |

**Screen time:** presets 74%, geometric 13%, idle 9%, organic 4%. Events: 55 rotations, 43 breakdowns, 43 drops, 10 surges, 10 interludes, 15 silences.

**Silence:** ~17 min of it in 13 stretches between 20:36 and 21:10 (longest 5.3 min), and 2 min at 21:34. **The music was genuinely off.** Every one recovered: 221 reopens, 15 `audio-returns`.

**Preset entries (the live check from §6) — pass, with the known residual.** 115 preset entries. The entry second's worst frame has a median of 33.3 ms — one dropped frame, which is the Butterchurn JS left unfixed in §6. 82 of 115 had a frame over 33 ms within 3 s of entry, against 7.8% of all live seconds. Only 12 seconds in the whole set exceeded 40 ms, all at preset entries; the worst was 66 ms (*Flexi – alien fish pond*, twice). Set 4 hitched ~50 ms at nearly every entry, so the §6 warm-up fix holds live.

**Interludes — not verified against notes.** 10 interludes, 13 min in all: 107, 17, 7, 282, 17, 101, 42, 24, 118 and 72 s, the first at 1 h 06. The user played ambient properly only once or twice. The rest were most likely breaks between songs, or an unmixed switch from techno to a chill track — music that is genuinely smooth, so the detector fired correctly, but the short spells (7–24 s) are a cut in and a hard cut out. Without timed notes the spans cannot be scored. The 15 s hold applies only on entry, so an interlude can end seconds after it starts (the 7 s one).

**Peak:** 5 spells, ~19 min in total (175, 60, 80, 752 and 61 s), the longest 1 h 55–2 h 08. Unlabelled, so no verdict on the §5 model.

## 9. rekordbox history and played tempo (2026-10-10)

*Offline, no rekordbox running. Asked to ground "position in the set" in data rather than an assumed 30 minutes.*

**Method.** A copy of rekordbox's library backup was read once, offline, with the user's approval: its play history (one entry per day, a timestamp per track) and each track's BPM, key and rekordbox's phrase **mood**. The live database is never opened, and nothing reads the library at runtime. 60 sessions of 40–100 minutes were used. No tracks are tagged, rated or coloured, so rekordbox's own analysis is all there is.

**Mood does not follow set position.** High-mood share is 72–89% in every 10-minute slot; first half against second half, 25 sessions drop and 23 rise. Mid includes the ambient interludes (79, 94 BPM), which busyness already catches.

**Tempo climbs** (track BPM, folded into 115–150 as the engine does; 60 sessions):

| Minutes in | 0–10 | 10–20 | 20–30 | 30–40 | 40–50 | 50–60 | 60–70 |
|---|---|---|---|---|---|---|---|
| Median BPM | 128 | 132 | 130 | 131.5 | 135 | 138 | 136 |
| Tracks ≥ 135 | 29% | 40% | 39% | 49% | 53% | 60% | 58% |

38 of 59 sessions are faster in their second half. Sessions differ widely: 20 of 60 open at ≥ 135, 26 never play three fast tracks running, and in the rest the first fast run starts anywhere from minute 2 to 63. Asked what "deeper/darker" means in their sets, **the user said harder and faster** — so design §5's sparse "deep" was the wrong picture of their sets, and the climb is the signal (design §5 *dark*).

**A launch clock would have been wrong.** On 2026-10-02 rekordbox's history runs continuously from 19:44, and dj-vj was launched at 20:59 — 75 minutes in. On 2026-10-09 the first track row came two minutes after launch. The two sets also share a 10-track run in the same order.

**Played tempo, 10-02 replay** (`logs/20261002-205947/features.jsonl` through the real analysis): a smooth ramp — ~130 for minutes 0–3, 132–134 to 16, 136–138 to 30, 138–139.5 to 44, then 134–139. Sync flattens the track BPMs (a 126 BPM track played at ~137). A tempo was known in every 30 s slot after the first 15 s, within 1–2 BPM, apart from occasional 30 s dips to ~120 — the 3/4-beat misreads of §7. This set is dark minimal; the rumble failure of §7 (set 4) was not seen here.

**Choosing the dark rule** (median of the clock's tempo over kick-playing seconds, simulated on the replay):

| Window | Enter / leave | Dark spans | Dark minutes of 56 |
|---|---|---|---|
| 60 s | 136 / 133 | 17:12–24:16, 25:01–51:10, 53:52–end | 36 |
| **120 s** | **136 / 133** | **17:39–52:16, 54:39–end** | **37** |
| 120 s | 137 / 134 | 20:58–51:31 | 30 |

The 60 s window let one 30 s misread drop dark for 45 s. The engine's own replay (`src/analysis/replay.test.ts`) prints dark 17:39–35:05, 36:34–52:38 and 54:27–end, with peak 35:05–36:34 outranking it.

**Deferred (tier B):** polling the live `master.db` for the current track, to read its mood, key or phrases during a set. A third-party app does it on rekordbox 5–6 only; whether the history row is written at load or at play is unknown; two-deck blends need the FLX4 MIDI to know which deck is live (design Phase 2); and the phrase map cannot be lined up without the play position. Key (mostly minor in the user's sets) is parked with it.

## Starting configuration for V1

From `spike/logs/capture-20261001074825.config.json` and the `analyse.py` defaults (design §5):

```json
{
  "kick": { "band_hz": [20, 60], "flux_window_s": 2.0, "k": 1.5, "rel": 0.3,
            "gate_ref_s": 60, "gate": 1.0, "refractory_s": 0.25 },
  "bpm": { "range": [115, 150], "window_s": 10 },
  "breakdown_gap_s": 4.0,
  "peak": { "window_s": 60, "entry_s": 60, "sub_dominance_db": 3.16 }
}
```
