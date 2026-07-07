# Architecture Review — Music-Synced Freerunning Game

Date: 2026-07-05. Reviewed: all of `src/` + `docs/music-sync.md`, `docs/music.md`, `docs/art-brief.md`.
This is a concept/plan document — no code. Each issue lists fix options; the recommended one is marked.
Implementation order suggestion is at the bottom.

Context: the game's goal is that gameplay tempo follows the song ("dance game" feel). The
audio-clock wave spawning from `docs/music-sync.md` is implemented in `ObstacleSpawner`.

---

## Critical Issues

### C1. Variable player speed breaks on-beat arrival (core rhythm-game conflict)

**Where:** `ObstacleSpawner.update()` computes `travelMs = distance / speed` using the player's
speed **at spawn time**, then moves obstacles each frame by the player's **current** speed.

**Problem:** Player speed changes constantly (tap accel 50 px/tap, decel 125 px/s, range 200–600).
An obstacle spawned while the player is fast but crossed while the player slows down arrives far
off the beat — up to ~1–2 seconds of error over a 500 px flight. For a rhythm game this destroys
the whole premise: obstacles will almost never actually arrive on the beat.

**Options:**

- **Option A — Recommended: derive obstacle X directly from the audio clock.**
  Each obstacle's position is a pure function of song time:
  `x = PLAYER_X + (arrivalMs − audioMs) × approachSpeed`, where `approachSpeed` is a fixed
  constant (px per ms) independent of the player. The obstacle *always* crosses the player
  exactly at `arrivalMs`, regardless of frame drops, pauses, or player speed. This is exactly how
  note highways in dance/rhythm games work (notes are positioned from song time, not integrated
  velocity). Player speed then no longer scrolls obstacles — it only affects the background
  parallax and the chasing enemy (see C2/D1).
  - Trade-off: player speed and world scroll visually decouple (obstacles approach at constant
    speed while background scroll speed varies). In practice players don't notice; it also makes
    the game *feel* more rhythmic because obstacle cadence becomes perfectly regular.
  - Bonus: seeking/looping the song "just works" — obstacle positions are recomputed from
    `audioMs` every frame, no spawn bookkeeping needed for correctness (a spawn Set is still
    handy for creating/destroying the rect objects).

- **Option B — Best Practice for pure runners: fix the world scroll speed entirely.**
  Make world speed constant (e.g. locked to the song's BPM) and repurpose alternating taps:
  instead of speeding the world up, taps push the chasing enemy back / build a stamina meter.
  This is the industry-standard rhythm-runner design (constant note speed) and simplifies
  everything (one speed, exact travel time, background and obstacles stay coherent).
  - Trade-off: bigger design change; the "run faster by tapping" fantasy becomes indirect.

- **Option C — keep current behavior, re-time in flight.** Every frame, re-solve each in-flight
  obstacle's velocity so it still arrives at `arrivalMs`. Works, but it makes obstacle speed
  visibly rubber-band as the player taps, and it's more math for a worse feel than A. Not
  recommended.

---

### C2. Enemy speed is permanently boosted after touching the left boundary

**Where:** `Enemy.update()` — when `x < −ENEMY_HW`, it clamps position **and sets
`this.speed = MAX_SPEED − 20` (580) forever**. It never resets to `ENEMY_SPEED` (400).

**Problem:** After the first time the enemy falls off-screen (which happens quickly whenever the
player taps fast), the enemy chases at 580 px/s for the rest of the run. The player can only
reach 600 max and decays at 125/s, so escape becomes nearly impossible and the difficulty curve
is a hidden one-way ratchet. Looks like a leftover experiment rather than intent.

**Options:**

- **Option A — Recommended:** reset `speed = ENEMY_SPEED` once the enemy is back on screen
  (i.e., when not at the boundary). Boundary boost becomes a temporary "catch-up" rubber-band —
  a standard chase-cam trick.
- **Option B — Best Practice:** replace the boolean boost with a distance-based rubber-band:
  enemy speed = f(distance behind player), clamped to `[ENEMY_MIN, MAX_SPEED − margin]`.
  Smoother, tunable, no branching state. Slightly more tuning work.
- Related design note: `trackY` snaps the enemy to the player's row instantly, so rows never help
  against the enemy. Consider a lag (enemy changes row on the beat — fits the dance theme) —
  see D1.

---

### C3. Music autoplay lock desyncs the first run

**Where:** `GameScene.create()` calls `music.play()` immediately; `BootScene` auto-starts
`GameScene` with no user interaction.

**Problem:** Browsers block audio until a user gesture. Phaser queues the sound and unlocks on
first input, but until then `audio.seek` stays 0 while `update()` runs — the spawner treats the
song as frozen at 0 ms and holds/spawns wave-0 obstacles against a clock that isn't advancing.
The first seconds of the first run are undefined behavior; on a fresh page load the game and
music start out of sync.

**Options:**

- **Option A — Recommended:** add a "Press any key / click to start" step (in `BootScene` or a
  tiny `TitleScene`) and only start `GameScene` + music after that gesture. One screen, solves
  autoplay everywhere, and gives you a natural home for instructions later.
- **Option B:** listen for Phaser's sound-unlocked event and freeze gameplay (don't run spawner /
  score / enemy) until the music is actually playing. Less UI work but more conditional state in
  `GameScene`; you'll want a start screen eventually anyway.

---

## Architecture Improvements (for the dance-game goal)

### A1. No beat/conductor abstraction — timing is raw milliseconds everywhere

**Where:** `waves.js` hardcodes ms (`5600`, `700`, `1400` — clearly 700 ms ≈ one beat at ~85.7
BPM, or a half-beat at ~171 BPM); `ObstacleSpawner` reads the audio clock directly; nothing else
can know about beats.

**Problem:** For "gameplay follows the song," beat knowledge must be shared: input judgment
(A2), enemy movement, visual pulses, spawn authoring. Right now every future feature would
re-derive timing from ms by hand, and re-authoring waves for a different track means recomputing
every number.

**Options:**

- **Option A — Recommended: a small `Conductor` (music clock) service.**
  One module owning: the music object, `BPM`, `FIRST_BEAT_OFFSET_MS`, and an
  `AUDIO_LATENCY_OFFSET_MS` calibration constant (all in `gameConfig.js`). It exposes
  `songTimeMs`, `currentBeat` (float), `beatDurationMs`, helpers like `timeToNearestBeat()`, and
  emits `beat` / `bar` events. `GameScene`, `ObstacleSpawner`, `Player`, and `Enemy` consume it
  instead of touching `this.music.seek` directly. Waves get authored in **beats**
  (`{ beat: 8, row: 0, … }`) and the Conductor converts to ms — swapping songs becomes changing
  BPM + offset, not rewriting every number.
- **Option B — minimal:** keep ms authoring but centralize the clock read: one
  `getSongTimeMs()` helper (music seek + latency offset) used by everyone, plus exported
  `BEAT_MS` so waves can be written as `beat * BEAT_MS` expressions. Less new structure, but
  beat events and judgment windows (A2) will force Option A's shape soon anyway.

The Conductor is the single highest-leverage change for your stated goal — most items below
assume it exists.

### A2. Player input is not connected to the beat (the actual "dance game" mechanic)

**Where:** `Player.update()` — any alternating L/R tap adds 50 speed, any time.

**Problem:** The stated vision is that *playing* feels like a dance game, but currently only the
obstacles know about music. Taps are rhythm-free mashing; the optimal strategy is to tap as fast
as possible, which fights the music instead of following it.

**Options:**

- **Option A — Recommended: beat-judged taps.** Compare each tap's song time to the nearest
  beat via the Conductor: within ±X ms = "on beat" (full accel + combo count), otherwise weak or
  zero accel. Combos multiply score or acceleration. This single change converts the run
  mechanic into a rhythm mechanic and naturally caps tap rate at the song tempo. Show judgment
  feedback (Perfect/Good/Miss text or a pulse on the player).
- **Option B — Best Practice: full judgment system.** Timing windows per grade
  (Perfect/Great/Good/Miss), calibration screen for input+audio latency, combo/health meters —
  the DDR-style stack. The right end state, but a lot at once; build it on top of Option A.
- Design choice to make either way: is tapping on **every beat** (steady 8th-note running) or on
  **accented beats** the target? Affects window width and BPM choice.

### A3. Player dimensions duplicated between `gameConfig.js` and `Player.js`

**Where:** `PLAYER_HW`/`PLAYER_HH` in config carry a "must match Player.js HALF_W / HALF_H"
comment; `Player.js` re-declares 35/35 locally.

- **Option A — Recommended:** `Player.js` imports `PLAYER_HW`/`PLAYER_HH` from config; delete
  the local constants and the comment. Trivial, removes a real drift risk (the spawner's
  one-row collision math in `_spawnAt` depends on `PLAYER_HH` being right).
- **Option B:** move them onto the `Player` class as static fields and have the config/spawner
  import from Player. Same effect; pick one owner. Config is already the declared "single source
  of truth," so A.

### A4. Wave data model: `hh` is visual-only, collision is hardcoded to one row

**Where:** `waves.js` comment "hh is visual only; collision is always 1 row regardless";
`_spawnAt` derives `collisionHh = ROW_HEIGHT − PLAYER_HH − 1` and clamps a separate visual Y.

**Problem:** The field named like a collision half-height silently isn't one; the top/bottom
"walls" in `gap_run` (row 0 + row 4, hh 54) *look* like they block multiple rows but only block
one. A future author (or agent) editing waves will get this wrong.

**Options:**

- **Option A — Recommended:** rename the field to `visualHh` in wave data and spawner, and add
  an optional `rows: n` (default 1) that expands collision to n rows when a wall really should
  block several. Keeps the "collision = whole rows" simplification, makes the data honest.
- **Option B:** make collision honor real `hh` again (pure AABB, no row snapping). More
  flexible, but breaks the clean row-based dodge design you just built and makes near-miss
  authoring harder. Not recommended for this game.

### A5. Fake-3D depth (from art-brief) not implemented — plan for it now

**Where:** `docs/art-brief.md` promises scale-by-row (60%→100%) and engine drop shadows; the
code renders same-size rectangles with no depth ordering (creation order decides overlap, so an
obstacle in a back row can draw on top of the player standing in a front row).

**Options:**

- **Option A — Recommended:** introduce a tiny shared helper now (e.g. row → {y, scale, depth}):
  `depth = row` (or `y`) applied via `setDepth()` to player, enemy, obstacles; scale table per
  the art brief; a shadow ellipse under each object. Do it while everything is still rectangles
  so sprites drop in later without touching game logic.
- **Option B:** wait for real sprites and do depth+scale+shadows in one art pass. Less churn
  now, but current row overlap rendering is already visibly wrong in `gap_run`-style waves, and
  collision tuning (hw/hh vs. visual scale) is easier to settle before art lands.

### A6. Two clocks: score/gameplay uses game time, obstacles use audio time

**Where:** `GameScene.update()` scores by `time − startTime` (Phaser clock); spawner runs on
`music.seek`. The music loops but `WAVES` covers only ~18.2 s, so if the track is longer than
the waves there is dead air; when the loop restarts, waves replay (the `spawned` reset on
seek-backwards handles this).

**Problem:** Not a bug today, but pause, tab-blur (Phaser pauses the sound, game clock choices
differ), and "song position" UI all get confusing with two time bases. Also the song-loop /
survival-score combination is an undecided design: is a run "one song = one level" or endless?

**Options:**

- **Option A — Recommended:** make the Conductor's song time the *only* gameplay clock (score,
  waves, enemy pacing). Decide: **song = level** — when the track ends, that's a clear/win
  screen; death before the end shows progress %. This matches the dance-game framing and makes
  wave authoring finite and meaningful.
- **Option B:** endless mode — keep looping, keep survival-seconds score, and make waves cycle
  with escalating modifiers (denser obstacles per loop). Fine as a mode later; harder to author
  well.

---

## Minor / Cleanup

- **M1. Missing `Phaser` import in `ObstacleSpawner.js`** — `Phaser.Math.Clamp` relies on the
  UMD global leaking from another module's import. Works today, breaks under stricter bundling.
  Fix: add the import (or use a plain `Math.min/max` clamp).
- **M2. Dead config:** `SPAWN_INTERVAL_MS` is unused since wave-driven spawning landed. Delete.
- **M3. Duplicated game-over sequence** in `GameScene.update()` (enemy hit vs. obstacle hit) —
  extract one `endRun()` path; it will grow (stop music? hit sound? freeze frame).
- **M4. Spawner scans all waves × obstacles every frame.** Harmless at this size; if waves grow
  to a full song, keep a cursor index per wave (events are already required to be sorted). Only
  do this when authoring a full track (YAGNI until then).
- **M5. CLAUDE.md is stale:** it still describes `ObstacleSpawner` as "spawns random obstacles
  on a timer" and doesn't mention `Enemy`, `waves.js`, rows, or the music clock. Update after
  the next structural change.
- **M6. Single audio format:** `music.m4a` only. Fine for modern browsers; optionally provide
  `.ogg` fallback via Phaser's multi-URL audio load if you ever hit a codec complaint.
- **M7. `GameOverScene` restart replays from song start** — expected, but once "song = level"
  (A6-A) is chosen, also show progress % reached, not just seconds.

---

## Suggested Implementation Order (for the follow-up agent)

1. **C3** start-gesture screen (unblocks reliable audio clock for everything else)
2. **A1** Conductor service + move latency/BPM/offset into `gameConfig.js`
3. **C1 Option A** obstacle X derived from audio clock (uses Conductor)
4. **C2** enemy speed reset / rubber-band
5. **A2 Option A** beat-judged taps + judgment feedback
6. **A6 Option A** single clock + song-as-level decision
7. **A3, A4, M1–M3** cleanups
8. **A5** depth/scale/shadow helper (pre-art)
9. **M5** update CLAUDE.md to reflect the above

Items 1–5 are the minimum set that makes the game actually *feel* music-synced.
