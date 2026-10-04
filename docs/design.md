# dj-vj — Design

Automatic, music-reactive visuals for home DJ sessions, projected on the wall while playing rekordbox on a DDJ-FLX4.

*Agreed 30 September 2026. Supersedes an earlier brainstorm brief, which was written without knowledge of how the sessions actually run.*

---

## 1. Purpose

The projector currently shows pre-recorded YouTube loops that ignore the music. This project replaces them with visuals that follow what is playing — pulsing with the beat, calming in breakdowns, opening up at drops — without anyone touching the laptop during a set.

The longer-term aim is creative: start with a curated look, then grow into visual scenes of my own, written as code, in the direction of Max Cooper's work.

### Where it runs

| Situation | What it demands |
|---|---|
| Solo sessions at home | Can tolerate tinkering; this is also where new scenes get tried |
| Back-to-back with another DJ at home | Always on my Mac, rekordbox and FLX4 — so one capture point covers every DJ |
| A house party at home | Fully hands-off; must never show the desktop, flash dangerously or need rescuing |

Portability to other venues is **out of scope**.

### Hardware and software (inventoried 2026-09-30)

| Item | Detail | Design consequence |
|---|---|---|
| Laptop | MacBook Air M4, 10-core, 16 GB, macOS 27.0 | **Fanless** — sustained GPU load throttles. Rendering must be light and self-governing |
| DJ software | rekordbox 7.2.16 | Stays untouched; visuals only listen to a copy of its master output |
| Controller | Pioneer DDJ-FLX4 | Remains rekordbox's audio device for master and headphone cue |
| Projector | 1080p, HDMI via adapter, ~55-inch image on a wall | 1080p is the ceiling; 720p upscaled is acceptable |
| Music | Spotify inside rekordbox, or downloaded files — **every set so far is streamed** (2026-10-03) | Must work fully offline with downloaded files. A real set cannot be recorded (§8) or analysed per track in advance: there is no local file |
| Installed | Google Chrome, Node 24, Python 3.14, uv, ffmpeg, BlackHole 2ch (2026-10-01) | — |

### Musical context

Progressive, hypnotic and driving techno, plus house. Long blends, controlled energy shifts, restraint, narrative sets, minimal vocals. Tempo typically 120–135 BPM, four-on-the-floor — which is what makes audio-only beat and energy detection viable in V1.

---

## 2. Requirements

### Behaviour

| # | Requirement | Version |
|---|---|---|
| R1 | Visuals pulse with the beat (kicks, bass, hats) | V1 |
| R2 | Visuals track the energy arc: breakdowns calm and sparse, drives tighter, peaks open up | V1 |
| R3 | Visual family is chosen by what the audio can show (§5) — psychedelic liquid for sustained heavy peaks, organic/mathematical for breakdowns, geometric light for everything else, with over half of it given to psychedelic presets, and only presets during a surge (2026-10-02: geometric scenes alone made live sets repetitive) | V1 |
| R4 | Within a family, the scene changes every 64 bars (~2 minutes), on a bar boundary, with a crossfade | V1 |
| R5 | Silence shows a slow ambient drift scene, never a frozen frame or the desktop | V1 |
| R6 | Fully automatic — no controls during a set; the only key is quit | V1 |
| R7 | One icon starts a session: checks, audio routing, fullscreen on the projector | V1 |
| R8 | Full-screen flashes capped at about 3 per second; no sustained strobe | V1 |
| R9 | Sets can be recorded and rendered to video afterwards | V1.1 |
| R10 | A newly loaded track brings a new scene once it becomes audible — once per track, so a long blend does not fire twice | V2 |
| R11 | Scene changes land on true bars and phrases | V3 |

### Constraints

- **£0 software, no new hardware.**
- **The DJ workflow is sacrosanct.** Master output, headphone cue, cue/master mix and every controller function must behave exactly as they do today. The visual system only ever listens to a *copy* of the master mix. If it crashes, the music continues.
- **Offline-capable** with downloaded tracks. Spotify is supported where capture works, not required.
- The drum machine and DJ Set Architect are **out of scope** — neither is a dependency, and the drum machine's audio not appearing in the visuals is acceptable.

### V1 definition of done

A one-hour set (the user's real set length — changed from two hours on 2026-10-02) in which nobody touches the laptop after clicking the icon; breakdowns are clearly calmer than peaks; nothing crashes or shows the desktop; the Air never stutters from thermal throttling; at least three scenes per family; master and headphone cue unaffected throughout; and quitting leaves the Mac's audio exactly as it was before launch.

---

## 3. Approach and rejected alternatives

**Chosen: a browser engine.** A local web app running fullscreen in a dedicated Chrome window on the projector, analysing BlackHole audio with the Web Audio API and drawing scenes with WebGL2 shaders. The psychedelic family is provided by Butterchurn (MIT-licensed WebGL port of MilkDrop, which accepts any Web Audio node and blends presets with a configurable duration).

Why: fastest loop for writing scenes (save a file, see it on the wall), all three visual families available from day one, and the same scene code serves both live playback and after-set video rendering.

**Butterchurn is effectively unmaintained** — the latest stable release (2.6.7) dates from March 2019; a 3.0 beta line has had one release since 2021 (July 2025). Pin the exact version. If a Chrome or WebGL change breaks it, the peak family loses its only source — at runtime it falls back to idle drift (§7) until original psychedelic scenes exist.

| Alternative | Why not |
|---|---|
| **Native Python** (aubio + moderngl) | Better beat tracking and an easy Ableton Link path, but no Butterchurn — the psychedelic family would need writing from scratch or fragile projectM bindings — and slower visual iteration. Held in reserve: if browser analysis proves too crude, analysis alone moves into a Python helper and the rest of the design stands |
| **projectM with a wrapper** | Fails the "own scenes as code" goal — MilkDrop preset language is obscure — and energy-based preset choice would mean driving the library API, not the app. The packaged macOS build also cannot capture local application audio (projectMSDL 2.0 pre-release notes), so BlackHole is needed regardless |

---

## 4. Architecture

```
rekordbox ──► DDJ-FLX4 (speakers + headphones, unchanged)
    └─ PC MASTER OUT ──► BlackHole 2ch
                              │
          Chrome, fullscreen on projector (localhost page)
          ┌───────────────────┴────────────────────────┐
          │ capture ──► analysis ──► clock              │
          │                 │          │                │
          │                 ▼          ▼                │
          │              director ──► compositor ──► canvas
          │                 │          ▲                │
          │                 │       scenes/             │
          │                 ▼                           │
          │              recorder (audio + scene log)   │
          └─────────────────────────────────────────────┘
launcher (one icon): pre-flight checks → local server → Chrome on projector
```

### Units

| Unit | Responsibility | Interface |
|---|---|---|
| **capture** | Find the BlackHole input by device label and open it | Emits one `MediaStream` / `AudioNode` |
| **analysis** | Per-frame features, the character and breakdown events (§5) | `Features` object each frame |
| **clock** | Beat, bar and 64-bar counters. V1 derives them from kicks; V3 swaps in Ableton Link behind the same interface | `{bpm, beat, bar, beatPhase}` |
| **director** | Chooses which scene is shown and when to change (§6); logs every decision | "Show scene X, crossfade over N beats" |
| **scenes/** | One module per scene (§6) | `init`, `render`, `dispose` |
| **compositor** | Renders outgoing and incoming scenes, crossfades, applies the flash limiter and render scale | Final frame to canvas |
| **recorder** | Streams mix audio and the scene log to the server (V1.1) | Files under `recordings/` |
| **server** | Python standard-library HTTP server: serves the built page, receives log and recording chunks, exposes `/quit` | Local HTTP |
| **launcher** | Shell script wrapped as a macOS app icon (§7) | One click |

### Stack

- TypeScript, Vite for development (hot reload onto the wall), built static files for sessions.
- WebGL2 with a small shared helper; **no 3D library in V1**. Tunnels and wireframes are achievable in shaders; a library is added only when a scene genuinely needs one.
- Vitest for automated tests.
- A local server is required because Chrome only allows microphone/audio-input capture on secure origins; `localhost` counts, `file://` does not.

---

## 5. Audio analysis and the character model

*Revised 2026-10-01 after spike 2 (`spike-findings.md` §2): a single energy score could not separate deep / driving / peak. Everything below was tuned on one 29-minute set of my own (`spike/analyse.py` is the reference implementation to port).*

### Fast features (every frame)

- **Bands** from the analyser's FFT: sub (~20–60 Hz), bass (~60–150 Hz), mids (~150 Hz–2 kHz), highs (~2 kHz+). Sub and bass must stay separate — peak detection is their ratio.
- **Automatic gain:** each band is normalised against its own rolling range over ~30 seconds. Visuals then behave the same for loud and quiet masters (spike 1: the copy is taken after the channel faders but before the master knob). It feeds the visuals only — the character model uses band *ratios*, which read the same at any playing level.
- **Kick onset:** a spike in **sub-band** flux above an adaptive threshold (trailing 2 s), kept only if the sub level is at least its median over the last 60 s. The sub band alone, because a rolling bassline in 60–150 Hz hid real kicks; the 60 s gate, because a 2 s threshold sinks with the bass in a breakdown and leftover low end kept counting as kicks.

### Beat clock (V1)

- Tempo from inter-kick intervals: **each interval is folded by octaves into 115–150 BPM before taking the median**, and intervals that will not fold into range are dropped. Folding the median instead fails on missed kicks — alternating one- and two-beat gaps give a 1.5-beat median (85 BPM at 128) that no octave fold reaches.
- Phase follows each detected kick with a small correction (a simple phase-locked loop).
- **Known limitation:** V1 counts four-beat groups from wherever it locked on, not from the true downbeat. Its "bar lines" can be one to three beats off, so a change may land mid-phrase. Crossfades of four or more beats mask most of this. V3 fixes it with Ableton Link.

### Character

My levels are three characters, not points on one scale: **deep** is sparse and spacious, **driving** is a continuous kick with bright tops, **peak** is weight — a heavy low end and tension-and-release. Only peak is visible in the audio, so the model outputs two characters plus events:

| Output | Signature | Family |
|---|---|---|
| **peak** | Sub dominates bass (20–60 Hz over 60–150 Hz) while the kick plays | Psychedelic liquid |
| **main** | Everything else with a kick | Geometric light, 55% of picks psychedelic |
| **breakdown** (event) | Kicks absent for 8 bars | Organic / mathematical |
| **surge** (event) | Over the last 4 s against the median of the 26 s before, loudness up 4 dB **or** highs (2–16 kHz) up 6 dB, with a kick in the last 2 s — the only decision that hears above the bass | A preset, if geometric is showing in main |
| **idle** (event) | Near-silence for 3 seconds | Idle drift |
| **interlude** (event) | Smooth sound: 30 s busyness under 0.9 and the last 8 s too, held 15 s; ends when the last 8 s go above 1.3. Busyness is the mean dB rise per frame over bass, mids and highs (silent seconds left out) | The interlude pool (§6) |

| Rule | Detail | Why |
|---|---|---|
| Measured only while the kick plays | Sub-dominance is the mean of sub/bass (dB) over the last 60 kick-playing seconds; it holds its value through breakdowns | Peak has breakdowns of its own (22:00–23:30 in the tuning set); averaging them in made the character flicker with every breakdown |
| Fixed threshold | 3.2 dB in the tuning set; stored in a config file | A consistently heavy set should stay peak, not be re-labelled relative to itself |
| **Slow in, fast out** | Peak only after sub-dominance has held above threshold for 60 kick-playing seconds; back to main as soon as it drops | A low-pass filter sweep cuts 60–150 Hz but not the sub, faking sub-dominance for as long as the sweep lasts — and I ride the filter regularly in builds and blends. No static spectral check told a filtered stretch from a dark peak track |
| **Breakdown** | Kicks absent for 8 bars (15 s without a tempo) → organic at the next bar line | Breakdowns are the moment people notice. 2 bars (until 2026-10-02) caught transition gaps, fills and soft kicks: a live set flipped scenes every few seconds (spike-findings §6) |
| **Drop** | Kicks return after a breakdown → a preset immediately (§6 director rules) | So is the drop |
| Idle | Near-silence for 3 seconds | Stops, pauses and B2B handovers |
| **Interlude by busyness, not by kicks or tempo** | Added 2026-10-03 (spike-findings §7). Precedence: idle, interlude, breakdown, peak, main | Ambient music fakes kicks (drone swells, ripples in an empty sub band) and the clock folds any gaps into a plausible tempo, so "no kick" and "< 115 BPM" never fire; rumbling techno hides its kick from every sub-band beat test tried. Busyness never fell below 1.03 over 30 s in the user's sets and sat under 0.9 for ~90% of an ambient mix |

**Known limitations (accepted 2026-10-01):**

- **Deep and driving are indistinguishable** — loudness, kick continuity, brightness, mids and sub all overlap. A deep section with a steady kick gets geometric visuals; organic appears only when the kick is actually missing. **No longer accepted (2026-10-03):** the user wants deep and driving to look different; how to detect it is open.
- **About 2 minutes' lag into peak** (one minute to fill the window, one minute of entry hold), and **peaks shorter than ~2–3 minutes stay geometric** — the tuning set's 2-minute closing peak was never detected.
- **A bright peak reads as main** — e.g. an acid-heavy peak with a punchy mid-bass rather than a sub. My usual peaks are dark and sub-heavy, so this was accepted.
- **A filter sweep longer than ~1 minute can still fake peak**, and an EQ bass swap lowers sub-dominance during blends.
- **An interlude starts ~25–45 s into smooth music and ends ~10–20 s after it turns busy.** A long smooth breakdown (≥ ~25 s) becomes an interlude, and one can start just as the kick returns if the hats have not (Waterworks 58:06–58:40). Busyness is frame-to-frame, so it assumes ~60 fps.
- **Broken-beat passages (DnB, patchy drums) read as main.** The user wants them muddy and messy (15 picks noted 2026-10-03), but no tested measure tells broken drums from a steady kick on the user's sets: kick-interval regularity, beat coverage and pulse clarity all failed on set 4 (spike-findings §7). Deferred.
- **Tempo stays folded into 115–150 BPM.** 75–150 was agreed, then dropped on data: ~20% of detected onsets in the user's sets sit 3/4 of a beat apart, which 75–150 reads as ~85 BPM (spike-findings §7).

### Debug overlay

One key toggles an overlay showing bands, kicks, BPM, sub-dominance and character. It exists to tune thresholds; it is off by default and is not a performance control.

---

## 6. Scenes and the director

### Scene contract

```ts
interface Scene {
  id: string;
  family: 'organic' | 'geometric' | 'psychedelic' | 'idle';
  source: string;      // "original" or where it came from
  licence: string;
  enabled: boolean;
  init(gl: WebGL2RenderingContext, seed: number): void;
  render(time: number, features: Features, size: RenderSize): void;
  dispose(): void;
}
```

- **`size`** is the compositor's scaled render target, added in V1 because scenes render below canvas size when the render scale steps down (§7).
- **Deterministic by rule.** `time` comes from the session clock and all randomness from `seed`. `Date.now()` and `Math.random()` are forbidden in scenes — this is what makes after-set rendering reproduce the night.
- **The scene file is the single source of truth** for its metadata. The registry discovers scene modules automatically; there is no separate manifest to drift.
- **Butterchurn presets** are wrapped as scenes. Butterchurn draws into its own canvas, which the compositor uploads as a texture each frame so the flash limiter still governs it. The per-frame copy costs GPU time — measured in spike 3 and affordable: shader plus copy held 60 fps at 1080p for 30 minutes. Butterchurn runs its own audio analysis, so these presets react in MilkDrop's way rather than to our features; acceptable for the one family meant to be wild.
- **Every scene is warmed before the set.** `Compositor.warmUp` runs each scene through what a live switch does — `init`, one frame off-screen, `dispose`. For presets that means the 4 s Butterchurn blend, because the GPU builds the blended pipeline at the first draw that uses it. Skipping the warm-up costs 33–200 ms at a scene's first showing (spike-findings §6, §11).

### V1 inventory

| Family | Shown for (§5) | Count | Source |
|---|---|---|---|
| Organic / mathematical | Breakdowns | 3 | Original shaders |
| Geometric light | Main | 4 | Original shaders: rings, lasers, glitch, shards (hexgrid off since 2026-10-02 — too dim, too alike between showings); presets take `mainPresetShare` (55%) of main picks |
| Psychedelic liquid | Peak | 8–15 | Curated Butterchurn presets |
| Interlude pool (across families) | Ambient interludes | 14 | The user's picks (2026-10-03, `scenes/interlude.ts`): organic curves and flow, 11 rotation presets, and *martin – castle in the air*, shown only in interludes |
| Idle drift | Silence | 1 | Slowed, dimmed organic scene |

Scenes are written fresh rather than ported from Shadertoy, whose default licence restricts reuse: shaders without a stated licence are **CC BY-NC-SA 3.0 Unported** (confirmed 2026-10-01 from shadertoy.com/terms "What license will my Shaders have?", read via a search-engine copy because the page blocks direct fetches) — non-commercial only, attribution, and derivatives under the same licence. Keeping scene code clean preserves the option to publish the repo later. Anything borrowed records its source and licence in the scene file.

### Director rules

| Event | Action | Timing | Crossfade |
|---|---|---|---|
| Character changes (main ↔ peak) | Pick a scene from the new family — only once the current scene has shown for `director.minStayS` (60 s), so a drop is not demoted seconds after it lands | Next bar line | 4 beats |
| Breakdown | Switch to organic | Next bar line | 8 beats |
| Drop | A preset: the one shown before the breakdown if there was one, else a new pick; geometric only without Butterchurn. The previous family is restored underneath, so the next character change or rotation follows it | Immediately — not the next bar line, since V1 bar lines can be 1–3 beats off (decided 2026-10-01) | None: a hard cut on the kick (2026-10-02 — a 2-beat fade back to the same preset felt too soft) |
| 64 bars in one scene | Next scene in the same family | Next bar line | Family default |
| Surge while a geometric scene shows in main | A preset; rotations during the surge also pick presets | Next bar line, not waiting out the minimum stay | 2 beats |
| Silence 3 s / audio returns | Enter / leave idle drift | Immediately | ~4 seconds (no beat clock in silence) |
| Interlude starts | A scene from the interlude pool | Immediately | 15 s |
| 120 s in one interlude scene | Next scene in the pool, least recently shown | Immediately (no beat to wait for) | 15 s — slow on purpose: the user asked for slower than 60 s |
| Interlude ends | The wanted family | Immediately | None: a hard cut, like the drop (user, 2026-10-03) |

Selection is a seeded shuffle within the family, least-recently-shown first, never repeating the current scene. A main pick is a Butterchurn preset with probability `director.mainPresetShare` (55%), else geometric; the family stays main, so moving to peak is still a character change. Each shader scene draws its shape — counts, symmetry, size, palette — from its seed, so a repeat showing looks different, not only recoloured. Every decision is appended to the scene log: `{time, bar, event, sceneId, seed, level, crossfadeBeats}`.

### Flash limiter

Lives in the compositor so no scene — original or borrowed — can bypass it. Each frame is downscaled to an **8 × 6 grid of tiles** (~240 × 180 px each at 1080p). Per tile it measures relative luminance and whether the tile is saturated red. A **change** is a tile's luminance moving ≥ 0.10 back from its brightest or darkest point since its last change, while the darker side is below 0.80 — **however many frames it takes**. It also counts when the tile moves into or out of saturated red, far enough in chromaticity from its colour at its last red change. As in WCAG, a **flash** is a pair of opposing changes. Brightness and red share **one budget: once any tile has had three flashes (six changes) inside any one-second window, further changes are damped across the whole frame** (whole frame, so the damping leaves no seams). Changes are counted 0.01 early, because the wall's 8-bit output can sit about 0.005 from the limiter's own record of it. *Revised 2026-10-01 after the V1 review:* the first version counted only jumps between consecutive frames, so a smooth 4–6 Hz swing (a preset pulsing at hi-hat rate) passed untouched, at up to 13 changes a second. Counting every jump instead of pairs would also have damped an ordinary kick pulse — a rise and a fall per beat is 4.3 changes a second at 128 BPM — which breaks R1. So the limiter counts pairs, as WCAG does. It is stricter than the standard in two ways: tiles are smaller than WCAG's area threshold, and brightness and red share one budget where WCAG allows three of each. Tiles finer than the area threshold can only over-count, which is the safe direction for any reasonable wall size.

**Verified 2026-10-01 against WCAG 2.2 SC 2.3.1 "Three Flashes or Below Threshold" (Level A, [w3.org Understanding page](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)):** content must not flash "more than three times in any one second period" unless below the thresholds. A general flash is "a pair of opposing changes in relative luminance of 10% or more of the maximum relative luminance (1.0) where the relative luminance of the darker image is below 0.80" — so the jump threshold is **0.10 relative luminance**, applied only when the darker frame is below 0.80. **Red flashes** count too: transitions involving saturated red (R/(R+G+B) ≥ 0.8, chromaticity change > 0.2 in CIE 1976 UCS) — psychedelic presets are the likely source. **Area:** flashes count when they cover more than 25% of any 10° visual field (WCAG's desktop stand-in: 341 × 256 px). On a wall, 10° is a fraction of the image (about 0.5 m across at 3 m), which is why the limiter measures tiles rather than the whole frame — a whole-frame mean barely moves for a large local flash.

### Curation page

A separate page that plays any scene against live audio or a saved audio file, with keys to step through scenes and toggle `enabled`. This is how Butterchurn presets are chosen and how each new original scene is signed off — by eye, on the wall.

---

## 7. Launch, unattended running and failure handling

### One-time manual setup

1. Install BlackHole 2ch from its official repository, then `sudo killall coreaudiod` — it does not appear as a device until Core Audio restarts.
2. In Audio MIDI Setup, set BlackHole 2ch to **44.1 kHz**, matching rekordbox's sample-rate preference. A mismatch makes **master itself play fast** (spike 1).
3. Set the projector display's wallpaper to solid black, so a Chrome crash shows black rather than the desktop.

PC MASTER OUT is **not** left on permanently: with it on, every rekordbox launch sends a copy of the mix to whatever the Mac output is — normally the laptop speakers, which then play a second copy (spike 1).

### The launcher

1. **Pre-flight (read-only).** BlackHole present **at 44.1 kHz** and an external display connected, or a macOS dialog explains what is missing and the launch stops — the rate check protects master speed. rekordbox not running → warning only.
2. **Audio output.** Switch the Mac default output to BlackHole and **restore the previous device on exit**, then a dialog: *"Turn PC MASTER OUT on in rekordbox (off and on again if it already is)."* rekordbox picks its copy target only at launch or when PC MASTER OUT is switched on — not when the output changes (spike 1) — so the toggle must come after this step. The launcher never touches rekordbox itself (decided 2026-10-01: manual toggle every session, over launching or restarting rekordbox). rekordbox's own device (the FLX4) is never touched, so master and cue cannot be affected. While a session runs, other Mac sound (notifications, a browser tab) goes silently into BlackHole and into the analysis — accepted.
3. **`caffeinate -d`** for the session, so the display never sleeps.
4. **Start the local server.**
5. **Open Chrome** in ordinary fullscreen on the external display, using a **dedicated profile** that only ever loads localhost, with audio capture pre-granted. No permission prompt, extensions or restore-tabs dialog in front of guests. Ordinary fullscreen, not kiosk (decided 2026-10-01), so Cmd-Ctrl-F leaves and re-enters it; a watchdog relaunch still comes back fullscreen. Kiosk hid two bars that ordinary fullscreen shows, so the launcher sets the profile to hide the toolbar in fullscreen and grants the mic to the page there, instead of the `--use-fake-ui-for-media-stream` flag that raises a warning bar (spike-findings §5). Chromium's throttling of hidden windows is switched off, so the wall never freezes when the laptop screen is used for rekordbox — in spike 3 the page stopped drawing for 12–36 s when it lost the screen (flags to verify, §11).
6. **Watchdog:** if Chrome exits without `/quit` having been called, relaunch it. Also relaunch it if the page has posted no log for 30 s (the server's `/age`). A crashed renderer ("Aw, Snap!") or a hung page leaves the Chrome process alive, and a drawing page logs every 5 s.

### Runtime failures

| Failure | Response |
|---|---|
| Scene fails to compile or throws | Disabled for the session and logged; director picks another. A family with no working scenes falls back to idle drift |
| WebGL context lost | Reload the page, which rebuilds the context and every scene. Rebuilding in place was dropped in V1: Butterchurn's own context has no loss handling, and scenes set up while the context is lost fail and would be disabled for the session |
| BlackHole cannot be opened at start | Retry every 2 s; idle drift meanwhile |
| Stream silent > 10 s (including a stream that ended), or a `devicechange` event | Reopen the stream in place, and again every 5 s while the silence lasts. An open stream can go silent with no error: opened at a rate rekordbox then changes (spike 1), or across a PC MASTER OUT toggle at the same rate (spike-findings §5). Reopening is invisible on the wall, so a paused deck or a B2B handover costs nothing, and recovery never rests on a single attempt. Replaced V1's one page reload per silence on 2026-10-01: once that reload was spent, a later toggle left idle drift all night |
| Frame time > 20 ms for 10 s | Step render scale down 100% → 83% → 67%; never back up within a session, to avoid oscillation; logged. Gaps in the frame clock count as slow frames — a page that draws nothing writes no frame times, which hid the spike 3 freezes from its report |
| Still > 20 ms for 10 s at 67% | Disable the current scene for the session and log it; the director picks another, as for a scene that throws. Spike 3 never left 100%, so this is a floor, not an expected path |
| Chrome crashes, or its page crashes or hangs | Watchdog relaunches (process gone, or no page log for 30 s); black wallpaper covers the gap |
| No audio in first 60 s | Small on-wall note: "No audio from BlackHole — is PC MASTER OUT on?" Shown only in that window |

### Ending a session

The quit key calls `/quit`. The launcher closes Chrome, restores the audio output, and stops the server and `caffeinate`.

There is **no reminder to switch PC MASTER OUT off** (decided 2026-10-01). If it is left on, the next rekordbox launch plays a second copy of the mix through the laptop speakers; switching PC MASTER OUT off stops it.

---

## 8. Recording and after-set rendering (V1.1)

- A second icon, **"VJ (record)"**, enables recording. It is opt-in because saving Spotify streams to disk is barred by Spotify's terms — the User Guidelines prohibit "copying, reproducing, redistributing, "ripping," recording, transferring…" Spotify content (checked 2026-10-01, spotify.com/uk/legal/user-guidelines); recorded sets use downloaded tracks.
- **During the set:** the recorder taps the BlackHole stream with `MediaRecorder` and posts chunks every 10 s; the server appends them to `recordings/<session>/`. The scene log and a `session.json` (seeds, thresholds, code version) sit alongside. Negligible extra load.
- **`vj render <session>`:** runs the engine in render mode, stepping time at a fixed frame interval over the decoded audio, **replaying the logged director decisions** rather than re-deciding, so the video matches what the wall showed. Frames are encoded in-browser (WebCodecs) and ffmpeg muxes the audio.
- **Butterchurn can be fed pre-computed audio** (confirmed 2026-10-01 by reading 2.6.7's source, not yet run): `visualizer.render({ audioLevels: { timeByteArray, timeByteArrayL, timeByteArrayR }, elapsedTime })` skips its own analyser and uses the given time step.
- **But Butterchurn is not deterministic:** it calls `Math.random()` in 29 places — per-preset `rand_start`/`rand_preset`, noise textures, blend-mode choice, and the global `rand()` that preset equations use. A re-render will not match the night. **Hypothesis:** swapping `Math.random` for a seeded generator around each Butterchurn call (and preset load) makes it reproducible; test by rendering the same preset and audio twice and comparing frames. If not, psychedelic segments render in real time and are not frame-exact.

---

## 9. Testing

| Layer | What | How |
|---|---|---|
| Automated (Vitest), synthetic audio only | 128 BPM click track locks within ±0.5 BPM; removing kicks triggers breakdown after 8 bars, a shorter gap does not; bassline notes in a breakdown are not kicks; peak entry hold and immediate exit; director follows its table; flash limiter caps alternating black/white frames at ≤3/s, an equal-luminance red/blue strobe, and a strobe confined to one tile; same seed and time → identical director output | No copyrighted audio in the repo |
| Tuning | Thresholds against my own tracks | Local, gitignored audio |
| Thermal soak | 1 hour, a live set | Frame-time and render-scale logs — **passed 2026-10-02**, set 4: 58 min, no frame gaps, render scale 1 throughout, last-10-min p95 17.6 ms |
| Manual acceptance | V1 definition of done (§2) | Real session |

---

## 10. Phasing

| Phase | Contents | Exit |
|---|---|---|
| **0 — Spike (throwaway)** | (1) PC MASTER OUT → BlackHole with the FLX4, Spotify and local tracks: which device it targets, cue unaffected. (2) Browser energy detection on 30 min of my music, graphed: does it separate deep / driving / peak? (3) One shader plus the Butterchurn texture copy at 1080p for 30 min with rekordbox running: frame times and throttling. (4) Is Ableton Link available in rekordbox on this setup? (V3 input only) | Findings note and starting thresholds. **Any failure reopens this design** |
| **1 — V1** | Engine, 3 + 3 original scenes, Butterchurn presets, director, compositor and flash limiter, launcher, failure handling, curation page | V1 definition of done — **Done 2026-10-03** (spike-findings §8: a 3.5-hour house-party set) |
| **1.1** | Recording and after-set rendering | First rendered set video |
| **2** | Track-change awareness from FLX4 MIDI (load, play, channel faders, crossfader). First verify rekordbox does not hold the controller's MIDI exclusively | A new track brings a new scene |
| **3** | Ableton Link bar clock; changes aligned to bars and phrases | Scene changes land on the true bar |
| Ongoing | New original scenes | — |

---

## 11. Open hypotheses

Each is unproven until its test runs.

| Hypothesis | Cheapest disproving test |
|---|---|
| PC MASTER OUT delivers a clean copy of master (without cue) to BlackHole while the FLX4 stays primary | **Confirmed 2026-10-01** — spike-findings §1 (copy is pre-master-knob) |
| rekordbox does not silence PC MASTER OUT for Spotify tracks | **Confirmed 2026-10-01** — spike-findings §1; local files not yet tested |
| ~~Browser analysis separates the three energy levels on this music~~ | **Disproved by spike 2** — only peak is separable; replaced by the character model (§5) |
| Sub-dominance marks my peaks on sets other than the tuning set, and filter sweeps rarely outlast the 60 s entry hold | **Open** — failed 2026-10-03 against 15-minute-grid labels on a Max Cooper recording (spike-findings §7), not a fair verdict. Next: re-label that recording to the half-minute, or label one of my own sets. **Deferred past V1** (2026-10-04): the 3.5-hour house-party set read peak ~19 min with no complaint, but was unlabelled (spike-findings §8) |
| The fanless Air sustains 1080p plus the Butterchurn copy alongside rekordbox | **Confirmed 2026-10-01** — spike-findings §3 (31 min, median p95 17.5 ms, thermal Nominal; autumn room) — and for a 58-minute live set with presets on screen 86% of the time, 2026-10-02 (spike-findings §6), and a 3.5-hour house-party set at render scale 1 throughout, 2026-10-03 (spike-findings §8) |
| Butterchurn's first-load stall is a one-off per preset, so loading each preset once before the set removes it | **Disproved, fixed** — the old warm-up loaded presets with blend 0, but a live switch blends, so the GPU built the blended pipeline at the first draw mid-set. Warm-up now runs every scene through `init` + one frame + `dispose`: cold first showings 33–117 ms → ≤ 33 ms. About 5–20 ms of Butterchurn JS per load remains, and removing it needs a patch (spike-findings §6). **Live check passed 2026-10-03:** median 33 ms (one dropped frame) at 115 preset entries, worst 66 ms (spike-findings §8) |
| Chromium stops drawing a window macOS reports as hidden; launch flags such as `--disable-backgrounding-occluded-windows` and `--disable-renderer-backgrounding` prevent it (flag names unverified) | **Partly tested 2026-10-01** (spike-findings §5): with the launcher's flags, no gaps over 45 s of rekordbox use, Cmd-Tab and Spaces; one unexplained 10.4 s stall earlier in the session. No gaps over 3.5 hours of live rekordbox use, 2026-10-03 (spike-findings §8) |
| The picture's lag behind the sound is too small to notice on the projector | **Not noticeable at normal speed 2026-10-01** (spike-findings §5); not measured — to measure, film a speaker cone and the wall together |
| ~~Butterchurn accepts pre-computed audio per frame~~ | **Confirmed by source read 2026-10-01** (§8) |
| A seeded `Math.random` swap makes Butterchurn reproducible | Before V1.1: render one preset over the same audio twice, compare frames (§8) |
| rekordbox exposes Ableton Link on this plan and controller | **Confirmed 2026-10-01** — spike-findings §4 (no Ableton Live needed) |
| rekordbox's Link phase 0 falls on the track's beat-grid downbeat | Before V3: print each phase wrap from `spike/link_probe.py`, compare with rekordbox's bar counter (spike-findings §4) |
| A dj-vj Link peer that only reads never moves rekordbox's tempo, whichever side joins first | Before V3: start the probe with `Link(100)`, then turn rekordbox LINK on with a deck at 124 (spike-findings §4) |
| ~~Toggling PC MASTER OUT while BlackHole is already at 44.1 kHz does not silence a stream that is already open~~ | **Disproved 2026-10-01** — spike-findings §5: the open stream stays silent until a reload |
| Reopening the stream in place recovers it after a same-rate PC MASTER OUT toggle | **Confirmed 2026-10-02** — two toggles on rekordbox, each recovered on the first reopen, sound back ~3 s after it (spike-findings §5) |
| A Chrome relaunched by the watchdog shows no "Restore pages?" bubble on the kiosk window | **Confirmed 2026-10-01** — spike-findings §5 |
| In ordinary fullscreen, `--hide-crash-restore-bubble` keeps the bubble off a relaunched window, and `--window-position` with `--start-fullscreen` lands on the projector | **Confirmed 2026-10-02** — fullscreen on the projector with no bar; `kill -9` relaunched in 1 s with no bubble (spike-findings §5) |
| Other apps can read FLX4 MIDI while rekordbox runs | Start of Phase 2 |
| The kick detector finds the kick in rumbling techno | **Disproved 2026-10-03** on set 4's opening and minutes 44–47: ~100 onsets a minute at 138 BPM with only 9–20% of gaps one beat long, whichever band (sub, bass, both) it listens to (spike-findings §7). 115–150 hides it by discarding gaps; any wider tempo range exposes it. Next test needs raw audio of a set, not the 60 Hz six-band log |
| Busyness separates ambient interludes from the user's techno on live sets, not only on the logs it was set on | The next set with an interlude, on the dev page with `?features=1` (the launcher stopped logging features 2026-10-04): `features.jsonl` replayed with `REPLAY=`, interlude spans against the user's notes. 2026-10-03: 10 interludes in 3.5 hours, no notes kept — the user played ambient once or twice, otherwise chill tracks after unmixed switches (spike-findings §8) |

---

## 12. Do NOT

- **Do NOT route rekordbox's primary output through a Multi-Output or aggregate device.** It is the one change that can break headphone cue; the visuals must listen to a copy only.
- **Do NOT use `Date.now()` or `Math.random()` inside a scene.** It silently breaks after-set rendering.
- **Do NOT enforce flash limits per scene.** The compositor owns it, so borrowed presets cannot bypass it.
- **Do NOT make any scene or feature depend on the drum machine or DJ Set Architect.**
- **Do NOT modify, re-sign or memory-read rekordbox.** V3 uses Ableton Link, a supported interface.
- **Do NOT write to Ableton Link.** Every peer can set the shared tempo, and a rekordbox deck with LINK on follows it — a dj-vj that sets tempo, or wins the session at its own tempo, retimes the track playing (spike-findings §4).
- **Do NOT commit audio files.** Tests use synthetic signals; tuning audio stays local.
- **Do NOT add live controls.** The session is fully automatic by decision; the only key is quit (plus the tuning overlay, off by default).
